/**
 * builders/cooling.js — 水泵、节温器、散热器、风扇、皮带、冷却水管路
 */
import * as THREE from 'three';
import { SPEC, D } from '../spec.js';
import * as G from '../geometry.js';
import { group } from '../geometry.js';
import { deg } from '../kinematics.js';

const S = SPEC;
const pumpPos = [-0.218, 0.030, 0.062];     // 水泵中心
const radPos = [-0.560, 0.130, 0.000];      // 散热器中心

export function buildCooling(M, reg) {
  const root = group('cooling');

  /* ---------------- 水泵 ---------------- */
  const pump = group('waterPump');
  pump.add(G.roundedBox(0.070, 0.082, 0.086, 0.010, M.alloyCrankcase, { pos: [0, 0, 0] }));
  // 蜗壳
  pump.add(G.volute(0.052, 0.076, 1.6, 0.030, M.alloyCrankcase, { axis: 'x', pos: [-0.034, 0.006, 0] }));
  pump.add(G.pipe(0.040, 0.034, 0.026, M.alloyCrankcase, { axis: 'x', seg: 28, pos: [-0.050, 0.006, 0] }));
  // 叶轮（可见）
  const imp = G.impeller(0.016, 0.048, 7, 0.030, M.rotor, { axis: 'x' });
  imp.position.set(-0.034, 0.006, 0);
  pump.add(imp);
  // 皮带轮
  const wpul = G.lathe([
    [0.010, 0.012], [0.036, 0.012], [0.036, 0.026], [0.062, 0.026],
    [0.062, 0.040], [0.036, 0.040], [0.036, 0.054], [0.010, 0.054],
  ], M.rotor, { axis: 'x', seg: 32, pos: [-0.082, 0.012, 0] });
  pump.add(wpul);
  pump.position.set(...pumpPos);
  reg.add('waterPump', pump, { explode: [-0.16, 0.03, 0.08] });

  /* ---------------- 风扇 + 皮带轮 ---------------- */
  const fanG = group('fan');
  const fanRotor = G.fan(0.168, 9, 0.026, M.plastic, { axis: 'x' });
  fanG.add(fanRotor);
  fanG.add(G.lathe([
    [0.010, -0.016], [0.036, -0.016], [0.036, -0.004], [0.080, -0.004],
    [0.080, 0.004], [0.036, 0.004], [0.036, 0.016], [0.010, 0.016],
  ], M.rotor, { axis: 'x', seg: 28, pos: [0.050, 0, 0] }));
  fanG.add(G.pipe(0.062, 0.020, 0.070, M.rotor, { axis: 'x', seg: 26, pos: [0.040, 0, 0] }));
  fanG.position.set(radPos[0] - 0.062, radPos[1] + 0.010, radPos[2]);
  reg.add('fan', fanG, { explode: [-0.34, 0.08, 0] });

  const shroud = group('shroud');
  shroud.add(G.pipe(0.188, 0.178, 0.070, M.plastic, { axis: 'x', seg: 44, pos: [radPos[0] - 0.062, radPos[1] + 0.010, radPos[2]] }));
  reg.add('fan', shroud, { explode: [-0.36, 0.10, 0], pick: false });

  /* ---------------- 散热器 ---------------- */
  const rad = group('radiator');
  const coreW = 0.030, coreH = 0.330, coreZ = 0.430;
  rad.add(G.roundedBox(coreW, coreH, coreZ, 0.006, M.alloyCrankcase, { pos: [0, 0, 0] }));
  // 芯组管片
  const finMat = new THREE.MeshStandardMaterial({ color: 0x3a3f45, metalness: 0.85, roughness: 0.55 });
  const finGeo = new THREE.BoxGeometry(0.016, 0.0014, coreZ - 0.02);
  const fins = new THREE.InstancedMesh(finGeo, finMat, 80);
  const dm = new THREE.Object3D();
  for (let k = 0; k < 80; k++) {
    dm.position.set(0, -coreH / 2 + 0.006 + k * (coreH - 0.012) / 79, 0);
    dm.updateMatrix();
    fins.setMatrixAt(k, dm.matrix);
  }
  fins.castShadow = true;
  rad.add(fins);
  // 上/下水室
  rad.add(G.roundedBox(0.052, 0.058, coreZ + 0.016, 0.012, M.plastic, { pos: [0, coreH / 2 + 0.024, 0] }));
  rad.add(G.roundedBox(0.052, 0.058, coreZ + 0.016, 0.012, M.plastic, { pos: [0, -coreH / 2 - 0.024, 0] }));
  rad.add(G.pipe(0.018, 0.015, 0.030, M.plastic, { seg: 18, axis: 'y', pos: [0, coreH / 2 + 0.056, -0.130] }));
  rad.add(G.cylinder(0.026, 0.026, 0.020, M.bronze, { seg: 20, axis: 'y', pos: [0, coreH / 2 + 0.048, -0.130] }));
  rad.position.set(...radPos);
  reg.add('radiator', rad, { explode: [-0.42, 0.12, 0] });

  /* ---------------- 节温器 ---------------- */
  const th = group('thermostat');
  th.add(G.roundedBox(0.052, 0.062, 0.058, 0.008, M.alloyCrankcase, { pos: [0, 0, 0] }));
  th.add(G.pipe(0.022, 0.018, 0.030, M.alloyCrankcase, { seg: 20, axis: 'x', pos: [-0.034, 0.010, 0] }));
  th.add(G.pipe(0.022, 0.018, 0.030, M.alloyCrankcase, { seg: 20, axis: 'z', pos: [0.010, 0.010, 0.034] }));
  const valve = G.lathe([
    [0, 0], [0.019, 0], [0.019, 0.008], [0.012, 0.014], [0, 0.014],
  ], M.bronze, { seg: 22 });
  valve.position.set(0.006, 0.004, 0.006);
  th.add(valve);
  th.position.set(-0.262, 0.128, 0.062);
  reg.add('thermostat', th, { explode: [-0.16, 0.22, 0.08] });

  /* ---------------- 皮带 ---------------- */
  const beltG = group('belt');
  const beltMesh = G.beltLoop([
    { c: [-0.300, 0.000, 0.000], r: 0.090 },          // 曲轴皮带轮/减振器
    { c: [-0.300, pumpPos[1] + 0.012, pumpPos[2]], r: 0.062 },   // 水泵带轮
    { c: [-0.300, 0.062, -0.048], r: 0.052 },         // 发电机带轮
  ], 0.020, 0.0055, M.rubber);
  beltG.add(beltMesh);
  // 发电机
  const alt = G.group('alternator');
  alt.add(G.lathe([
    [0.008, -0.052], [0.050, -0.052], [0.050, 0.028], [0.044, 0.038], [0.008, 0.038],
  ], M.rotor, { axis: 'x', seg: 26, pos: [-0.300, 0.062, -0.048] }));
  alt.add(G.pipe(0.052, 0.020, 0.024, M.rotor, { axis: 'x', seg: 26, pos: [-0.300, 0.062, -0.048] }));
  beltG.add(alt);
  reg.add('belt', beltG, { explode: [-0.30, 0.06, 0] });

  /* ---------------- 冷却水管路 ---------------- */
  const pipes = group('coolantPipes');
  // 水泵 → 缸体进水口（下水管）
  pipes.add(G.hose([
    [pumpPos[0] + 0.040, pumpPos[1] + 0.020, pumpPos[2] - 0.030],
    [-0.200, 0.060, 0.090], [-0.100, 0.020, 0.098], [-0.010, -0.010, 0.100],
  ], 0.0170, M.rubber, { seg: 60 }));
  // 缸盖出水 → 散热器上水管
  pipes.add(G.hose([
    [-0.180, 0.196, 0.070], [-0.300, 0.240, 0.070], [-0.450, 0.290, 0.040],
    [radPos[0] + 0.010, radPos[1] + 0.240, -0.160],
  ], 0.0175, M.rubber, { seg: 70 }));
  // 散热器下水 → 节温器 → 水泵
  pipes.add(G.hose([
    [radPos[0] + 0.010, radPos[1] - 0.260, -0.160], [-0.400, -0.060, -0.020],
    [-0.300, 0.070, 0.030], [-0.270, 0.100, 0.060],
  ], 0.0175, M.rubber, { seg: 70 }));
  // 暖风接口
  pipes.add(G.hose([[-0.060, 0.190, 0.086], [-0.020, 0.220, 0.150], [0.080, 0.210, 0.180]], 0.014, M.rubber, { seg: 40 }));
  reg.add('coolantPipe', pipes, { explode: [-0.10, 0.10, 0.14] });

  root.add(pump, fanG, rad, th, beltG, pipes);

  return {
    root,
    update(state) {
      const rot = deg(state.rpm * 1.35) * 0.016;
      imp.rotation.x = rot;
      wpul.rotation.x = rot;
      fanRotor.rotation.x = rot * 0.98;
      fanG.rotation.x = rot * 0.98;
      // 节温器开启
      const o = state.thermostat;
      valve.position.y = 0.004 + o * 0.012;
      valve.rotation.z = -o * 0.55;
    },
  };
}
