/**
 * builders/rotating.js — 曲轴、活塞组、连杆、飞轮、曲轴皮带轮/减振器、燃烧可视化
 */
import * as THREE from 'three';
import { SPEC, D } from '../spec.js';
import * as G from '../geometry.js';
import { group } from '../geometry.js';
import { crownY, pinY, deg } from '../kinematics.js';

const S = SPEC;
const R = S.crankThrow;
const CH = S.compHeight;              // 压缩高 38 mm

/** 曲柄臂/平衡重轮廓（shape X → 世界 Y, shape Y → 世界 Z），曲拐销朝 +Y(90°) */
function webShape(cwR = S.counterweightR) {
  const s = new THREE.Shape();
  const a0 = 205 * Math.PI / 180, a1 = 335 * Math.PI / 180;
  s.absarc(0, 0, cwR, a0, a1, false);              // 平衡重圆弧（朝 -Y）
  s.absarc(0, 0, 0.0425, a1, a0, true);             // 回到轴颈凸台
  s.closePath();
  return s;
}

/** 活塞（局部原点 = 活塞销中心，+Y 为上） */
function pistonMesh(M, i) {
  const g = group('piston');
  const crownTop = CH;
  const bowlR = S.pistonBowlD / 2, bowlH = S.pistonBowlH;
  const prof = [
    [0, crownTop - bowlH],
    [bowlR - 0.004, crownTop - bowlH],
    [bowlR, crownTop - bowlH + 0.0006],
    [bowlR, crownTop - 0.0016],
    [S.bore / 2 - 0.0006, crownTop],
    [S.bore / 2 - 0.0006, crownTop - 0.0035],
    // 第一道气环槽
    [S.bore / 2 - 0.0035, crownTop - 0.0042],
    [S.bore / 2 - 0.0006, crownTop - 0.0050],
    [S.bore / 2 - 0.0006, crownTop - 0.0072],
    // 第二道气环槽
    [S.bore / 2 - 0.0028, crownTop - 0.0080],
    [S.bore / 2 - 0.0006, crownTop - 0.0090],
    [S.bore / 2 - 0.0006, crownTop - 0.0122],
    // 油环槽
    [S.bore / 2 - 0.0042, crownTop - 0.0130],
    [S.bore / 2 - 0.0006, crownTop - 0.0148],
    [S.bore / 2 - 0.0006, crownTop - 0.0192],
    [S.bore / 2 - 0.0008, crownTop - 0.0225],
    // 裙部（略带锥度）
    [S.bore / 2 - 0.0012, -0.0060],
    [S.bore / 2 - 0.0018, -0.0140],
    [S.bore / 2 - 0.0075, -0.0150],
    [0.034, -0.0148],
    [0.0335, -0.0060],
    [0.0335, 0.0060],
  ];
  g.add(G.lathe(prof, M.pistonAlu, { seg: 48 }));
  // 顶部耐磨涂层
  const crown = G.lathe([
    [0, crownTop - bowlH + 0.0002], [bowlR - 0.004, crownTop - bowlH + 0.0002],
    [bowlR - 0.0005, crownTop - bowlH + 0.0010], [S.bore / 2 - 0.0007, crownTop - 0.0003],
  ], M.pistonCrown, { seg: 48 });
  g.add(crown);
  // 活塞销座
  [-1, 1].forEach((s) => {
    g.add(G.cylinder(0.0195, 0.0195, 0.030, M.pistonAlu, { seg: 24, axis: 'x', pos: [s * 0.030, 0, 0] }));
  });
  // 内腔（剖视可见）
  g.add(G.pipe(0.0325, 0.0315, 0.028, M.pistonAlu, { axis: 'x', seg: 32, pos: [0, 0, 0] }));
  return g;
}

/** 活塞环组 */
function pistonRings(M) {
  const g = group('rings');
  const bore = S.bore / 2;
  // 第一道压缩环
  g.add(G.pipe(bore + 0.0006, bore - 0.0022, 0.0026, M.ringSteel, { seg: 48, pos: [0, CH - 0.0058, 0] }));
  // 第二道压缩环（锥面）
  g.add(G.pipe(bore + 0.0006, bore - 0.0018, 0.0020, M.ringSteel, { seg: 48, pos: [0, CH - 0.0098, 0] }));
  // 油环（上刮片 / 隔片 / 下刮片）
  g.add(G.pipe(bore + 0.0008, bore - 0.0022, 0.0012, M.ringSteel, { seg: 48, pos: [0, CH - 0.0138, 0] }));
  g.add(G.pipe(bore - 0.0026, bore - 0.0038, 0.0022, M.ringSteel, { seg: 40, pos: [0, CH - 0.0152, 0] }));
  g.add(G.pipe(bore + 0.0008, bore - 0.0022, 0.0012, M.ringSteel, { seg: 48, pos: [0, CH - 0.0166, 0] }));
  return g;
}

/** 连杆（局部原点 = 大头中心，+Y 指向小头） */
function conrodMesh(M, len) {
  const g = group('conrod');
  // 大头
  g.add(G.pipe(0.0480, 0.0260, 0.0300, M.forgedSteel, { axis: 'x', seg: 40 }));
  // 大头盖（分体线）
  const cap = G.lathe([
    [0.0260, 0], [0.0480, 0], [0.0480, -0.016], [0.0260, -0.020],
  ], M.forgedSteel, { axis: 'x', seg: 40, pos: [0.016, 0, 0] });
  g.add(cap);
  // 杆身（工字形近似）
  const shank = G.lathe([
    [0.0230, 0.006], [0.0230, 0.026], [0.0140, 0.040], [0.0110, len * 0.55],
    [0.0135, len - 0.046], [0.0185, len - 0.028], [0.0185, len - 0.012],
  ], M.forgedSteel, { axis: 'x', seg: 28 });
  shank.rotation.z = 0;
  shank.position.x = -0.0125;
  g.add(shank);
  const web = G.roundedBox(0.021, len - 0.075, 0.010, 0.004, M.forgedSteel,
    { pos: [0, (len + 0.012) / 2 - 0.010, 0] });
  g.add(web);
  // 小头
  g.add(G.pipe(0.0265, 0.0212, 0.0300, M.forgedSteel, { axis: 'x', seg: 36, pos: [0, len, 0] }));
  g.add(G.pipe(0.0248, 0.0212, 0.0310, M.bronze, { axis: 'x', seg: 36, pos: [0, len, 0] }));
  // 连杆螺栓
  [-1, 1].forEach((s) => {
    g.add(G.cylinder(0.0060, 0.0060, 0.030, M.steelMatte, { seg: 14, axis: 'x', pos: [s * 0.019, -0.014, 0] }));
    g.add(G.hexPrism(0.017, 0.012, M.nitride, { pos: [s * 0.021, -0.030, 0] }));
  });
  return g;
}

export function buildRotating(M, reg) {
  const root = group('rotating');

  /* ---------------- 曲轴 ---------------- */
  const crank = group('crankshaft');
  D.mainX.forEach((x) => {
    crank.add(G.pipe(S.mainJournalD / 2, S.mainJournalD / 2 - 0.006, S.mainWidth, M.groundSteel,
      { axis: 'x', seg: 36, pos: [x, 0, 0] }));
  });
  D.cylX.forEach((cx, i) => {
    const phi = deg(-S.firePhase[i]);
    const jy = R * Math.cos(phi), jz = R * Math.sin(phi);
    crank.add(G.pipe(S.rodJournalD / 2, S.rodJournalD / 2 - 0.005, S.rodWidth, M.groundSteel,
      { axis: 'x', seg: 36, pos: [cx, jy, jz] }));
    [-1, 1].forEach((s) => {
      const web = G.plate(webShape(), S.mainWebWidth, M.forgedSteel, {
        pos: [cx + s * 0.0265, 0, 0], rot: [0, Math.PI / 2, 0], curveSegments: 26,
      });
      web.rotation.x = phi - Math.PI / 2;
      crank.add(web);
    });
  });
  // 主轴承隔板（曲拐间的连接臂）
  D.mainX.forEach((x) => {
    [-1, 1].forEach((s) => {
      const web = G.plate(webShape(0.086), S.mainWebWidth, M.forgedSteel, {
        pos: [x + s * (S.mainWidth / 2 + 0.011), 0, 0], rot: [0, Math.PI / 2, 0], curveSegments: 22,
      });
      crank.add(web);
    });
  });
  // 前端法兰 + 后端法兰
  crank.add(G.pipe(0.062, 0.010, 0.020, M.forgedSteel, { axis: 'x', seg: 32, pos: [-0.268, 0, 0] }));
  crank.add(G.pipe(0.070, 0.010, 0.026, M.forgedSteel, { axis: 'x', seg: 32, pos: [0.272, 0, 0] }));
  reg.add('crankshaft', crank, { explode: [0, 0, 0] });

  /* ---------------- 飞轮 + 皮带轮（随曲轴旋转） ---------------- */
  const fw = group('flywheel');
  fw.add(G.lathe([
    [S.mainJournalD / 2 - 0.001, -S.flywheelT / 2], [0.060, -S.flywheelT / 2],
    [0.185, -S.flywheelT / 2], [0.185, -S.flywheelT / 2 + 0.010],
    [0.060, -S.flywheelT / 2 + 0.016], [0.060, S.flywheelT / 2 - 0.010],
    [0.150, S.flywheelT / 2 - 0.006], [0.150, S.flywheelT / 2],
    [0.085, S.flywheelT / 2], [S.mainJournalD / 2 - 0.001, S.flywheelT / 2],
  ], M.castIron, { axis: 'x', seg: 56, pos: [0.300, 0, 0] }));
  // 起动齿圈
  const toothGroup = new THREE.Group();
  const toothGeo = new THREE.BoxGeometry(0.006, 0.009, 0.014);
  const ring = new THREE.InstancedMesh(toothGeo, M.nitride, 132);
  const dm = new THREE.Object3D();
  for (let k = 0; k < 132; k++) {
    const a = (k / 132) * Math.PI * 2;
    dm.position.set(0, Math.cos(a) * 0.196, Math.sin(a) * 0.196);
    dm.rotation.set(a, 0, 0);
    dm.updateMatrix();
    ring.setMatrixAt(k, dm.matrix);
  }
  ring.castShadow = true;
  fw.add(ring);
  fw.add(G.pipe(0.198, 0.192, S.flywheelT, M.nitride, { axis: 'x', seg: 56, pos: [0.300, 0, 0] }));
  // 飞轮螺栓
  const bgeo = new THREE.CylinderGeometry(0.007, 0.007, 0.016, 10);
  const bmesh = new THREE.InstancedMesh(bgeo, M.nitride, 8);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    dm.position.set(0.286, Math.cos(a) * 0.075, Math.sin(a) * 0.075);
    dm.rotation.set(0, 0, 0);
    dm.updateMatrix();
    bmesh.setMatrixAt(k, dm.matrix);
  }
  fw.add(bmesh);
  reg.add('flywheel', fw, { explode: [0.30, 0, 0] });

  const pulley = group('pulley');
  pulley.add(G.lathe([
    [0.010, -0.045], [0.062, -0.045], [0.070, -0.030], [0.070, -0.010],
    [0.090, -0.010], [0.090, 0.010], [0.070, 0.010], [0.070, 0.030],
    [0.062, 0.045], [0.010, 0.045],
  ], M.rotor, { axis: 'x', seg: 40, pos: [-0.300, 0, 0] }));
  pulley.add(G.pipe(0.090, 0.040, 0.030, M.steelMatte, { axis: 'x', seg: 40, pos: [-0.300, 0, 0] }));
  reg.add('pulley', pulley, { explode: [-0.20, 0, 0] });

  root.add(crank, fw, pulley);

  /* ---------------- 活塞 / 连杆 / 活塞销 ---------------- */
  const pistonG = group('pistons');
  const ringSetG = group('rings');
  const pinG = group('gudgeonPins');
  const rodG = group('conrods');
  const shellG = group('rodBearings');
  const gasG = group('combustionGas');
  const units = [];

  D.cylX.forEach((cx, i) => {
    const p = pistonMesh(M, i);
    p.position.set(cx, 0, 0);
    pistonG.add(p);
    const rings = pistonRings(M);
    rings.position.set(cx, 0, 0);
    ringSetG.add(rings);

    const pin = G.pipe(0.0210, 0.0110, 0.092, M.groundSteel, { axis: 'x', seg: 32 });
    pin.position.set(cx, 0, 0);
    pinG.add(pin);

    const rod = conrodMesh(M, S.rodLen);
    rodG.add(rod);

    const shell = G.pipe(S.rodJournalD / 2 + 0.0008, S.rodJournalD / 2, 0.026, M.bearingShell,
      { axis: 'x', seg: 40, pos: [0.016, 0, 0] });
    shellG.add(shell);

    // 缸内燃气（可视化）
    const gas = new THREE.Mesh(
      new THREE.CylinderGeometry(S.bore / 2 - 0.0012, S.bore / 2 - 0.0012, 1, 36, 1, true),
      M.gas.clone(),
    );
    gas.castShadow = false; gas.receiveShadow = false;
    gasG.add(gas);

    units.push({ i, cx, piston: p, rings, pin, rod, shell, gas });
  });

  reg.add('piston', pistonG, { explode: [0, 0.05, 0] });
  reg.add('rings', ringSetG, { explode: [0, 0.05, 0] });
  reg.add('gudgeonPin', pinG, { explode: [0, 0.16, 0] });
  reg.add('conrod', rodG, { explode: [0, 0.02, 0.22] });
  reg.add('bearingShell', shellG, { explode: [0, 0.02, 0.22] });

  root.add(pistonG, ringSetG, pinG, rodG, shellG, gasG);

  return {
    root, crank, flywheel: fw, units,
    update(state) {
      crank.rotation.x = deg(state.theta);
      fw.rotation.x = deg(state.theta);
      pulley.rotation.x = deg(state.theta);
      for (const u of units) {
        const c = state.cylinders[u.i];
        const y = crownY(c.a);
        u.piston.position.y = y;
        u.rings.position.y = y;
        u.pin.position.y = y - CH;
        const pinPos = new THREE.Vector3(u.cx, y - CH, 0);
        const bigPos = new THREE.Vector3(u.cx, R * Math.cos(deg(c.a)), R * Math.sin(deg(c.a)));
        const mid = pinPos.clone().add(bigPos).multiplyScalar(0.5);
        u.rod.position.copy(mid);
        const dir = pinPos.clone().sub(bigPos);
        const len = dir.length();
        u.rod.rotation.x = Math.atan2(dir.z, dir.y);
        u.shell.position.copy(bigPos);
        u.shell.rotation.x = u.rod.rotation.x;
        // 缸内燃气柱
        const topY = S.deckHeight - 0.0005;
        const h = Math.max(topY - y, 0.002);
        u.gas.scale.y = h;
        u.gas.position.set(u.cx, y + h / 2, 0);
        const burn = c.burn || 0;
        const gm = u.gas.material;
        gm.opacity = Math.min(0.85, burn * 0.9 + (c.stroke.key === 'exhaust' ? 0.04 : 0.0));
        gm.emissiveIntensity = 0.4 + burn * 2.6;
        gm.color.setHSL(0.06 - burn * 0.045, 0.95, 0.5 + 0.1 * Math.sin(state.simTime * 9 + u.i));
      }
    },
  };
}
