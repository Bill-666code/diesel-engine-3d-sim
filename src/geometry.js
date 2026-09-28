/**
 * geometry.js — 通用几何构件库
 * 所有函数均返回已经设置好投影/接收阴影属性的 Object3D。
 * 坐标约定：X = 曲轴轴向（−X 前端正时室，+X 后端飞轮），Y = 缸体高度，Z = 进(+)/排(−)气侧。
 */
import * as THREE from 'three';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

/** 旋转一个几何体使其轴向对齐 'x' | 'y' | 'z' */
export function orientAxis(geo, axis = 'y') {
  if (axis === 'x') geo.rotateZ(-Math.PI / 2);
  else if (axis === 'z') geo.rotateX(Math.PI / 2);
  return geo;
}

function finish(obj, { cast = true, receive = true } = {}) {
  obj.traverse((o) => {
    if (o.isMesh || o.isInstancedMesh) { o.castShadow = cast; o.receiveShadow = receive; }
  });
  return obj;
}

/** 圆柱 / 圆台 */
export function cylinder(rTop, rBot, h, mat, { axis = 'y', seg = 40, open = false, caps = true, pos, rot } = {}) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, open || caps === false);
  orientAxis(g, axis);
  const m = new THREE.Mesh(g, mat);
  if (pos) m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  return finish(m);
}

/** 圆管（内外双壁，带端环） */
export function pipe(rOut, rIn, h, mat, { axis = 'y', seg = 40, pos } = {}) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, rOut, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, rIn, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: seg });
  g.translate(0, 0, -h / 2);
  orientAxis(g, axis);
  const m = new THREE.Mesh(g, mat);
  if (pos) m.position.set(...pos);
  return finish(m);
}

/** 车削件：profile = [[r, y], ...] （单位 m，绕 Y 轴旋转） */
export function lathe(profile, mat, { seg = 48, axis = 'y', pos, rot, phiLength = Math.PI * 2 } = {}) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-6), y));
  const g = new THREE.LatheGeometry(pts, seg, 0, phiLength);
  orientAxis(g, axis);
  const m = new THREE.Mesh(g, mat);
  if (pos) m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  return finish(m);
}

/** 圆角长方体（铸件质感） */
export function roundedBox(w, h, d, r = 0.004, mat, { pos, rot, seg = 2 } = {}) {
  r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
  const shape = new THREE.Shape();
  const x = -w / 2 + r, y = -h / 2 + r, W = w - 2 * r, H = h - 2 * r;
  shape.moveTo(-w / 2, -h / 2 + r);
  shape.lineTo(-w / 2, y + H);
  shape.absarc(x + 0, y + H, r, Math.PI, Math.PI / 2, true);
  shape.lineTo(x + W, -h / 2);
  shape.absarc(x + W, y, r, -Math.PI / 2, 0, true);
  shape.lineTo(w / 2, y + H);
  shape.absarc(x + W, y + H, r, 0, Math.PI / 2, true);
  shape.lineTo(-w / 2, -h / 2 + r);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: d - 2 * r, bevelEnabled: true, bevelSize: r, bevelThickness: r, bevelSegments: seg, curveSegments: 8,
  });
  g.translate(0, 0, -(d - 2 * r) / 2 - r);
  const m = new THREE.Mesh(g, mat);
  if (pos) m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  return finish(m);
}

/** 由 2D 轮廓（XY 平面）拉伸成板件，holes 为孔洞数组 */
export function plate(shape, thickness, mat, { bevel = 0.0012, pos, rot, curveSegments = 28 } = {}) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: thickness - 2 * bevel, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel,
    bevelSegments: 1, curveSegments,
  });
  g.translate(0, 0, -(thickness - 2 * bevel) / 2 - bevel);
  const m = new THREE.Mesh(g, mat);
  if (pos) m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  return finish(m);
}

/** 矩形 Shape */
export function rectShape(w, h, cx = 0, cy = 0) {
  const s = new THREE.Shape();
  s.moveTo(cx - w / 2, cy - h / 2);
  s.lineTo(cx + w / 2, cy - h / 2);
  s.lineTo(cx + w / 2, cy + h / 2);
  s.lineTo(cx - w / 2, cy + h / 2);
  s.closePath();
  return s;
}

/** 在 Shape 上开圆孔 */
export function holeCircle(shape, cx, cy, r, seg = 40) {
  const p = new THREE.Path();
  p.absarc(cx, cy, r, 0, Math.PI * 2, true);
  p.curveSegments = seg;
  shape.holes.push(p);
  return shape;
}

/** 在 Shape 上开矩形窗 */
export function holeRect(shape, cx, cy, w, h) {
  const p = new THREE.Path();
  p.moveTo(cx - w / 2, cy - h / 2);
  p.lineTo(cx - w / 2, cy + h / 2);
  p.lineTo(cx + w / 2, cy + h / 2);
  p.lineTo(cx + w / 2, cy - h / 2);
  p.closePath();
  shape.holes.push(p);
  return shape;
}

/** 六角柱（螺栓/螺母） */
export function hexPrism(acrossFlats, h, mat, { axis = 'y', pos, rot, chamfer = true } = {}) {
  const r = acrossFlats / 2 / Math.cos(Math.PI / 6);
  const g = chamfer
    ? new THREE.CylinderGeometry(r, r, h, 6, 1)
    : new THREE.CylinderGeometry(r, r, h, 6, 1);
  orientAxis(g, axis);
  const m = new THREE.Mesh(g, mat);
  if (pos) m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  return finish(m);
}

/** 一颗六角螺栓（含垫圈），沿 +Y 从底面向上 */
export function bolt(dia, len, mat, matWasher, { pos, rot, axis = 'y', washer = true } = {}) {
  const g = new THREE.Group();
  const headH = dia * 0.66;
  const head = hexPrism(dia, headH, mat, { axis });
  head.position.y = len / 2 + headH / 2;
  g.add(head);
  const shaft = cylinder(dia * 0.5, dia * 0.5, len, mat, { axis, seg: 16 });
  g.add(shaft);
  if (washer && matWasher) {
    const w = cylinder(dia * 0.86, dia * 0.86, dia * 0.16, matWasher, { axis, seg: 20 });
    w.position.y = len / 2 + dia * 0.08;
    g.add(w);
  }
  if (pos) g.position.set(...pos);
  if (rot) g.rotation.set(...rot);
  return finish(g);
}

/** 螺栓阵列（InstancedMesh，性能友好） */
export function boltArray(positions, dia, len, mat, { axis = 'y', flip = false, washer = true, matWasher } = {}) {
  const geo = new THREE.Group();
  const headH = dia * 0.66;
  const parts = [
    { geo: new THREE.CylinderGeometry(dia / 2 / Math.cos(Math.PI / 6), dia / 2 / Math.cos(Math.PI / 6), headH, 6), y: len / 2 + headH / 2 },
    { geo: new THREE.CylinderGeometry(dia * 0.5, dia * 0.5, len, 14), y: 0 },
  ];
  if (washer) parts.push({ geo: new THREE.CylinderGeometry(dia * 0.86, dia * 0.86, dia * 0.16, 18), y: len / 2 + dia * 0.08 });
  const list = [];
  for (const p of parts) {
    orientAxis(p.geo, axis);
    const m = new THREE.InstancedMesh(p.geo, p === parts[0] || p === parts[2] ? mat : mat, parts.length);
    m.userData.mat = p === parts[0] ? mat : (p === parts[2] ? (matWasher || mat) : mat);
    list.push(m);
  }
  const dummy = new THREE.Object3D();
  positions.forEach((p, i) => {
    parts.forEach((part, k) => {
      const mm = list[k];
      dummy.position.set(p[0], p[1] + part.y * (flip ? -1 : 1), p[2]);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mm.setMatrixAt(i, dummy.matrix);
    });
  });
  const g = new THREE.Group();
  list.forEach((m) => {
    m.material = m.userData.mat;
    m.instanceMatrix.needsUpdate = true;
    g.add(m);
  });
  return finish(g, { receive: false });
}

/** 齿轮（渐开线近似：梯形齿廓） */
export function gear(teeth, rPitch, width, mat, { axis = 'x', pos, holeR = 0, addendum = 0.0 } = {}) {
  const shape = new THREE.Shape();
  const ra = rPitch + addendum;
  const rd = rPitch - addendum * 1.6;
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a0 = i * step;
    const p = (ang, r) => [Math.cos(ang) * r, Math.sin(ang) * r];
    const A = p(a0 + step * 0.02, rd);
    const B = p(a0 + step * 0.16, ra);
    const C = p(a0 + step * 0.34, ra);
    const D = p(a0 + step * 0.48, rd);
    if (i === 0) shape.moveTo(A[0], A[1]); else shape.lineTo(A[0], A[1]);
    shape.lineTo(B[0], B[1]);
    shape.lineTo(C[0], C[1]);
    shape.lineTo(D[0], D[1]);
    const E = p(a0 + step * 0.66, rd);
    shape.lineTo(E[0], E[1]);
  }
  shape.closePath();
  if (holeR > 0) holeCircle(shape, 0, 0, holeR, 32);
  const g = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: true, bevelSize: width * 0.06, bevelThickness: width * 0.06, bevelSegments: 1, curveSegments: 4 });
  g.translate(0, 0, -width / 2);
  orientAxis(g, axis);
  const m = new THREE.Mesh(g, mat);
  if (pos) m.position.set(...pos);
  return finish(m);
}

/** 蜗轮/凸轮：cam lobe 轮廓（基圆 + 升程曲线） */
export function camLobe(baseR, lift, width, liftFn, mat, { pos, noseAngle = 0, axis = 'x', seg = 72 } = {}) {
  const shape = new THREE.Shape();
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    // liftFn(camAngleFromNose) -> lift (m)
    let da = a - noseAngle;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    const r = baseR + liftFn(da);
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  const hole = new THREE.Path();
  hole.absarc(0, 0, baseR * 0.42, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: true, bevelSize: 0.0008, bevelThickness: 0.0008, bevelSegments: 1, curveSegments: 4 });
  g.translate(0, 0, -width / 2);
  orientAxis(g, axis);
  const m = new THREE.Mesh(g, mat);
  if (pos) m.position.set(...pos);
  return finish(m);
}

/** 螺旋弹簧（TubeGeometry） */
export function coilSpring(rCoil, rWire, length, coils, mat, { axis = 'y', pos, seg = 96, radial = 7 } = {}) {
  const pts = [];
  const n = Math.max(32, Math.floor(coils * 8));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = t * coils * Math.PI * 2;
    pts.push(V3(Math.cos(a) * rCoil, (t - 0.5) * length, Math.sin(a) * rCoil));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const g = new THREE.TubeGeometry(curve, seg, rWire, radial, false);
  if (axis === 'x') g.rotateZ(-Math.PI / 2);
  else if (axis === 'z') g.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  if (pos) m.position.set(...pos);
  return finish(m);
}

/** 沿曲线的管（进排气管、高压油管、水管） */
export function tubeAlong(points, radius, mat, { seg = 80, radial = 14, closed = false, taper = null } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => (p.isVector3 ? p : V3(...p))), closed, 'catmullrom', 0.2);
  const g = new THREE.TubeGeometry(curve, seg, radius, radial, closed);
  if (taper) {
    // 简易锥化：按 t 缩放截面
    const pos = g.attributes.position;
    const frames = curve.computeFrenetFrames(seg, closed);
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      const rr = taper(t);
      for (let j = 0; j <= radial; j++) {
        const idx = i * (radial + 1) + j;
        const cx = frames.normals[i].clone().multiplyScalar(0).copy(curve.getPointAt(t));
        const off = new THREE.Vector3(pos.getX(idx), pos.getY(idx), pos.getZ(idx)).sub(cx).multiplyScalar(rr / radius);
        pos.setXYZ(idx, cx.x + off.x, cx.y + off.y, cx.z + off.z);
      }
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
  }
  return finish(new THREE.Mesh(g, mat));
}

/** 软管（波纹） */
export function hose(points, radius, mat, { seg = 70, radial = 12, rib = 0.0018 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => V3(...p)), false, 'catmullrom', 0.2);
  const g = new THREE.TubeGeometry(curve, seg, radius, radial, false);
  const pos = g.attributes.position, nrm = g.attributes.normal;
  const frames = curve.computeFrenetFrames(seg, false);
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const c = curve.getPointAt(t);
    const bump = 1 + 0.055 * Math.sin(t * seg * 1.9);
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      const p = new THREE.Vector3(pos.getX(idx), pos.getY(idx), pos.getZ(idx));
      const off = p.clone().sub(c);
      p.copy(c).add(off.multiplyScalar(bump));
      pos.setXYZ(idx, p.x, p.y, p.z);
    }
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return finish(new THREE.Mesh(g, mat));
}

/** 旋转体外流线（蜗壳/叶轮等） */
export function volute(rIn, rOut, turns, height, mat, { seg = 90, axis = 'x', pos } = {}) {
  const pts = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const a = t * turns * Math.PI * 2;
    const r = rIn + (rOut - rIn) * t;
    pts.push(new THREE.Vector3(t * height, Math.cos(a) * r, Math.sin(a) * r));
  }
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, 0.010, 10, false);
  orientAxis(g, axis);
  const m = new THREE.Mesh(g, mat);
  if (pos) m.position.set(...pos);
  return finish(m);
}

/** 叶轮（离心泵/涡轮） */
export function impeller(rHub, rOuter, blades, height, mat, { pos, axis = 'x' } = {}) {
  const g = new THREE.Group();
  g.add(cylinder(rHub, rHub, height, mat, { axis, seg: 28, pos: [0, 0, 0] }));
  const disc = pipe(rOuter * 0.98, rHub, height * 0.28, mat, { axis, seg: 36 });
  disc.position.x = -height * 0.3;
  g.add(disc);
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2;
    const shape = new THREE.Shape();
    shape.moveTo(rHub * 0.9, -height * 0.06);
    shape.quadraticCurveTo(rOuter * 0.75, 0, rOuter * 0.98, height * 0.1);
    shape.lineTo(rOuter * 0.98, height * 0.3);
    shape.quadraticCurveTo(rOuter * 0.7, height * 0.26, rHub * 0.9, height * 0.3);
    shape.closePath();
    const b = plate(shape, height * 0.1, mat, { bevel: 0.0004 });
    b.rotation.z = a;
    g.add(b);
  }
  if (pos) g.position.set(...pos);
  return finish(g);
}

/** 风扇（多叶片，带后倾扭角） */
export function fan(rOuter, blades, height, mat, { pos, axis = 'x' } = {}) {
  const g = new THREE.Group();
  const hub = lathe([[0, -height / 2], [rOuter * 0.20, -height / 2], [rOuter * 0.20, height / 2], [0, height / 2]], mat, { seg: 28, axis });
  g.add(hub);
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2;
    const shape = new THREE.Shape();
    shape.moveTo(rOuter * 0.18, 0.0);
    shape.quadraticCurveTo(rOuter * 0.55, rOuter * 0.13, rOuter * 0.97, rOuter * 0.15);
    shape.quadraticCurveTo(rOuter * 1.0, rOuter * 0.05, rOuter * 0.92, -rOuter * 0.10);
    shape.quadraticCurveTo(rOuter * 0.55, -rOuter * 0.10, rOuter * 0.18, -rOuter * 0.02);
    shape.closePath();
    const b = plate(shape, height * 0.10, mat, { bevel: 0.0008 });
    b.rotation.set(0, Math.PI / 2, 0);       // 叶片法线沿 X
    const holder = new THREE.Group();
    holder.rotation.x = a;
    holder.add(b);
    b.rotation.set(0, Math.PI / 2, -0.42);   // 后倾
    g.add(holder);
  }
  if (pos) g.position.set(...pos);
  return finish(g);
}

/** O 型密封圈 / 垫片环 */
export function oring(r, tubeR, mat, { axis = 'y', pos, seg = 48 } = {}) {
  const curve = new THREE.EllipseCurve(0, 0, r, r, 0, Math.PI * 2, false, 0);
  const pts = curve.getPoints(seg).map((p) => new THREE.Vector3(p.x, p.y, 0));
  const c = new THREE.CatmullRomCurve3(pts, true);
  const g = new THREE.TubeGeometry(c, seg, tubeR, 8, true);
  orientAxis(g, axis);
  const m = new THREE.Mesh(g, mat);
  if (pos) m.position.set(...pos);
  return finish(m, { cast: false });
}

/** 多层钢垫片：带孔轮廓的薄板 */
export function gasketPlate(shape, thickness, mat, { pos, rot } = {}) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 30 });
  g.translate(0, 0, -thickness / 2);
  const m = new THREE.Mesh(g, mat);
  if (pos) m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  m.castShadow = false;
  return m;
}

/** V 带（皮带）：按支撑函数求多轮包络，适用于共面带轮
 *  pulleys: [{c:[x,y,z], r}] 所有带轮应位于同一 x 平面
 */
export function beltLoop(pulleys, width, thick, mat, samples = 96) {
  const x0 = pulleys[0].c[0];
  const pts = [];
  for (let k = 0; k < samples; k++) {
    const a = (k / samples) * Math.PI * 2;
    const uy = Math.cos(a), uz = Math.sin(a);
    let best = null, bv = -Infinity;
    for (const p of pulleys) {
      const v = p.c[1] * uy + p.c[2] * uz + p.r;
      if (v > bv) { bv = v; best = p; }
    }
    pts.push(new THREE.Vector3(x0, best.c[1] + uy * best.r, best.c[2] + uz * best.r));
  }
  return tubeAlong(pts.map((v) => [v.x, v.y, v.z]), thick, mat, { seg: 180, radial: 6, closed: true });
}

/** 半透明流线管（油道/水套/气道示意） */
export function flowPipe(points, r, mat, { seg = 60, radial = 12 } = {}) {
  return tubeAlong(points, r, mat, { seg, radial });
}

export function group(name, children = []) {
  const g = new THREE.Group();
  g.name = name;
  children.forEach((c) => c && g.add(c));
  return g;
}
