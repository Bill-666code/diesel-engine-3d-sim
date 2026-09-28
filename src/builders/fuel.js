/**
 * builders/fuel.js — 高压油泵、喷油器、高压油管、燃油滤清器、输油管
 */
import * as THREE from 'three';
import { SPEC, D } from '../spec.js';
import * as G from '../geometry.js';
import { group } from '../geometry.js';
import { deg } from '../kinematics.js';

const S = SPEC;
const pumpX0 = -0.292, pumpX1 = -0.086;   // 油泵沿 X 布置
const pumpZ = 0.176;                        // 油泵中心 z（缸体 +Z 侧）
const pumpY = 0.092;
const injX = (i) => D.cylX[i] + 0.046;    // 喷油器 x
const injTipY = 0.2205;

export function buildFuel(M, reg) {
  const root = group('fuel');

  /* ---------------- 高压油泵 ---------------- */
  const pump = group('hpPump');
  pump.add(G.roundedBox(pumpX1 - pumpX0, 0.086, 0.062, 0.008, M.alloyCrankcase,
    { pos: [(pumpX0 + pumpX1) / 2, pumpY, pumpZ] }));
  pump.add(G.roundedBox(pumpX1 - pumpX0 - 0.02, 0.020, 0.050, 0.005, M.alloyCrankcase,
    { pos: [(pumpX0 + pumpX1) / 2, pumpY + 0.052, pumpZ] }));
  // 柱塞偶件（4 组）
  const plungers = [];
  for (let k = 0; k < 4; k++) {
    const px = pumpX0 + 0.030 + k * 0.048;
    pump.add(G.pipe(0.0145, 0.0120, 0.056, M.groundSteel, { axis: 'x', seg: 22, pos: [px, pumpY + 0.056, pumpZ] }));
    const pl = G.cylinder(0.0060, 0.0060, 0.034, M.groundSteel, { seg: 16, axis: 'y', pos: [px, pumpY + 0.062, pumpZ] });
    pump.add(pl);
    plungers.push(pl);
    // 出油阀 + 止回阀
    pump.add(G.pipe(0.0080, 0.0055, 0.020, M.bronze, { seg: 16, pos: [px, pumpY + 0.090, pumpZ] }));
  }
  // 泵体与缸体的安装法兰、喷油提前角调整器
  pump.add(G.roundedBox(0.030, 0.100, 0.030, 0.004, M.alloyCrankcase, { pos: [pumpX0 - 0.010, pumpY - 0.006, pumpZ - 0.042] }));
  pump.add(G.cylinder(0.014, 0.014, 0.024, M.steelMatte, { seg: 20, pos: [pumpX0 - 0.012, pumpY - 0.056, pumpZ - 0.042] }));
  // 调速器
  const gov = G.roundedBox(0.052, 0.060, 0.050, 0.006, M.alloyCrankcase, { pos: [pumpX1 + 0.034, pumpY, pumpZ] });
  pump.add(gov);
  // 输油口
  pump.add(G.pipe(0.010, 0.007, 0.030, M.steelMatte, { seg: 16, pos: [pumpX1 - 0.010, pumpY - 0.050, pumpZ] }));
  reg.add('hpPump', pump, { explode: [0, 0, 0.20] });

  /* ---------------- 高压油管 + 喷油器 ---------------- */
  const lineG = group('hpLines');
  const injG = group('injectors');
  const injectors = [];
  const injColor = M.steelMatte;

  for (let i = 0; i < S.nCyl; i++) {
    const px = pumpX0 + 0.030 + i * 0.048;
    const ix = injX(i);
    const top = new THREE.Vector3(px, pumpY + 0.100, pumpZ);
    const p1 = new THREE.Vector3(px, pumpY + 0.150, pumpZ - 0.010);
    const p2 = new THREE.Vector3(ix * 0.5 + px * 0.5, 0.330, pumpZ - 0.055);
    const p3 = new THREE.Vector3(ix, 0.318, 0.150);
    const p4 = new THREE.Vector3(ix, 0.302, 0.045);
    const p5 = new THREE.Vector3(ix, 0.296, 0.002);
    const line = G.tubeAlong([top, p1, p2, p3, p4, p5], 0.0032, M.groundSteel, { seg: 90, radial: 10 });
    lineG.add(line);
    // 管接头
    [top, p5].forEach((pt) => {
      const f = G.hexPrism(0.010, 0.014, M.steelMatte, { pos: [pt.x, pt.y + (pt === top ? 0.008 : -0.006), pt.z] });
      lineG.add(f);
    });

    /* 喷油器 */
    const inj = group('injector');
    inj.add(G.pipe(0.0140, 0.0080, 0.030, injColor, { seg: 22, pos: [0, 0.286, 0] }));
    inj.add(G.hexPrism(0.017, 0.014, injColor, { pos: [0, 0.262, 0] }));
    inj.add(G.hexPrism(0.019, 0.016, injColor, { pos: [0, 0.244, 0] }));
    inj.add(G.pipe(0.0090, 0.0045, 0.026, M.groundSteel, { seg: 18, pos: [0, 0.228, 0] }));
    // 多孔喷嘴
    const nozzle = G.lathe([
      [0, 0], [0.0030, 0], [0.0030, 0.006], [0.0060, 0.008], [0.0060, 0.012], [0, 0.012],
    ], M.ceramic, { seg: 16 });
    nozzle.position.set(0, injTipY - 0.006, 0);
    inj.add(nozzle);
    // 喷油器夹紧座
    inj.add(G.pipe(0.0230, 0.0160, 0.008, M.steelMatte, { seg: 20, pos: [0, 0.276, 0] }));
    // 回油管接头
    inj.add(G.pipe(0.0065, 0.004, 0.014, M.steelMatte, { seg: 14, pos: [0.019, 0.288, 0] }));
    inj.position.set(ix, 0, 0);
    injG.add(inj);
    injectors.push(inj);
  }
  reg.add('hpLine', lineG, { explode: [0, 0.22, 0.14] });
  reg.add('injector', injG, { explode: [0, 0.16, 0.10] });

  /* ---------------- 燃油滤清器 ---------------- */
  const ff = group('fuelFilter');
  ff.add(G.lathe([
    [0, -0.090], [0.052, -0.090], [0.052, 0.072], [0.044, 0.090],
    [0.016, 0.090], [0.016, 0.100], [0, 0.100],
  ], M.filterCan, { seg: 32, pos: [-0.360, 0.176, 0.130] }));
  ff.add(G.roundedBox(0.030, 0.040, 0.030, 0.004, M.filterCan, { pos: [-0.360, 0.100, 0.130] }));
  // 进/出油口
  ff.add(G.pipe(0.0085, 0.006, 0.026, M.steelMatte, { seg: 16, pos: [-0.360, 0.220, 0.130] }));
  reg.add('fuelFilter', ff, { explode: [-0.12, 0.05, 0.14] });

  // 低压输油管
  const feed = G.hose([
    [-0.360, 0.108, 0.130], [-0.372, 0.060, 0.168], [-0.352, 0.030, 0.196],
    [pumpX1 - 0.010, 0.042, pumpZ],
  ], 0.0060, M.rubber, { seg: 60 });
  reg.add('hpLine', feed, { explode: [0, 0, 0.20], pick: false });

  root.add(pump, lineG, injG, ff);

  return {
    root,
    update(state) {
      // 柱塞以曲轴 1/2 转速运动
      const ph = deg(state.theta) / 2;
      plungers.forEach((p) => {
        p.position.y = pumpY + 0.062 + Math.sin(ph + p.position.x * 40) * 0.006 * (0.35 + state.load);
      });
    },
  };
}
