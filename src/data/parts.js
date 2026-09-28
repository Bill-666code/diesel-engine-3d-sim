/**
 * data/parts.js — 零件信息库（中英文对照 / 材料工艺 / 功能 / 关键参数 / 实时状态）
 * 每个零件一个条目，hover 卡片与图例说明均由此处驱动。
 * state(s, ctx) 返回当前运动状态文案；s = EngineState，ctx = { i: 缸序(可为 null) }
 */
import { SPEC, D } from '../spec.js';
import { strokeOf, clamp } from '../kinematics.js';

const mm = (v) => `${(v * 1000).toFixed(v * 1000 < 10 ? 2 : 1)} mm`;
const P = (obj) => obj;

const strokeOfCyl = (s, i) => strokeOf(s.cylinders[i ?? 0].a);

function pistonState(s, ctx) {
  const i = (ctx && typeof ctx === 'object') ? ctx.i : ctx;
  const c = s.cylinders[i ?? 0];
  const rising = Math.cos((c.a * Math.PI) / 180) > 0;
  const dir = rising ? (c.a % 360 < 180 ? '上行' : '下行') : (c.a % 360 < 180 ? '下行' : '上行');
  const zh = `正在${c.stroke.zh}${dir} · 缸压 ${(c.p / 1e5).toFixed(1)} bar`;
  const en = `${c.stroke.en} ${rising ? 'up' : 'down'} · ${(c.p / 1e5).toFixed(1)} bar`;
  return { zh, en };
}

function valveState(s, kind) {
  // kind: 'intake' | 'exhaust' | 0..3
  let best = null;
  for (let i = 0; i < s.cylinders.length; i++) {
    const c = s.cylinders[i];
    const lift = kind === 'intake' ? c.iLift : c.eLift;
    if (!best || lift > best.lift) best = { lift, i, c };
  }
  const { lift, i, c } = best;
  const name = kind === 'intake' ? '进气门' : '排气门';
  const nameEn = kind === 'intake' ? 'Intake valve' : 'Exhaust valve';
  if (lift > 1e-6) {
    const pct = ((lift / SPEC.valveLift) * 100).toFixed(0);
    return {
      zh: `${name}开启中 升程 ${mm(lift)} (${pct}%) · ${i + 1}缸 ${c.stroke.zh}`,
      en: `${nameEn} OPEN lift ${mm(lift)} (${pct}%) · cyl${i + 1} ${c.stroke.en}`,
    };
  }
  const act = kind === 'intake' ? '关闭密封中' : '关闭密封中';
  return { zh: `${name}${act} · ${i + 1}缸 ${c.stroke.zh}`, en: `${nameEn} closed · cyl${i + 1} ${c.stroke.en}` };
}

function crankState(s) {
  const t = (s.theta % 720).toFixed(0);
  return { zh: `转速 ${s.rpm.toFixed(0)} r/min · 转角 ${t}°/720° · 输出 ${s.power.toFixed(1)} kW / ${s.torque.toFixed(0)} N·m`,
    en: `${s.rpm.toFixed(0)} rpm · ${t}°/720° · ${s.power.toFixed(1)} kW / ${s.torque.toFixed(0)} N·m` };
}

export const PART_INFO = {
  // ================= 固定件 FIXED STRUCTURE =================
  block: P({
    name: { zh: '气缸体', en: 'Cylinder Block' }, group: '固定件',
    material: { zh: 'HT300 灰铸铁 / 缸孔内嵌硼铸铁缸套', en: 'HT300 grey cast iron, cast-iron liners' },
    process: { zh: '重力铸造，缸孔珩磨 φ85.00 +0.015/0，平面铣削加工，表面 5 轴数控联动', en: 'gravity cast, honed bores, CNC-machined deck, 5-axis' },
    fn: { zh: '发动机的核心基础件，承受全部气体爆发力与惯性力，内部集成缸孔、水套、主油道与主轴承座。', en: 'Main structural body carrying combustion and inertia loads; houses bores, water jacket, oil gallery and main bearing saddles.' },
    specs: [['缸径 × 行程', `${(SPEC.bore * 1000).toFixed(1)} × ${(SPEC.stroke * 1000).toFixed(1)} mm`],
      ['缸心距', `${(SPEC.spacing * 1000).toFixed(1)} mm`], ['缸数/排列', '4 缸 直线'],
      ['缸孔圆度公差', '≤ 0.008 mm'], ['缸孔位置度', '≤ 0.05 mm'],
      ['上平面跳动', '≤ 0.03 mm'], ['缸孔粗糙度', 'Ra 0.4 ~ 0.8 μm']],
    state: (s) => ({ zh: `承受缸内最高 ${(Math.max(...s.cylinders.map((c) => c.p)) / 1e5).toFixed(0)} bar 爆发压力 · 1 缸${s.cylinders[0].stroke.zh}`, en: `Peak ${(Math.max(...s.cylinders.map((c) => c.p)) / 1e5).toFixed(0)} bar · cyl1 ${s.cylinders[0].stroke.en}` }),
  }),
  liner: P({
    name: { zh: '气缸套（湿式）', en: 'Cylinder Liner (Wet)' }, group: '固定件',
    material: { zh: '硼铸铁 / 离心铸造合金铸铁', en: 'boron alloy cast iron' },
    process: { zh: '内孔珩磨，平台网纹储油，外部水套密封圈', en: 'honed bore, plateau honing, O-rings in jacket' },
    fn: { zh: '构成活塞往复运动导向面，直接与高温高压燃气接触，壁面油膜承担密封与润滑。', en: 'Guides the piston and forms the combustion wall; an oil film provides sealing and lubrication.' },
    specs: [['内径', `φ${(SPEC.bore * 1000).toFixed(3)} mm H6`], ['壁厚', '3.5 mm'], ['外径', 'φ93 mm'],
      ['珩磨网纹夹角', '60°'], ['圆柱度', '≤ 0.005 mm']],
    state: (s) => ({ zh: `壁面油膜润滑 · 缸压 ${(s.cylinders[0].p / 1e5).toFixed(1)} bar`, en: `Oil film · ${(s.cylinders[0].p / 1e5).toFixed(1)} bar` }),
  }),
  waterJacket: P({
    name: { zh: '缸体水套', en: 'Cylinder Water Jacket' }, group: '固定件',
    material: { zh: '与缸体一体铸出的冷却水通道', en: 'cast-in coolant passage' },
    process: { zh: '铸造后高压水压试验 1.5 MPa，水套内壁清砂并做防锈处理', en: '1.5 MPa hydrotest, deburred and rust-protected' },
    fn: { zh: '包围缸套吸收燃烧室热量，把冷却液送到缸盖，保证活塞与缸壁温度在合理范围。', en: 'Removes combustion heat from the liners and feeds the head coolant circuit.' },
    specs: [['水套外径', `φ${(SPEC.jacketOD * 1000).toFixed(0)} mm`], ['水套容积', '≈ 4.6 L'],
      ['缸壁水温', '85 ~ 95 ℃'], ['冷却液', '乙二醇 50% + 去离子水']],
    state: (s) => ({ zh: `冷却液 ${s.coolantTemp.toFixed(0)} ℃ · 流量 ${s.coolantFlow.toFixed(0)} L/min`, en: `${s.coolantTemp.toFixed(0)}℃ · ${s.coolantFlow.toFixed(0)} L/min` }),
  }),
  head: P({
    name: { zh: '气缸盖', en: 'Cylinder Head' }, group: '固定件',
    material: { zh: 'ZL109 铝合金，燃烧室为细晶铸造铝', en: 'ZL109 aluminium alloy' },
    process: { zh: '低压铸造 + 五面加工中心精加工，气门座圈过盈冷装，气门导管镶入后铰孔', en: 'low-pressure cast, 5-side machined, seats shrunk in, guides reamed' },
    fn: { zh: '封闭气缸上部，容纳燃烧室、进排气道与气门机构，并承受全部爆发压力。', en: 'Seals the cylinder top; contains chamber, ports and the valvetrain; carries combustion pressure.' },
    specs: [['厚度', '125 mm'], ['燃烧室', `沉孔 φ${(SPEC.headChamberD * 1000).toFixed(0)} × ${(SPEC.headChamberDepth * 1000).toFixed(1)} mm`],
      ['气门夹角', `${(SPEC.valveTilt * 180 / Math.PI).toFixed(0)}°`], ['底平面跳动', '≤ 0.03 mm'],
      ['每缸气门数', '2 (1进1排)']],
    state: (s) => ({ zh: `燃烧中 · 缸温 ${(s.cylinders[0].T - 273).toFixed(0)} ℃ · 1 缸${s.cylinders[0].stroke.zh}`, en: `${(s.cylinders[0].T - 273).toFixed(0)}℃ · cyl1 ${s.cylinders[0].stroke.en}` }),
  }),
  headGasket: P({
    name: { zh: '气缸垫（多层金属）', en: 'Head Gasket (MLS)' }, group: '密封件',
    material: { zh: '301 不锈钢带 + 氟橡胶涂层', en: '301 stainless strip with FKM coating' },
    process: { zh: '多层精密冲压成型，弹卸压紧，圆角翻边抗裂纹', en: 'multi-layer precision stamping, spring tabs' },
    fn: { zh: '同时密封燃烧室、冷却水套与机油通道，是三流体共存的界面。', en: 'Seals gas, coolant and oil simultaneously.' },
    specs: [['厚度', '1.20 mm'], ['耐压', '≥ 200 bar'], ['耐温', '-40 ~ 250 ℃']],
    state: (s) => ({ zh: `密封 ${(Math.max(...s.cylinders.map((c) => c.p)) / 1e5).toFixed(0)} bar 燃气 + ${s.coolantTemp.toFixed(0)} ℃ 冷却液 + 机油`, en: `Seals gas/coolant/oil` }),
  }),
  valveCover: P({
    name: { zh: '气门室罩', en: 'Rocker Cover' }, group: '固定件',
    material: { zh: '压铸铝 + 迷宫式油气分离器', en: 'die-cast aluminium with迷宫 oil separator' },
    process: { zh: '压铸后与缸盖螺栓连接，内壁迷宫挡油', en: 'die-cast, labyrinth oil separation' },
    fn: { zh: '封闭气门室，回收曲轴箱窜出的机油并过滤后再回油底壳。', en: 'Encloses the rocker area and recirculates blow-by oil.' },
    specs: [['密封形式', '硅胶密封条'], ['机油雾气处理', '迷宫 + 离心式']],
    state: (s) => ({ zh: `回油量 ${(s.oilFlow * 0.08).toFixed(1)} L/min · 罩内温度 ${(s.oilTemp + 12).toFixed(0)} ℃`, en: `Blow-by return ${(s.oilFlow * 0.08).toFixed(1)} L/min` }),
  }),
  oilPan: P({
    name: { zh: '油底壳', en: 'Oil Pan / Sump' }, group: '固定件',
    material: { zh: '冲压钢板 / 铸铝', en: 'stamped steel / cast aluminium' },
    process: { zh: '深油底壳带挡油板，集滤器前置防涡流', en: 'deep sump with baffles and windage tray' },
    fn: { zh: '储存润滑油并冷却油液，集滤器从这里吸油供全机润滑。', en: 'Stores and cools the lubricant; the pickup feeds the whole engine.' },
    specs: [['机油容量', `${SPEC.oilPanVol} L`], ['油品牌号', SPEC.oilGrade],
      ['放油螺塞', 'M22×1.5 磁性']],
    state: (s) => ({ zh: `油位正常 · 油温 ${s.oilTemp.toFixed(0)} ℃ · 回油 ${s.oilFlow.toFixed(0)} L/min`, en: `${s.oilTemp.toFixed(0)}℃ · ${s.oilFlow.toFixed(0)} L/min` }),
  }),
  flywheelHousing: P({
    name: { zh: '飞轮壳', en: 'Flywheel Housing' }, group: '固定件',
    material: { zh: 'HT250 铸铁', en: 'HT250 grey cast iron' },
    process: { zh: '铸造后与缸体定位销螺栓连接，后端止口定位飞轮', en: 'cast, dowel-located to block, rear spigot pilots flywheel' },
    fn: { zh: '连接发动机与变速箱，承受飞轮旋转离心力并隔离噪声。', en: 'Bridges engine and transmission, carries flywheel loads.' },
    specs: [['止口圆跳动', '≤ 0.05 mm'], ['结合面平面度', '≤ 0.10 mm'], ['噪声衰减', '≥ 78 dB(A)']],
    state: (s) => ({ zh: `随发动机 ${s.rpm.toFixed(0)} r/min 工作 · 转速波动 ±${(s.rpm * 0.004).toFixed(1)} r/min`, en: `${s.rpm.toFixed(0)} rpm` }),
  }),
  timingGears: P({
    name: { zh: '正时传动齿轮组', en: 'Timing Gear Train' }, group: '紧固件',
    material: { zh: '20CrMnTi 渗碳淬火钢 / 球墨铸铁惰轮', en: 'carburised alloy steel / iron idler' },
    process: { zh: '滚齿后热处理，齿面磨削，定位销+螺栓锁紧', en: 'gear cut, shaved & ground, dowel located' },
    fn: { zh: '以 2:1 传动比驱动凸轮轴，并同时带动机油泵与喷油泵。', en: 'Drives the camshaft at 2:1 and powers the oil and injection pumps.' },
    specs: [['曲轴正时齿轮', '32 齿'], ['凸轮轴正时齿轮', '64 齿'], ['惰轮', '22 齿'],
      ['传动比', '2 : 1'], ['侧隙', '0.06 ~ 0.15 mm'], ['齿面硬度', 'HRC 58 ~ 62']],
    state: (s) => ({ zh: `曲轴 ${s.rpm.toFixed(0)} r/min → 凸轮轴 ${(s.rpm / 2).toFixed(0)} r/min`, en: `Crank ${s.rpm.toFixed(0)} → cam ${(s.rpm / 2).toFixed(0)} rpm` }),
  }),
  timingCase: P({
    name: { zh: '正时齿轮室', en: 'Timing Gear Case' }, group: '固定件',
    material: { zh: '铝合金压铸', en: 'die-cast aluminium' },
    process: { zh: '压铸加工，前端油封座 + 正时标记', en: 'die-cast & machined with front seal seat and timing marks' },
    fn: { zh: '容纳曲轴正时齿轮、惰轮、凸轮轴驱动齿轮与各附件驱动齿轮。', en: 'Houses the timing gear train and accessory drives.' },
    specs: [['传动比', '2 : 1 (曲轴 : 凸轮轴)'], ['齿形', '渐开线 m=3']],
    state: (s) => ({ zh: `正时传动 2:1 · 曲轴 ${s.rpm.toFixed(0)} → 凸轮轴 ${(s.rpm / 2).toFixed(0)} r/min`, en: `2:1 · crank ${s.rpm.toFixed(0)} rpm` }),
  }),
  mainBearingWeb: P({
    name: { zh: '主轴承座（主油道）', en: 'Main Bearing Web / Gallery' }, group: '固定件',
    material: { zh: '缸体一体铸造', en: 'integrally cast with block' },
    process: { zh: '镗瓦后与缸孔一次定位加工，保证同轴度 φ0.03mm', en: 'bored with cylinders in one setup, coaxiality φ0.03' },
    fn: { zh: '通过主油道把机油分配到 5 道主轴承、凸轮轴与缸壁。', en: 'Distributes oil to the 5 main bearings, camshaft and cylinder walls.' },
    specs: [['主轴承数', '5 道'], ['主轴颈', `φ${(SPEC.mainJournalD * 1000).toFixed(1)} mm`],
      ['主油道', `φ${(SPEC.oilGalleryD * 1000).toFixed(0)} mm`]],
    state: (s) => ({ zh: `5 道主轴承供油 ${(s.oilFlow * 0.45).toFixed(0)} L/min · 压力 ${s.oilPressure.toFixed(1)} bar`, en: `${s.oilPressure.toFixed(1)} bar` }),
  }),

  // ================= 运动件 MOVING PARTS =================
  piston: P({
    name: { zh: '活塞', en: 'Piston' }, group: '运动件',
    material: { zh: '共晶 Al-Si 铝合金，顶面喷涂石墨/硅合金耐磨层', en: 'eutectic Al-Si alloy with graphite/silicon skirt coating' },
    process: { zh: '锻造或重力铸造，顶面沉入式燃烧碗，裙部椭圆加工 φ0.02 mm', en: 'forged/cast, re-entrant bowl, oval-honed skirt φ0.02' },
    fn: { zh: '在气缸内往复运动，承受燃烧压力并经活塞销把力传给连杆，同时隔开燃气与机油。', en: 'Reciprocates in the bore, transferring combustion force through the gudgeon pin while sealing gas from oil.' },
    specs: [['直径', `φ${(SPEC.bore * 1000).toFixed(3)} mm`], ['压缩高', `${(SPEC.compHeight * 1000).toFixed(1)} mm`],
      ['总高', '78.0 mm'], ['质量', '≈ 0.62 kg'], ['顶隙', `${(SPEC.deckGap * 1000).toFixed(1)} mm`],
      ['燃烧碗', `φ${(SPEC.pistonBowlD * 1000).toFixed(0)} × ${(SPEC.pistonBowlH * 1000).toFixed(1)} mm`]],
    state: pistonState,
  }),
  rings: P({
    name: { zh: '活塞环组', en: 'Piston Rings' }, group: '运动件',
    material: { zh: '马氏体不锈钢 1Cr18Ni9Ti / 球墨铸铁', en: 'martensitic stainless / ductile iron' },
    process: { zh: '螺旋卷曲、端部对接研磨，镀铬或喷钼', en: 'spiral wound, butt-ground ends, Cr/Mo coated' },
    fn: { zh: '第一道压缩环密封燃烧压力，第二道压缩环分担背压，油环刮除多余机油形成油膜。', en: '1st ring seals combustion, 2nd relieves back-pressure, oil ring controls the lubricating film.' },
    specs: [['第一道气环', 'φ85.0 × 2.5 mm，镀铬'], ['第二道气环', 'φ85.0 × 2.0 mm，锥面'],
      ['油环', '三片式 φ86.0 × 3.0 mm'], ['侧隙', '0.06 ~ 0.09 mm'], ['端隙', '0.20 ~ 0.35 mm']],
    state: pistonState,
  }),
  gudgeonPin: P({
    name: { zh: '活塞销（浮式）', en: 'Gudgeon Pin (Floating)' }, group: '运动件',
    material: { zh: '20CrMnTi 渗碳淬火钢', en: '20CrMnTi case-hardened steel' },
    process: { zh: '渗碳淬火 HRC58-62，磨削后表面超精研（Ra 0.2）', en: 'carburized, ground & super-finished' },
    fn: { zh: '连接活塞与连杆小头，在活塞销座与连杆衬套中浮动传力。', en: 'Links piston and rod small end, floating in bosses and bushings.' },
    specs: [['外径', `φ${(0.0420 * 1000).toFixed(3)} mm`], ['内径', 'φ22.0 mm'],
      ['长度', '92.0 mm'], ['表面硬度', 'HRC 58 ~ 62'], ['质量', '≈ 0.19 kg']],
    state: pistonState,
  }),
  conrod: P({
    name: { zh: '连杆', en: 'Connecting Rod' }, group: '运动件',
    material: { zh: '42CrMo 调质锻钢 / 粉末冶金', en: '42CrMo forged steel' },
    process: { zh: '模锻后正火调质，杆身喷丸强化，大小头精加工分开', en: 'die forged, Q&T, shot peened, big/small end machined separately' },
    fn: { zh: '把活塞的往复运动传给曲轴连杆颈，并分解惯性力与气体力。', en: 'Transmits reciprocating motion to the crankpin and resolves inertia and gas forces.' },
    specs: [['中心距', `${(SPEC.rodLen * 1000).toFixed(1)} mm`], ['连杆比 (L/S)', D.rodRatio.toFixed(3)],
      ['大头外径', 'φ96.0 mm'], ['小头内径', 'φ42.0 mm'], ['杆身 I 值', '9500 mm⁴'],
      ['连杆螺栓', '2 × M12×1.25，拧紧力矩 110 N·m']],
    state: pistonState,
  }),
  bearingShell: P({
    name: { zh: '连杆轴瓦（轴瓦）', en: 'Connecting Rod Bearing' }, group: '运动件',
    material: { zh: '铜铅合金 + 钢背 / 三元金属', en: 'Cu-Pb with steel backing / trimetal' },
    process: { zh: '复合板冲压成型，与瓦背过盈配合，铣削油槽', en: 'stamped bimetal, shrunk into shell, oil groove machined' },
    fn: { zh: '在连杆颈与轴瓦之间形成动压油膜，减小摩擦与冲击载荷。', en: 'Forms a hydrodynamic film between crankpin and rod journal.' },
    specs: [['内径', `φ${(SPEC.rodJournalD * 1000).toFixed(1)} mm`], ['壁厚', '1.50 mm'],
      ['配合间隙', '0.045 ~ 0.080 mm'], ['油隙', '0.030 ~ 0.060 mm'], ['许用比压', '≥ 60 MPa']],
    state: pistonState,
  }),
  crankshaft: P({
    name: { zh: '曲轴', en: 'Crankshaft' }, group: '运动件',
    material: { zh: '42CrMo 调质锻钢，轴颈高频淬火', en: '42CrMo forged & Q&T, induction hardened journals' },
    process: { zh: '模锻 + 气体氮碳共渗，圆角滚压，平衡去重，拐角抛光降低应力集中', en: 'die forged, nitrided, rolled fillets, polished, dynamically balanced' },
    fn: { zh: '将连杆的往复运动转变为旋转输出，并通过飞轮储存动能、吸收扭振。', en: 'Converts reciprocating motion into rotation; the flywheel smooths speed and absorbs torsional vibration.' },
    specs: [['行程', `${(SPEC.stroke * 1000).toFixed(1)} mm`], ['曲柄半径(偏心距)', `${(SPEC.crankThrow * 1000).toFixed(1)} mm`],
      ['主轴颈', `φ${(SPEC.mainJournalD * 1000).toFixed(1)} × ${(SPEC.mainWidth * 1000).toFixed(0)} mm ×5`],
      ['连杆颈', `φ${(SPEC.rodJournalD * 1000).toFixed(1)} × ${(SPEC.rodWidth * 1000).toFixed(0)} mm ×4`],
      ['曲拐相位', '1-3-4-2'], ['动平衡', '≤ 35 g·cm'], ['轴向间隙', '0.10 ~ 0.25 mm']],
    state: crankState,
  }),
  flywheel: P({
    name: { zh: '飞轮（带齿圈）', en: 'Flywheel with Ring Gear' }, group: '运动件',
    material: { zh: 'HT250 灰铸铁盘 + 40Cr 齿圈', en: 'HT250 cast iron disc + 40Cr ring gear' },
    process: { zh: '铸造后车削平衡，齿圈过盈压装后滚压强化', en: 'machined & balanced, ring gear shrunk and rolled' },
    fn: { zh: '以转动惯量平稳转速，并把发动机的输出扭矩传给离合器。', en: 'Stores kinetic energy to smooth RPM and drives the clutch.' },
    specs: [['外径', `φ${(SPEC.flywheelD * 1000).toFixed(0)} mm`], ['厚度', `${(SPEC.flywheelT * 1000).toFixed(0)} mm`],
      ['齿数', '132 齿'], ['转动惯量', '≈ 0.19 kg·m²'], ['端面跳动', '≤ 0.10 mm']],
    state: crankState,
  }),
  pulley: P({
    name: { zh: '曲轴皮带轮 / 扭转减振器', en: 'Crank Pulley / Torsion Damper' }, group: '运动件',
    material: { zh: '铸铁轮毂 + 钢制惯性环 + 硅油阻尼层', en: 'iron hub, steel inertia ring, silicone damper' },
    process: { zh: '惯性环与轮毂之间充硅油，V 带槽精车', en: 'silicone filled inertia ring, machined belt grooves' },
    fn: { zh: '驱动水泵/发电机等附件，同时以惯性环与硅油衰减曲轴扭振。', en: 'Drives accessories and damps crankshaft torsional vibration.' },
    specs: [['外径', 'φ180 mm'], ['槽数', '5 × SPB'], ['减振频率', '≈ 220 Hz']],
    state: crankState,
  }),

  // ================= 配气机构 VALVETRAIN =================
  camshaft: P({
    name: { zh: '凸轮轴', en: 'Camshaft' }, group: '配气机构',
    material: { zh: '冷激铸铁 / 20CrMnTi 渗碳钢', en: 'chilled cast iron / carburised alloy steel' },
    process: { zh: '桃尖与基圆数控磨削，轴颈超精研，配气相位可调', en: 'CNC lobe grinding, journals super-finished, adjustable phasing' },
    fn: { zh: '按设定的配气正时驱动气门，保证四冲程的进气与排气门开闭时刻。', en: 'Operates the valves at programmed timing to realise intake and exhaust strokes.' },
    specs: [['基圆半径', `φ${(SPEC.camBaseR * 2000).toFixed(0)} mm`], ['最大升程', `${(SPEC.valveLift * 1000).toFixed(1)} mm`],
      ['持续角(进/排)', '234° / 244°'], ['转速比', '曲轴的 1/2'],
      ['轴颈', 'φ40 mm ×5'], ['传动比', '2:1']],
    state: (s) => valveState(s, 'intake'),
  }),
  tappet: P({
    name: { zh: '挺柱（桶形）', en: 'Tappet / Lifter' }, group: '配气机构',
    material: { zh: '20CrMnTi 渗碳淬火钢，杯体冷激铸铁', en: 'case-hardened alloy steel in chilled iron cup' },
    process: { zh: '渗碳淬火 HRC58，杯口油槽储存机油', en: 'carburised HRC58, oil groove in crown' },
    fn: { zh: '把凸轮的径向升程转换为直线运动并经推杆传给摇臂。', en: 'Converts cam lift into reciprocating motion passed through the pushrod.' },
    specs: [['直径', 'φ30.0 mm'], ['高度', '30.0 mm'], ['接触面', '平面 + 储油槽'], ['冷间隙', '0.25 mm']],
    state: (s) => {
      let best = null;
      for (const c of s.cylinders) if (!best || c.iLift > best.lift) best = { lift: c.iLift, c };
      const push = best.lift / SPEC.camRatio;
      return {
        zh: `挺柱升程 ${mm(push)} · ${best.c.stroke.zh}`,
        en: `Tappet lift ${mm(push)}`,
      };
    },
  }),
  pushrod: P({
    name: { zh: '推杆', en: 'Pushrod' }, group: '配气机构',
    material: { zh: '20CrMnTi 冷拔钢管，两端冷镦球头', en: 'cold-drawn 20CrMnTi tube with swaged ball ends' },
    process: { zh: '管壁镀铬，球头渗碳淬火', en: 'chrome plated bore, carburised ball ends' },
    fn: { zh: '在挺柱与摇臂之间传递往复运动，本身只受推压不受弯矩。', en: 'Transmits reciprocating motion from tappet to rocker, in compression only.' },
    specs: [['外径 / 内径', 'φ10.0 / φ6.0 mm'], ['长度', '146.5 mm'], ['两端球半径', 'R7.94 mm']],
    state: (s) => {
      let best = null;
      for (const c of s.cylinders) if (!best || c.iLift > best.lift) best = { lift: c.iLift, c };
      const push = best.lift / SPEC.camRatio;
      return { zh: `推杆升程 ${mm(push)} · ${best.c.stroke.zh}`, en: `Pushrod travel ${mm(push)}` };
    },
  }),
  rocker: P({
    name: { zh: '摇臂', en: 'Rocker Arm' }, group: '配气机构',
    material: { zh: '球墨铸铁 / 精锻钢', en: 'ductile iron or forged steel' },
    process: { zh: '精密锻造后冷激，气门调整螺钉锁紧', en: 'precision forged, chilled, adjuster screw locked' },
    fn: { zh: '以杠杆放大比把推杆位移放大后传给气门，并兼作气门间隙调整。', en: 'Amplifies pushrod motion by the rocker ratio and sets valve lash.' },
    specs: [['摇臂比', SPEC.camRatio.toFixed(2)], ['气门间隙', `${(SPEC.lash * 1000).toFixed(2)} mm`],
      ['调整螺钉', 'M8×1.0'], ['材料厚度', '16 mm']],
    state: (s) => {
      let best = null;
      for (const c of s.cylinders) if (!best || c.iLift > best.lift) best = { lift: c.iLift, c };
      return { zh: `摇臂摆角 ${((best.lift / (0.0162)) * 57.3).toFixed(1)}° · 开启中`, en: `Rocker swing ${((best.lift / 0.0162) * 57.3).toFixed(1)}°` };
    },
  }),
  valveIntake: P({
    name: { zh: '进气门', en: 'Intake Valve' }, group: '配气机构',
    material: { zh: '4Cr9Si2 耐热钢，杆端淬硬，锥面司太立合金堆焊', en: '4Cr9Si2 heat-resistant steel, Stellite faced' },
    process: { zh: '模锻 → 调质 → 杆端高频淬火 → 密封锥面堆焊 → 磨削', en: 'forged, Q&T, induction hardened stem, Stellite deposit on seat face' },
    fn: { zh: '控制新鲜充量进入气缸，是柴油机进气阻力的主要来源之一。', en: 'Admits fresh charge into the cylinder; a major inlet restriction.' },
    specs: [['阀头直径', `φ${(SPEC.valveDIntake * 1000).toFixed(1)} mm`], ['杆径', `φ${(SPEC.valveStemD * 1000).toFixed(1)} mm`],
      ['最大升程', `${(SPEC.valveLift * 1000).toFixed(1)} mm`], ['开启角 IVO', `${720 - SPEC.IVO}° BTDC`],
      ['关闭角 IVC', `${SPEC.IVC - 540}° ABDC`], ['持续角', '234°'], ['工作温度', '300 ~ 420 ℃']],
    state: (s) => valveState(s, 'intake'),
  }),
  valveExhaust: P({
    name: { zh: '排气门', en: 'Exhaust Valve' }, group: '配气机构',
    material: { zh: '耐热钢 + 司太立合金密封面 + 耐热合金导管', en: 'heat-resistant steel, Stellite face' },
    process: { zh: '密封面等离子喷焊，与导管摩擦副氮化处理', en: 'plasma welded seat face, nitrided stem-guide pair' },
    fn: { zh: '排出燃烧后的高温废气并参与扫气，散热最恶劣的零件之一。', en: 'Ejects hot exhaust gas and drives scavenging.' },
    specs: [['阀头直径', `φ${(SPEC.valveDExhaust * 1000).toFixed(1)} mm`], ['杆径', `φ${(SPEC.valveStemD * 1000).toFixed(1)} mm`],
      ['开启角 EVO', `${180 - SPEC.EVO}° BBDC`], ['关闭角 EVC', `${SPEC.EVC - 360}° ATDC`],
      ['持续角', '244°'], ['工作温度', '600 ~ 780 ℃'], ['升程', `${(SPEC.valveLift * 1000).toFixed(1)} mm`]],
    state: (s) => valveState(s, 'exhaust'),
  }),
  valveSpring: P({
    name: { zh: '气门弹簧', en: 'Valve Spring' }, group: '配气机构',
    material: { zh: '油淬回火弹簧钢丝 50CrVA，两端并紧磨平', en: '50CrVA oil-hardened spring wire, ground ends' },
    process: { zh: '冷卷 → 去应力回火 → 喷丸 → 两端并紧', en: 'cold wound, stress relieved, shot peened, squared ends' },
    fn: { zh: '保证气门在高速下紧密关闭并回位，是决定高转速配气正时的关键。', en: 'Closes and returns the valve at high speed; sets the achievable timing.' },
    specs: [['自由长度', `${(SPEC.springFree * 1000).toFixed(1)} mm`], ['安装长度', `${(SPEC.springInstalled * 1000).toFixed(1)} mm`],
      ['弹簧刚度', '≈ 42 N/mm'], ['最大压缩力', '≈ 520 N @ 9.7 mm'], ['并紧圈数', '1.5 + 5.5']],
    state: (s) => valveState(s, 'intake'),
  }),
  valveSeat: P({
    name: { zh: '气门座圈', en: 'Valve Seat Insert' }, group: '配气机构',
    material: { zh: '粉末冶金合金 / 青铜', en: 'powder-metallurgy alloy' },
    process: { zh: '过盈冷装后与座圈座同心镗削，45° 密封锥面', en: 'shrunk in, 45° seat reamed coaxially' },
    fn: { zh: '提供气门密封锥面，承受高温燃气并把热量传给缸盖。', en: 'Provides the sealing cone and conducts heat into the head.' },
    specs: [['内锥角', '45°'], ['锥面宽度', '1.6 ~ 2.0 mm'], ['过盈量', '0.08 mm']],
    state: (s) => ({ zh: `排气门开启中 · 密封带温度 ${(s.exhaustTemp * 0.6 + 120).toFixed(0)} ℃`, en: `Seal temp ${(s.exhaustTemp * 0.6 + 120).toFixed(0)}℃` }),
  }),
  rockerShaft: P({
    name: { zh: '摇臂轴', en: 'Rocker Shaft' }, group: '配气机构',
    material: { zh: '45 钢，表面高频淬火', en: 'AISI 1045 steel, induction hardened' },
    process: { zh: '深孔钻油道至每个摇臂座', en: 'deep-hole oil feed to each rocker' },
    fn: { zh: '支撑所有摇臂并向其内部输送机油。', en: 'Supports the rockers and supplies oil to each of them.' },
    specs: [['直径', 'φ24 mm'], ['支撑数', '5 处'], ['油孔', 'φ3 mm']],
    state: (s) => ({ zh: `供油压力 ${s.oilPressure.toFixed(1)} bar · 转速 ${(s.rpm / 2).toFixed(0)} r/min`, en: `${s.oilPressure.toFixed(1)} bar` }),
  }),

  // ================= 燃油系统 FUEL SYSTEM =================
  hpPump: P({
    name: { zh: '高压油泵（直列柱塞式）', en: 'High-Pressure Fuel Pump' }, group: '燃油系统',
    material: { zh: '铝合金泵体 + 柱塞偶件（GCr15 研磨）', en: 'aluminium body, lapped steel plunger pair' },
    process: { zh: '柱塞副研磨间隙 2 μm 以内，泵体与缸体后油封隔离', en: 'plunger lapped to < 2 µm, rear-seal isolation' },
    fn: { zh: '按发动机转速与负荷产生 400 ~ 1800 bar 的高压柴油，经喷油器喷入气缸。', en: 'Generates 400–1800 bar injection pressure metered by speed and load.' },
    specs: [['柱塞直径 × 行程', 'φ10.0 × 10.0 mm'], ['驱动比', '曲轴的 1/2'],
      ['最高供油压力', '1800 bar'], ['各缸供油不均匀度', '≤ 3%'],
      ['喷油提前角', `${SPEC.injectionBTDC}° BTDC`], ['喷油持续角', '26° (标定)']],
    state: (s) => ({ zh: `正在供油 · 压力 ${(400 + s.load * 1400).toFixed(0)} bar · 负荷 ${(s.load * 100).toFixed(0)}%`,
      en: `Pumping · ${(400 + s.load * 1400).toFixed(0)} bar · load ${(s.load * 100).toFixed(0)}%` }),
  }),
  injector: P({
    name: { zh: '喷油器（多孔喷嘴）', en: 'Fuel Injector' }, group: '燃油系统',
    material: { zh: '喷油器体 40Cr / 喷嘴珠光体合金 + 硅钼耐热钢', en: '40Cr body, pearlitic alloy nozzle' },
    process: { zh: '喷孔电火花/激光加工，多孔喷雾与油束锥角一致', en: 'EDM/laser drilled multi-hole orifices' },
    fn: { zh: '将高压柴油雾化成细颗粒喷入燃烧室，决定混合气形成质量。', en: 'Atomises diesel into fine droplets — the key to mixture formation.' },
    specs: [['喷孔数 × 孔径', '7 × 0.16 mm'], ['喷油量', '8.5 mg/次 @ 2200 bar'],
      ['喷雾锥角', '18°'], ['开启压力', '22 MPa'], ['喷油器型式', '多孔式']],
    state: (s) => (s.injectorPulse > 0.02
      ? { zh: `喷油中 · 强度 ${(s.injectorPulse * 100).toFixed(0)}%`, en: `Injecting ${(s.injectorPulse * 100).toFixed(0)}%` }
      : { zh: `未喷油（怠速/停油）`, en: 'Not injecting' }),
  }),
  fuelFilter: P({
    name: { zh: '燃油滤清器（含油水分离器）', en: 'Fuel Filter / Water Separator' }, group: '燃油系统',
    material: { zh: '钢制罐体 + 酚醛树脂滤芯', en: 'steel canister, phenolic element' },
    process: { zh: '罐体旋装式，滤芯 4 μm 精滤 + 10 μm 水分离', en: 'spin-on canister, 4 µm filtration' },
    fn: { zh: '滤除柴油中的机械杂质与水分，保护高压油泵柱塞偶件。', en: 'Removes particulates and water protecting the injection pump.' },
    specs: [['过滤精度', '4 μm'], ['过滤效率', '≥ 98%'], ['水过滤效率', '≥ 95%'],
      ['更换里程', '30 000 km'], ['旋装扭矩', '18 N·m']],
    state: (s) => ({ zh: `供油流量 ${(2 + s.load * 12).toFixed(1)} L/h · 压差 ${(0.05 + s.load * 0.25).toFixed(2)} bar`, en: `${(2 + s.load * 12).toFixed(1)} L/h` }),
  }),
  hpLine: P({
    name: { zh: '高压油管', en: 'High-Pressure Fuel Line' }, group: '燃油系统',
    material: { zh: '冷拔无缝钢管 φ6.35 × 2.4 mm', en: 'seamless steel φ6.35 × 2.4' },
    process: { zh: '两端球头压接，弯曲半径 ≥ 50 mm，脉冲压力试验 2000 bar', en: 'crimped ball ends, 2000 bar pulse tested' },
    fn: { zh: '把各缸喷油器与油泵刚性连接，要求等长以保证供油同时性。', en: 'Rigidly connects pump to injectors; equal length for timing uniformity.' },
    specs: [['外径 / 内径', 'φ6.35 / φ1.6 mm'], ['耐压', '1800 bar'], ['每缸长度差', '≤ 5 mm']],
    state: (s) => ({ zh: `管路压力 ${(400 + s.load * 1400).toFixed(0)} bar · 各缸同时供油`, en: `${(400 + s.load * 1400).toFixed(0)} bar` }),
  }),
  injectionDrive: P({
    name: { zh: '喷油泵驱动齿轮', en: 'Injection Pump Drive Gear' }, group: '燃油系统',
    material: { zh: '20CrMnTi 渗碳淬火钢', en: 'carburised alloy steel' },
    process: { zh: '渗碳淬火 HRC58，磨齿后与正时齿轮共轭', en: 'carburised & ground, conjugated with timing gear' },
    fn: { zh: '以曲轴的 1/2 转速驱动高压油泵柱塞。', en: 'Drives the injection pump plunger at half crankshaft speed.' },
    specs: [['齿数', '28 齿'], ['传动比', '0.5 : 1'], ['安装相位', '按正时标记']],
    state: crankState,
  }),

  // ================= 润滑系统 LUBRICATION =================
  oilPump: P({
    name: { zh: '机油泵（内啮合转子泵）', en: 'Oil Pump (Gerotor)' }, group: '润滑系统',
    material: { zh: '铝泵体 + 铸铁内外转子', en: 'aluminium body, iron rotors' },
    process: { zh: '转子型面精密磨削，卸荷阀限制最高压力', },
    fn: { zh: '建立并循环全机油压，把机油送到主油道、机油滤清器与散热器。', en: 'Develops system pressure and circulates oil to gallery, filter and cooler.' },
    specs: [['额定流量', '≥ 60 L/min @ 4000 r/min'], ['额定压力', '4.5 bar'], ['转子间隙', '0.05 ~ 0.10 mm'],
      ['容积效率', '≥ 88%'], ['限压阀开启压力', '5.0 bar']],
    state: (s) => ({ zh: `泵转速 ${(s.rpm / 2).toFixed(0)} r/min · 流量 ${s.oilFlow.toFixed(0)} L/min · 压力 ${s.oilPressure.toFixed(1)} bar`,
      en: `${(s.rpm / 2).toFixed(0)} rpm · ${s.oilFlow.toFixed(0)} L/min · ${s.oilPressure.toFixed(1)} bar` }),
  }),
  oilFilter: P({
    name: { zh: '机油滤清器（旋装式）', en: 'Oil Filter' }, group: '润滑系统',
    material: { zh: '钢罐 + 合成纤维滤芯', en: 'steel canister, synthetic media' },
    process: { zh: '旋装更换，旁通阀 1.0 bar 开启', en: 'spin-on, 1.0 bar bypass' },
    fn: { zh: '截留机油中的磨粒，保护轴颈与轴瓦；堵塞后旁通阀开启保供。', en: 'Traps wear debris; a bypass valve preserves flow when clogged.' },
    specs: [['过滤精度', '15 ~ 25 μm'], ['过滤效率', '≥ 90%'], ['旁通开启压力', '1.0 bar'],
      ['旋装扭矩', '25 N·m'], ['容量', `${SPEC.filterSpec}`]],
    state: (s) => ({ zh: `流量 ${(s.oilFlow * 0.55).toFixed(0)} L/min · 油温 ${s.oilTemp.toFixed(0)} ℃`, en: `${(s.oilFlow * 0.55).toFixed(0)} L/min` }),
  }),
  oilCooler: P({
    name: { zh: '机油冷却器', en: 'Oil Cooler' }, group: '润滑系统',
    material: { zh: '铜制管板式换热器', en: 'copper tube-plate heat exchanger' },
    process: { zh: '钎焊管板，波纹翅片提高换热系数', en: 'brazed plate-fin, corrugated fins' },
    fn: { zh: '利用冷却液带走机油热量，控制油膜黏度与氧化速度。', en: 'Removes heat from the oil to stabilise film viscosity.' },
    specs: [['换热面积', '0.42 m²'], ['冷却能力', '≥ 18 kW @ ΔT 20K'],
      ['油侧压降', '< 0.15 bar'], ['水侧流量', `60~140 L/min`]],
    state: (s) => ({ zh: `油温 ${s.oilTemp.toFixed(0)} ℃ · 冷却液 ${s.coolantTemp.toFixed(0)} ℃`, en: `Oil ${s.oilTemp.toFixed(0)}℃ / water ${s.coolantTemp.toFixed(0)}℃` }),
  }),
  oilGallery: P({
    name: { zh: '主油道', en: 'Main Oil Gallery' }, group: '润滑系统',
    material: { zh: '缸体内钻削 φ18 通孔', en: 'drilled φ18 passage in the block' },
    process: { zh: '钻孔后压入 Ø12 钢球防止泄漏，末端设溢流节流孔', en: 'drilled, ends closed with pressed steel balls' },
    fn: { zh: '主供油通道，把机油分配到 5 道主轴承并继续到凸轮轴与缸壁。', en: 'Main distribution to 5 mains, camshaft and cylinder walls.' },
    specs: [['孔径', 'φ18 mm'], ['长度', '460 mm'], ['主轴承供油孔', 'φ6 mm ×5'],
      ['限流孔', 'Ø2.0 mm']],
    state: (s) => ({ zh: `油压 ${s.oilPressure.toFixed(1)} bar · 流量 ${s.oilFlow.toFixed(0)} L/min`, en: `${s.oilPressure.toFixed(1)} bar` }),
  }),
  oilPickup: P({
    name: { zh: '集滤器 / 吸油管', en: 'Oil Pickup' }, group: '润滑系统',
    material: { zh: '冲压钢板壳体 + 钢丝网', en: 'stamped shell with wire screen' },
    process: { zh: '滤网 0.8 mm 缝隙，安装于油底壳底部', en: '0.8 mm screen aperture' },
    fn: { zh: '机油入口，防止大颗粒进入泵体并降低吸油负压。', en: 'Oil inlet; prevents large debris entering the pump.' },
    specs: [['滤网间隙', '0.8 mm'], ['吸油口直径', 'φ22 mm'], ['安装高度', '距壳底 ≤ 15 mm']],
    state: (s) => ({ zh: `吸油量 ${s.oilFlow.toFixed(0)} L/min · 油位正常`, en: `${s.oilFlow.toFixed(0)} L/min` }),
  }),

  // ================= 冷却系统 COOLING =================
  waterPump: P({
    name: { zh: '水泵（机械式离心泵）', en: 'Water Pump' }, group: '冷却系统',
    material: { zh: '铸铝泵壳 + 铸铁叶轮 + 不锈钢轴承', en: 'cast aluminium body, iron impeller' },
    process: { zh: '叶轮与泵盖间隙 0.3 ~ 0.8 mm，密封圈静压 1.5 MPa', en: 'impeller clearance 0.3–0.8 mm' },
    fn: { zh: '强制冷却液在缸体水套、缸盖与散热器之间循环。', en: 'Forces coolant circulation through block, head and radiator.' },
    specs: [['叶轮直径', 'φ96 mm'], ['额定流量', `140 L/min @ 4000 r/min`],
      ['扬程', '≈ 4.5 bar'], ['速比', '1.35 : 1'], ['轴封', '机械密封 + 碳素石墨']],
    state: (s) => ({ zh: `转速 ${(s.rpm * 1.35).toFixed(0)} r/min · 流量 ${s.coolantFlow.toFixed(0)} L/min`, en: `${(s.rpm * 1.35).toFixed(0)} rpm` }),
  }),
  thermostat: P({
    name: { zh: '节温器', en: 'Thermostat' }, group: '冷却系统',
    material: { zh: '黄铜阀体 + 石蜡感温筒', en: 'brass body with wax element' },
    process: { zh: '起开温度 82 ℃，全开 95 ℃，旁通孔 φ6 mm', en: '82 ℃ start / 95 ℃ full open' },
    fn: { zh: '按冷却液温度控制通往散热器的大循环与小循环切换。', en: 'Switches coolant between radiator and bypass circuits by temperature.' },
    specs: [['起开温度', `${SPEC.thermostatOpen} ℃`], ['全开温度', `${SPEC.thermostatFull} ℃`],
      ['开启升程', '9 mm'], ['旁通流量', '≈ 10% 大循环']],
    state: (s) => ({ zh: `开启度 ${(s.thermostat * 100).toFixed(0)}% · 冷却液 ${s.coolantTemp.toFixed(0)} ℃`, en: `${(s.thermostat * 100).toFixed(0)}% open @ ${s.coolantTemp.toFixed(0)}℃` }),
  }),
  radiator: P({
    name: { zh: '散热器', en: 'Radiator' }, group: '冷却系统',
    material: { zh: '铜/铝钎焊芯组 + 尼龙水室', en: 'copper/aluminium brazed core, nylon tanks' },
    process: { zh: '超薄铜管+钎焊扁带，翅片高频翅片化', en: 'multi-row brazed core' },
    fn: { zh: '利用迎面风把冷却液热量传给空气，把冷却液温度控制在 90 ℃ 左右。', en: 'Rejects coolant heat to ambient air.' },
    specs: [['芯组尺寸', '520 × 400 × 32 mm'], ['散热能力', '≥ 78 kW'],
      ['水室容量', '3.2 L'], ['加注压力盖', '开阀 105 kPa']],
    state: (s) => ({ zh: `散热器流量 ${s.radFlow.toFixed(0)} L/min · 进水 ${s.coolantTemp.toFixed(0)} ℃`, en: `${s.radFlow.toFixed(0)} L/min @ ${s.coolantTemp.toFixed(0)}℃` }),
  }),
  fan: P({
    name: { zh: '风扇', en: 'Cooling Fan' }, group: '冷却系统',
    material: { zh: '增强尼龙 PA6-GF30', en: 'glass-fibre reinforced nylon' },
    process: { zh: '注塑成型，动平衡 5 g·cm 以内', en: 'injection moulded, balanced' },
    fn: { zh: '产生通过散热器的空气流，把冷却系统热量带走。', en: 'Moves ambient air through the radiator core.' },
    specs: [['直径', 'φ420 mm'], ['叶片数', '9'], ['转速', '≈ 2200 r/min'], ['驱动方式', '皮带 / 硅油离合']],
    state: (s) => ({ zh: `转速 ${(s.rpm * 1.35).toFixed(0)} r/min`, en: `${(s.rpm * 1.35).toFixed(0)} rpm` }),
  }),
  belt: P({
    name: { zh: '正时/附件皮带', en: 'Drive Belt' }, group: '冷却系统',
    material: { zh: '丁苯橡胶 + 芳纶芯线', en: 'SBR rubber with aramid cords' },
    process: { zh: '硫化成型，5 槽 SPB 断面', en: '5-rib SPB profile' },
    fn: { zh: '由曲轴皮带轮驱动水泵、发电机与风扇，实现正时传动。', en: 'Transmits crankshaft rotation to pump, alternator and fan.' },
    specs: [['规格', '5 × SPB 1750'], ['张紧力', '350 N'], ['包角（水泵）', '≥ 120°']],
    state: crankState,
  }),
  coolantPipe: P({
    name: { zh: '冷却水管路', en: 'Coolant Piping' }, group: '冷却系统',
    material: { zh: '玻纤增强尼龙 / 橡胶复合软管', en: 'glass-fibre nylon / rubber composite hose' },
    process: { zh: '注塑接头 + 卡箍，内壁防老化层', en: 'moulded fittings with clamps' },
    fn: { zh: '把冷却液分配到缸盖、暖风与散热器，实现大循环路径。', en: 'Distributes coolant to head, heater and radiator.' },
    specs: [['主管内径', 'φ35 mm'], ['软管内径', 'φ32 mm'], ['耐压', '1.5 MPa'], ['耐温', '120 ℃']],
    state: (s) => ({ zh: `流量 ${s.coolantFlow.toFixed(0)} L/min · ${s.coolantTemp.toFixed(0)} ℃`, en: `${s.coolantFlow.toFixed(0)} L/min` }),
  }),

  // ================= 进排气系统 INDUCTION / EXHAUST =================
  intakeManifold: P({
    name: { zh: '进气管', en: 'Intake Manifold' }, group: '进排气系统',
    material: { zh: '铝合金铸造，稳压腔内壁抛光', en: 'cast aluminium, polished plenum' },
    process: { zh: '重力铸造，等长进气歧管保证各缸充量一致', en: 'equal-length runners' },
    fn: { zh: '把中冷后的空气均匀分配到 4 个气缸，控制进气惯性效应。', en: 'Distributes intercooled charge equally to all cylinders.' },
    specs: [['歧管内径', 'φ42 mm'], ['歧管长度', '320 mm'], ['稳压腔容积', '3.4 L'],
      ['各缸充量差', '< 3%'], ['进气温度（中冷后）', '35 ~ 55 ℃']],
    state: (s) => ({ zh: `进气压力 ${(101.3 + s.boost / 1000).toFixed(1)} kPa · 流量 ${(s.airMass * 3600).toFixed(0)} kg/h`,
      en: `${(101.3 + s.boost / 1000).toFixed(1)} kPa` }),
  }),
  exhaustManifold: P({
    name: { zh: '排气管', en: 'Exhaust Manifold' }, group: '进排气系统',
    material: { zh: 'Si-Mo 耐热铸铁（304 不锈钢波纹段）', en: 'Si-Mo heat-resistant cast iron' },
    process: { zh: '各缸等长汇流，加隔板降低排气干涉', en: 'equal-length log manifold with dividers' },
    fn: { zh: '汇集各缸高温废气并导入涡轮增压器，承受 700 ℃ 以上的废气冲击。', en: 'Collects exhaust and routes it into the turbocharger.' },
    specs: [['支管管径', 'φ45 × 4 支'], ['汇流后管径', 'φ60 mm'], ['排气温度（满负荷）', '620 ℃'],
      ['隔热包覆', '陶纤毡 + 不锈钢网'], ['热膨胀补偿', '波纹管 2 处']],
    state: (s) => ({ zh: `排气温度 ${s.exhaustTemp.toFixed(0)} ℃ · 背压 ${(20 + s.load * 55).toFixed(0)} mbar`, en: `${s.exhaustTemp.toFixed(0)}℃` }),
  }),
  turbo: P({
    name: { zh: '涡轮增压器', en: 'Turbocharger' }, group: '进排气系统',
    material: { zh: '铸铁蜗壳 + 42CrMo 涡轮轴 + Inconel 涡轮叶轮', en: 'cast iron housings, Inconel turbine wheel' },
    process: { zh: '动平衡叶轮，浮动轴承间隙 0.04 ~ 0.08 mm', en: 'balanced wheel, floating journal bearing' },
    fn: { zh: '利用排气能量驱动涡轮带动压气机，提高进气密度从而提升功率与降低烟度。', en: 'Uses exhaust energy to drive a compressor, raising inlet density.' },
    specs: [['涡轮轴转速', `90 000 r/min (最大)`], ['压气机叶轮', 'φ58 mm'],
      ['涡轮叶轮', 'φ56 mm'], ['最大增压', `${(SPEC.turboBoostMax / 1000).toFixed(0)} kPa`],
      ['轴承形式', '浮动轴承'], ['惯性矩', '≤ 0.12 g·cm²']],
    state: (s) => ({ zh: `增压压力 ${(s.boost / 1000).toFixed(0)} kPa · 转速 ${(12000 + s.load * 60000 + s.rpm * 14).toFixed(0)} r/min`,
      en: `Boost ${(s.boost / 1000).toFixed(0)} kPa` }),
  }),
  intercooler: P({
    name: { zh: '中冷器', en: 'Intercooler' }, group: '进排气系统',
    material: { zh: '铝钎焊空冷芯组', en: 'all-aluminium bar-and-plate core' },
    process: { zh: '钎焊芯组，前后防撞网', en: 'brazed core with guards' },
    fn: { zh: '冷却被压缩升温的空气，降低进气温度提高充气密度、减小 NOx 与烟度。', en: 'Cools the compressed charge to raise density and cut NOx/soot.' },
    specs: [['芯组尺寸', `φ${(SPEC.intercoolerD * 1000).toFixed(0)} × 550 × 62 mm`],
      ['冷却效率', '≥ 70%'], ['最大承压', '2.5 bar'], ['冷却介质', '空气']],
    state: (s) => ({ zh: `压气机出口 ${(298 + s.boost / 4200 - 273).toFixed(0)} ℃ → 中冷后 42 ℃`, en: `In ${(298 + s.boost / 4200 - 273).toFixed(0)}℃ → 42℃` }),
  }),
  airFilter: P({
    name: { zh: '空气滤清器', en: 'Air Filter' }, group: '进排气系统',
    material: { zh: '干式纸质滤芯 + 钢制外壳', en: 'paper element in steel canister' },
    process: { zh: '旋风预滤 + 主滤两级', en: 'cyclonic pre-cleaner + main element' },
    fn: { zh: '过滤空气中的灰尘，防止气缸与涡轮叶轮磨损。', en: 'Removes dust protecting cylinders and turbo wheels.' },
    specs: [['过滤效率', '≥ 99%'], ['阻力', '< 2.0 kPa'], ['阻力报警', '3.5 kPa']],
    state: (s) => ({ zh: `进气流量 ${(s.airMass * 3600).toFixed(0)} kg/h · 阻力 1.1 kPa`, en: `${(s.airMass * 3600).toFixed(0)} kg/h` }),
  }),
  chargePipe: P({
    name: { zh: '增压空气管路', en: 'Charge Air Pipe' }, group: '进排气系统',
    material: { zh: '硅胶/铝复合软管 + 镀铝钢管', en: 'silicone/aluminium composite hose' },
    process: { zh: '内外卡箍约束抗脉动，内壁抗老化层', en: 'double clamped, anti-fatigue' },
    fn: { zh: '连接涡轮压气机出口、中冷器与进气管，承担压力脉动。', en: 'Links compressor outlet, intercooler and manifold under pulsating pressure.' },
    specs: [['管径', 'φ60 mm'], ['耐压', '2.5 bar'], ['耐温', '220 ℃']],
    state: (s) => ({ zh: `增压压力 ${(s.boost / 1000).toFixed(0)} kPa · 空气温度 ${(298 + s.boost / 4200 - 273).toFixed(0)} ℃`, en: `${(s.boost / 1000).toFixed(0)} kPa` }),
  }),

  // ================= 紧固与密封 FASTENERS =================
  headBolt: P({
    name: { zh: '气缸盖螺栓', en: 'Cylinder Head Bolt' }, group: '紧固件',
    material: { zh: '合金钢 40Cr，滚压螺纹 + 微弧氧化', en: '40Cr alloy steel, rolled thread' },
    process: { zh: '扭矩法 + 转角法复合预紧，冷态拉伸永久化', en: 'torque + angle tightening, cold stretch' },
    fn: { zh: '把缸盖压紧在缸体上，密封燃烧室、水套与油道。', en: 'Clamps the head to the block sealing gas, coolant and oil.' },
    specs: [['规格', 'M14×2.0'], ['数量', '16 × M14'], ['预紧力矩', '120 N·m + 90°'],
      ['伸长量', '0.25 ~ 0.30 mm'], ['重复使用', '不可重复使用']],
    state: (s) => ({ zh: `预紧后承受 ${(Math.max(...s.cylinders.map((c) => c.p)) / 1e5).toFixed(0)} bar 缸盖压力`, en: `Loaded ${(Math.max(...s.cylinders.map((c) => c.p)) / 1e5).toFixed(0)} bar` }),
  }),
  mainBolt: P({
    name: { zh: '主轴承螺栓', en: 'Main Bearing Bolt' }, group: '紧固件',
    material: { zh: '合金钢 42CrMo，滚压螺纹', en: '42CrMo, rolled thread' },
    process: { zh: '液压拉伸器预紧至 1.2 倍轴向载荷', en: 'hydraulic tensioner' },
    fn: { zh: '固定主轴承盖，把曲轴主轴承压紧在缸体上。', en: 'Clamps main caps onto the block saddles.' },
    specs: [['规格', 'M16×2.0'], ['数量', '10 × M16'], ['预紧力矩', '180 N·m + 45°']],
    state: (s) => ({ zh: `承受曲轴交变惯性力 · 转速 ${s.rpm.toFixed(0)} r/min`, en: `${s.rpm.toFixed(0)} rpm` }),
  }),
  conrodBolt: P({
    name: { zh: '连杆螺栓', en: 'Connecting Rod Bolt' }, group: '紧固件',
    material: { zh: '合金钢 35CrMo，喷丸强化 + 滚压螺纹', en: '35CrMo alloy steel, peened' },
    process: { zh: '断裂式（非塑性）设计，分为中段与杆部两段', en: 'fraction-split bolt' },
    fn: { zh: '连接连杆大头与连杆盖，承受最高 100 kN 交变惯性力。', en: 'Joins rod cap to big end under high cyclic inertia load.' },
    specs: [['规格', 'M12×1.25'], ['每杆数量', '2 × M12'], ['预紧力矩', '110 N·m'], ['旋转扭矩', '30 ~ 40 N·m']],
    state: (s) => ({ zh: `承受交变载荷 ${(30 + s.rpm * 0.012 + s.load * 25).toFixed(0)} kN · 严禁拆卸`, en: `${(30 + s.rpm * 0.012 + s.load * 25).toFixed(0)} kN` }),
  }),
  oilPipes: P({
    name: { zh: '润滑油管路', en: 'Lubricant Piping' }, group: '润滑系统',
    material: { zh: '钢管 + 编织软管（局部尼龙管）', en: 'steel pipe with braided hose' },
    process: { zh: '管路压接成型，弯半径 ≥ 3D，试验压力 1.5 MPa', en: 'crimped, bend radius ≥ 3D' },
    fn: { zh: '连接油底壳、机油泵、滤清器、机油冷却器与主油道，传递机油。', en: 'Connects sump, pump, filter, cooler and main gallery.' },
    specs: [['主管外径', 'φ20 mm'], ['吸油管内径', 'φ25 mm'], ['耐压', '1.5 MPa'], ['耐温', '130 ℃']],
    state: (s) => ({ zh: `输油量 ${s.oilFlow.toFixed(0)} L/min · 油温 ${s.oilTemp.toFixed(0)} ℃`, en: `${s.oilFlow.toFixed(0)} L/min @ ${s.oilTemp.toFixed(0)}℃` }),
  }),
  panBolt: P({
    name: { zh: '油底壳螺栓', en: 'Oil Pan Bolt' }, group: '紧固件',
    material: { zh: '合金钢镀锌螺栓 M8', en: 'zinc-plated alloy steel M8' },
    process: { zh: '带法兰面，振动等级 8.8', en: 'flanged, property class 8.8' },
    fn: { zh: '把油底壳法兰压紧密封，防止机油泄漏。', en: 'Clamps the sump flange to prevent oil leakage.' },
    specs: [['规格', 'M8×1.25 ×18'], ['数量', '18 × M8'], ['拧紧力矩', '12 N·m']],
    state: () => ({ zh: '已拧紧至 12 N·m · 一次性装配', en: 'Tightened 12 N·m' }),
  }),
  coverBolt: P({
    name: { zh: '气门室罩螺栓', en: 'Rocker Cover Bolt' }, group: '紧固件',
    material: { zh: '钢板冲压成型螺栓 M6 + 尼龙垫圈', en: 'stamped steel M6 with nylon washer' },
    process: { zh: '塑料嵌件防松', en: 'nylon insert for anti-loosening' },
    fn: { zh: '压紧气门室罩并压住硅胶密封条，封闭曲轴箱窜气。', en: 'Clamps the rocker cover and its gasket seal.' },
    specs: [['规格', 'M6×1.0 ×16'], ['数量', '16 × M6'], ['拧紧力矩', '8 N·m']],
    state: () => ({ zh: '已拧紧至 8 N·m · 密封条压紧', en: 'Tightened 8 N·m' }),
  }),
  gaskets: P({
    name: { zh: '密封垫片组', en: 'Gasket Set' }, group: '密封件',
    material: { zh: '复合垫片 / 硅胶 / 多层不锈钢', en: 'composite / silicone / MLS' },
    process: { zh: '按部位分别选材：油底壳纤维垫、罩盖硅胶垫、水泵垫片', en: 'material chosen per joint' },
    fn: { zh: '各结合面的静密封元件，防止液体与气体泄漏。', en: 'Static seals at every joint.' },
    specs: [['油底壳垫', '1.2 mm 纤维'], ['罩盖垫', '3.0 mm 硅胶'], ['飞轮壳垫', '1.2 mm 复合']],
    state: (s) => ({ zh: `静密封 · 介质 ${(s.oilPressure).toFixed(1)} bar 机油 / ${(s.coolantTemp).toFixed(0)} ℃ 冷却液`, en: 'Static seals' }),
  }),
  oilSeal: P({
    name: { zh: '油封（曲轴油封）', en: 'Crankshaft Oil Seal' }, group: '密封件',
    material: { zh: '丁腈橡胶 NBR + 钢骨架', en: 'NBR rubber with steel case' },
    process: { zh: '唇口过盈 0.8 mm，唇口弹簧箍紧', en: '0.8 mm interference, garter spring' },
    fn: { zh: '阻止机油沿旋转轴向外泄漏，同时对轴颈形成油膜润滑。', en: 'Prevents oil leakage while lubricating the shaft surface.' },
    specs: [['规格', 'φ100 × 8 mm 双唇'], ['唇口线速度上限', '25 m/s'], ['耐温', '-30 ~ 150 ℃']],
    state: (s) => ({ zh: `轴颈线速度 ${(s.rpm * 0.0628).toFixed(1)} m/s · 油压 ${s.oilPressure.toFixed(1)} bar`, en: `${(s.rpm * 0.0628).toFixed(1)} m/s` }),
  }),
};

export const PART_GROUPS = {
  固定件: '#6fb1ff', 运动件: '#ffb03a', 配气机构: '#7ee081', 燃油系统: '#ff7a7a',
  润滑系统: '#ffd166', 冷却系统: '#59d0d0', 进排气系统: '#c792ea', 紧固件: '#9aa4b2',
  密封件: '#8d99ae', 流体: '#4fc3f7', 其它: '#cccccc',
};

export function partList() {
  return Object.entries(PART_INFO).map(([id, p]) => ({ id, ...p }));
}
