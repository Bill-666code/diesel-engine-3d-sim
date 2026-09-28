/**
 * main.js — 启动、渲染循环、拾取与高亮
 */
import * as THREE from 'three';
import { createStage } from './scene.js';
import { EngineState } from './kinematics.js';
import { initUI } from './ui.js';

const container = document.getElementById('viewport');
const state = new EngineState();
let stage;
try {
  stage = createStage(container);
} catch (err) {
  console.error(err);
  document.body.insertAdjacentHTML('beforeend',
    `<div style="position:fixed;inset:0;display:grid;place-items:center;color:#e6edf3;font-size:14px;text-align:center;padding:40px">
       WebGL 初始化失败：${err.message}<br><span style="color:#9fb0c0;font-size:12px">请使用支持 WebGL2 的现代浏览器（Chrome / Edge / Firefox / Safari 16+）</span></div>`);
  throw err;
}

const ui = initUI(stage, state);

/* ---------------- 选中高亮框 ---------------- */
const outline = new THREE.Box3Helper(new THREE.Box3(), 0xffb03a);
outline.material.depthTest = false;
outline.material.transparent = true;
outline.material.opacity = 0.85;
outline.visible = false;
outline.renderOrder = 10;
stage.scene.add(outline);
const box = new THREE.Box3();

let selected = null;
function setSelected(rec) {
  selected = rec;
  ui.setCur(rec);
  if (!rec) { outline.visible = false; return; }
  outline.visible = true;
  box.setFromObject(rec.object);
  if (box.isEmpty()) outline.visible = false;
  outline.box.copy(box);
}
window.addEventListener('sim:deselect', () => { setSelected(null); ui.hideCard(); });

/* ---------------- 鼠标交互 ---------------- */
let hoverRec = null;
let mouseX = 0, mouseY = 0, moved = 0;
let downPos = null;

container.addEventListener('pointermove', (e) => {
  mouseX = e.clientX; mouseY = e.clientY;
  moved++;
});
container.addEventListener('pointerdown', (e) => { downPos = [e.clientX, e.clientY]; });
container.addEventListener('pointerup', (e) => {
  if (!downPos) return;
  const dist = Math.hypot(e.clientX - downPos[0], e.clientY - downPos[1]);
  downPos = null;
  if (dist > 5) return;                   // 拖拽，不算点击
  const hit = stage.pick(e.clientX, e.clientY);
  if (hit) {
    setSelected(hit.rec);
    ui.showCard(hit.rec, e.clientX, e.clientY);
  } else {
    setSelected(null);
    ui.hideCard();
  }
});

/* ---------------- 主循环 ---------------- */
const PARAMS = new URLSearchParams(location.search);
const STILL = PARAMS.has('still');      // 静帧模式：只渲染指定帧，便于低性能环境截图
let frameCount = 0;

let last = performance.now();
let fps = 60, frames = 0, fpsT = 0, cpuMs = 0;
let pickTimer = 0;

function renderFrame(dt) {
  state.update(dt);
  stage.update(state, dt);
  stage.renderer.render(stage.scene, stage.camera);
}

function loop(now) {
  requestAnimationFrame(loop);
  if (STILL) return;                     // 静帧模式：循环完全停用，仅由 renderAt 驱动
  const dt = Math.min(Math.max((now - last) / 1000, 0), 0.05);
  last = now;

  const tSim = performance.now();
  try {
    state.update(dt);
    stage.update(state, dt);
  } catch (err) {
    if (!window.__simErr) { window.__simErr = String(err && err.stack || err); console.error(err); }
  }
  cpuMs = cpuMs * 0.88 + (performance.now() - tSim) * 0.12;
  frameCount++;

  // 选中框跟随（部件会动）
  if (selected) {
    box.setFromObject(selected.object);
    if (!box.isEmpty()) { outline.box.copy(box); outline.visible = true; }
  }

  // 拾取（节流 ~30Hz）
  pickTimer += dt;
  if (pickTimer > 0.033 && stage.controls.enabled) {
    pickTimer = 0;
    const hit = stage.pick(mouseX, mouseY);
    hoverRec = hit ? hit.rec : null;
    if (hoverRec) {
      if (!selected || selected.id !== hoverRec.id) ui.showCard(hoverRec, mouseX, mouseY);
      else ui.showCard(hoverRec, mouseX, mouseY);
      container.style.cursor = 'pointer';
    } else if (!selected) {
      ui.hideCard();
      container.style.cursor = 'grab';
    }
  }

  stage.renderer.render(stage.scene, stage.camera);
  frames++; fpsT += dt;
  if (fpsT >= 0.5) { fps = frames / fpsT; frames = 0; fpsT = 0; }
  ui.update(state, fps, cpuMs);
}
requestAnimationFrame(loop);

/* ---------------- 尺寸自适应 ---------------- */
window.addEventListener('resize', () => stage.resize());

/* 调试用：暴露到控制台 */
window.__diesel = {
  THREE, stage, state, ui,
  /** 渲染指定曲轴转角的静帧（用于截图/测试） */
  renderAt(theta, { rpm = state.rpmTarget, load = state.loadTarget } = {}) {
    state.theta = theta; state.rpm = rpm; state.rpmTarget = rpm; state.load = load; state.loadTarget = load;
    state.simTime = theta / Math.max(rpm, 1) * 6;
    for (let k = 0; k < 240; k++) state.update(1 / 60, true);   // 让热力/流量参数收敛
    state.theta = theta;
    stage.update(state, 0);
    stage.renderer.render(stage.scene, stage.camera);
    ui.update(state, 60, cpuMs);
    return { theta: state.theta, rpm: state.rpm, load: state.load };
  },
};
