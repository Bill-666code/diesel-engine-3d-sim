/**
 * ui.js — 界面控制与信息显示（面板、图例、信息卡、四冲程循环图）
 */
import { SPEC, D } from './spec.js';
import { PART_GROUPS } from './data/parts.js';
import { STROKES, clamp, mod } from './kinematics.js';
import { VIEWS } from './controls.js';

const $ = (id) => document.getElementById(id);
const mmv = (v) => (v * 1000).toFixed(0);

export function initUI(stage, state) {
  const reg = stage.reg;

  /* ---------------- 标题规格 ---------------- */
  $('titleSpec').innerHTML = `
    型号 <b>${SPEC.code}</b> · ${SPEC.nCyl} 缸直列 · ${D.dispL.toFixed(2)} L<br>
    缸径×行程 <b>${mmv(SPEC.bore)}×${mmv(SPEC.stroke)} mm</b> · 压缩比 <b>${D.eps.toFixed(1)}:1</b><br>
    ${SPEC.type.zh}<br>
    点火顺序 1-3-4-2 · ${(SPEC.maxPowerKW).toFixed(0)} kW @ ${SPEC.powerRpm} r/min · ${SPEC.maxTorqueNm} N·m`;

  /* ---------------- 循环图 ---------------- */
  const svg = $('cycleSvg');
  const NS = 'http://www.w3.org/2000/svg';
  const R = 40, CX = 60, CY = 60;
  const ang = (deg) => (-90 + (deg / 720) * 360) * Math.PI / 180;
  const arc = (a0, a1, color) => {
    const p = document.createElementNS(NS, 'path');
    const x0 = CX + R * Math.cos(ang(a0)), y0 = CY + R * Math.sin(ang(a0));
    const x1 = CX + R * Math.cos(ang(a1)), y1 = CY + R * Math.sin(ang(a1));
    p.setAttribute('d', `M ${x0} ${y0} A ${R} ${R} 0 0 1 ${x1} ${y1}`);
    p.setAttribute('stroke', color);
    p.setAttribute('stroke-width', '9');
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke-linecap', 'butt');
    svg.appendChild(p);
  };
  const lbl = (deg, text, color, dy = 0) => {
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', CX + (R + 15) * Math.cos(ang(deg)));
    t.setAttribute('y', CY + (R + 15) * Math.sin(ang(deg)) + dy);
    t.setAttribute('fill', color);
    t.setAttribute('font-size', '9.5');
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('font-weight', '600');
    t.textContent = text;
    svg.appendChild(t);
  };
  const bg = document.createElementNS(NS, 'circle');
  bg.setAttribute('cx', CX); bg.setAttribute('cy', CY); bg.setAttribute('r', R);
  bg.setAttribute('fill', 'none'); bg.setAttribute('stroke', 'rgba(255,255,255,.08)'); bg.setAttribute('stroke-width', '9');
  svg.appendChild(bg);
  STROKES.forEach((s) => arc(s.range[0], s.range[1], s.color));
  lbl(90, '做功', '#ff5a2b'); lbl(270, '排气', '#8b7ad6');
  lbl(450, '进气', '#35b6ff'); lbl(630, '压缩', '#f2c14e');
  [0, 180, 360, 540].forEach((a) => {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', CX + R * Math.cos(ang(a)));
    c.setAttribute('cy', CY + R * Math.sin(ang(a)));
    c.setAttribute('r', '2.4'); c.setAttribute('fill', '#cfd8e3');
    svg.appendChild(c);
  });
  const needle = document.createElementNS(NS, 'line');
  needle.setAttribute('stroke', '#fff'); needle.setAttribute('stroke-width', '1.8');
  needle.setAttribute('x1', CX); needle.setAttribute('y1', CY);
  svg.appendChild(needle);
  const hub = document.createElementNS(NS, 'circle');
  hub.setAttribute('cx', CX); hub.setAttribute('cy', CY); hub.setAttribute('r', '3.2');
  hub.setAttribute('fill', '#ffb03a');
  svg.appendChild(hub);

  /* ---------------- 缸状态条 ---------------- */
  const cylList = $('cylList');
  const cylRows = [];
  for (let i = 0; i < SPEC.nCyl; i++) {
    const d = document.createElement('div');
    d.className = 'cyl-row';
    d.innerHTML = `<span class="n">${i + 1}</span><span class="bar"><i></i></span>`;
    cylList.appendChild(d);
    cylRows.push({ bar: d.querySelector('i'), row: d });
  }

  /* ---------------- 视角按钮 ---------------- */
  const viewWrap = $('viewBtns');
  const keys = ['iso', 'front', 'side', 'sideEx', 'top', 'rear', 'section', 'bottom'];
  keys.forEach((k, i) => {
    const b = document.createElement('button');
    b.className = 'btn';
    b.textContent = `${i + 1} ${VIEWS[k].label.zh}`;
    b.onclick = () => {
      stage.setView(k);
      baseRadius = VIEWS[k].radius;
      if (sldExplode.value > 0) stage.controls.goal.radius = Math.min(stage.controls.maxRadius, baseRadius * (1 + (+sldExplode.value / 100) * 0.85));
      if (k === 'section') { toggleGhost(true); toggleSection(true); }
    };
    viewWrap.appendChild(b);
  });

  /* ---------------- 总成显隐 ---------------- */
  const GROUPS = {
    固定件: ['block', 'liner', 'head', 'headGasket', 'valveCover', 'oilPan', 'flywheelHousing', 'timingCase', 'mainBearingWeb', 'waterJacket', 'oilGallery', 'oilPickup', 'rockerShaft'],
    运动件: ['piston', 'rings', 'gudgeonPin', 'conrod', 'bearingShell', 'crankshaft', 'flywheel', 'pulley'],
    配气机构: ['camshaft', 'tappet', 'pushrod', 'rocker', 'valveIntake', 'valveExhaust', 'valveSpring', 'timingGears'],
    燃油系统: ['hpPump', 'injector', 'hpLine', 'fuelFilter', 'injectionDrive'],
    润滑系统: ['oilPump', 'oilFilter', 'oilCooler', 'oilPipes'],
    冷却系统: ['waterPump', 'thermostat', 'radiator', 'fan', 'belt', 'coolantPipe'],
    进排气: ['intakeManifold', 'exhaustManifold', 'turbo', 'intercooler', 'chargePipe', 'airFilter'],
    细节件: ['headBolt', 'mainBolt', 'conrodBolt', 'oilSeal', 'gaskets'],
  };
  const asmWrap = $('asmBtns');
  const groupState = {};
  Object.keys(GROUPS).forEach((g) => {
    const b = document.createElement('button');
    b.className = 'btn tog on';
    b.textContent = g;
    groupState[g] = true;
    b.onclick = () => {
      groupState[g] = !groupState[g];
      b.classList.toggle('on', groupState[g]);
      GROUPS[g].forEach((id) => reg.setVisible(id, groupState[g]));
    };
    asmWrap.appendChild(b);
  });

  /* ---------------- 图例 ---------------- */
  const legend = $('legend');
  Object.entries(PART_GROUPS).forEach(([k, v]) => {
    const d = document.createElement('div');
    d.innerHTML = `<i style="background:${v}"></i>${k}`;
    legend.appendChild(d);
  });

  /* ---------------- 滑块与按钮 ---------------- */
  const sldRpm = $('sldRpm'), sldLoad = $('sldLoad'), sldSpeed = $('sldSpeed');
  const sldClip = $('sldClip'), sldExplode = $('sldExplode');
  sldRpm.oninput = () => { state.rpmTarget = +sldRpm.value; $('lbRpm').textContent = `${sldRpm.value} r/min`; };
  sldLoad.oninput = () => { state.loadTarget = +sldLoad.value / 100; $('lbLoad').textContent = `${sldLoad.value} %`; };
  sldSpeed.oninput = () => { state.timeScale = +sldSpeed.value; $('lbSpeed').textContent = `${(+sldSpeed.value).toFixed(2)}×`; };

  let ghostOn = false, sectionOn = false;
  const btnGhost = $('btnGhost'), btnSection = $('btnSection'), btnSpin = $('btnSpin'), clipWrap = $('clipWrap');
  function toggleGhost(v) {
    ghostOn = v === undefined ? !ghostOn : v;
    btnGhost.classList.toggle('on', ghostOn);
    stage.setGhost(ghostOn);
  }
  function toggleSection(v) {
    sectionOn = v === undefined ? !sectionOn : v;
    btnSection.classList.toggle('on', sectionOn);
    clipWrap.hidden = !sectionOn;
    stage.setSection(sectionOn, +sldClip.value / 1000);
  }
  btnGhost.onclick = () => toggleGhost();
  btnSection.onclick = () => toggleSection();
  btnSpin.onclick = () => {
    stage.controls.autoRotate = stage.controls.autoRotate ? 0 : 0.18;
    btnSpin.classList.toggle('on', !!stage.controls.autoRotate);
  };
  sldClip.oninput = () => {
    stage.setSectionPos(+sldClip.value / 1000);
    $('lbClip').textContent = `${sldClip.value} mm`;
  };
  let baseRadius = stage.controls.goal.radius;
  sldExplode.oninput = () => {
    const t = +sldExplode.value / 100;
    reg.setExplode(t);
    $('lbExplode').textContent = `${sldExplode.value} %`;
    // 拆解后包围盒变大，相机按比例拉远以保证整体在视野内
    stage.controls.goal.radius = Math.min(stage.controls.maxRadius, baseRadius * (1 + t * 0.85));
  };

  const btnRun = $('btnRun');
  function toggleRun() {
    state.running = !state.running;
    btnRun.textContent = state.running ? '⏸ 停机' : '▶ 启动';
    btnRun.classList.toggle('primary', true);
  }
  btnRun.onclick = toggleRun;
  $('btnReset').onclick = () => {
    sldRpm.value = 800; state.rpmTarget = 800; $('lbRpm').textContent = '800 r/min';
    sldLoad.value = 20; state.loadTarget = 0.2; $('lbLoad').textContent = '20 %';
    sldSpeed.value = 1; state.timeScale = 1; $('lbSpeed').textContent = '1.00×';
    sldExplode.value = 0; reg.setExplode(0); $('lbExplode').textContent = '0 %';
    stage.controls.goal.radius = Math.min(stage.controls.maxRadius, baseRadius * 1.0);
    state.theta = 0;
    stage.setView('iso');
    toast('已复位');
  };
  $('btnCollapse').onclick = () => {
    const b = $('controlsBody');
    b.style.display = b.style.display === 'none' ? '' : 'none';
  };

  document.querySelectorAll('[data-fluid]').forEach((b) => {
    b.onclick = () => {
      const on = !b.classList.contains('on');
      b.classList.toggle('on', on);
      stage.setFluidsVisible(b.dataset.fluid, on);
    };
  });

  /* ---------------- 帮助 ---------------- */
  const help = $('help');
  $('btnHelpClose').onclick = () => { help.hidden = true; };
  const toggleHelp = () => { help.hidden = !help.hidden; };

  let toastTimer = null;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 1800);
  }

  /* ---------------- 键盘 ---------------- */
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    const map = { 1: 'iso', 2: 'front', 3: 'side', 4: 'top', 5: 'rear', 6: 'section', 7: 'bottom' };
    if (map[k]) stage.setView(map[k]);
    if (k === 'c') toggleSection();
    if (k === 'g') toggleGhost();
    if (k === 'h') toggleHelp();
    if (k === ' ') { e.preventDefault(); toggleRun(); }
    if (k === 'f') {
      document.querySelectorAll('[data-fluid]').forEach((b) => { b.click(); });
    }
    if (k === 'escape') { help.hidden = true; window.dispatchEvent(new CustomEvent('sim:deselect')); }
  });

  /* ---------------- 信息卡 ---------------- */
  const card = $('card');
  function fillCard(rec, state) {
    const p = rec.info;
    $('cName').textContent = p.name.zh;
    $('cEn').textContent = p.name.en;
    $('cGroup').textContent = p.group;
    $('cMat').textContent = p.material?.zh || '-';
    $('cProc').textContent = p.process?.zh || '-';
    $('cFn').textContent = p.fn?.zh || '-';
    const st = p.state ? p.state(state, { i: null }) : null;
    $('cState').innerHTML = st ? `${st.zh}<em>${st.en}</em>` : '—';
    const sp = $('cSpecs');
    sp.innerHTML = '';
    (p.specs || []).forEach(([k, v]) => {
      const d = document.createElement('div');
      d.innerHTML = `<label>${k}</label><b>${v}</b>`;
      sp.appendChild(d);
    });
    const foot = $('cFoot');
    foot.textContent = `材料 EN: ${p.material?.en || '-'}｜功能 EN: ${p.fn?.en || '-'}｜单击锁定 · Esc 取消`;
  }
  function placeCard(x, y) {
    const w = 314, h = card.offsetHeight || 300;
    let left = x + 18, top = y + 16;
    if (left + w > window.innerWidth - 8) left = x - w - 18;
    if (top + h > window.innerHeight - 8) top = Math.max(8, y - h - 16);
    card.style.left = `${Math.max(8, left)}px`;
    card.style.top = `${Math.max(8, top)}px`;
  }
  function showCard(rec, x, y) { card.hidden = false; fillCard(rec, state); placeCard(x, y); }
  function hideCard() { card.hidden = true; }
  function refreshCard() { if (!card.hidden && curRec) fillCard(curRec, state); }
  let curRec = null;

  /* ---------------- 每帧刷新 ---------------- */
  const ro = {
    angle: $('roAngle'), stroke: $('roStroke'), rpm: $('roRpm'), load: $('roLoad'),
    press: $('roPress'), temp: $('roTemp'), oilP: $('roOilP'), oilT: $('roOilT'),
    cool: $('roCool'), boost: $('roBoost'), exhT: $('roExhT'), power: $('roPower'),
    torque: $('roTorque'), oilF: $('roOilF'), coolF: $('roCoolF'), fuel: $('roFuel'),
  };
  function update(state, fps, cpuMs = 0) {
    const a = mod(state.theta, 720);
    ro.angle.textContent = `${a.toFixed(0)}°`;
    const c0 = state.cylinders[0];
    ro.stroke.textContent = c0.stroke.zh;
    ro.stroke.style.color = c0.stroke.color;
    ro.rpm.textContent = state.rpm.toFixed(0);
    ro.load.textContent = (state.load * 100).toFixed(0);
    ro.press.textContent = (c0.p / 1e5).toFixed(1);
    ro.temp.textContent = (c0.T - 273).toFixed(0);
    ro.oilP.textContent = state.oilPressure.toFixed(1);
    ro.oilT.textContent = state.oilTemp.toFixed(0);
    ro.cool.textContent = state.coolantTemp.toFixed(0);
    ro.boost.textContent = (state.boost / 1000).toFixed(0);
    ro.exhT.textContent = state.exhaustTemp.toFixed(0);
    ro.power.textContent = state.power.toFixed(1);
    ro.torque.textContent = state.torque.toFixed(0);
    ro.oilF.textContent = state.oilFlow.toFixed(0);
    ro.coolF.textContent = state.coolantFlow.toFixed(0);
    ro.fuel.textContent = state.fuelFlow.toFixed(1);
    $('fpsBadge').textContent = `${fps.toFixed(0)} fps · ${cpuMs.toFixed(1)} ms`;
    $('fpsBadge').title = '帧率与仿真线程单帧耗时（不含 GPU 光栅化）';

    // 指针
    const an = ang(a);
    needle.setAttribute('x2', CX + (R + 4) * Math.cos(an));
    needle.setAttribute('y2', CY + (R + 4) * Math.sin(an));

    // 各缸
    state.cylinders.forEach((c, i) => {
      const r = cylRows[i];
      const prog = (mod(c.a, 720) % 180) / 180;
      r.bar.style.width = `${prog * 100}%`;
      r.bar.style.background = c.stroke.color;
    });
    refreshCard();
  }

  return { update, showCard, hideCard, toast, setCur: (r) => { curRec = r; }, getCur: () => curRec };
}
