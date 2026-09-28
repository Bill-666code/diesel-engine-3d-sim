/**
 * builders/head.js — 气缸盖、燃烧室、气道、气门座/导管、气门室罩、缸盖垫
 */
import * as THREE from 'three';
import { SPEC, D } from '../spec.js';
import * as G from '../geometry.js';
import { group } from '../geometry.js';
import { hz } from './fixed.js';

const S = SPEC;
const yb = S.yHeadBottom, yt = S.yHeadTop;
const x0 = -S.headLen / 2, x1 = S.headLen / 2;
const zHalf = S.headWidth / 2;

/** 气门中心位置：进气 +z，排气 -z */
export function valvePos(i, kind) {
  const sgn = kind === 'intake' ? 1 : -1;
  return new THREE.Vector3(D.cylX[i], 0, sgn * S.valveOffsetZ);
}
/** 气门轴线方向（带夹角） */
export function valveAxis(kind) {
  const sgn = kind === 'intake' ? 1 : -1;
  const t = S.valveTilt;
  return new THREE.Vector3(0, Math.cos(t), sgn * Math.sin(t));
}

export function buildHead(M, reg) {
  const headG = group('head');
  const t = 0.030;

  /* 缸盖底板（含燃烧室开口与螺栓孔） */
  const bot = G.rectShape(S.headLen, S.headWidth, 0, 0);
  D.cylX.forEach((x) => {
    G.holeCircle(bot, x, 0, S.headChamberD / 2, 44);
    for (let k = -1; k <= 1; k += 2) {
      [-1, 1].forEach((s) => G.holeCircle(bot, x + k * 0.044, -s * 0.0855, 0.0085, 16));
    }
  });
  headG.add(hz(bot, t, M.alloyHead, [0, yb + t / 2, 0]));

  /* 燃烧室：Ø80 沉孔 + 顶部浅球冠（内表面） */
  const chamberMat = new THREE.MeshStandardMaterial({
    color: 0xd8c3a5, metalness: 0.85, roughness: 0.5, side: THREE.DoubleSide,
  });
  const chamberProfile = [];
  {
    const R = S.headChamberD / 2, dep = S.headChamberDepth, hh = S.headDomeH;
    chamberProfile.push([R, yb + 0.0002]);
    chamberProfile.push([R, yb + dep]);
    for (let i = 1; i <= 10; i++) {
      const u = i / 10;
      chamberProfile.push([R * (1 - u), yb + dep + hh * Math.sqrt(Math.max(1 - (1 - u) ** 2, 0))]);
    }
  }
  D.cylX.forEach((x) => {
    const geo = new THREE.LatheGeometry(
      chamberProfile.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-5), y)), 44,
    );
    const m = new THREE.Mesh(geo, chamberMat);
    m.position.x = x;
    m.castShadow = false; m.receiveShadow = true;
    headG.add(m);
  });

  /* 侧壁（进/排气侧），带气道过孔 */
  [-1, 1].forEach((sgn) => {
    const shp = G.rectShape(S.headLen, yt - yb - 0.02);
    D.cylX.forEach((x) => {
      G.holeCircle(shp, x, 0, 0.0235, 24);
      G.holeRect(shp, x + 0.046, 0, 0.030, 0.030);   // 喷油器过孔
    });
    const wall = G.plate(shp, 0.016, M.alloyHead, {
      pos: [0, (yb + yt) / 2, sgn * (zHalf - 0.008)],
      rot: [0, sgn > 0 ? 0 : Math.PI, 0],
    });
    headG.add(wall);
  });

  /* 前后壁 */
  [-1, 1].forEach((sgn) => {
    const shp = G.rectShape(S.headWidth - 0.032, yt - yb - 0.02);
    D.cylX.forEach((x) => G.holeCircle(shp, x - sgn * (S.headLen / 2 - 0.01), 0, 0.012, 18));
    const wall = G.plate(shp, 0.016, M.alloyHead, {
      pos: [sgn * (x1 - 0.008), (yb + yt) / 2, 0], rot: [0, Math.PI / 2, 0],
    });
    headG.add(wall);
  });

  /* 顶板（含挺柱/推杆孔与摇臂轴座孔） */
  const topShape = G.rectShape(S.headLen, S.headWidth - 0.032);
  D.cylX.forEach((x) => {
    [-1, 1].forEach((s) => G.holeCircle(topShape, x + s * S.pushrodOffsetX, 0, 0.0115, 18));
    for (let k = -1; k <= 1; k += 2) G.holeCircle(topShape, x + k * 0.044, 0, 0.0062, 12);
  });
  headG.add(hz(topShape, 0.016, M.alloyHead, [0, yt - 0.008, 0]));

  /* 摇臂轴支座 */
  const shaft = group('rockerShaft');
  D.cylX.forEach((x) => {
    [-1, 1].forEach((sgn) => {
      shaft.add(G.roundedBox(0.030, 0.024, 0.040, 0.005, M.alloyHead, { pos: [x, S.yRockerShaft - 0.014, sgn * S.rockerZ] }));
    });
  });
  [-1, 1].forEach((sgn) => {
    [-1, 1].forEach((sx) => {
      shaft.add(G.roundedBox(0.018, 0.028, 0.038, 0.005, M.alloyHead, { pos: [sx * (x1 - 0.02), S.yRockerShaft - 0.014, sgn * S.rockerZ] }));
    });
  });
  [-1, 1].forEach((sgn) => shaft.add(G.pipe(0.0090, 0.0040, S.headLen - 0.03, M.shaftSteel, { axis: 'x', seg: 24, pos: [0, S.yRockerShaft, sgn * S.rockerZ] })));
  reg.add('rockerShaft', shaft, { explode: [0, 0.20, 0] });

  /* 气道（进/排气道示形） */
  const portMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.75, roughness: 0.72, side: THREE.DoubleSide });
  const portMatEx = new THREE.MeshStandardMaterial({ color: 0x7d766e, metalness: 0.7, roughness: 0.8, side: THREE.DoubleSide });
  const intakeRunner = [], exhaustRunner = [];
  D.cylX.forEach((x) => {
    const vin = valvePos(0, 'intake'), vex = valvePos(0, 'exhaust');
    // 进气道：从侧面进缸盖 → 绕行 → 进气门座
    const p1 = new THREE.Vector3(x, yb + 0.028, zHalf - 0.004);
    const p2 = new THREE.Vector3(x, yb + 0.062, S.valveOffsetZ + 0.012);
    const p3 = new THREE.Vector3(x, yb + 0.006, S.valveOffsetZ + 0.006);
    const p4 = new THREE.Vector3(x, yb + 0.012, S.valveOffsetZ * 0.55);
    headG.add(G.flowPipe([p1, p2, p3, p4].map((v) => [v.x, v.y, v.z]), 0.0215, portMat, { seg: 44 }));
    intakeRunner.push([x, yb + 0.045, zHalf]);
    // 排气道：排气门座 → 侧向出口
    const e1 = new THREE.Vector3(x, yb + 0.016, -S.valveOffsetZ * 0.5);
    const e2 = new THREE.Vector3(x, yb + 0.020, -S.valveOffsetZ - 0.008);
    const e3 = new THREE.Vector3(x, yb + 0.050, -zHalf + 0.004);
    headG.add(G.flowPipe([e1, e2, e3].map((v) => [v.x, v.y, v.z]), 0.0185, portMatEx, { seg: 40 }));
    exhaustRunner.push([x, yb + 0.040, -zHalf]);
  });
  headG.userData.intakeRunner = intakeRunner;
  headG.userData.exhaustRunner = exhaustRunner;

  /* 气门座圈 + 导管 */
  const seatMat = M.bronze;
  D.cylX.forEach((x) => {
    ['intake', 'exhaust'].forEach((kind) => {
      const sgn = kind === 'intake' ? 1 : -1;
      const vz = sgn * S.valveOffsetZ;
      const dia = kind === 'intake' ? S.valveDIntake : S.valveDExhaust;
      const seat = G.pipe(dia / 2 + 0.0035, dia / 2 - 0.001, 0.009, seatMat, {
        seg: 36, pos: [x, D.ySeat - 0.002, vz], rot: [-sgn * S.valveTilt, 0, 0],
      });
      headG.add(seat);
      const guide = G.pipe(0.0090, S.valveStemD / 2 + 0.0002, 0.070, M.bronze, {
        seg: 24, pos: [x, D.ySeat + 0.042, vz + sgn * 0.0122],
      });
      headG.add(guide);
    });
  });

  /* 喷油器安装座 */
  D.cylX.forEach((x) => {
    const boss = G.pipe(0.0175, 0.0095, 0.024, M.alloyHead, { seg: 24, pos: [x + 0.046, yt - 0.030, 0] });
    headG.add(boss);
  });

  reg.add('head', headG, { explode: [0, 0.30, 0] });

  /* ---------------- 缸盖垫 ---------------- */
  const gs = G.rectShape(S.headLen, S.headWidth);
  D.cylX.forEach((x) => {
    G.holeCircle(gs, x, 0, S.bore / 2, 44);
    for (let k = -1; k <= 1; k += 2) [-1, 1].forEach((s) => G.holeCircle(gs, x + k * 0.044, -s * 0.0855, 0.0085, 14));
    [-1, 1].forEach((s) => G.holeCircle(gs, x + s * S.pushrodOffsetX, 0, 0.0062, 12));
  });
  const gasket = G.gasketPlate(gs, 0.0012, M.gasketMLS, { pos: [0, yb - 0.0006, 0], rot: [-Math.PI / 2, 0, 0] });
  reg.add('headGasket', gasket, { explode: [0, 0.16, 0] });

  /* ---------------- 气门室罩 ---------------- */
  const coverG = group('cover');
  const cw = S.headWidth - 0.006, cl = S.headLen - 0.006;
  const coverShape = G.rectShape(cl, cw);
  coverG.add(hz(coverShape, 0.010, M.alloyCrankcase, [0, S.yCoverTop - 0.005, 0]));
  [-1, 1].forEach((s) => {
    coverG.add(G.roundedBox(cl, S.yCoverTop - yt - 0.01, 0.010, 0.004, M.alloyCrankcase,
      { pos: [0, (S.yCoverTop + yt) / 2, s * (cw / 2 - 0.005)] }));
    coverG.add(G.roundedBox(0.010, S.yCoverTop - yt - 0.01, cw, 0.004, M.alloyCrankcase,
      { pos: [s * (cl / 2 - 0.005), (S.yCoverTop + yt) / 2, 0] }));
  });
  // 加油口 + 曲轴箱通风阀
  coverG.add(G.pipe(0.028, 0.022, 0.026, M.plastic, { seg: 24, pos: [-0.16, S.yCoverTop + 0.012, 0.045] }));
  coverG.add(G.pipe(0.016, 0.012, 0.040, M.plastic, { seg: 18, pos: [0.17, S.yCoverTop + 0.018, -0.04] }));
  reg.add('valveCover', coverG, { explode: [0, 0.46, 0] });

  return { root: group('headAssembly', [headG, coverG]) };
}
