/**
 * builders/fixed.js — 固定件：气缸体、缸套、水套、主轴承座、主油道、油底壳、飞轮壳、正时齿轮室
 */
import * as THREE from 'three';
import { SPEC, D } from '../spec.js';
import * as G from '../geometry.js';
import { group } from '../geometry.js';

const S = SPEC;

/** 水平板（shape: X → 世界 X, shape: Y → 世界 −Z），厚度沿 Y */
export function hz(shape, t, mat, pos, extra = {}) {
  return G.plate(shape, t, mat, { pos, rot: [-Math.PI / 2, 0, 0], ...extra });
}
/** 垂直板，法线沿 X（面朝 ±X） */
export function vx(shape, t, mat, pos, extra = {}) {
  return G.plate(shape, t, mat, { pos, rot: [0, Math.PI / 2, 0], ...extra });
}
/** 垂直板，法线沿 Z（面朝 ±Z） */
export function vz(shape, t, mat, pos, extra = {}) {
  return G.plate(shape, t, mat, { pos, rot: [0, 0, 0], ...extra });
}

export function buildFixed(M, reg) {
  const root = group('fixed');
  const x0 = -S.blockLen / 2, x1 = S.blockLen / 2;          // -0.245 .. 0.245
  const zHalf = S.blockWidth / 2;                              // 0.10
  const deckY = S.deckHeight;
  const skirtY = S.yBlockBottom;
  const jacketTop = 0.060;                                     // 水套顶
  const crankcaseTop = 0.030;

  /* ---------------- 气缸体 ---------------- */
  const blockG = group('block');

  // 上平面（含缸孔）
  const deck = G.rectShape(S.blockLen, S.blockWidth, 0, 0);
  D.cylX.forEach((x) => G.holeCircle(deck, x, 0, S.linerOD / 2, 48));
  blockG.add(hz(deck, 0.032, M.castIron, [0, deckY - 0.016, 0]));

  // 缸孔之间的加强筋 / 水套外壁
  const wallShape = G.rectShape(S.blockLen, S.blockWidth);
  D.cylX.forEach((x) => G.holeCircle(wallShape, x, 0, S.jacketOD / 2, 44));
  blockG.add(hz(wallShape, jacketTop - deckY + 0.032, M.castIron, [0, (jacketTop + deckY) / 2 + 0.016, 0]));

  // 前后端面
  [-1, 1].forEach((sgn) => {
    const shp = G.rectShape(S.blockWidth, deckY - jacketTop);
    const m = G.plate(shp, 0.020, M.castIron, {
      pos: [sgn * (x1 - 0.010) * (sgn > 0 ? 1 : 1) - sgn * 0.010, (deckY + jacketTop) / 2, 0],
      rot: [0, Math.PI / 2, 0],
    });
    // 端面定位到 ±x1
    m.position.x = sgn * (x1 - 0.010);
    blockG.add(m);
  });

  // 曲轴箱侧壁（含减重孔）
  [-1, 1].forEach((sgn) => {
    const shp = G.rectShape(S.blockLen - 0.04, crankcaseTop - skirtY);
    for (let i = 0; i < 3; i++) {
      const cx = -0.14 + i * 0.14;
      G.holeCircle(shp, cx, 0, 0.052, 28);
    }
    const m = G.plate(shp, 0.014, M.castIron, {
      pos: [0, (crankcaseTop + skirtY) / 2, sgn * (zHalf - 0.007)],
      rot: [0, sgn > 0 ? 0 : Math.PI, 0],
    });
    m.rotation.set(0, 0, 0);
    blockG.add(m);
    // 上部曲轴箱壁
    const up = G.plate(G.rectShape(S.blockLen - 0.04, jacketTop - crankcaseTop), 0.014, M.castIron, {
      pos: [0, (crankcaseTop + jacketTop) / 2, sgn * (zHalf - 0.007)],
    });
    blockG.add(up);
  });

  // 前后曲轴箱端板
  [-1, 1].forEach((sgn) => {
    const shp = G.rectShape(S.blockWidth - 0.028, crankcaseTop - skirtY);
    G.holeCircle(shp, 0, 0.0, 0.086, 32);
    const m = G.plate(shp, 0.016, M.castIron, {
      pos: [sgn * (x1 - 0.008), (crankcaseTop + skirtY) / 2, 0],
      rot: [0, Math.PI / 2, 0],
    });
    blockG.add(m);
  });

  // 主轴承座隔板 + 主轴承盖
  const webG = group('mains');
  D.mainX.forEach((x, i) => {
    const shp = G.rectShape(S.blockWidth - 0.030, 0.170);
    G.holeCircle(shp, 0, 0.0, S.mainJournalD / 2 + 0.001, 40);
    const web = G.plate(shp, 0.030, M.castIron, { pos: [x, 0.0, 0], rot: [0, Math.PI / 2, 0] });
    webG.add(web);
    // 主轴承盖（下半）
    const cap = G.lathe([
      [S.mainJournalD / 2 + 0.001, 0],
      [0.056, 0],
      [0.056, -0.042],
      [S.mainJournalD / 2 + 0.001, -0.048],
      [S.mainJournalD / 2 + 0.001, 0],
    ], M.castIron, { axis: 'x', seg: 32 });
    cap.rotation.z = 0;
    cap.position.set(x - 0.015, 0, 0);
    cap.rotation.set(0, 0, 0);
    webG.add(cap);
    // 上下轴瓦
    const shell = new THREE.Shape();
    shell.absarc(0, 0, S.mainJournalD / 2 + 0.0008, 0, Math.PI * 2, false);
    G.holeCircle(shell, 0, 0, S.mainJournalD / 2, 40);
    const bearing = G.plate(shell, 0.026, M.bearing, { pos: [x, 0, 0], rot: [0, Math.PI / 2, 0] });
    webG.add(bearing);
  });
  blockG.add(webG);

  // 缸盖螺栓座与凸台
  const bossMat = M.castIron;
  const boltPts = [];
  D.cylX.forEach((x) => {
    [-1, 1].forEach((s) => {
      for (let k = -1; k <= 1; k += 2) {
        const bx = x + k * 0.044, bz = s * 0.0855;
        boltPts.push([bx, bz]);
        const boss = G.cylinder(0.0175, 0.020, 0.040, bossMat, { seg: 16, pos: [bx, deckY - 0.006, bz] });
        blockG.add(boss);
      }
    });
  });
  blockG.userData.boltPts = boltPts;

  // 推杆导管（从缸盖穿过缸体上平面）
  D.cylX.forEach((x) => {
    [-1, 1].forEach((s) => {
      const tube = G.pipe(0.0115, 0.0062, 0.110, M.castIron, { seg: 16, pos: [x + s * S.pushrodOffsetX, deckY - 0.055, 0] });
      blockG.add(tube);
    });
  });

  // 油底壳结合面法兰
  const flange = G.rectShape(S.blockLen + 0.02, S.blockWidth + 0.02);
  blockG.add(hz(flange, 0.012, M.castIron, [0, skirtY + 0.006, 0]));

  reg.add('block', blockG, { explode: [0, 0, 0] });
  reg.add('mainBearingWeb', webG, { explode: [0, -0.12, 0] });

  /* ---------------- 气缸套 ---------------- */
  const linerG = group('liners');
  D.cylX.forEach((x) => {
    const liner = G.pipe(S.linerOD / 2, S.bore / 2, deckY - jacketTop + 0.03, M.nodularIron,
      { seg: 56, pos: [x, (deckY + jacketTop - 0.03) / 2 + 0.015, 0] });
    linerG.add(liner);
    // 下部支撑凸台
    linerG.add(G.cylinder(S.linerOD / 2 + 0.008, S.linerOD / 2 + 0.008, 0.014, M.nodularIron,
      { seg: 40, pos: [x, jacketTop - 0.005, 0] }));
  });
  reg.add('liner', linerG, { explode: [0, 0.10, 0] });

  /* ---------------- 水套（半透明示意） ---------------- */
  const jacketG = group('jacket');
  D.cylX.forEach((x) => {
    jacketG.add(G.pipe(S.jacketOD / 2, S.linerOD / 2, deckY - jacketTop, M.coolant,
      { seg: 40, pos: [x, (deckY + jacketTop) / 2, 0] }));
  });
  // 缸盖/缸体之间的连接水道
  [-1, 1].forEach((s) => {
    jacketG.add(G.roundedBox(S.blockLen - 0.06, 0.050, 0.030, 0.006, M.coolant,
      { pos: [0, deckY - 0.058, s * 0.080] }));
  });
  reg.add('waterJacket', jacketG, { explode: [0, 0.16, 0] });

  /* ---------------- 主油道（半透明） ---------------- */
  const gal = group('gallery');
  gal.add(G.pipe(S.oilGalleryD / 2, S.oilGalleryD / 2 - 0.002, S.blockLen - 0.05, M.oil, {
    axis: 'x', seg: 24, pos: [0, S.oilGalleryY, S.oilGalleryZ],
  }));
  D.mainX.forEach((x) => {
    gal.add(G.pipe(0.006, 0.005, 0.060, M.oil, { seg: 12, pos: [x, S.oilGalleryY - 0.030, S.oilGalleryZ] }));
  });
  // 缸壁飞溅润滑喷孔
  D.cylX.forEach((x) => {
    gal.add(G.pipe(0.0035, 0.003, 0.012, M.oil, { seg: 8, pos: [x - 0.030, jacketTop + 0.02, -0.075], rot: [0, 0, Math.PI / 2] }));
  });
  reg.add('oilGallery', gal, { explode: [0, 0.10, -0.08] });

  /* ---------------- 油底壳 ---------------- */
  const panG = group('pan');
  const panTop = skirtY - 0.002, panBot = S.yPanBottom;
  const panShape = G.rectShape(S.blockLen - 0.01, S.blockWidth - 0.012);
  panG.add(hz(panShape, 0.010, M.castIron, [0, panTop - 0.005, 0]));
  // 侧壁（下部收拢）
  [-1, 1].forEach((s) => {
    panG.add(G.roundedBox(S.blockLen - 0.02, 0.072, 0.011, 0.004, M.castIron,
      { pos: [0, panTop - 0.048, s * (zHalf - 0.008)] }));
    panG.add(G.roundedBox(0.011, 0.072, S.blockWidth - 0.02, 0.004, M.castIron,
      { pos: [s * (x1 - 0.012), panTop - 0.048, 0] }));
  });
  // 深油底壳主体
  panG.add(G.roundedBox(S.blockLen - 0.05, 0.070, S.blockWidth - 0.05, 0.012, M.castIron, { pos: [0, panBot + 0.035, 0] }));
  // 放油螺塞
  panG.add(G.hexPrism(0.030, 0.014, M.steelMatte, { pos: [-0.150, panBot + 0.002, 0.030] }));
  // 防涡流挡板
  panG.add(G.roundedBox(0.30, 0.004, 0.13, 0.002, M.steelMatte, { pos: [0, panBot + 0.072, 0] }));
  reg.add('oilPan', panG, { explode: [0, -0.22, 0] });

  // 集滤器
  const pick = group('pickup');
  pick.add(G.pipe(0.024, 0.021, 0.030, M.steelMatte, { seg: 24, pos: [0, panBot + 0.055, 0] }));
  pick.add(G.roundedBox(0.115, 0.060, 0.090, 0.010, M.steelMatte, { pos: [0, panBot + 0.090, 0] }));
  pick.add(G.pipe(0.014, 0.012, 0.115, M.steelMatte, { seg: 20, pos: [0, panBot + 0.175, 0] }));
  reg.add('oilPickup', pick, { explode: [0, -0.12, 0.10] });

  /* ---------------- 飞轮壳 ---------------- */
  const fh = group('flywheelHousing');
  const fhX0 = x1 - 0.005, fhX1 = S.xFlywheel;
  fh.add(G.pipe(0.205, 0.185, fhX1 - fhX0, M.castIron, { axis: 'x', seg: 44, pos: [(fhX0 + fhX1) / 2, 0.0, 0] }));
  fh.add(G.pipe(0.230, 0.150, 0.016, M.castIron, { axis: 'x', seg: 44, pos: [fhX1 - 0.008, 0.0, 0] }));
  // 与缸体结合法兰
  fh.add(G.pipe(0.215, 0.150, 0.014, M.castIron, { axis: 'x', seg: 40, pos: [fhX0 + 0.007, 0, 0] }));
  // 下部油封座
  fh.add(G.pipe(0.070, 0.052, 0.030, M.alloyCrankcase, { axis: 'x', seg: 28, pos: [fhX1 - 0.020, 0, 0] }));
  reg.add('flywheelHousing', fh, { explode: [0.22, 0, 0] });

  /* ---------------- 正时齿轮室 ---------------- */
  const tc = group('timingCase');
  const tcX0 = S.xFront, tcX1 = -x1 - 0.005;
  const tcShape = G.rectShape(S.blockWidth + 0.01, deckY + 0.030);
  tc.add(G.plate(tcShape, 0.014, M.alloyCrankcase, { pos: [tcX0 + 0.007, (deckY + 0.030) / 2 - 0.08, 0], rot: [0, Math.PI / 2, 0] }));
  tc.add(G.pipe(0.215, 0.190, tcX1 - tcX0, M.alloyCrankcase, { axis: 'x', seg: 44, pos: [(tcX0 + tcX1) / 2, 0.0, 0] }));
  tc.add(G.pipe(0.230, 0.150, 0.015, M.alloyCrankcase, { axis: 'x', seg: 44, pos: [tcX0 + 0.008, 0, 0] }));
  // 凸轮轴前油封座
  tc.add(G.pipe(0.032, 0.021, 0.030, M.alloyCrankcase, { axis: 'x', seg: 24, pos: [tcX0 + 0.020, S.yCam, 0] }));
  // 前油封
  const seal = G.pipe(0.058, 0.040, 0.014, M.seal, { axis: 'x', seg: 30, pos: [tcX0 - 0.006, 0, 0] });
  reg.add('oilSeal', seal, { explode: [-0.10, 0, 0] });
  reg.add('timingCase', tc, { explode: [-0.22, 0, 0] });

  root.add(blockG);
  return { root, deckBoltPoints: boltPts };
}
