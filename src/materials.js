/**
 * materials.js — PBR 材质库 + 程序化环境光照
 * 所有外壳（缸体/缸盖/油底壳…）材质登记在 cutMats 中，供剖视/半透明模式统一处理。
 */
import * as THREE from 'three';

const std = (o) => new THREE.MeshStandardMaterial(o);
const phys = (o) => new THREE.MeshPhysicalMaterial(o);

export function makeEnvironment(renderer, size = 256) {
  // 程序化“摄影棚”环境：顶部柔光 + 两侧冷暖补光 + 地面反光
  const scene = new THREE.Scene();
  const box = new THREE.BoxGeometry(12, 8, 12);
  box.deleteAttribute('uv');
  const room = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: 0x1b1f24, side: THREE.BackSide }));
  scene.add(room);

  const panel = (w, h, color, intensity, pos, rot) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...pos);
    if (rot) m.rotation.set(...rot);
    scene.add(m);
    return m;
  };
  panel(9, 9, 0xffffff, 2.6, [0, 3.9, 0], [Math.PI / 2, 0, 0]);           // 顶光
  panel(6, 5, 0xdfe8ff, 1.5, [-5.9, 1.2, 0], [0, Math.PI / 2, 0]);          // 冷侧光
  panel(6, 5, 0xffeedd, 0.9, [5.9, 0.6, 0], [0, -Math.PI / 2, 0]);         // 暖侧光
  panel(8, 6, 0xaabbcc, 0.7, [0, 0.4, -5.9], [0, 0, 0]);                    // 背光
  panel(10, 10, 0x2a2f36, 0.5, [0, -3.9, 0], [-Math.PI / 2, 0, 0]);          // 地面

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const rt = pmrem.fromScene(scene, 0.02, 0.1, 1000);
  pmrem.dispose();
  room.geometry.dispose();
  return rt.texture;
}

export function createMaterials() {
  const M = {};
  const cut = [];

  // ---------- 铸件 / 结构件 ----------
  M.castIron = std({ color: 0x6e7379, metalness: 0.92, roughness: 0.62, name: 'castIron' });
  M.castIronDark = std({ color: 0x565b61, metalness: 0.9, roughness: 0.7, name: 'castIronDark' });
  M.alloyHead = std({ color: 0xb7bcc2, metalness: 0.95, roughness: 0.34, name: 'alloyHead' });
  M.alloyCrankcase = std({ color: 0xa8aeb5, metalness: 0.9, roughness: 0.45, name: 'alloyCrankcase' });
  M.nodularIron = std({ color: 0x7d8288, metalness: 0.9, roughness: 0.55, name: 'nodularIron' });

  // ---------- 钢制运动件 ----------
  M.forgedSteel = std({ color: 0x9aa1a9, metalness: 1.0, roughness: 0.26, name: 'forgedSteel' });
  M.groundSteel = std({ color: 0xb6bcc3, metalness: 1.0, roughness: 0.13, name: 'groundSteel' });
  M.hardenedSteel = std({ color: 0xcdd2d8, metalness: 1.0, roughness: 0.16, name: 'hardenedSteel' });
  M.steelMatte = std({ color: 0x878d95, metalness: 1.0, roughness: 0.42, name: 'steelMatte' });
  M.springSteel = std({ color: 0x99a1ad, metalness: 1.0, roughness: 0.3, name: 'springSteel' });
  M.nitride = std({ color: 0x5c6167, metalness: 1.0, roughness: 0.38, name: 'nitride' });
  M.pistonAlu = std({ color: 0xd2d6da, metalness: 0.88, roughness: 0.33, name: 'pistonAlu' });
  M.pistonCrown = std({ color: 0xc8ccd0, metalness: 0.9, roughness: 0.45, name: 'pistonCrown' });
  M.ringSteel = std({ color: 0xa9b0b8, metalness: 1.0, roughness: 0.2, name: 'ringSteel' });
  M.shaftSteel = std({ color: 0x8d939b, metalness: 1.0, roughness: 0.24, name: 'shaftSteel' });

  // ---------- 铜铝轴瓦 / 衬套 ----------
  M.bearing = std({ color: 0xb5763a, metalness: 1.0, roughness: 0.32, name: 'bearing' });
  M.bearingShell = std({ color: 0xc08a52, metalness: 1.0, roughness: 0.36, name: 'bearingShell' });
  M.bronze = std({ color: 0xb08d57, metalness: 1.0, roughness: 0.3, name: 'bronze' });

  // ---------- 非金属 ----------
  M.rubber = std({ color: 0x1b1d20, metalness: 0.0, roughness: 0.88, name: 'rubber' });
  M.seal = std({ color: 0x23262b, metalness: 0.0, roughness: 0.72, name: 'seal' });
  M.gasketMLS = std({ color: 0xc4c9ce, metalness: 0.95, roughness: 0.4, name: 'gasketMLS' });
  M.gasketCork = std({ color: 0x6d4a2e, metalness: 0.0, roughness: 0.85, name: 'gasketCork' });
  M.gasketFiber = std({ color: 0xb9a06a, metalness: 0.1, roughness: 0.8, name: 'gasketFiber' });
  M.plastic = std({ color: 0x2b2f36, metalness: 0.0, roughness: 0.55, name: 'plastic' });
  M.ceramic = std({ color: 0xf2f0ec, metalness: 0.0, roughness: 0.25, name: 'ceramic' });

  // ---------- 涂装 ----------
  M.paintIntake = std({ color: 0x2f5d8a, metalness: 0.25, roughness: 0.42, name: 'paintIntake' });
  M.paintExhaust = std({ color: 0x8a4a35, metalness: 0.35, roughness: 0.55, name: 'paintExhaust' });
  M.paintTurbo = std({ color: 0x9aa2ab, metalness: 0.7, roughness: 0.36, name: 'paintTurbo' });
  M.paintRed = std({ color: 0x9c2f2a, metalness: 0.3, roughness: 0.45, name: 'paintRed' });
  M.paintGreen = std({ color: 0x2f6b4f, metalness: 0.3, roughness: 0.45, name: 'paintGreen' });

  // ---------- 流体（半透明） ----------
  M.coolant = phys({ color: 0x1f86d6, metalness: 0, roughness: 0.12, transparent: true, opacity: 0.42,
    transmission: 0, emissive: 0x062a44, emissiveIntensity: 0.35, name: 'coolant' });
  M.oil = phys({ color: 0xc8873a, metalness: 0, roughness: 0.18, transparent: true, opacity: 0.62,
    emissive: 0x2a1403, emissiveIntensity: 0.4, name: 'oil' });
  M.air = phys({ color: 0x9fd8ff, metalness: 0, roughness: 0.2, transparent: true, opacity: 0.16, name: 'air' });
  M.gas = phys({ color: 0xff7a18, metalness: 0, roughness: 0.6, transparent: true, opacity: 0.0,
    emissive: 0xff5a00, emissiveIntensity: 1.2, name: 'gas' });

  // ---------- 加热 / 发光 ----------
  M.hotExhaust = std({ color: 0x6b4a3a, metalness: 0.85, roughness: 0.55, emissive: 0x300a00, emissiveIntensity: 0.0, name: 'hotExhaust' });
  M.turboHot = std({ color: 0x8d8f92, metalness: 0.9, roughness: 0.4, emissive: 0x3a1200, emissiveIntensity: 0.0, name: 'turboHot' });
  M.filterCan = std({ color: 0x1d5fb0, metalness: 0.4, roughness: 0.35, name: 'filterCan' });
  M.rotor = std({ color: 0x2a2d33, metalness: 0.4, roughness: 0.5, name: 'rotor' });

  // 需要被剖切/半透明处理的材质
  cut.push(M.castIron, M.castIronDark, M.alloyHead, M.alloyCrankcase, M.nodularIron,
    M.paintIntake, M.paintExhaust, M.paintRed, M.filterCan, M.paintGreen);

  for (const m of cut) { m.userData.cuttable = true; }
  M._cut = cut;

  // 半透明/剖视状态
  M._state = { ghost: false, clip: null };
  M.setGhost = (on, opacity = 0.22) => {
    for (const m of cut) {
      m.transparent = on;
      m.opacity = on ? opacity : 1;
      m.depthWrite = !on;
      m.needsUpdate = true;
    }
    M._state.ghost = on;
  };
  M.setClip = (planes) => {
    for (const m of cut) { m.clippingPlanes = planes; m.needsUpdate = true; }
    M._state.clip = planes;
  };
  return M;
}
