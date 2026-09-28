/**
 * spec.js — 四冲程柴油机主参数（唯一真值来源）
 * Four-stroke diesel engine master specification.
 * 单位: SI (m, s, K, Pa)。界面显示时换算为 mm / bar / rpm / kW。
 */

export const SPEC = {
  // ---- 基本参数 Basic ----
  code: 'DF4190-2.0TDi',
  name: { zh: '四冲程直列四缸涡轮增压柴油机', en: '4-Stroke Inline-4 Turbocharged Diesel Engine' },
  type: { zh: '水冷 / 顶置气门(OHV) / 废气涡轮增压 / 空中冷', en: 'Water-cooled / OHV / Turbocharged / Air-intercooled' },
  displacementL: 1.997,           // 排量 L（由缸径冲程算出，见 computeDerived）
  compressionRatio: 21.0,          // 压缩比（由燃烧室几何算出）

  // ---- 缸体缸径行程 Cylinder geometry ----
  bore: 0.0850,                    // 缸径 85 mm
  stroke: 0.0880,                  // 行程 88 mm
  nCyl: 4,
  spacing: 0.1040,                 // 缸心距 104 mm
  rodLen: 0.1340,                  // 连杆中心距 134 mm
  crankThrow: 0.0440,              // 曲柄半径(偏心距) 44 mm
  deckHeight: 0.2160,              // 缸体上平面高度 216 mm
  compHeight: 0.0380,              // 活塞压缩高 38 mm
  pinOffset: 0.0005,               // 活塞销偏心 0.5 mm（偏置向排气侧）

  // ---- 燃烧室 Combustion chamber ----
  headChamberD: 0.0800,            // 缸盖燃烧室沉孔直径 80 mm
  headChamberDepth: 0.0032,        // 沉孔深 3.2 mm
  headDomeH: 0.0011,               // 沉孔顶部球冠高 1.1 mm
  pistonBowlD: 0.0600,             // 活塞顶燃烧碗直径 60 mm
  pistonBowlH: 0.0019,             // 燃烧碗深度 1.9 mm
  deckGap: 0.0009,                 // 顶隙 0.9 mm

  // ---- 配气机构 Valvetrain (SOHC 8V, 推杆摇臂) ----
  nValve: 2,                       // 每缸 1进 1排
  valveDIntake: 0.0420,
  valveDExhaust: 0.0340,
  valveStemD: 0.0095,
  valveStemLen: 0.1200,            // 阀锥面到杆端 120 mm
  valveTilt: 3 * Math.PI / 180,    // 气门夹角 ±3°
  valveLift: 0.0120,               // 气门最大升程 12 mm
  lash: 0.0003,                    // 气门间隙 0.3 mm
  camBaseR: 0.0255,
  camLobeW: 0.0100,
  camRatio: 1.600,                 // 摇臂比 1.6
  valveOffsetZ: 0.0240,            // 气门中心距中面 ±24 mm（进/排气门中心距 48 mm）
  pushrodOffsetX: 0.0280,          // 挺柱/凸轮桃相对缸心轴向偏移 ±28 mm
  rockerZ: 0.0480,                 // 摇臂轴平面 z = ±48 mm（推杆在摇臂轴外侧，阀杆在内侧）
  tappetOD: 0.0240,
  springOD: 0.0300,
  springWire: 0.0027,
  springFree: 0.0640,
  springInstalled: 0.0520,

  // ---- 配气正时 Valve timing (曲轴转角, 0° = 做功上止点 TDC firing) ----
  // 循环: 做功 0-180 / 排气 180-360 / 进气 360-540 / 压缩 540-720
  IVO: 348, IVC: 582,              // 进气门 开(上止点前12°)/关(下止点后42°)
  EVO: 130, EVC: 374,              // 排气门 开(下止点前50°)/关(上止点后14°)
  injectionBTDC: 8,                // 喷油提前角 8° ATDC(压缩上止点)

  // ---- 曲轴连杆轴颈 Crankshaft ----
  mainJournalD: 0.0600,
  rodJournalD: 0.0480,
  mainWidth: 0.0340,
  rodWidth: 0.0300,
  counterweightR: 0.1000,
  mainWebWidth: 0.0220,
  flywheelD: 0.4000,
  flywheelT: 0.0450,

  // ---- 主要轴系高度 Axes ----
  yCrank: 0.0,
  yCam: -0.0300,                   // 凸轮轴中心线（缸体挺柱室内）
  yTappet: -0.0045,                // 挺柱顶面 = 凸轮基圆接触点
  yRockerShaft: 0.3450,
  yHeadBottom: 0.2172,             // 缸盖底面(垫片 1.2mm)
  yHeadTop: 0.3422,                // 缸盖顶面 125 mm 厚
  yCoverTop: 0.3980,
  yBlockBottom: -0.1500,
  yPanBottom: -0.2860,

  // ---- 总体尺寸 Overall ----
  blockLen: 0.4900,                // X 方向
  blockWidth: 0.2000,              // Z 方向
  headLen: 0.4800,
  headWidth: 0.1900,
  xFront: -0.3000,                 // 正时齿轮室前端
  xFlywheel: 0.3600,

  // ---- 润滑 Lubrication ----
  oilGalleryY: 0.0700, oilGalleryZ: -0.0780, oilGalleryD: 0.0180,
  oilPanVol: 11.5,                 // L
  filterSpec: 'LF9080 机油滤清器',
  oilGrade: 'CI-4 / 15W-40',

  // ---- 冷却 Cooling ----
  jacketOD: 0.1080,                // 水套外径
  linerOD: 0.0930,
  thermostatOpen: 82,              // ℃ 起开
  thermostatFull: 95,

  // ---- 增压 Turbocharger ----
  turboBoostMax: 115000,          // 相对环境的最大增压压力 115 kPa（单位 Pa）
  intercoolerD: 0.2600,

  // ---- 性能 Performance ----
  idleRpm: 750,
  maxRpm: 4200,
  powerRpm: 3600,
  maxPowerKW: 63,
  torqueRpm: 1900,
  maxTorqueNm: 220,
  bsfc: 212,                       // g/kWh

  firingOrder: [1, 3, 4, 2],
  // 缸 1..4 的做功上止点对应的曲轴转角（曲轴 0° = 1 缸做功上止点）
  firePhase: [0, 540, 180, 360],
};

/** 派生量：体积、压缩比、缸心坐标等 */
export function computeDerived(s = SPEC) {
  const cylArea = Math.PI * 0.25 * s.bore * s.bore;
  const swept = cylArea * s.stroke;                 // 单缸排量 m³
  const disp = swept * s.nCyl;

  // 压缩比：缸盖燃烧室沉孔 + 球冠 + 活塞碗 + 燃烧室口环面顶隙
  const a = s.headChamberD / 2;
  const throat = Math.PI * 0.25 * s.headChamberD ** 2 * s.headChamberDepth;
  const h = s.headDomeH;
  const Rs = (a * a + h * h) / (2 * h);                 // 球冠球半径
  const dome = Math.PI * h * h * (Rs - h / 3);
  const bowl = Math.PI * 0.25 * s.pistonBowlD ** 2 * s.pistonBowlH;
  const land = (Math.PI * 0.25 * s.bore ** 2 - Math.PI * 0.25 * s.headChamberD ** 2) * s.deckGap;
  const Vc = throat + dome + bowl + land;                // 余隙容积
  const eps = (swept + Vc) / Vc;

  const cylX = [];
  for (let i = 0; i < s.nCyl; i++) cylX.push((i - (s.nCyl - 1) / 2) * s.spacing);
  const mainX = [-0.208, -0.104, 0.0, 0.104, 0.208];

  // 配气机构杠杆：阀端在摇臂轴内侧，推杆端在外侧
  const valveTipZ = s.valveOffsetZ + s.valveStemLen * Math.sin(s.valveTilt);
  const valveArm = s.rockerZ - valveTipZ;
  const pushArm = valveArm / s.camRatio;
  const pushrodZ = s.rockerZ + pushArm;

  return {
    cylArea, swept, disp, dispL: disp * 1e3, throat, dome, bowl, land, Vc, eps,
    cylX, mainX,
    ySeat: s.yHeadBottom + s.headChamberDepth + s.headDomeH * 0.5,
    rodRatio: s.rodLen / s.stroke,
    volL: s.cylArea * s.stroke * s.nCyl * 1e3,
    valveTipZ, valveArm, pushArm, pushrodZ,
    yValveTip: s.yHeadBottom + s.headChamberDepth + s.headDomeH * 0.5 + s.valveStemLen * Math.cos(s.valveTilt),
    tappetTopY: s.yCam + s.camBaseR,
  };
}

export const D = computeDerived();

/** 缸号 → X 坐标 */
export const cylX = (i) => D.cylX[i];
/** 主轴承序号 → X 坐标 */
export const mainX = (i) => D.mainX[i];
