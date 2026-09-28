/**
 * kinematics.js — 四冲程运动学与热力学简化模型
 * 曲轴转角约定：0° = 1 缸做功上止点(TDC firing)
 *   0–180 做功 Power | 180–360 排气 Exhaust | 360–540 进气 Intake | 540–720 压缩 Compression
 */
import { SPEC, D } from './spec.js';

export const TAU = Math.PI * 2;
export const mod = (a, n) => ((a % n) + n) % n;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const deg = (d) => (d * Math.PI) / 180;

export const STROKES = [
  { key: 'power',       zh: '做功',  en: 'Power',       color: '#ff5a2b', range: [0, 180] },
  { key: 'exhaust',     zh: '排气',  en: 'Exhaust',     color: '#8b7ad6', range: [180, 360] },
  { key: 'intake',      zh: '进气',  en: 'Intake',      color: '#35b6ff', range: [360, 540] },
  { key: 'compression', zh: '压缩',  en: 'Compression', color: '#f2c14e', range: [540, 720] },
];

export function strokeOf(a) {
  a = mod(a, 720);
  for (const s of STROKES) if (a >= s.range[0] && a < s.range[1]) return s;
  return STROKES[3];
}

/** 曲柄滑块：活塞销中心高度 (m)，a 为该缸曲轴转角(°) */
export function pinY(a) {
  const r = SPEC.crankThrow, l = SPEC.rodLen;
  const ar = deg(a);
  return r * Math.cos(ar) + Math.sqrt(Math.max(l * l - r * r * Math.sin(ar) ** 2, 1e-9));
}

/** 连杆倾角 (rad) */
export function rodAngle(a) {
  return Math.asin((SPEC.crankThrow / SPEC.rodLen) * Math.sin(deg(a)));
}

/** 活塞顶面高度 (m, 相对曲轴中心线) */
export function crownY(a) {
  return pinY(a) + SPEC.compHeight;
}

export const yTop = SPEC.deckHeight;                 // 上止点缸顶
export const yBottom = yTop - SPEC.stroke;           // 下止点缸顶

/** 气缸容积 (m³) */
export function volume(a) {
  return D.Vc + D.cylArea * (yTop - crownY(a));
}

/** 摆线升程曲线 */
function cycloid(u) { return u - Math.sin(TAU * u) / TAU; }

/**
 * 气门升程 (m)：a 为该缸曲轴转角(°)
 * 事件用曲轴转角给出，升程曲线按摆线(等加速段)构造，最大升程处加速度最小。
 */
export function valveLift(a, open, close, maxLift = SPEC.valveLift) {
  a = mod(a, 720);
  let span = mod(close - open, 720);
  if (span < 1) span += 720;
  let p = mod(a - open, 720);
  if (p > span) return 0;
  const half = span / 2;
  const u = p <= half ? p / half : (span - p) / half;
  return maxLift * cycloid(clamp(u, 0, 1));
}

/** 供凸轮建模使用：相对桃尖(最大升程处)的凸轮转角 da(°) → 升程 (m) */
export function camProfileFn(open, close, maxLift = SPEC.valveLift) {
  const span = mod(close - open, 720) || 720;
  const half = span / 2;
  return (da) => {
    const u = (half - Math.abs(da)) / half;
    if (u <= 0) return 0;
    return maxLift * cycloid(clamp(u, 0, 1));
  };
}

/** 该事件的持续角 (曲轴°) */
export function eventDuration(open, close) {
  return mod(close - open, 720) || 720;
}

export const intakeLift = (a) => valveLift(a, SPEC.IVO, SPEC.IVC);
export const exhaustLift = (a) => valveLift(a, SPEC.EVO, SPEC.EVC);

/** 喷油器状态：提前角 ~ 喷油始点 a = 720 - 8 = 712（压缩上止点前 8°） */
export function injectorState(a) {
  const start = 720 - SPEC.injectionBTDC;
  let since = mod(a - start, 720);
  const dur = 26;          // 喷油持续角（曲轴°）
  const open = since < dur;
  const rate = open ? Math.sin(Math.PI * (since / dur)) : 0;
  return { open, rate, since, start, dur };
}

/** 柱塞泵（高压油泵）供油相位：以 720°/2 周期（每 360° 一次）供油一次 */
export function pumpPlunger(a) {
  const p = mod(a, 360);
  const camStart = 700;                     // 供油始点 ≈ 上止点前 20°
  let d = mod(p - camStart, 360);
  const dur = 90;
  if (d < dur) return Math.sin(Math.PI * (d / dur));          // 柱塞上升
  return 0;
}

export function ramp(cur, target, dt, rate) {
  const k = clamp(1 - Math.exp(-Math.max(dt, 0) / Math.max(rate, 1e-4)), 0, 1);
  return cur + (target - cur) * k;
}

/**
 * 发动机运行状态：转速、负荷、各缸运动学与压力温度
 */
export class EngineState {
  constructor() {
    this.running = true;
    this.rpmTarget = 900;
    this.rpm = 900;
    this.load = 0.2;              // 0..1 负荷率
    this.loadTarget = 0.2;
    this.theta = 0;               // 曲轴转角(°)，0 = 1 缸做功上止点
    this.timeScale = 1;
    this.autoLoad = true;
    this.simTime = 0;
    this.derate = 0;              // 瞬时转速波动（各缸燃烧不均）
    this.cylinders = SPEC.nCyl ? Array.from({ length: SPEC.nCyl }, (_, i) => ({
      i, a: 0, stroke: STROKES[0],
      crown: yTop, pin: 0, rod: 0,
      iLift: 0, eLift: 0, iOpen: false, eOpen: false,
      p: 101, T: 320, burn: 0, injector: { open: false, rate: 0 },
      pPeak: 101, TPeak: 400, vol: D.Vc,
    })) : [];
    this.coolantTemp = 88;
    this.oilTemp = 92;
    this.oilPressure = 1.8;       // bar
    this.boost = 0;               // Pa (相对大气)
    this.intakeTemp = 321;        // K
    this.exhaustTemp = 320;       // ℃
    this.torque = 0;              // N·m
    this.power = 0;               // kW
    this.fuelFlow = 0;            // L/h
    this.oilFlow = 0;             // L/min
    this.coolantFlow = 0;         // L/min
    this.radFlow = 0;             // L/min 散热器流量
    this.airMass = 0;             // kg/s
    this.thermostat = 1;          // 0 关 → 1 全开
    this.injectorPulse = 0;
    this.update(0);
  }

  /** 单缸瞬时功率（kW），用于曲轴转速波动与排气脉冲 */
  cylPower(c) {
    const pEff = (c.p - 100) * 1e3;             // Pa
    const mDot = this.load * 0.00042;           // kg/(s·cyl)
    if (mDot <= 1e-9) return 0;
    const q = 18.5e6;                            // 柴油 LHV J/kg
    return (mDot * q) / 1000;
  }

  update(dt, freezeAngle = false) {
    const S = SPEC;
    this.simTime += dt;
    this.rpm = ramp(this.rpm, this.running ? this.rpmTarget : 0, dt, 0.35);
    this.load = ramp(this.load, this.loadTarget, dt, 0.45);

    if (this.running && this.rpm > 1 && !freezeAngle) {
      const dTheta = (this.rpm / 60) * 360 * dt * this.timeScale;
      this.theta = mod(this.theta + dTheta, 720);
    }

    // ---- 增压压力 ----
    const boostTarget = Math.max(0, this.load * S.turboBoostMax * clamp((this.rpm - 650) / 1400, 0, 1.1));
    this.boost = ramp(this.boost, boostTarget, dt, 0.5);
    const pInt = 101325 + this.boost;
    this.intakeTemp = ramp(this.intakeTemp, 298 + this.boost / 4200, dt, 0.6);

    // ---- 各缸运动学 ----
    let totalWork = 0;
    for (let i = 0; i < S.nCyl; i++) {
      const c = this.cylinders[i];
      const a = mod(this.theta - S.firePhase[i], 720);
      c.a = a;
      c.stroke = strokeOf(a);
      c.crown = crownY(a);
      c.pin = pinY(a);
      c.rod = rodAngle(a);
      c.iLift = intakeLift(a);
      c.eLift = exhaustLift(a);
      c.iOpen = c.iLift > 1e-6;
      c.eOpen = c.eLift > 1e-6;
      c.injector = injectorState(a);
      this.injectorPulse = Math.max(this.injectorPulse, c.injector.rate * this.load);
      c.vol = volume(a);

      // ---- 压力/温度（简化指示图） ----
      const nPol = 1.33;
      const boostR = clamp(this.boost / S.turboBoostMax, 0, 1.2);
      const heat = 1 + 0.32 * this.load * clamp(boostR + 0.36, 0.2, 1.45);
      const Tpeak = (1150 + 1250 * this.load) * (0.72 + 0.28 * boostR);
      const Vmax = D.swept + D.Vc;
      const peakIdx = 12;                       // 最大爆发压力出现在上止点后 12°
      const volPeak = volume(peakIdx);
      const pPeak = pInt * (Vmax / volPeak) ** nPol * heat;
      const key = c.stroke.key;
      c.pPeak = pPeak;

      if (key === 'intake') {
        c.p = pInt * (1 - 0.03 * this.load);
        c.T = this.intakeTemp;
        c.burn = 0;
      } else if (key === 'compression') {
        const r = Vmax / c.vol;
        c.p = pInt * r ** nPol;
        c.T = this.intakeTemp * r ** (nPol - 1);
        c.burn = 0;
      } else if (key === 'power') {
        if (a < peakIdx) {
          const pc = pInt * (Vmax / c.vol) ** nPol;
          const f = 0.5 + 0.5 * Math.sin(Math.PI * clamp(a / peakIdx, 0, 1));
          c.p = lerp(pc, pPeak, f);
          c.T = lerp(this.intakeTemp * (Vmax / c.vol) ** (nPol - 1), Tpeak, f);
          c.burn = this.load * f;
        } else {
          const r = volPeak / Math.max(c.vol, 1e-9);
          c.p = pPeak * r ** nPol;
          c.T = Tpeak * r ** (nPol - 1);
          c.burn = this.load * clamp(1 - (a - peakIdx) / 170, 0, 1);
        }
      } else { // exhaust
        if (a < 200) {                       // 排气门开启前仍处于膨胀段
          c.p = pPeak * (volPeak / Math.max(c.vol, 1e-9)) ** nPol;
          c.T = Tpeak * (volPeak / Math.max(c.vol, 1e-9)) ** (nPol - 1);
        } else {
          c.p = pInt * (1 + 0.12 * this.load);
          c.T = lerp(900, 620 + 240 * this.load, clamp((a - 200) / 160, 0, 1));
        }
        c.burn = 0;
      }
      totalWork += this.cylPower(c);
    }

    // ---- 负荷曲线 ----
    const N = this.rpm;
    const dN = N - S.torqueRpm;
    const tqCurve = dN >= 0
      ? 1 - 0.55 * Math.pow(dN / 2600, 2)          // 高转速段：平缓衰减
      : 1 - 0.42 * Math.pow(dN / 1500, 2);         // 低转速段
    const tqMax = S.maxTorqueNm * clamp(tqCurve, 0.10, 1);
    this.torque = tqMax * this.load;
    this.power = (this.torque * N * TAU) / 60 / 1000;     // kW
    const rated = this.power / S.maxPowerKW;
    this.fuelFlow = (this.power * S.bsfc) / 840;          // L/h

    // ---- 润滑 ----
    const oilP = clamp(0.7 + 4.2 * (N / S.maxRpm), 0, 6.5);
    this.oilPressure = ramp(this.oilPressure, this.running ? oilP * clamp(1.3 - this.oilTemp / 220, 0.7, 1.1) : 0, dt, 0.4);
    this.oilTemp = ramp(this.oilTemp, 62 + 58 * clamp(N / S.maxRpm, 0, 1) + 18 * this.load, dt, 6);
    this.oilFlow = clamp((14 + 120 * (N / S.maxRpm)) * clamp(0.35 + this.load, 0.4, 1.35), 0, 160);

    // ---- 冷却 ----
    const coolantTarget = 82 + 16 * clamp(N / S.maxRpm, 0, 1) * (0.35 + 0.65 * this.load);
    this.coolantTemp = ramp(this.coolantTemp, this.running ? coolantTarget : 25, dt, 5);
    this.thermostat = clamp((this.coolantTemp - S.thermostatOpen) / (S.thermostatFull - S.thermostatOpen), 0, 1);
    this.coolantFlow = clamp((12 + 135 * (N / S.maxRpm)) * clamp(0.3 + this.load, 0.35, 1.3), 0, 170);
    this.radFlow = this.coolantFlow * (0.06 + 0.94 * this.thermostat);

    this.exhaustTemp = 210 + 430 * clamp(0.25 + this.load, 0, 1) * clamp(N / 2400, 0.35, 1.2);
    this.airMass = clamp((N / 1000) * 3.2e-4 * (1 + this.boost / 101325) * (0.3 + 0.7 * this.load), 0, 0.09);
    this.injectorPulse = Math.max(0, this.injectorPulse - dt * 6);
    this.derate = (totalWork / 1e3) / (S.maxPowerKW || 1);
  }

  /** 当前 1 缸的冲程文案 */
  strokeText(i = 0) {
    const c = this.cylinders[i];
    return { zh: c.stroke.zh, en: c.stroke.en, key: c.stroke.key };
  }
}
