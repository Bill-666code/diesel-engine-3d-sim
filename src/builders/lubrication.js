/**
 * builders/lubrication.js — 机油泵、机油滤清器、机油冷却器、油管路
 */
import * as THREE from 'three';
import { SPEC, D } from '../spec.js';
import * as G from '../geometry.js';
import { group } from '../geometry.js';
import { deg } from '../kinematics.js';

const S = SPEC;

export function buildLubrication(M, reg) {
  const root = group('lubrication');

  /* ---------------- 机油泵（转子泵） ---------------- */
  const pump = group('oilPump');
  const px = -0.228, py = -0.052, pz = 0.052;
  pump.add(G.roundedBox(0.086, 0.084, 0.076, 0.008, M.alloyCrankcase, { pos: [px, py, pz] }));
  // 泵盖 + 转子
  const rotorOuter = G.group('rotorOuter');
  const rotorInner = G.group('rotorInner');
  const lobe = (n, r0, r1, h) => {
    const sh = new THREE.Shape();
    for (let k = 0; k <= n; k++) {
      const a = (k / n) * Math.PI * 2;
      const a2 = ((k + 0.5) / n) * Math.PI * 2;
      const x = Math.cos(a) * r1, y = Math.sin(a) * r1;
      const x2 = Math.cos(a2) * r0, y2 = Math.sin(a2) * r0;
      if (k === 0) sh.moveTo(x, y); else sh.lineTo(x, y);
      sh.lineTo(x2, y2);
    }
    sh.closePath();
    return G.plate(sh, h, M.groundSteel);
  };
  rotorOuter.add(lobe(6, 0.016, 0.030, 0.024));
  rotorInner.add(lobe(5, 0.010, 0.021, 0.026));
  rotorOuter.position.set(px - 0.014, py + 0.006, pz);
  rotorInner.position.set(px - 0.014, py + 0.006, pz);
  rotorOuter.rotation.y = Math.PI / 2;
  rotorInner.rotation.y = Math.PI / 2;
  pump.add(rotorOuter, rotorInner);
  // 限压阀
  pump.add(G.cylinder(0.012, 0.012, 0.030, M.steelMatte, { seg: 18, pos: [px + 0.028, py + 0.052, pz] }));
  pump.add(G.pipe(0.008, 0.005, 0.026, M.steelMatte, { seg: 14, pos: [px - 0.030, py + 0.040, pz] }));
  reg.add('oilPump', pump, { explode: [-0.10, -0.16, 0.14] });

  /* ---------------- 机油滤清器 ---------------- */
  const filt = group('oilFilter');
  filt.add(G.lathe([
    [0, -0.090], [0.049, -0.090], [0.049, 0.086], [0.040, 0.104],
    [0.014, 0.104], [0.014, 0.112], [0, 0.112],
  ], M.filterCan, { seg: 30 }));
  filt.position.set(0.086, 0.010, 0.152);
  filt.rotation.z = Math.PI / 2;
  filt.rotation.y = 0.35;
  reg.add('oilFilter', filt, { explode: [0.05, 0.03, 0.20] });

  /* ---------------- 机油冷却器 ---------------- */
  const cooler = group('oilCooler');
  const cw = 0.130, ch = 0.120;
  cooler.add(G.roundedBox(0.052, ch, cw, 0.006, M.alloyCrankcase, { pos: [0, 0, 0] }));
  for (let k = 0; k < 14; k++) {
    cooler.add(G.roundedBox(0.060, 0.006, cw - 0.012, 0.002, M.steelMatte,
      { pos: [0, -ch / 2 + 0.010 + k * 0.0082, 0] }));
  }
  cooler.add(G.pipe(0.016, 0.013, 0.040, M.steelMatte, { seg: 18, axis: 'z', pos: [0, 0.070, 0] }));
  cooler.add(G.pipe(0.016, 0.013, 0.040, M.steelMatte, { seg: 18, axis: 'z', pos: [0, -0.070, 0] }));
  cooler.position.set(0.272, 0.020, -0.148);
  cooler.rotation.y = 0.2;
  reg.add('oilCooler', cooler, { explode: [0.10, 0, -0.18] });

  /* ---------------- 管路 ---------------- */
  const pipes = group('oilPipes');
  // 吸油管：油底壳集滤器 → 机油泵
  pipes.add(G.hose([
    [-0.010, -0.215, 0.000], [-0.090, -0.190, 0.010], [-0.190, -0.140, 0.030],
    [px + 0.010, py - 0.046, pz],
  ], 0.0125, M.steelMatte, { seg: 64 }));
  // 泵 → 滤清器
  pipes.add(G.hose([
    [px + 0.040, py + 0.010, pz + 0.020], [-0.150, -0.030, 0.120], [-0.020, 0.006, 0.150],
    [0.086 - 0.050, 0.010, 0.128],
  ], 0.0090, M.steelMatte, { seg: 56 }));
  // 滤清器 → 冷却器
  pipes.add(G.hose([
    [0.086 + 0.050, 0.016, 0.178], [0.180, 0.020, 0.170], [0.262, 0.040, 0.060],
    [0.272, 0.060, -0.086],
  ], 0.0085, M.steelMatte, { seg: 56 }));
  // 冷却器 → 主油道
  pipes.add(G.hose([
    [0.268, -0.048, -0.150], [0.210, -0.020, -0.120], [0.080, 0.020, -0.090],
    [-0.060, 0.052, -0.078], [S.oilGalleryY - 0.004, S.oilGalleryZ, -0.150],
  ], 0.0080, M.steelMatte, { seg: 60 }));
  // 机油压力传感器 + 油尺
  pipes.add(G.cylinder(0.010, 0.010, 0.030, M.steelMatte, { seg: 14, pos: [0.180, 0.060, 0.098] }));
  const dip = G.group('dipstick');
  dip.add(G.roundedBox(0.010, 0.010, 0.075, 0.003, M.steelMatte, { pos: [0, 0, 0] }));
  dip.add(G.cylinder(0.014, 0.014, 0.014, M.plastic, { seg: 16, pos: [0, 0.010, 0.048] }));
  dip.position.set(-0.150, -0.070, 0.108);
  pipes.add(dip);
  reg.add('oilPipes', pipes, { explode: [0, 0.10, 0.10] });

  root.add(pump, filt, cooler, pipes);

  return {
    root,
    update(state) {
      rotorOuter.rotation.y = Math.PI / 2 + deg(state.theta);
      rotorInner.rotation.y = Math.PI / 2 - deg(state.theta) * 1.25;
    },
  };
}
