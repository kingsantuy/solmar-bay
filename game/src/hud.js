import { CONFIG, LANDMARKS, RADIO, GARAGE } from './config.js';
import { buyWeapon, buyGarage } from './state.js';
const CSS = '#hud{position:fixed;inset:0;pointer-events:none;font-family:Arial,Helvetica,sans-serif;color:#fff;z-index:5;overflow:hidden}'
+ '#hud-tl{position:absolute;top:12px;left:14px;text-shadow:0 1px 2px #000}'
+ '#hud-money{font-size:28px;font-weight:900;color:#4ade80}'
+ '#hud-respect{display:flex;align-items:center;gap:6px;margin-top:4px;font-size:11px;font-weight:700;color:#fbbf24}'
+ '#hud-respect .bar{width:110px;height:8px;background:rgba(0,0,0,.55);border:1px solid #fbbf24;border-radius:4px;overflow:hidden}'
+ '#hud-respect-fill{display:block;height:100%;width:0%;background:linear-gradient(90deg,#f59e0b,#fbbf24)}'
+ '#hud-health{width:170px;height:12px;background:rgba(0,0,0,.55);border:1px solid #fff3;border-radius:6px;overflow:hidden;margin-top:5px}'
+ '#hud-health-fill{display:block;height:100%;width:100%;background:#22c55e}'
+ '#hud-stars{font-size:22px;letter-spacing:2px;margin-top:3px}'
+ '#hud-stars .on{color:#ffd24a}#hud-stars .off{color:rgba(255,255,255,.35)}'
+ '#hud-district{font-size:14px;font-weight:700;margin-top:2px}'
+ '#hud-dispatch{margin-top:8px;background:rgba(10,14,24,.78);border:1px solid rgba(255,255,255,.18);border-radius:6px;padding:6px 8px;font-size:12px;min-width:210px;display:none}'
+ '#hud-dispatch .dh{font-weight:900;letter-spacing:1px;color:#f87171;border-bottom:1px solid rgba(255,255,255,.15);padding-bottom:3px;margin-bottom:3px}'
+ '#hud-dispatch .dr{display:flex;justify-content:space-between;gap:10px;padding:1px 0}'
+ '#hud-dispatch .st{font-weight:800;padding:0 5px;border-radius:3px;font-size:11px}'
+ '#hud-dispatch .st-RAMMING{background:#dc2626}#hud-dispatch .st-FIRING{background:#f97316}#hud-dispatch .st-SPOTLIGHT{background:#2563eb}#hud-dispatch .st-ROADBLOCK{background:#7c3aed}#hud-dispatch .st-PATROL{background:#475569}'
+ '#hud-tr{position:absolute;top:12px;right:14px;text-align:right}'
+ '#hud-map{border:2px solid rgba(255,255,255,.5);border-radius:8px;background:#223}'
+ '#hud-weapons{display:flex;gap:4px;margin-top:5px;justify-content:flex-end}'
+ '#hud-weapons .wslot{min-width:34px;padding:3px 4px;background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.25);border-radius:4px;font-size:10px;font-weight:800;text-align:center}'
+ '#hud-weapons .wslot.cur{border-color:#ffd24a;color:#ffd24a}'
+ '#hud-weapons .wslot.lock{color:#f87171}'
+ '#hud-weapons .wslot small{display:block;font-weight:400;color:#ccc;font-size:9px}'
+ '#hud-mission{position:absolute;left:14px;bottom:14px;background:rgba(10,14,24,.72);border:1px solid rgba(255,255,255,.16);border-radius:6px;padding:8px 10px;max-width:340px}'
+ '#hud-mission-title{font-weight:900;font-size:14px;color:#ffd24a}'
+ '#hud-mission-obj{font-size:13px;margin-top:2px}'
+ '#hud-mission-timer{font-size:13px;font-weight:800;color:#f87171;margin-top:2px}'
+ '#hud-mission-spot{font-size:13px;font-weight:900;color:#f87171;margin-top:2px;display:none}'
+ '#hud-br{position:absolute;right:14px;bottom:14px;text-align:right;text-shadow:0 1px 2px #000}'
+ '#hud-radio{font-size:12px;font-weight:700;color:#f9a8d4;margin-bottom:4px}'
+ '#hud-cond{width:190px;height:10px;background:rgba(0,0,0,.55);border:1px solid #fff3;border-radius:5px;overflow:hidden;margin:0 0 4px auto;display:none}'
+ '#hud-cond-fill{display:block;height:100%;width:100%;background:#38bdf8}'
+ '#hud-cond-txt{font-size:11px;font-weight:700;color:#bae6fd}'
+ '#hud-speed{font-size:30px;font-weight:900}'
+ '#hud-speed small{font-size:14px;font-weight:700;color:#ccc}'
+ '#hud-hint{font-size:12px;color:#e5e5e5;margin-top:2px}'
+ '#hud-toast{position:absolute;top:14px;left:50%;transform:translateX(-50%);background:rgba(10,14,24,.8);border:1px solid rgba(255,255,255,.2);border-radius:6px;padding:7px 14px;font-size:14px;font-weight:700;display:none;white-space:nowrap}'
+ '#hud-banner{position:absolute;top:34%;left:50%;transform:translate(-50%,-50%);font-size:44px;font-weight:900;letter-spacing:2px;text-shadow:0 2px 12px #000;display:none}'
+ '#hud-edge{position:absolute;display:none;font-size:15px;font-weight:900;color:#ffd24a;text-shadow:0 1px 3px #000;white-space:nowrap}'
+ '#hud-cross{position:absolute;width:18px;height:18px;margin:-9px 0 0 -9px;display:none;pointer-events:none}'
+ '#hud-cross:before,#hud-cross:after{content:"";position:absolute;background:#fff;box-shadow:0 0 3px #000}'
+ '#hud-cross:before{left:8px;top:0;width:2px;height:18px}'
+ '#hud-cross:after{top:8px;left:0;width:18px;height:2px}'
+ '#hud-dialogue{position:absolute;left:50%;bottom:96px;transform:translateX(-50%);display:none;align-items:center;gap:10px;background:rgba(10,14,24,.85);border:1px solid rgba(255,255,255,.2);border-radius:8px;padding:10px 14px;max-width:560px}'
+ '#huddlg-face{width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:18px;flex:none;border:2px solid #fff}'
+ '#huddlg-name{font-weight:900;font-size:13px;color:#7dd3fc}'
+ '#huddlg-text{font-size:14px;margin-top:2px}'
+ '#hud-vignette{position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 120px 40px rgba(220,38,38,.55);opacity:0}'
+ '.modal{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(8,12,20,.94);border:1px solid rgba(255,255,255,.25);border-radius:10px;padding:14px 16px;pointer-events:auto;display:none;min-width:340px;box-shadow:0 8px 40px rgba(0,0,0,.6)}'
+ '.modal h2{margin:0 0 4px;font-size:17px;letter-spacing:1px}'
+ '.modal .msub{font-size:12px;color:#bbb;margin-bottom:10px}'
+ '.mrow{display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid rgba(255,255,255,.14);border-radius:6px;margin-bottom:6px;cursor:pointer;font-size:13px}'
+ '.mrow:hover{border-color:#ffd24a}'
+ '.mrow.cur{border-color:#ffd24a;background:rgba(255,210,74,.12)}'
+ '.mrow .key{background:#fff;color:#000;font-weight:900;border-radius:3px;padding:1px 6px;font-size:12px}'
+ '.mrow .nm{font-weight:800;flex:1}'
+ '.mrow .pr{font-weight:800;color:#4ade80}'
+ '.mrow .lk{font-weight:800;color:#f87171}'
+ '.mrow .sw{width:16px;height:16px;border-radius:3px;border:1px solid #fff;display:inline-block;vertical-align:-3px}'
+ '.screen{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;text-align:center;background:linear-gradient(180deg,rgba(20,16,60,.88),rgba(120,60,20,.82));pointer-events:auto}'
+ '.screen h1{font-size:56px;margin:0;letter-spacing:4px;text-shadow:0 3px 16px #000}'
+ '.screen .tag{font-size:16px;margin:10px 0 18px;color:#ffe9c9}'
+ '.screen .ctl{font-size:13px;line-height:1.8;color:#e5e5e5;background:rgba(0,0,0,.35);padding:10px 18px;border-radius:8px}'
+ '.screen .go{font-size:18px;font-weight:900;margin-top:20px;color:#ffd24a}'
+ '.screen h2{font-size:42px;margin:0;letter-spacing:3px}';
function el(tag, id, parent, html) { const e = document.createElement(tag); if (id) e.id = id; if (html !== undefined) e.innerHTML = html; parent.appendChild(e); return e; }
export function createHud(game, renderer) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const root = el('div', 'hud', document.body);
  const tl = el('div', 'hud-tl', root);
  el('div', 'hud-money', tl, '$0');
  const resp = el('div', 'hud-respect', tl);
  resp.innerHTML = '<span>RESPECT</span><div class="bar"><div id="hud-respect-fill"></div></div><span id="hud-respect-lv">LV 0</span>';
  const hp = el('div', 'hud-health', tl);
  el('div', 'hud-health-fill', hp);
  el('div', 'hud-stars', tl);
  el('div', 'hud-district', tl, 'Solmar Bay');
  el('div', 'hud-dispatch', tl);
  const tr = el('div', 'hud-tr', root);
  const map = el('canvas', 'hud-map', tr);
  map.width = 190; map.height = 142;
  el('div', 'hud-weapons', tr);
  const ms = el('div', 'hud-mission', root);
  el('div', 'hud-mission-title', ms);
  el('div', 'hud-mission-obj', ms);
  el('div', 'hud-mission-timer', ms);
  el('div', 'hud-mission-spot', ms);
  const br = el('div', 'hud-br', root);
  el('div', 'hud-radio', br);
  const cond = el('div', 'hud-cond', br);
  el('div', 'hud-cond-fill', cond);
  el('span', 'hud-cond-txt', cond);
  el('div', 'hud-speed', br);
  el('div', 'hud-hint', br);
  el('div', 'hud-toast', root);
  el('div', 'hud-banner', root);
  el('div', 'hud-edge', root);
  el('div', 'hud-cross', root);
  const dlg = el('div', 'hud-dialogue', root);
  el('div', 'huddlg-face', dlg, 'MA');
  const dlgTx = el('div', null, dlg);
  el('div', 'huddlg-name', dlgTx);
  el('div', 'huddlg-text', dlgTx);
  el('div', 'hud-vignette', root);
  const wheel = el('div', 'hud-wheel', root, '<h2>WEAPONS</h2><div class="msub">Click or press 1–5 · Q closes · $0</div><div class="mrows"></div>');
  wheel.classList.add('modal');
  const garage = el('div', 'hud-garage', root, '<h2>CHOP SHOP — SPRAY &amp; TUNE</h2><div class="msub">Click or press 1–4 · G / Esc closes · $0</div><div class="mrows"></div>');
  garage.classList.add('modal');
  const title = el('div', 'hud-title', root);
  title.classList.add('screen');
  title.innerHTML = '<h1>SOLMAR BAY</h1><div class="tag">Eight story jobs. One city. Lose the heat, keep the cash.</div><div class="ctl">WASD / Arrows — walk &amp; drive · Shift — run · Space — handbrake<br>E — enter / exit car · F — punch · Mouse — aim &amp; shoot<br>1–5 — weapons · Q — weapon wheel · G — Chop Shop tune<br>R — radio · M — mute · Esc — pause</div><div class="go">Press Enter to start</div>';
  const pause = el('div', 'hud-pause', root);
  pause.classList.add('screen');
  pause.innerHTML = '<h2>PAUSED</h2><div class="tag">Take a breath, Rook.</div><div class="ctl">Enter — resume<br>R — restart<br>Q — save &amp; quit</div>';
  const busted = el('div', 'hud-busted', root);
  busted.classList.add('screen');
  busted.innerHTML = '<h2>BUSTED</h2><div class="tag">The cops caught you. $100 lighter.</div><div class="go">Press Enter</div>';
  const wasted = el('div', 'hud-wasted', root);
  wasted.classList.add('screen');
  wasted.innerHTML = '<h2>WASTED</h2><div class="tag">You got wasted. $100 lighter.</div><div class="go">Press Enter</div>';
  const status = document.getElementById('status');
  const hud = {
    game, renderer, root,
    mouse: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
    bind(g) { hud.game = g; },
    update,
  };
  window.addEventListener('mousemove', (e) => { hud.mouse.x = e.clientX; hud.mouse.y = e.clientY; });
  wheel.addEventListener('click', (e) => {
    const row = e.target.closest('.mrow');
    if (!row) return;
    if (buyWeapon(hud.game, row.dataset.id)) hud.game.ui.wheel = false;
  });
  garage.addEventListener('click', (e) => {
    const row = e.target.closest('.mrow');
    if (!row) return;
    buyGarage(hud.game, row.dataset.item);
  });
  window.addEventListener('keydown', (e) => {
    if (!hud.game || !hud.game.ui.garage) return;
    const items = ['repair', 'paint', 'engine', 'armour'];
    const n = ['1', '2', '3', '4'].indexOf(e.key);
    if (n >= 0) buyGarage(hud.game, items[n]);
  });
  const q = (id) => document.getElementById(id);
  const els = {
    money: q('hud-money'), respectFill: q('hud-respect-fill'), respectLv: q('hud-respect-lv'),
    healthFill: q('hud-health-fill'), stars: q('hud-stars'), district: q('hud-district'),
    dispatch: q('hud-dispatch'), map: q('hud-map'), weapons: q('hud-weapons'),
    missionTitle: q('hud-mission-title'), missionObj: q('hud-mission-obj'), missionTimer: q('hud-mission-timer'), missionSpot: q('hud-mission-spot'),
    radio: q('hud-radio'), cond: q('hud-cond'), condFill: q('hud-cond-fill'), condTxt: q('hud-cond-txt'),
    speed: q('hud-speed'), hint: q('hud-hint'), toast: q('hud-toast'), banner: q('hud-banner'),
    edge: q('hud-edge'), cross: q('hud-cross'), dialogue: q('hud-dialogue'),
    dlgFace: q('huddlg-face'), dlgName: q('huddlg-name'), dlgText: q('huddlg-text'),
    vignette: q('hud-vignette'), wheel, garage, title, pause, busted, wasted,
  };
  const mapCtx = els.map.getContext('2d');
  const last = {};
  function setText(node, key, text) { if (last[key] !== text) { last[key] = text; node.textContent = text; } }
  function setShow(node, key, show, disp) { const v = show ? (disp || 'block') : 'none'; if (last[key] !== v) { last[key] = v; node.style.display = v; } }
  function setBar(node, key, pct, color) {
    const p = Math.max(0, Math.min(100, Math.round(pct)));
    if (last[key] !== p) { last[key] = p; node.style.width = p + '%'; }
    if (color && last[key + 'c'] !== color) { last[key + 'c'] = color; node.style.background = color; }
  }
  function currentTarget(g) {
    if (g.mission) { const s = g.mission.def.steps[g.mission.step]; if (s && s.kind !== 'escape') return { x: s.x, y: s.y }; return null; }
    if (g.taxi && g.taxi.active) {
      if (g.taxi.state === 'toClient' && g.taxi.client) return { x: g.taxi.client.x, y: g.taxi.client.y };
      return { x: g.taxi.destX, y: g.taxi.destY };
    }
    return null;
  }
  function drawMap(g) {
    const c = mapCtx;
    const sx = 190 / CONFIG.world.w, sy = 142 / CONFIG.world.h;
    c.fillStyle = '#20242e'; c.fillRect(0, 0, 190, 142);
    c.fillStyle = '#1c4a6e'; c.fillRect(0, 0, 110 * sx, 142);
    c.fillStyle = '#c9b183'; c.fillRect(110 * sx, 0, 190 * sx, 142);
    c.fillStyle = '#6a6f7d';
    for (const r of CONFIG.roadsV) c.fillRect((r - CONFIG.roadW / 2) * sx, 0, CONFIG.roadW * sx, 142);
    for (const r of CONFIG.roadsH) c.fillRect(0, (r - CONFIG.roadW / 2) * sy, 190, CONFIG.roadW * sy);
    c.fillStyle = '#f59e0b';
    for (const k of Object.keys(LANDMARKS)) { const lm = LANDMARKS[k]; c.beginPath(); c.arc(lm.x * sx, lm.y * sy, 2.5, 0, 7); c.fill(); }
    const t = currentTarget(g);
    if (t) {
      c.fillStyle = '#ffd24a';
      c.save(); c.translate(t.x * sx, t.y * sy); c.rotate(Math.PI / 4); c.fillRect(-4, -4, 8, 8); c.restore();
    }
    if (g.taxi && g.taxi.active) {
      c.fillStyle = '#f2c200';
      const tx = g.taxi.state === 'toClient' && g.taxi.client ? g.taxi.client.x : g.taxi.destX;
      const ty = g.taxi.state === 'toClient' && g.taxi.client ? g.taxi.client.y : g.taxi.destY;
      c.beginPath(); c.arc(tx * sx, ty * sy, 3, 0, 7); c.fill();
    }
    for (const car of g.cars) {
      c.fillStyle = car.kind === 'police' ? '#ef4444' : '#9aa0aa';
      c.fillRect(car.x * sx - 1.5, car.y * sy - 1.5, 3, 3);
    }
    for (const pd of g.peds) {
      if (pd.kind === 'cop') { c.fillStyle = '#ef4444'; c.fillRect(pd.x * sx - 1.5, pd.y * sy - 1.5, 3, 3); }
    }
    if (g.heli.active) { c.fillStyle = '#ef4444'; c.font = 'bold 9px Arial'; c.fillText('H', g.heli.x * sx - 3, g.heli.y * sy + 3); }
    const p = g.player;
    c.save();
    c.translate(p.x * sx, p.y * sy); c.rotate(p.angle);
    c.fillStyle = '#111'; c.beginPath(); c.moveTo(7, 0); c.lineTo(-5, -5); c.lineTo(-5, 5); c.closePath(); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(5, 0); c.lineTo(-4, -3.5); c.lineTo(-4, 3.5); c.closePath(); c.fill();
    c.restore();
  }
  function wheelSig(g) { return g.weapons.list.map((w) => w.id + (w.owned ? 1 : 0)).join('') + g.weapons.cur + g.respect.pts + g.player.money; }
  function garageSig(g) { return g.garage.engine + '/' + g.garage.armour + '/' + g.garage.paint + '/' + g.player.money + '/' + (g.player.car ? Math.round(g.player.car.health) : 0); }
  function renderWheel(g) {
    const rows = g.weapons.list.map((w, i) => {
      const locked = w.reqRespect > 0 && g.respect.pts < w.reqRespect;
      const tag = locked ? '<span class="lk">LOCKED · ' + w.reqRespect + ' RESPECT</span>' : (w.owned ? '<span class="pr">OWNED</span>' : '<span class="pr">$' + w.price + '</span>');
      return '<div class="mrow' + (g.weapons.cur === i ? ' cur' : '') + '" data-id="' + w.id + '"><span class="key">' + (i + 1) + '</span><span class="nm">' + w.name + '</span><span>' + w.dmg + ' dmg · ' + w.rate + 's</span>' + tag + '</div>';
    }).join('');
    els.wheel.querySelector('.msub').textContent = 'Click or press 1–5 · Q closes · $' + g.player.money;
    els.wheel.querySelector('.mrows').innerHTML = rows;
  }
  function renderGarage(g) {
    const car = g.player.car;
    const cond = car ? Math.round((car.health / (100 + g.garage.armour * GARAGE.armourBonus)) * 100) : 0;
    const nextPaint = CONFIG.paintColors[(g.garage.paint + 1) % CONFIG.paintColors.length];
    const rows = '<div class="mrow" data-item="repair"><span class="key">1</span><span class="nm">Repair</span><span>Condition ' + cond + '%</span><span class="pr">$' + GARAGE.repair + '</span></div>'
      + '<div class="mrow" data-item="paint"><span class="key">2</span><span class="nm">Respray</span><span class="sw" style="background:' + nextPaint + '"></span><span class="pr">$' + GARAGE.paint + '</span></div>'
      + '<div class="mrow" data-item="engine"><span class="key">3</span><span class="nm">Engine tune</span><span>Lv ' + g.garage.engine + '/' + GARAGE.engineMax + ' · +40 top speed</span><span class="pr">' + (g.garage.engine >= GARAGE.engineMax ? 'MAXED' : '$' + GARAGE.engine) + '</span></div>'
      + '<div class="mrow" data-item="armour"><span class="key">4</span><span class="nm">Armour plating</span><span>Lv ' + g.garage.armour + '/' + GARAGE.armourMax + ' · +50 max health</span><span class="pr">' + (g.garage.armour >= GARAGE.armourMax ? 'MAXED' : '$' + GARAGE.armour) + '</span></div>';
    els.garage.querySelector('.msub').textContent = 'Click or press 1–4 · G / Esc closes · $' + g.player.money;
    els.garage.querySelector('.mrows').innerHTML = rows;
  }
  function update() {
    const g = hud.game;
    if (!g) return;
    const p = g.player;
    setText(els.money, 'money', '$' + p.money);
    const lv = Math.floor(g.respect.pts / 200);
    setBar(els.respectFill, 'resp', (g.respect.pts % 200) / 2);
    setText(els.respectLv, 'resplv', 'LV ' + lv);
    setBar(els.healthFill, 'hp', p.health, p.health > 50 ? '#22c55e' : (p.health > 25 ? '#f59e0b' : '#ef4444'));
    const stars = '★★★★★'.slice(0, g.wanted.stars) + '☆☆☆☆☆'.slice(0, 5 - g.wanted.stars);
    if (last.stars !== stars) { last.stars = stars; els.stars.innerHTML = '<span class="on">' + '★'.repeat(g.wanted.stars) + '</span><span class="off">' + '☆'.repeat(5 - g.wanted.stars) + '</span>'; }
    setText(els.district, 'dist', g.district);
    if (g.wanted.stars >= 1 && g.dispatch.length) {
      setShow(els.dispatch, 'disp', true);
      const sig = g.dispatch.map((u) => u.name + u.distM + u.status).join('|');
      if (last.dispsig !== sig) {
        last.dispsig = sig;
        els.dispatch.innerHTML = '<div class="dh">● SOLMAR PD — ' + g.dispatch.length + ' UNITS · CODE ' + g.wanted.stars + '</div>' + g.dispatch.map((u) => '<div class="dr"><span>' + u.name + '</span><span>' + u.distM + ' m</span><span class="st st-' + u.status + '">' + u.status + '</span></div>').join('');
      }
    } else setShow(els.dispatch, 'disp', false);
    const wsig = wheelSig(g);
    if (last.wsig !== wsig) { last.wsig = wsig; els.weapons.innerHTML = g.weapons.list.map((w, i) => '<div class="wslot' + (g.weapons.cur === i ? ' cur' : '') + ((w.reqRespect > 0 && g.respect.pts < w.reqRespect) ? ' lock' : '') + '">' + (i + 1) + ' ' + w.name.toUpperCase() + '<small>' + (w.reqRespect > 0 && g.respect.pts < w.reqRespect ? 'LOCKED' : (w.owned ? 'OWNED' : '$' + w.price)) + '</small></div>').join(''); }
    if (g.mission) {
      setText(els.missionTitle, 'mt', 'JOB ' + (g.mission.index + 1) + '/8 — ' + g.mission.def.title + ' · $' + g.mission.def.pay);
      const step = g.mission.def.steps[g.mission.step];
      setText(els.missionObj, 'mo', step ? 'STAGE ' + (g.mission.step + 1) + '/' + g.mission.def.steps.length + ' — ' + step.label : '');
      setText(els.missionTimer, 'mtm', g.mission.timer !== null && g.mission.timer !== undefined ? '⏱ ' + Math.ceil(g.mission.timer) + 's' : '');
    } else {
      setText(els.missionTitle, 'mt', g.missionIndex >= 8 ? 'STORY COMPLETE' : 'NO JOB');
      setText(els.missionObj, 'mo', g.missionIndex >= 8 ? 'Solmar Bay is yours — free roam.' : 'Press Enter for the next job.');
      setText(els.missionTimer, 'mtm', '');
    }
    const spot = g.heli.active || g.cars.some((c) => c.kind === 'police' && Math.hypot(c.x - p.x, c.y - p.y) <= 520) || g.peds.some((pd) => pd.kind === 'cop' && Math.hypot(pd.x - p.x, pd.y - p.y) <= 320);
    setShow(els.missionSpot, 'spot', spot);
    setText(els.missionSpot, 'spottx', spot ? '● IN SIGHT' : '');
    const st = g.audio ? g.audio.station : 0;
    setText(els.radio, 'radio', '♪ ' + RADIO[st].name + ' — ' + RADIO[st].track);
    setShow(els.radio, 'radioshow', !p.onFoot);
    if (!p.onFoot && p.car) {
      setShow(els.cond, 'cond', true);
      setBar(els.condFill, 'condfill', (p.car.health / (100 + g.garage.armour * GARAGE.armourBonus)) * 100);
      setText(els.condTxt, 'condtxt', 'CONDITION ' + Math.round((p.car.health / (100 + g.garage.armour * GARAGE.armourBonus)) * 100) + '%');
      const spd = Math.round(p.car.speed * 0.25) + ' <small>km/h · ' + p.car.model.toUpperCase() + '</small>';
      if (last.speed !== spd) { last.speed = spd; els.speed.innerHTML = spd; }
      setText(els.hint, 'hint', nearCarHint(g));
    } else {
      setShow(els.cond, 'cond', false);
      if (last.speed !== '') { last.speed = ''; els.speed.innerHTML = ''; }
      setText(els.hint, 'hint', weaponName(g) + ' · E — enter car · F — punch · Q — weapons');
    }
    setShow(els.toast, 'toast', g.messageTimer > 0);
    setText(els.toast, 'toasttx', g.message || '');
    setShow(els.banner, 'banner', g.bannerTimer > 0);
    setText(els.banner, 'bannertx', g.banner || '');
    updateEdge(g);
    const armed = p.weapon !== 'fists';
    setShow(els.cross, 'cross', armed && g.screen === 'play' && !g.ui.wheel && !g.ui.garage);
    if (armed) { els.cross.style.left = hud.mouse.x + 'px'; els.cross.style.top = hud.mouse.y + 'px'; }
    if (g.dialogue) {
      setShow(els.dialogue, 'dlg', true, 'flex');
      if (last.dlgface !== g.dialogue.init) { last.dlgface = g.dialogue.init; els.dlgFace.textContent = g.dialogue.init; els.dlgFace.style.background = g.dialogue.color; }
      setText(els.dlgName, 'dlgname', g.dialogue.name + ' · ' + g.dialogue.role);
      setText(els.dlgText, 'dlgtext', g.dialogue.text + '  (Enter)');
    } else setShow(els.dialogue, 'dlg', false);
    const vig = Math.min(1, p.hitFlash * 1.5 + (p.health < 30 && p.health > 0 ? 0.35 + 0.1 * Math.sin(performance.now() / 200) : 0));
    if (Math.abs((last.vig || 0) - vig) > 0.02) { last.vig = vig; els.vignette.style.opacity = vig.toFixed(2); }
    setShow(els.wheel, 'wheel', !!g.ui.wheel);
    if (g.ui.wheel) { const s = wheelSig(g); if (last.wheelsig !== s) { last.wheelsig = s; renderWheel(g); } }
    setShow(els.garage, 'garage', !!g.ui.garage);
    if (g.ui.garage) { const s = garageSig(g); if (last.garagesig !== s) { last.garagesig = s; renderGarage(g); } }
    setShow(els.title, 'sctitle', g.screen === 'title', 'flex');
    if (g.screen === 'title') {
      const go = g.hasSave ? 'Continue — ' + g.completedMissions.length + ' jobs done · $' + p.money + ' — Press Enter' : 'Press Enter to start';
      setText(title.querySelector('.go'), 'titlego', go);
    }
    setShow(els.pause, 'scpause', g.screen === 'pause', 'flex');
    setShow(els.busted, 'scbusted', g.screen === 'busted', 'flex');
    setShow(els.wasted, 'scwasted', g.screen === 'wasted', 'flex');
    drawMap(g);
    if (status) {
      const stxt = 'Solmar Bay. ' + g.screen + '. ' + (g.mission ? g.mission.def.title : 'Free roam') + '. $' + p.money + '.';
      if (last.status !== stxt) { last.status = stxt; status.textContent = stxt; }
    }
  }
  function nearCarHint(g) {
    const p = g.player;
    if (!p.car) return '';
    return nearChop(g) ? 'G — Chop Shop tune' : 'E — exit car · Space — handbrake';
  }
  function nearChop(g) { return Math.hypot(g.player.x - LANDMARKS.chopshop.x, g.player.y - LANDMARKS.chopshop.y) < 320; }
  function weaponName(g) { const w = g.weapons.list[g.weapons.cur]; return w ? w.name.toUpperCase() : 'FISTS'; }
  function updateEdge(g) {
    const t = currentTarget(g);
    if (!t || !renderer || !renderer.projectToScreen) { setShow(els.edge, 'edge', false); return; }
    const pr = renderer.projectToScreen(t.x, t.y, 0);
    const w = window.innerWidth, h = window.innerHeight;
    const onScreen = pr.visible && !pr.behind;
    if (onScreen) { setShow(els.edge, 'edge', false); return; }
    setShow(els.edge, 'edge', true);
    let dx = pr.x - w / 2, dy = pr.y - h / 2;
    if (pr.behind) { dx = -dx; dy = -dy; }
    const ang = Math.atan2(dy, dx);
    const m = 46;
    let px = w / 2 + Math.cos(ang) * 1000, py = h / 2 + Math.sin(ang) * 1000;
    const cx = w / 2, cy = h / 2;
    const kx = (w / 2 - m) / Math.abs(Math.cos(ang) || 0.001);
    const ky = (h / 2 - m) / Math.abs(Math.sin(ang) || 0.001);
    const k = Math.min(kx, ky);
    px = cx + Math.cos(ang) * k; py = cy + Math.sin(ang) * k;
    const distM = Math.round(Math.hypot(t.x - g.player.x, t.y - g.player.y) / 10);
    els.edge.style.left = px + 'px';
    els.edge.style.top = py + 'px';
    els.edge.style.transform = 'translate(-50%,-50%) rotate(' + (ang * 180 / Math.PI) + 'deg)';
    setText(els.edge, 'edgetx', '➤ ' + distM + ' m');
  }
  return hud;
}
