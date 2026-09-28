/**
 * builders/induction.js — 进气管、排气管、涡轮增压器、中冷器、空气滤清器、增压管路
 */
import * as THREE from 'three';
import { SPEC, D } from '../spec.js';
import * as G from '../geometry.js';
import { group } from '../geometry.js';
import { deg } from '../kinematics.js';

const S = SPEC;
const turboPos = new THREE.Vector3(0.040, 0.268, -0.340);

export function buildInduction(M, reg) {
  const root = group('induction');

  /* ---------------- 进气管 ---------------- */
  const intake = group('intakeManifold');
  // 稳压腔
  intake.add(G.lathe([
    [0, -0.230], [0.070, -0.230], [0.070, 0.230], [0, 0.230],
  ], M.paintIntake, { seg: 32, axis: 'x', pos: [0, 0.268, 0.250] }));
  intake.add(G.pipe(0.086, 0.070, 0.020, M.paintIntake, { axis: 'x', seg: 32, pos: [-0.246, 0.268, 0.250] }));
  // 4 支歧管
  D.cylX.forEach((x) => {
    const pts = [
      new THREE.Vector3(x, 0.268, 0.250),
      new THREE.Vector3(x, 0.276, 0.200),
      new THREE.Vector3(x, 0.286, 0.140),
      new THREE.Vector3(x, 0.272, 0.112),
      new THREE.Vector3(x, 0.250, 0.096),
    ];
    intake.add(G.tubeAlong(pts, 0.0235, M.paintIntake, { seg: 60, radial: 16 }));
    intake.add(G.pipe(0.030, 0.0235, 0.014, M.paintIntake, { axis: 'z', seg: 20, pos: [x, 0.250, 0.100] }));
  });
  reg.add('intakeManifold', intake, { explode: [0, 0.05, 0.20] });

  /* ---------------- 排气管 ---------------- */
  const exh = group('exhaustManifold');
  const mergePts = [];
  D.cylX.forEach((x) => {
    const pts = [
      new THREE.Vector3(x, 0.240, -0.096),
      new THREE.Vector3(x, 0.250, -0.150),
      new THREE.Vector3(x, 0.262, -0.205),
      new THREE.Vector3(x, 0.272, -0.250),
    ];
    exh.add(G.tubeAlong(pts, 0.0215, M.hotExhaust, { seg: 56, radial: 16 }));
    exh.add(G.pipe(0.028, 0.0215, 0.016, M.hotExhaust, { axis: 'z', seg: 20, pos: [x, 0.240, -0.100] }));
    mergePts.push(new THREE.Vector3(x, 0.272, -0.250));
  });
  // 汇流总管
  exh.add(G.tubeAlong([
    new THREE.Vector3(-0.170, 0.272, -0.252), new THREE.Vector3(-0.050, 0.272, -0.256),
    new THREE.Vector3(0.050, 0.272, -0.258), new THREE.Vector3(0.120, 0.272, -0.262),
    new THREE.Vector3(0.150, 0.272, -0.290), new THREE.Vector3(0.100, 0.268, -0.330),
  ], 0.030, M.hotExhaust, { seg: 80, radial: 18 }));
  reg.add('exhaustManifold', exh, { explode: [0, 0.05, -0.20] });

  /* ---------------- 涡轮增压器 ---------------- */
  const turbo = group('turbo');
  // 涡轮壳（蜗形）
  turbo.add(G.volute(0.052, 0.086, 1.5, 0.070, M.paintTurbo, { axis: 'x', pos: [-0.040, 0, 0] }));
  turbo.add(G.pipe(0.072, 0.052, 0.062, M.paintTurbo, { axis: 'z', seg: 32, pos: [0, 0, -0.020] }));
  // 中间体（轴承座）
  turbo.add(G.lathe([
    [0.016, -0.040], [0.046, -0.040], [0.046, -0.012], [0.036, 0.000],
    [0.036, 0.012], [0.046, 0.024], [0.046, 0.044], [0.016, 0.044],
  ], M.steelMatte, { axis: 'z', seg: 28 }));
  // 压气机壳
  turbo.add(G.volute(0.044, 0.072, 1.4, 0.060, M.paintTurbo, { axis: 'z', pos: [0, 0, 0.070] }));
  turbo.add(G.pipe(0.058, 0.040, 0.040, M.paintTurbo, { axis: 'z', seg: 30, pos: [0, 0, 0.046] }));
  turbo.add(G.pipe(0.046, 0.038, 0.046, M.paintTurbo, { axis: 'x', seg: 30, pos: [0.040, 0, 0.070] }));
  // 涡轮/压气机叶轮（旋转）
  const tWheel = G.impeller(0.012, 0.044, 9, 0.026, M.turboHot, { axis: 'z' });
  tWheel.position.set(0, 0, -0.020);
  turbo.add(tWheel);
  const cWheel = G.impeller(0.012, 0.040, 8, 0.024, M.groundSteel, { axis: 'z' });
  cWheel.position.set(0, 0, 0.070);
  turbo.add(cWheel);
  // 进气口
  turbo.add(G.pipe(0.050, 0.042, 0.034, M.paintTurbo, { axis: 'z', seg: 30, pos: [0, 0.046, 0.070] }));
  // 执行器（废气旁通）
  turbo.add(G.lathe([
    [0, 0], [0.020, 0], [0.020, 0.052], [0.014, 0.058], [0, 0.058],
  ], M.steelMatte, { axis: 'x', seg: 20, pos: [0.030, 0.052, -0.010] }));
  turbo.add(G.cylinder(0.006, 0.006, 0.060, M.groundSteel, { seg: 12, axis: 'y', pos: [0.030, 0.026, -0.010] }));
  turbo.position.copy(turboPos);
  reg.add('turbo', turbo, { explode: [0.08, 0.12, -0.26] });

  /* ---------------- 中冷器 ---------------- */
  const ic = group('intercooler');
  const icR = S.intercoolerD / 2;
  ic.add(G.pipe(icR, icR - 0.004, 0.070, M.alloyCrankcase, { axis: 'z', seg: 40 }));
  const icFins = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.0022, 0.0030, 0.062), finMatCooler(), 120,
  );
  {
    const dm = new THREE.Object3D();
    for (let k = 0; k < 120; k++) {
      const a = (k / 120) * Math.PI * 2;
      dm.position.set(Math.cos(a) * (icR - 0.0035), Math.sin(a) * (icR - 0.0035), 0);
      dm.rotation.set(0, 0, a);
      dm.updateMatrix();
      icFins.setMatrixAt(k, dm.matrix);
    }
  }
  ic.add(icFins);
  ic.add(G.pipe(0.040, 0.036, 0.030, M.alloyCrankcase, { axis: 'x', seg: 26, pos: [0, -icR - 0.010, 0] }));
  ic.add(G.pipe(0.040, 0.036, 0.030, M.alloyCrankcase, { axis: 'x', seg: 26, pos: [0, icR + 0.010, 0] }));
  ic.position.set(-0.160, 0.352, 0.268);
  ic.rotation.x = Math.PI / 2;
  reg.add('intercooler', ic, { explode: [0, 0.26, 0.16] });

  /* ---------------- 增压空气管路 ---------------- */
  const charge = group('chargePipes');
  // 压气机出口 → 中冷器入口
  charge.add(G.hose([
    [turboPos.x + 0.040, turboPos.y, turboPos.z + 0.070],
    [0.120, 0.250, -0.330], [-0.060, 0.230, -0.360], [-0.300, 0.280, -0.240],
    [-0.330, 0.380, 0.060], [-0.240, 0.420, 0.240], [-0.160, 0.392, 0.268],
  ], 0.0270, M.rubber, { seg: 90 }));
  // 中冷器出口 → 进气稳压腔
  charge.add(G.hose([
    [-0.160, 0.352 - S.intercoolerD / 2 - 0.010, 0.268],
    [-0.150, 0.330, 0.240], [-0.120, 0.300, 0.250], [-0.060, 0.272, 0.250],
  ], 0.0300, M.rubber, { seg: 70 }));
  // 排气 → 涡轮进口
  charge.add(G.hose([
    [0.150, 0.268, -0.300], [turboPos.x + 0.030, turboPos.y, turboPos.z - 0.070],
  ], 0.0280, M.hotExhaust, { seg: 40 }));
  reg.add('chargePipe', charge, { explode: [0, 0.14, -0.08] });

  /* ---------------- 空气滤清器 ---------------- */
  const af = group('airFilter');
  af.add(G.lathe([
    [0, -0.062], [0.066, -0.062], [0.066, 0.052], [0.058, 0.070],
    [0.024, 0.070], [0.024, 0.086], [0, 0.086],
  ], M.filterCan, { seg: 34 }));
  af.add(G.pipe(0.046, 0.043, 0.026, M.plastic, { seg: 26, axis: 'x', pos: [-0.072, 0.024, 0] }));
  af.position.set(0.268, 0.286, 0.288);
  af.rotation.z = -Math.PI / 2;
  af.rotation.x = 0;
  reg.add('airFilter', af, { explode: [0.16, 0.20, 0.10] });
  // 空滤 → 稳压腔
  charge.add(G.hose([
    [0.196, 0.286, 0.288], [0.080, 0.300, 0.286], [-0.060, 0.288, 0.268], [-0.180, 0.272, 0.252],
  ], 0.044, M.rubber, { seg: 70 }));

  root.add(intake, exh, turbo, ic, charge, af);

  return {
    root,
    update(state) {
      const turboRpm = (state.running ? 6000 + state.load * 68000 + state.rpm * 16 : 0);
      tWheel.rotation.z = turboRpm * 0.000012;
      cWheel.rotation.z = turboRpm * 0.000012;
    },
  };
}

function finMatCooler() {
  return new THREE.MeshStandardMaterial({ color: 0x454b52, metalness: 0.88, roughness: 0.45 });
}
