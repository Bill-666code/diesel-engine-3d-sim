/**
 * registry.js — 零件登记表：几何体 ↔ 元数据 ↔ 拆解位移
 */
import * as THREE from 'three';
import { PART_INFO } from './data/parts.js';

export class PartRegistry {
  constructor() {
    this.parts = new Map();
    this.pickables = [];
    this._byId = new Map();
  }

  /**
   * @param {string} id 零件编号（见 data/parts.js）
   * @param {THREE.Object3D} obj 零件根对象（需为其设置材质/变换）
   * @param {object} opts { explode:[x,y,z], pick:true, noShadow }
   */
  add(id, obj, opts = {}) {
    const info = PART_INFO[id];
    if (!info) console.warn('[registry] 缺少零件元数据:', id);
    const rec = {
      id,
      info: info || { name: { zh: id, en: id }, group: '其它', material: '-', process: '-', fn: { zh: '-', en: '-' }, specs: [] },
      object: obj,
      home: obj.position.clone(),
      explode: new THREE.Vector3(...(opts.explode || [0, 0, 0])),
      visible: true,
      castable: opts.pick !== false,
    };
    obj.userData.partId = id;
    obj.traverse((o) => {
      if (o.isMesh || o.isInstancedMesh) {
        o.userData.partId = id;
        if (opts.pick !== false) rec.meshes = (rec.meshes || []).concat(o);
      }
    });
    // 挂在其它零件内部的从属网格（如气门弹簧上半段）
    (opts.extraMeshes || []).forEach((m) => {
      m.userData.partId = id;
      (rec.meshes = rec.meshes || []).push(m);
    });
    if (rec.meshes) this.pickables.push(...rec.meshes);
    this.parts.set(id, rec);
    return rec;
  }

  get(id) { return this.parts.get(id); }
  obj(id) { return this.parts.get(id)?.object; }

  setExplode(t) {
    for (const rec of this.parts.values()) {
      rec.object.position.copy(rec.home).addScaledVector(rec.explode, t);
    }
  }

  setVisible(id, v) {
    const rec = this.parts.get(id);
    if (!rec) return;
    rec.visible = v;
    rec.object.visible = v;
    if (!v) this.pickables = this.pickables.filter((m) => m.userData.partId !== id);
    else if (rec.meshes && !this.pickables.includes(rec.meshes[0])) this.pickables.push(...rec.meshes);
  }

  /** 从射线命中的 mesh 找到零件记录 */
  fromObject(obj) {
    let o = obj;
    while (o && !o.userData.partId) o = o.parent;
    return o ? this.parts.get(o.userData.partId) : null;
  }
}
