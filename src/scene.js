/**
 * scene.js — 场景装配：渲染器、光照、环境、剖视/半透明模式、拾取
 */
import * as THREE from 'three';
import { SPEC, D } from './spec.js';
import { makeEnvironment, createMaterials } from './materials.js';
import { PartRegistry } from './registry.js';
import { Orbit, VIEWS } from './controls.js';
import { buildFixed } from './builders/fixed.js';
import { buildHead } from './builders/head.js';
import { buildValvetrain } from './builders/valvetrain.js';
import { buildRotating } from './builders/rotating.js';
import { buildFuel } from './builders/fuel.js';
import { buildLubrication } from './builders/lubrication.js';
import { buildCooling } from './builders/cooling.js';
import { buildInduction } from './builders/induction.js';
import { buildDetails } from './builders/details.js';
import { buildFluids } from './fluids.js';

export function createStage(container, opts = {}) {
  const t0 = performance.now();
  const q = new URLSearchParams(location.search);
  const low = opts.lowFx ?? (q.get('q') === 'low');
  const capture = opts.capture ?? q.has('capture');   // 截图模式：保留绘制缓冲以便 toDataURL
  const renderer = new THREE.WebGLRenderer({ antialias: !low, preserveDrawingBuffer: capture, powerPreference: 'high-performance' });
  renderer.setPixelRatio(low ? 1 : Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = !low;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.localClippingEnabled = true;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x11151a);
  scene.fog = new THREE.Fog(0x11151a, 2.2, 5.2);

  const camera = new THREE.PerspectiveCamera(38, container.clientWidth / container.clientHeight, 0.02, 40);
  camera.position.set(0.8, 0.6, 1.1);

  scene.environment = makeEnvironment(renderer, low ? 128 : 256);
  scene.environmentIntensity = low ? 1.0 : 0.85;

  // 灯光
  const hemi = new THREE.HemisphereLight(0xdfe8ff, 0x20242a, low ? 1.1 : 0.45);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfffaf2, low ? 1.9 : 2.6);
  key.position.set(1.1, 2.0, 1.4);
  key.castShadow = !low;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.4;
  key.shadow.camera.far = 4.0;
  const sc = 0.85;
  key.shadow.camera.left = -sc; key.shadow.camera.right = sc;
  key.shadow.camera.top = sc; key.shadow.camera.bottom = -sc;
  key.shadow.bias = -0.0009;
  key.shadow.normalBias = 0.008;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xa8bcd8, 0.85);
  fill.position.set(-1.6, 0.9, -1.1);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffc79a, 0.35);
  rim.position.set(-0.4, -0.8, 1.8);
  scene.add(rim);

  // 地面
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(1.9, 72),
    new THREE.MeshStandardMaterial({ color: 0x1a1e24, metalness: 0.2, roughness: 0.85 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.34;
  ground.receiveShadow = true;
  scene.add(ground);
  const grid = new THREE.GridHelper(3.4, 34, 0x2c333c, 0x222831);
  grid.position.y = -0.338;
  grid.material.transparent = true;
  grid.material.opacity = 0.5;
  scene.add(grid);

  const M = createMaterials();
  const reg = new PartRegistry();
  const engine = new THREE.Group();
  scene.add(engine);

  const fixed = buildFixed(M, reg);
  const head = buildHead(M, reg);
  const vt = buildValvetrain(M, reg);
  const rot = buildRotating(M, reg);
  const fuel = buildFuel(M, reg);
  const lube = buildLubrication(M, reg);
  const cool = buildCooling(M, reg);
  const ind = buildInduction(M, reg);
  const det = buildDetails(M, reg);
  engine.add(fixed.root, head.root, vt.root, rot.root, fuel.root, lube.root, cool.root, ind.root, det.root);

  // 流体
  const fluids = {
    oil: buildFluids('oil', low ? 0.35 : 1),
    coolant: buildFluids('coolant', low ? 0.35 : 1),
    air: buildFluids('air', low ? 0.35 : 1),
  };
  console.info(`[diesel-sim] 场景装配完成 ${(performance.now() - t0).toFixed(0)} ms · 零件 ${reg.parts.size} 个`);
  engine.add(fluids.oil.root, fluids.coolant.root, fluids.air.root);

  const controls = new Orbit(camera, renderer.domElement, { target: new THREE.Vector3(-0.02, 0.06, 0), radius: 1.62, theta: 0.92, phi: 1.10 });

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  /* ---------- 剖视 / 半透明 ---------- */
  const clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.0);
  let sectionOn = false;
  let clipPos = 0.0;

  function setSection(on, pos) {
    sectionOn = on;
    if (pos !== undefined) clipPos = pos;
    clipPlane.constant = clipPos;
    M.setClip(on ? [clipPlane] : null);
  }

  return {
    renderer, scene, camera, controls, reg, materials: M, engine,
    modules: { fixed, head, vt, rot, fuel, lube, cool, ind, det, fluids },
    setGhost: (on) => M.setGhost(on),
    setSection,
    setFluidsVisible(kind, v) { if (fluids[kind]) fluids[kind].root.visible = v; },
    setSectionPos(p) { clipPos = p; clipPlane.constant = p; },
    setView(name) {
      const v = VIEWS[name] || VIEWS.iso;
      controls.set({
        theta: v.theta, phi: v.phi, radius: v.radius,
        target: new THREE.Vector3(...v.target),
      });
      // 视角预设自动隐藏遮挡件（返回其它视角时恢复）
      if (this._autoHidden) this._autoHidden.forEach((id) => reg.setVisible(id, true));
      this._autoHidden = v.hide || null;
      if (v.hide) v.hide.forEach((id) => reg.setVisible(id, false));
    },
    pick(clientX, clientY) {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(reg.pickables, false);
      for (const h of hits) {
        const rec = reg.fromObject(h.object);
        if (rec && rec.visible) return { rec, point: h.point, distance: h.distance };
      }
      return null;
    },
    update(state, dt) {
      controls.update(dt);
      rot.update(state);
      vt.update(state);
      fuel.update(state);
      lube.update(state);
      cool.update(state);
      ind.update(state);
      const projScale = renderer.domElement.clientHeight / (2 * Math.tan((camera.fov * Math.PI) / 360));
      fluids.oil.update(state, dt, projScale);
      fluids.coolant.update(state, dt, projScale);
      fluids.air.update(state, dt, projScale);
    },
    resize() {
      const w = container.clientWidth, h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    },
  };
}
