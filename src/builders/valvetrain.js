/**
 * builders/valvetrain.js — 凸轮轴、挺柱、推杆、摇臂、进/排气门、气门弹簧、正时齿轮
 * 布局（已按运动干涉校核）：
 *   凸轮轴中心线 y = −30 mm（缸体挺柱室内），桃顶朝上推动挺柱
 *   挺柱/推杆 z = ±59.1 mm，气门 z = ±24 mm，摇臂轴 z = ±48 mm
 *   阀端在摇臂轴内侧、推杆端在外侧 → 摇臂比 1.6
 */
import * as THREE from 'three';
import { SPEC, D } from '../spec.js';
import * as G from '../geometry.js';
import { group } from '../geometry.js';
import { camProfileFn, deg } from '../kinematics.js';

const S = SPEC;
const SPRING_Y0 = 0.036;                 // 下弹簧座（气门局部坐标）
const SPRING_INST = S.springInstalled;   // 0.052 m

/** 气门本体（局部坐标：阀锥面在 y=0，杆端 +Y） */
function valveMesh(dia, M) {
  const sr = S.valveStemD / 2;
  const prof = [
    [0, 0.0085], [dia / 2 - 0.0032, 0.0085], [dia / 2, 0.0050],
    [dia / 2 - 0.0016, 0.0008], [dia / 2 - 0.0048, -0.0013],
    [0.0112, -0.0026], [0.0112, 0.0000], [0.0068, 0.0105],
    [sr, 0.020], [sr, 0.1120], [sr + 0.0007, 0.1150], [sr + 0.0007, 0.1172],
    [sr, 0.1200], [sr, 0.1225], [0, 0.1232],
  ];
  return G.lathe(prof, M.hardenedSteel, { seg: 40 });
}

function retainerMesh(M) {
  return G.lathe([
    [0.0055, 0.0895], [0.0128, 0.0895], [0.0138, 0.0930],
    [0.0105, 0.0962], [0.0062, 0.0962], [0.0055, 0.0940],
  ], M.steelMatte, { seg: 28 });
}

export function buildValvetrain(M, reg) {
  const root = group('valvetrain');
  const t = S.valveTilt;
  const liftCamIntake = camProfileFn(S.IVO, S.IVC);
  const liftCamExhaust = camProfileFn(S.EVO, S.EVC);
  const cIntake = S.IVO + (((S.IVC - S.IVO) + 720) % 720) / 2;
  const cExhaust = S.EVO + (((S.EVC - S.EVO) + 720) % 720) / 2;

  /* ---------------- 凸轮轴 ---------------- */
  const camG = group('camshaft');
  camG.position.set(0, S.yCam, 0);
  camG.add(G.pipe(0.0150, 0.0060, 0.520, M.shaftSteel, { axis: 'x', seg: 24 }));
  D.mainX.forEach((x) => {
    camG.add(G.pipe(0.0200, 0.0060, 0.024, M.groundSteel, { axis: 'x', seg: 28, pos: [x, 0, 0] }));
  });
  camG.add(G.cylinder(0.024, 0.024, 0.014, M.shaftSteel, { axis: 'x', seg: 24, pos: [-0.266, 0, 0] }));
  reg.add('camshaft', camG, { explode: [0, -0.20, 0] });

  const valveG = { intake: group('valves-intake'), exhaust: group('valves-exhaust') };
  const springG = group('springs');
  const tappetG = group('tappets');
  const pushG = group('pushrods');
  const rockerG = group('rockers');
  const springUppers = [];
  const perCyl = [];

  /* 摇臂轮廓（局部：阀端在 −Z，推杆端在 +Z，绕 X 轴摆动） */
  const armLen = D.valveArm + 0.015, pushLen = D.pushArm + 0.013;
  const rockerShape = new THREE.Shape();
  rockerShape.moveTo(-armLen, -0.014);
  rockerShape.lineTo(pushLen, -0.0105);
  rockerShape.lineTo(pushLen, 0.0105);
  rockerShape.lineTo(-armLen, 0.014);
  rockerShape.closePath();
  const armGeo = new THREE.ExtrudeGeometry(rockerShape, {
    depth: 0.014, bevelEnabled: true, bevelSize: 0.0015, bevelThickness: 0.0015, bevelSegments: 1, curveSegments: 4,
  });
  armGeo.translate(0, 0, -0.007);
  armGeo.rotateY(-Math.PI / 2);          // 形状 X → 世界 Z

  D.cylX.forEach((cx, i) => {
    for (const kind of ['intake', 'exhaust']) {
      const s = kind === 'intake' ? 1 : -1;
      const dia = kind === 'intake' ? S.valveDIntake : S.valveDExhaust;
      const x = cx + s * S.pushrodOffsetX;
      const liftFn = kind === 'intake' ? liftCamIntake : liftCamExhaust;
      const center = kind === 'intake' ? cIntake : cExhaust;

      /* 凸轮桃 */
      const lobe = G.camLobe(S.camBaseR, S.valveLift, S.camLobeW, (da) => liftFn(Math.atan2(Math.sin(deg(da)), Math.cos(deg(da)))),
        M.hardenedSteel, { pos: [x, 0, s * D.pushrodZ], seg: 88 });
      lobe.rotation.x = Math.PI - deg((center - S.firePhase[i]) / 2);
      camG.add(lobe);

      /* 挺柱 */
      const tap = G.lathe([
        [0, 0], [S.tappetOD / 2, 0], [S.tappetOD / 2, 0.026], [S.tappetOD / 2 - 0.001, 0.028],
        [0.008, 0.028], [0.008, 0.024], [0, 0.024],
      ], M.nitride, { seg: 32 });
      tap.position.set(x, D.tappetTopY - 0.028, s * D.pushrodZ);
      tappetG.add(tap);

      /* 推杆 */
      const yPushTop = S.yRockerShaft - 0.008;
      const yPushBot = D.tappetTopY - 0.028;
      const rodLen = yPushTop - yPushBot;
      const rod = group('rod', [
        G.cylinder(0.0050, 0.0050, rodLen, M.steelMatte, { seg: 16 }),
        G.cylinder(0.0074, 0.0074, 0.013, M.groundSteel, { seg: 18, pos: [0, rodLen / 2 - 0.0065, 0] }),
        G.cylinder(0.0074, 0.0074, 0.013, M.groundSteel, { seg: 18, pos: [0, -rodLen / 2 + 0.0065, 0] }),
      ]);
      rod.position.set(x, (yPushTop + yPushBot) / 2, s * D.pushrodZ);
      pushG.add(rod);

      /* 摇臂 */
      const rocker = group('rocker');
      rocker.add(new THREE.Mesh(armGeo, M.steelMatte));
      rocker.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      rocker.add(G.pipe(0.0165, 0.0100, 0.021, M.steelMatte, { axis: 'x', seg: 24 }));
      rocker.add(G.cylinder(0.0055, 0.0055, 0.015, M.groundSteel, { seg: 16, pos: [0, 0.014, -D.valveArm] }));
      rocker.add(G.cylinder(0.0078, 0.0078, 0.011, M.groundSteel, { seg: 18, pos: [0, 0.003, D.pushArm] }));
      rocker.position.set(x, S.yRockerShaft, s * S.rockerZ);
      rockerG.add(rocker);

      /* 气门 + 弹簧（上半段） */
      const vg = group('valve');
      vg.add(valveMesh(dia, M));
      vg.add(retainerMesh(M));
      const spUp = G.coilSpring(S.springOD / 2 - S.springWire, S.springWire, SPRING_INST / 2, 3.5, M.springSteel,
        { seg: 84, radial: 7, pos: [0, SPRING_Y0 + SPRING_INST * 0.75, 0] });
      vg.add(spUp);
      vg.position.set(cx, D.ySeat, s * S.valveOffsetZ);
      vg.rotation.x = s * t;
      valveG[kind].add(vg);
      springUppers.push(spUp);

      /* 弹簧（下半段，固定于缸盖） */
      const lower = group('springLower');
      lower.rotation.x = s * t;
      lower.position.set(cx, D.ySeat, s * S.valveOffsetZ);
      lower.add(G.coilSpring(S.springOD / 2 - S.springWire, S.springWire, SPRING_INST / 2, 3.5, M.springSteel,
        { seg: 84, radial: 7, pos: [0, SPRING_Y0 + SPRING_INST * 0.25, 0] }));
      lower.add(G.pipe(S.springOD / 2, 0.0115, 0.008, M.steelMatte, { seg: 30, pos: [0, SPRING_Y0 - 0.003, 0] }));
      springG.add(lower);

      perCyl.push({
        i, kind, s, x, valve: vg,
        tappet: tap, tappetY0: D.tappetTopY - 0.028,
        rod, rodY0: (yPushTop + yPushBot) / 2,
        rocker,
      });
    }
  });

  reg.add('valveIntake', valveG.intake, { explode: [0, 0.22, 0.18] });
  reg.add('valveExhaust', valveG.exhaust, { explode: [0, 0.22, -0.18] });
  reg.add('valveSpring', springG, { explode: [0, 0.26, 0], extraMeshes: springUppers });
  reg.add('tappet', tappetG, { explode: [0, -0.12, 0.14] });
  reg.add('pushrod', pushG, { explode: [0, 0.06, 0.16] });
  reg.add('rocker', rockerG, { explode: [0, 0.30, 0.16] });

  root.add(camG, valveG.intake, valveG.exhaust, springG, tappetG, pushG, rockerG);

  /* ---------------- 正时/驱动齿轮 ---------------- */
  const gears = group('gears');
  const camGear = G.gear(64, 0.0580, 0.026, M.nitride, { axis: 'x', pos: [-0.262, S.yCam, 0], holeR: 0.016, addendum: 0.0035 });
  const crankGear = G.gear(32, 0.0290, 0.026, M.nitride, { axis: 'x', pos: [-0.262, 0, 0], holeR: 0.015, addendum: 0.0035 });
  const idler = G.gear(22, 0.0240, 0.024, M.nitride, { axis: 'x', pos: [-0.262, 0.048, 0.050], holeR: 0.008, addendum: 0.0035 });
  const oilGear = G.gear(26, 0.0250, 0.022, M.shaftSteel, { axis: 'x', pos: [-0.262, -0.070, 0.055], holeR: 0.006, addendum: 0.003 });
  const injGear = G.gear(26, 0.0250, 0.022, M.shaftSteel, { axis: 'x', pos: [-0.262, -0.030, -0.070], holeR: 0.006, addendum: 0.003 });
  gears.add(camGear, crankGear, idler, oilGear, injGear);
  reg.add('timingGears', gears, { explode: [-0.14, 0, 0] });

  const injDrive = group('injDrive');
  injDrive.add(injGear.clone());
  reg.add('injectionDrive', injDrive, { explode: [-0.22, 0.02, -0.12] });

  return {
    root, perCyl, cam: camG,
    update(state) {
      camG.rotation.x = deg(state.theta) / 2;
      camGear.rotation.x = deg(state.theta) / 2;
      crankGear.rotation.x = deg(state.theta);
      idler.rotation.x = -deg(state.theta) * 0.62;
      oilGear.rotation.x = deg(state.theta) * 0.9;
      injGear.rotation.x = deg(state.theta) / 2;
      const ct = Math.cos(t), st = Math.sin(t);
      for (const p of perCyl) {
        const c = state.cylinders[p.i];
        const lift = p.kind === 'intake' ? c.iLift : c.eLift;
        p.valve.position.y = D.ySeat - lift * ct;
        p.valve.position.z = p.s * (S.valveOffsetZ + lift * st);
        p.tappet.position.y = p.tappetY0 + lift / S.camRatio;
        p.rocker.rotation.x = -p.s * (lift / D.valveArm);
        p.rod.position.y = p.rodY0 + lift / S.camRatio;
      }
    },
  };
}
