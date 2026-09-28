/**
 * builders/details.js — 螺栓、密封垫片、油封等细节件（示意级精度）
 */
import * as THREE from 'three';
import { SPEC, D } from '../spec.js';
import * as G from '../geometry.js';
import { group } from '../geometry.js';

const S = SPEC;

export function buildDetails(M, reg) {
  const root = group('details');

  /* ---------------- 气缸盖螺栓 ---------------- */
  const headPts = [];
  D.cylX.forEach((x) => {
    for (let k = -1; k <= 1; k += 2) {
      [-1, 1].forEach((s) => headPts.push([x + k * 0.044, S.yHeadTop + 0.002, s * 0.0855]));
    }
  });
  const headBolts = G.boltArray(headPts, 0.014, 0.030, M.nitride, { axis: 'y', washer: true, matWasher: M.steelMatte });
  reg.add('headBolt', headBolts, { explode: [0, 0.20, 0] });

  /* ---------------- 主轴承螺栓 ---------------- */
  const mainPts = [];
  D.mainX.forEach((x) => [-1, 1].forEach((s) => mainPts.push([x + s * 0.040, -0.052, 0.062])));
  const mainBolts = G.boltArray(mainPts, 0.016, 0.028, M.nitride, { axis: 'y', matWasher: M.steelMatte });
  reg.add('mainBolt', mainBolts, { explode: [0, -0.14, 0.06] });

  /* ---------------- 油底壳螺栓（法兰螺栓） ---------------- */
  const panPts = [];
  for (let k = 0; k < 9; k++) {
    panPts.push([-0.230 + k * 0.0575, S.yBlockBottom + 0.002, 0.108]);
    panPts.push([-0.230 + k * 0.0575, S.yBlockBottom + 0.002, -0.108]);
  }
  const panBolts = G.boltArray(panPts, 0.008, 0.014, M.nitride, { axis: 'y', flip: true, matWasher: M.steelMatte });
  reg.add('panBolt', panBolts, { explode: [0, -0.18, 0], pick: false });

  /* ---------------- 气门室罩螺栓 ---------------- */
  const coverPts = [];
  for (let k = 0; k < 8; k++) {
    coverPts.push([-0.215 + k * 0.0615, S.yCoverTop + 0.001, 0.090]);
    coverPts.push([-0.215 + k * 0.0615, S.yCoverTop + 0.001, -0.090]);
  }
  const coverBolts = G.boltArray(coverPts, 0.006, 0.010, M.nitride, { axis: 'y', matWasher: M.steelMatte });
  reg.add('coverBolt', coverBolts, { explode: [0, 0.44, 0], pick: false });

  /* ---------------- 油封 ---------------- */
  const seals = group('seals');
  seals.add(G.pipe(0.062, 0.040, 0.016, M.seal, { axis: 'x', seg: 30, pos: [-0.288, 0, 0] }));    // 曲轴前油封
  seals.add(G.pipe(0.062, 0.042, 0.016, M.seal, { axis: 'x', seg: 30, pos: [0.336, 0, 0] }));     // 飞轮后油封
  seals.add(G.pipe(0.032, 0.021, 0.014, M.seal, { axis: 'x', seg: 24, pos: [-0.276, S.yCam, 0] })); // 凸轮前油封
  D.cylX.forEach((x) => {
    [-1, 1].forEach((s) => seals.add(G.pipe(0.014, 0.0072, 0.010, M.seal, { seg: 16, pos: [x + s * S.pushrodOffsetX, 0.250, s * D.pushrodZ] })));
  });
  reg.add('oilSeal', seals, { explode: [0, 0, 0] });

  /* ---------------- 密封垫片 ---------------- */
  const gaskets = group('gaskets');
  // 油底壳垫
  const panG = G.rectShape(S.blockLen - 0.012, S.blockWidth - 0.014);
  gaskets.add(G.gasketPlate(panG, 0.0012, M.gasketFiber, { pos: [0, S.yBlockBottom - 0.0006, 0], rot: [-Math.PI / 2, 0, 0] }));
  // 气门室罩垫
  const covG = G.rectShape(S.headLen - 0.010, S.headWidth - 0.010);
  gaskets.add(G.gasketPlate(covG, 0.0030, M.gasketCork, { pos: [0, S.yHeadTop + 0.0015, 0], rot: [-Math.PI / 2, 0, 0] }));
  // 水泵垫
  gaskets.add(G.roundedBox(0.006, 0.090, 0.094, 0.002, M.gasketFiber, { pos: [-0.240, 0.030, 0.062] }));
  // 飞轮壳垫
  gaskets.add(G.pipe(0.202, 0.190, 0.0012, M.gasketFiber, { axis: 'x', seg: 40, pos: [0.2435, 0, 0] }));
  reg.add('gaskets', gaskets, { explode: [0, 0.12, 0], pick: false });

  root.add(headBolts, mainBolts, panBolts, coverBolts, seals, gaskets);
  return { root };
}
