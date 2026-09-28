/**
 * fluids.js — 冷却液 / 润滑油 / 空气 流动可视化
 * 粒子沿流线运动，速度与数量随转速、负荷、节温器开度与气门升程实时变化。
 */
import * as THREE from 'three';
import { SPEC, D } from './spec.js';
import { clamp } from './kinematics.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function spriteTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.75)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

class Stream {
  constructor(points, { color, size, count, speed, opacity = 0.9, blending = THREE.AdditiveBlending, closed = false }) {
    // 去除连续重复点，避免弧长表出现 NaN
    const pts = [];
    for (const p of points) {
      const q = p.isVector3 ? p : new THREE.Vector3(p[0], p[1], p[2]);
      if (!Number.isFinite(q.x) || !Number.isFinite(q.y) || !Number.isFinite(q.z)) continue;
      const last = pts[pts.length - 1];
      if (last && last.distanceToSquared(q) < 1e-8) continue;
      pts.push(q);
    }
    this.valid = pts.length >= 2;
    this.curve = new THREE.CatmullRomCurve3(pts, closed, 'catmullrom', 0.25);
    this.length = this.curve.getLength() || 1e-3;
    if (!Number.isFinite(this.length)) this.length = 1e-3;
    this.color = new THREE.Color(color);
    this.size = size;
    this.count = count;
    this.maxCount = count;
    this.speed = speed;
    this.t = new Float32Array(count);
    for (let i = 0; i < count; i++) this.t[i] = i / count;
    this.positions = new Float32Array(count * 3);
    this.alphas = new Float32Array(count);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: spriteTexture() }, uSize: { value: size }, uColor: { value: this.color },
        uScale: { value: 800 },
      },
      vertexShader: `
        attribute float aAlpha; varying float vA; uniform float uSize; uniform float uScale;
        void main(){ vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_PointSize = max(1.5, uSize * (uScale / max(-mv.z, 0.02))); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `
        uniform sampler2D uMap; uniform vec3 uColor; varying float vA;
        void main(){ vec4 t = texture2D(uMap, gl_PointCoord);
          gl_FragColor = vec4(uColor, t.a * vA); if(gl_FragColor.a < 0.01) discard; }`,
      transparent: true, depthWrite: false, blending,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    this.baseOpacity = opacity;
    // 半透明流线管：标示流动路径
    const tubeMat = new THREE.MeshStandardMaterial({
      color: this.color, transparent: true, opacity: 0.16, roughness: 0.25, metalness: 0.0,
      emissive: this.color, emissiveIntensity: 0.35, depthWrite: false, side: THREE.DoubleSide,
    });
    this.tube = new THREE.Mesh(new THREE.TubeGeometry(this.curve, 64, Math.max(size * 1.5, 0.008), 10, closed), tubeMat);
    this.tube.renderOrder = 4;
    this.tubeMat = tubeMat;
  }

  update(dt, rate) {
    if (!Number.isFinite(rate)) rate = 0;
    if (!Number.isFinite(dt)) dt = 0;
    const n = Math.round(clamp(this.maxCount * rate, 0, this.maxCount));
    this.geo.setDrawRange(0, n);
    if (n === 0) return;
    const v = rate * (this.speed / Math.max(this.length, 1e-4));
    for (let i = 0; i < n; i++) {
      let t = (this.t[i] + v * dt) % 1;
      if (!Number.isFinite(t)) t = (i / this.maxCount);
      t = Math.min(Math.max(t, 0), 0.99999);
      this.t[i] = t;
      let p;
      try { p = this.curve.getPointAt(t); } catch { p = this.curve.getPoint(t); }
      if (!p || !Number.isFinite(p.x)) continue;
      this.positions[i * 3] = p.x;
      this.positions[i * 3 + 1] = p.y;
      this.positions[i * 3 + 2] = p.z;
      this.alphas[i] = 1;
    }
    for (let i = n; i < this.maxCount; i++) this.alphas[i] = 0;
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
    this.mat.uniforms.uColor.value.copy(this.color).multiplyScalar(clamp(0.35 + rate * 0.75, 0.25, 1.4));
    this.tubeMat.opacity = 0.07 + 0.13 * clamp(rate, 0, 1.2);
    this.tubeMat.emissiveIntensity = 0.2 + 0.7 * clamp(rate, 0, 1.2);
  }
}

/**
 * @param {'oil'|'coolant'|'air'} kind
 */
export function buildFluids(kind, density = 1) {
  const root = new THREE.Group();
  root.name = 'fluid-' + kind;
  const streams = [];

  const add0 = (pts, o) => {
    if (density < 1) o = { ...o, count: Math.max(6, Math.round(o.count * density)) };
    const s = new Stream(pts, o);
    if (!s.valid) return;
    streams.push(s); root.add(s.points); root.add(s.tube);
  };
  if (kind === 'oil') {
    const add = add0;
    // 吸油 → 泵
    add([[0.000, -0.215, 0], [-0.090, -0.190, 0.010], [-0.190, -0.150, 0.030], [-0.222, -0.100, 0.052]],
      { color: 0xffa63a, size: 0.014, count: 90, speed: 1.1, opacity: 1, blending: THREE.NormalBlending });
    // 泵 → 滤清器
    add([[-0.180, -0.040, 0.070], [-0.120, -0.020, 0.120], [0.010, 0.010, 0.150], [0.050, 0.010, 0.152]],
      { color: 0xffa63a, size: 0.014, count: 80, speed: 1.3 });
    // 滤清器 → 冷却器
    add([[0.120, 0.016, 0.160], [0.200, 0.024, 0.140], [0.268, 0.060, 0.020], [0.272, 0.060, -0.120]],
      { color: 0xffa63a, size: 0.014, count: 80, speed: 1.3 });
    // 冷却器 → 主油道
    add([[0.266, -0.048, -0.148], [0.180, -0.020, -0.120], [0.020, 0.030, -0.090], [-0.100, 0.060, -0.078]],
      { color: 0xffa63a, size: 0.014, count: 80, speed: 1.2 });
    // 主油道
    add([[-0.230, SPEC.oilGalleryY, SPEC.oilGalleryZ], [-0.100, SPEC.oilGalleryY, SPEC.oilGalleryZ],
      [0.050, SPEC.oilGalleryY, SPEC.oilGalleryZ], [0.230, SPEC.oilGalleryY, SPEC.oilGalleryZ]],
      { color: 0xffb45a, size: 0.015, count: 150, speed: 1.0 });
    // 主轴承供油
    D.mainX.forEach((x) => {
      add([[x, SPEC.oilGalleryY, SPEC.oilGalleryZ], [x, 0.030, -0.055], [x, 0.006, -0.030], [x, -0.010, 0.030], [x, -0.060, 0.050]],
        { color: 0xffb45a, size: 0.012, count: 34, speed: 0.9 });
    });
    // 缸壁飞溅
    D.cylX.forEach((x) => {
      add([[x - 0.030, 0.075, -0.075], [x, 0.120, -0.060], [x + 0.010, 0.090, -0.042], [x - 0.010, 0.060, -0.040]],
        { color: 0xffc27a, size: 0.011, count: 26, speed: 0.7 });
    });
    // 摇臂轴供油
    add([[-0.230, SPEC.oilGalleryY, SPEC.oilGalleryZ], [-0.248, 0.180, -0.060], [-0.248, 0.330, -0.010],
      [-0.180, 0.345, SPEC.rockerZ], [0.180, 0.345, SPEC.rockerZ]],
      { color: 0xffb45a, size: 0.012, count: 90, speed: 0.9 });
  }

  if (kind === 'coolant') {
    const add = add0;
    // 缸盖出水 → 散热器上水管
    add([[-0.180, 0.200, 0.070], [-0.300, 0.245, 0.070], [-0.450, 0.300, 0.030], [-0.560, 0.340, -0.160]],
      { color: 0x36b6ff, size: 0.016, count: 110, speed: 1.2, key: 'rad' });
    // 散热器芯组
    add([[-0.560, 0.310, -0.160], [-0.560, 0.100, -0.160], [-0.560, -0.090, -0.160], [-0.560, -0.270, -0.160]],
      { color: 0x36b6ff, size: 0.017, count: 130, speed: 1.0, key: 'rad' });
    // 散热器下水 → 节温器 → 水泵
    add([[-0.560, -0.270, -0.160], [-0.470, -0.130, -0.060], [-0.330, 0.030, 0.030], [-0.290, 0.110, 0.062]],
      { color: 0x36b6ff, size: 0.016, count: 110, speed: 1.2, key: 'rad' });
    // 节温器旁通（小循环）
    add([[-0.262, 0.150, 0.062], [-0.230, 0.090, 0.078], [-0.150, 0.050, 0.090], [-0.060, 0.030, 0.096]],
      { color: 0x8ad8ff, size: 0.015, count: 80, speed: 1.1, key: 'bypass' });
    // 水泵 → 缸体水套
    add([[-0.246, 0.050, 0.062], [-0.160, 0.010, 0.090], [-0.040, -0.010, 0.098], [0.060, 0.010, 0.090], [0.150, 0.030, 0.086]],
      { color: 0x36b6ff, size: 0.016, count: 110, speed: 1.3 });
    // 水套环流（沿缸套上行）
    D.cylX.forEach((x, i) => {
      const a = i * 1.1;
      add([[x, 0.030, 0.048], [x + Math.cos(a) * 0.050, 0.090, Math.sin(a) * 0.050],
        [x + Math.cos(a + 2.1) * 0.050, 0.150, Math.sin(a + 2.1) * 0.050],
        [x + Math.cos(a + 4.2) * 0.048, 0.196, Math.sin(a + 4.2) * 0.048]],
        { color: 0x36b6ff, size: 0.015, count: 60, speed: 0.9 });
    });
    // 缸盖水套 → 出水
    add([[-0.160, 0.200, 0.060], [-0.120, 0.215, 0.078], [-0.030, 0.208, 0.080], [0.060, 0.200, 0.074]],
      { color: 0x36b6ff, size: 0.015, count: 90, speed: 1.0 });
  }

  if (kind === 'air') {
    const add = add0;
    // 空滤 → 稳压腔
    add([[0.180, 0.330, 0.250], [0.020, 0.322, 0.262], [-0.120, 0.296, 0.256], [-0.240, 0.268, 0.250]],
      { color: 0x8fd8ff, size: 0.017, count: 90, speed: 1.4 });
    // 压气机 → 中冷器 → 稳压腔
    add([[0.080, 0.268, -0.270], [-0.020, 0.340, -0.180], [-0.140, 0.386, 0.040], [-0.160, 0.392, 0.180]],
      { color: 0x9fe0ff, size: 0.016, count: 110, speed: 1.6, key: 'boost' });
    add([[-0.160, 0.352 - 0.130 - 0.010, 0.268], [-0.150, 0.330, 0.244], [-0.100, 0.300, 0.252], [-0.240, 0.268, 0.250]],
      { color: 0x9fe0ff, size: 0.016, count: 110, speed: 1.6, key: 'boost' });
    // 各缸进气
    D.cylX.forEach((x, i) => {
      add([[x, 0.268, 0.246], [x, 0.280, 0.180], [x, 0.284, 0.130], [x, 0.262, 0.104], [x, 0.238, 0.070], [x, 0.196, 0.030]],
        { color: 0x7fd0ff, size: 0.015, count: 70, speed: 1.8, key: 'intake' + i });
    });
    // 各缸排气 → 涡轮
    D.cylX.forEach((x, i) => {
      add([[x, 0.228, -0.040], [x, 0.236, -0.090], [x, 0.252, -0.160], [x, 0.268, -0.235],
        [0.060, 0.272, -0.262], [0.110, 0.270, -0.320]],
        { color: 0xffb27a, size: 0.015, count: 80, speed: 1.8, key: 'exhaust' + i });
    });
  }

  return {
    root, streams,
    update(state, dt, projScale) {
      if (projScale) for (const s of streams) s.mat.uniforms.uScale.value = projScale;
      const rpmN = clamp(state.rpm / SPEC.maxRpm, 0, 1.2);
      for (const s of streams) {
        let rate = 0, key = s.streamsKey;
        if (kind === 'oil') {
          rate = clamp(state.oilFlow / 90, 0, 1.3) * (0.25 + 0.75 * rpmN) * (state.running ? 1 : 0);
        } else if (kind === 'coolant') {
          const base = clamp(state.coolantFlow / 110, 0, 1.3);
          const k = s.key || '';
          if (k === 'rad') rate = base * (0.05 + 0.95 * state.thermostat);
          else if (k === 'bypass') rate = base * (0.15 + 0.85 * (1 - state.thermostat));
          else rate = base * (state.running ? 1 : 0);
        } else {
          const k = s.key || '';
          if (k === 'boost') rate = clamp(state.boost / SPEC.turboBoostMax, 0, 1.2) * 0.9 + rpmN * 0.1;
          else if (k.startsWith('intake')) {
            const i = +k.slice(6);
            rate = (state.cylinders[i]?.iLift / SPEC.valveLift) * 0.9 + 0.05;
          } else if (k.startsWith('exhaust')) {
            const i = +k.slice(7);
            rate = (state.cylinders[i]?.eLift / SPEC.valveLift) * 0.9 + 0.05;
          } else rate = 0.15 + rpmN * 0.6;
          if (!state.running) rate = 0;
        }
        s.update(dt, clamp(rate, 0, 1.4));
      }
    },
  };
}
