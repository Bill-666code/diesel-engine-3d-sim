/**
 * controls.js — 轻量轨道控制器（自写，无外部依赖）
 * 左键旋转 / 滚轮缩放 / 右键或 Shift+左键平移 / 双击聚焦 / 触摸单指旋转双指缩放平移
 */
import * as THREE from 'three';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export class Orbit {
  constructor(camera, dom, opts = {}) {
    this.camera = camera;
    this.dom = dom;
    this.target = opts.target ? opts.target.clone() : new THREE.Vector3(0, 0.1, 0);
    this.goalTarget = this.target.clone();
    this.theta = opts.theta ?? 1.05;     // 方位角
    this.phi = opts.phi ?? 1.12;         // 极角
    this.radius = opts.radius ?? 1.5;
    this.goal = { theta: this.theta, phi: this.phi, radius: this.radius };
    this.minRadius = 0.25; this.maxRadius = 4.2;
    this.damping = 0.12;
    this.enabled = true;
    this.autoRotate = 0;
    this._dragging = null;
    this._pointers = new Map();
    this._last = { x: 0, y: 0 };
    this._bind();
    this.update(0);
  }

  _bind() {
    const dom = this.dom;
    dom.style.touchAction = 'none';
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    dom.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      dom.setPointerCapture(e.pointerId);
      this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this._pointers.size === 1) {
        this._dragging = (e.button === 2 || e.shiftKey || e.ctrlKey) ? 'pan' : 'rotate';
        this._last = { x: e.clientX, y: e.clientY };
      } else if (this._pointers.size === 2) {
        this._dragging = 'pinch';
        this._pinch = this._pinchDist();
      }
    });
    dom.addEventListener('pointermove', (e) => {
      if (!this._pointers.has(e.pointerId)) return;
      this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this._dragging === 'rotate') {
        const dx = e.clientX - this._last.x, dy = e.clientY - this._last.y;
        this._last = { x: e.clientX, y: e.clientY };
        this.goal.theta -= dx * 0.0072;
        this.goal.phi = clamp(this.goal.phi - dy * 0.0072, 0.04, Math.PI - 0.04);
        this.theta = this.goal.theta; this.phi = this.goal.phi;
        this.userMoved = true;
      } else if (this._dragging === 'pan') {
        const dx = e.clientX - this._last.x, dy = e.clientY - this._last.y;
        this._last = { x: e.clientX, y: e.clientY };
        this._pan(dx, dy);
      } else if (this._dragging === 'pinch' && this._pointers.size === 2) {
        const d = this._pinchDist();
        this.goal.radius = clamp(this.goal.radius * (this._pinch / d), this.minRadius, this.maxRadius);
        this._pinch = d;
      }
    });
    const up = (e) => {
      this._pointers.delete(e.pointerId);
      if (this._pointers.size === 0) this._dragging = null;
      else if (this._pointers.size === 1) { this._dragging = 'rotate'; const p = [...this._pointers.values()][0]; this._last = { x: p.x, y: p.y }; }
    };
    dom.addEventListener('pointerup', up);
    dom.addEventListener('pointercancel', up);
    dom.addEventListener('wheel', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      const f = Math.exp(clamp(e.deltaY, -120, 120) * 0.0012);
      this.goal.radius = clamp(this.goal.radius * f, this.minRadius, this.maxRadius);
      if (!this.userMoved) { this.radius = this.goal.radius; }
      this.userMoved = true;
    }, { passive: false });
  }

  _pinchDist() {
    const p = [...this._pointers.values()];
    return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
  }

  _pan(dx, dy) {
    const scale = this.radius * 0.0016;
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 1);
    this.goalTarget.addScaledVector(right, -dx * scale).addScaledVector(up, dy * scale);
    this.target.copy(this.goalTarget);
    this.userMoved = true;
  }

  /** 平移到某点并设定距离 */
  focus(point, radius) {
    this.goalTarget.copy(point);
    if (radius) this.goal.radius = clamp(radius, this.minRadius, this.maxRadius);
    this.userMoved = true;
  }

  set(pose) {
    if (pose.theta !== undefined) this.goal.theta = pose.theta;
    if (pose.phi !== undefined) this.goal.phi = clamp(pose.phi, 0.04, Math.PI - 0.04);
    if (pose.radius !== undefined) this.goal.radius = clamp(pose.radius, this.minRadius, this.maxRadius);
    if (pose.target) this.goalTarget.copy(pose.target);
  }

  snap() {
    this.theta = this.goal.theta; this.phi = this.goal.phi; this.radius = this.goal.radius;
    this.target.copy(this.goalTarget);
  }

  update(dt) {
    if (this.autoRotate) this.goal.theta += this.autoRotate * dt;
    const k = 1 - Math.pow(1 - this.damping, Math.max(dt, 1 / 240) * 60);
    this.theta += (this.goal.theta - this.theta) * k;
    this.phi += (this.goal.phi - this.phi) * k;
    this.radius += (this.goal.radius - this.radius) * k;
    this.target.lerp(this.goalTarget, k);
    const sp = Math.sin(this.phi), cp = Math.cos(this.phi);
    this.camera.position.set(
      this.target.x + this.radius * sp * Math.sin(this.theta),
      this.target.y + this.radius * cp,
      this.target.z + this.radius * sp * Math.cos(this.theta),
    );
    this.camera.lookAt(this.target);
  }
}

export const VIEWS = {
  iso:      { theta: 0.92, phi: 1.10, radius: 1.62, target: [-0.02, 0.06, 0], label: { zh: '轴测', en: 'Iso' } },
  top:      { theta: 0.0,  phi: 0.10, radius: 1.30, target: [-0.02, 0.10, 0], label: { zh: '俯视', en: 'Top' } },
  side:     { theta: 0.0,  phi: Math.PI / 2, radius: 1.20, target: [-0.02, 0.08, 0], label: { zh: '侧视(进气侧)', en: 'Side' } },
  sideEx:   { theta: Math.PI, phi: Math.PI / 2, radius: 1.20, target: [-0.02, 0.08, 0], label: { zh: '侧视(排气侧)', en: 'Exh. side' } },
  front:    { theta: -Math.PI / 2, phi: Math.PI / 2, radius: 0.62, target: [-0.24, 0.10, 0], hide: ['radiator', 'fan', 'chargePipe', 'airFilter', 'intercooler'], label: { zh: '正视(正时端)', en: 'Front' } },
  rear:     { theta: Math.PI / 2, phi: Math.PI / 2, radius: 0.62, target: [0.22, 0.08, 0], hide: ['flywheelHousing', 'turbo'], label: { zh: '后视(飞轮端)', en: 'Rear' } },
  section:  { theta: 0.62, phi: 1.18, radius: 0.92, target: [0.00, 0.13, 0], label: { zh: '剖视', en: 'Section' } },
  bottom:   { theta: 0.35, phi: 2.70, radius: 1.20, target: [-0.02, 0.02, 0], label: { zh: '仰视(油底壳)', en: 'Bottom' } },
};
