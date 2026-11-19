// Solmar Bay — DOM HUD: money, health, wanted stars, district, minimap,
// mission text, speed / weapon hints, toasts, district banner, crosshair,
// and the title / pause / busted / wasted overlays. updateHUD only touches
// the DOM when a value actually changed; the minimap redraws each frame
// (190x142, cheap).
const WORLD_W = 4800;
const WORLD_H = 3600;

function el(tag, cls, parent, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}

const CSS = `
#hud{position:fixed;inset:0;pointer-events:none;font-family:Arial,Helvetica,sans-serif;color:#fff;z-index:5}
#hud .panel{background:rgba(10,14,20,.55);border-radius:8px;padding:8px 12px}
#hud-tl{position:absolute;top:14px;left:14px}
#hud-money{font-size:26px;font-weight:700;color:#7dff8a;text-shadow:0 2px 4px rgba(0,0,0,.7)}
#hud-health{width:190px;height:12px;background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.35);border-radius:6px;margin-top:6px;overflow:hidden}
#hud-health-fill{height:100%;background:#37c24a;width:100%}
#hud-stars{font-size:22px;letter-spacing:3px;margin-top:5px;text-shadow:0 2px 4px rgba(0,0,0,.8)}
#hud-stars .on{color:#ffd21a}#hud-stars .off{color:#8a8f96}
#hud-district{font-size:15px;margin-top:5px;color:#ffe9b0;text-shadow:0 2px 4px rgba(0,0,0,.8)}
#hud-map{position:absolute;top:14px;right:14px;border:2px solid rgba(255,255,255,.5);border-radius:6px;background:#0a1420}
#hud-bl{position:absolute;left:14px;bottom:14px;max-width:46vw}
#hud-mission-title{font-size:17px;font-weight:700;color:#ffd21a}
#hud-mission-obj{font-size:15px;margin-top:3px}
#hud-mission-timer{font-size:22px;font-weight:700;color:#ff6a4a;margin-top:3px}
#hud-br{position:absolute;right:14px;bottom:14px;text-align:right}
#hud-speed{font-size:30px;font-weight:700;text-shadow:0 2px 4px rgba(0,0,0,.8)}
#hud-carname{font-size:15px;color:#cfe3ff}
#hud-hint{font-size:15px;margin-top:4px;color:#ffe9b0}
#hud-toast{position:absolute;top:16px;left:50%;transform:translateX(-50%);font-size:17px;font-weight:700;background:rgba(10,14,20,.65);border-radius:8px;padding:8px 16px;text-shadow:0 2px 4px rgba(0,0,0,.8);white-space:nowrap}
#hud-banner{position:absolute;top:30%;left:50%;transform:translate(-50%,-50%);font-size:44px;font-weight:700;letter-spacing:2px;color:#fff;text-shadow:0 3px 12px rgba(0,0,0,.85);white-space:nowrap}
#hud-cross{position:fixed;width:22px;height:22px;margin:-11px 0 0 -11px;pointer-events:none;z-index:6;display:none}
#hud-cross:before,#hud-cross:after{content:'';position:absolute;background:#fff;box-shadow:0 0 3px #000}
#hud-cross:before{left:10px;top:0;width:2px;height:22px}
#hud-cross:after{top:10px;left:0;width:22px;height:2px}
#hud-vignette{position:fixed;inset:0;pointer-events:none;z-index:4;display:none;background:radial-gradient(ellipse at center,transparent 55%,rgba(200,0,0,.55) 100%)}
.screen{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;pointer-events:auto;z-index:10;color:#fff;font-family:Arial,Helvetica,sans-serif}
#screen-title{background:linear-gradient(180deg,rgba(255,140,80,.88) 0%,rgba(220,90,90,.82) 45%,rgba(40,60,110,.9) 100%)}
#screen-pause,#screen-busted,#screen-wasted{background:rgba(8,12,20,.82)}
.screen h1{font-size:64px;letter-spacing:6px;margin:0 0 8px;text-shadow:0 4px 16px rgba(0,0,0,.6)}
.screen h2{font-size:34px;margin:0 0 10px}
.screen .story{font-size:18px;max-width:640px;line-height:1.5;margin:0 0 18px;padding:0 20px}
.screen .controls{font-size:15px;line-height:1.9;color:#dfe8ff;margin-bottom:20px}
.screen .press{font-size:20px;font-weight:700;color:#ffd21a;animation:pulse 1.2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}
.screen .small{font-size:14px;color:#b9c6dd;margin-top:14px}
`;

const CAR_NAMES = { sedan: 'Sedan', taxi: 'Taxi', sport: 'Sportscar', truck: 'Truck', van: 'Van', police: 'Police Cruiser', classic: 'Classic' };

export function createHUD(opts = {}) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const root = el('div', null, document.body);
  root.id = 'hud';
  const vignette = el('div', null, document.body);
  vignette.id = 'hud-vignette';

  const tl = el('div', 'panel', root);
  tl.id = 'hud-tl';
  const money = el('div', null, tl, '$0');
  money.id = 'hud-money';
  const health = el('div', null, tl);
  health.id = 'hud-health';
  const healthFill = el('div', null, health);
  healthFill.id = 'hud-health-fill';
  const stars = el('div', null, tl);
  stars.id = 'hud-stars';
  for (let i = 0; i < 5; i++) {
    const s = el('span', 'off', stars, '★');
    s.dataset.i = i;
  }
  const district = el('div', null, tl, 'Solmar Bay');
  district.id = 'hud-district';

  const map = document.createElement('canvas');
  map.id = 'hud-map';
  map.width = 190;
  map.height = 142;
  root.appendChild(map);
  const mctx = map.getContext('2d');

  const bl = el('div', 'panel', root);
  bl.id = 'hud-bl';
  const mTitle = el('div', null, bl, '');
  mTitle.id = 'hud-mission-title';
  const mObj = el('div', null, bl, '');
  mObj.id = 'hud-mission-obj';
  const mTimer = el('div', null, bl, '');
  mTimer.id = 'hud-mission-timer';

  const br = el('div', 'panel', root);
  br.id = 'hud-br';
  const speed = el('div', null, br, '');
  speed.id = 'hud-speed';
  const carName = el('div', null, br, '');
  carName.id = 'hud-carname';
  const hint = el('div', null, br, '');
  hint.id = 'hud-hint';

  const toast = el('div', null, root, '');
  toast.id = 'hud-toast';
  const banner = el('div', null, root, '');
  banner.id = 'hud-banner';
  const cross = el('div', null, document.body);
  cross.id = 'hud-cross';

  // --- Screens -------------------------------------------------------------
  const title = el('div', 'screen', document.body);
  title.id = 'screen-title';
  el('h1', null, title, 'SOLMAR BAY');
  el('div', 'story', title, 'Rook Reyes, driver-for-hire, new in a sun-soaked coastal city. Work five jobs for the crew, dodge the police, and make the bay yours.');
  const controls = el('div', 'controls', title);
  controls.innerHTML = 'WASD / Arrows — drive &amp; walk &nbsp;·&nbsp; Shift — run<br>E — enter / exit car &nbsp;·&nbsp; Space — handbrake &nbsp;·&nbsp; F — punch<br>Mouse click — shoot (pistol) &nbsp;·&nbsp; 1 / 2 — fists / pistol<br>Esc / P — pause &nbsp;·&nbsp; M — mute &nbsp;·&nbsp; R — radio';
  const press = el('div', 'press', title, opts.hasSave ? 'Press Enter to Continue' : 'Press Enter to Start');
  press.id = 'title-press';
  if (opts.hasSave && opts.saveSummary) {
    el('div', 'small', title, opts.saveSummary);
  }

  const pause = el('div', 'screen', document.body);
  pause.id = 'screen-pause';
  pause.style.display = 'none';
  el('h2', null, pause, 'PAUSED');
  el('div', 'controls', pause).innerHTML = 'Enter — resume<br>R — restart from scratch<br>Q — save &amp; quit to title';

  const busted = el('div', 'screen', document.body);
  busted.id = 'screen-busted';
  busted.style.display = 'none';
  el('h2', null, busted, 'BUSTED');
  el('div', 'story', busted, 'The cops hauled you in. You wake up at Police HQ, $100 lighter, with a clean record — for now.').id = 'busted-text';
  el('div', 'press', busted, 'Press Enter to continue');

  const wasted = el('div', 'screen', document.body);
  wasted.id = 'screen-wasted';
  wasted.style.display = 'none';
  el('h2', null, wasted, 'WASTED');
  el('div', 'story', wasted, 'You went down in Solmar Bay. You wake up at Solmar General, $100 lighter, patched up and ready to go again.').id = 'wasted-text';
  el('div', 'press', wasted, 'Press Enter to continue');

  const screens = { title, pause, busted, wasted };
  let currentScreen = 'title';
  let last = {};
  let lastDistrict = null;
  let bannerUntil = 0;

  function showScreen(name) {
    currentScreen = name || 'play';
    for (const [k, s] of Object.entries(screens)) {
      s.style.display = k === currentScreen ? 'flex' : 'none';
    }
    root.style.display = currentScreen === 'play' || currentScreen === 'pause' ? 'block' : 'none';
    vignette.style.display = 'none';
  }

  function setText(node, key, value) {
    if (last[key] !== value) {
      last[key] = value;
      node.textContent = value;
    }
  }

  function drawMinimap(game) {
    const W = 190;
    const H = 142;
    const sx = W / WORLD_W;
    const sy = H / WORLD_H;
    const X = (x) => x * sx;
    const Y = (y) => y * sy;
    mctx.clearRect(0, 0, W, H);
    mctx.fillStyle = '#3f7a4e';
    mctx.fillRect(0, 0, W, H);
    const city = game.city || {};
    const seaX = city.seaX ?? 110;
    mctx.fillStyle = '#2f6f8f';
    mctx.fillRect(0, 0, X(seaX), H);
    mctx.fillStyle = '#d9b380';
    mctx.fillRect(X(seaX), 0, X((city.beachX1 ?? 300) - seaX), H);
    mctx.fillStyle = '#3a3a40';
    for (const x of city.roadsV || []) mctx.fillRect(X(x - 58), 0, 116 * sx, H);
    for (const y of city.roadsH || []) mctx.fillRect(0, Y(y - 58), W, 116 * sy);
    mctx.fillStyle = '#7a6a58';
    for (const b of city.buildings || []) {
      const bd = b.d ?? b.h;
      mctx.fillRect(X(b.x - b.w / 2), Y(b.y - bd / 2), Math.max(1, b.w * sx), Math.max(1, bd * sy));
    }
    // Mission / taxi target: yellow diamond.
    let target = null;
    const m = game.mission;
    if (m && m.active !== false && m.def && m.def.steps) {
      const s = m.def.steps[Math.min(m.step || 0, m.def.steps.length - 1)];
      if (s) target = s;
    } else if (game.taxi && game.taxi.active) {
      const t = game.taxi;
      target = t.state === 'toClient' && t.client ? t.client : { x: t.destX, y: t.destY };
    }
    if (target) {
      mctx.fillStyle = '#ffd21a';
      const tx = X(target.x);
      const ty = Y(target.y);
      mctx.beginPath();
      mctx.moveTo(tx, ty - 5);
      mctx.lineTo(tx + 5, ty);
      mctx.lineTo(tx, ty + 5);
      mctx.lineTo(tx - 5, ty);
      mctx.closePath();
      mctx.fill();
    }
    // Cars: grey dots, police red.
    for (const c of game.cars || []) {
      mctx.fillStyle = c.kind === 'police' ? '#ff3344' : '#bbbbbb';
      mctx.fillRect(X(c.x) - 1, Y(c.y) - 1, 3, 3);
    }
    if (game.heli && game.heli.active) {
      mctx.fillStyle = '#ff3344';
      mctx.font = 'bold 9px Arial';
      mctx.fillText('H', X(game.heli.x) - 3, Y(game.heli.y) + 3);
    }
    // Player: white arrow.
    const p = game.player || {};
    const px = X(p.x || 0);
    const py = Y(p.y || 0);
    const a = p.angle || 0;
    mctx.fillStyle = '#ffffff';
    mctx.beginPath();
    mctx.moveTo(px + Math.cos(a) * 6, py + Math.sin(a) * 6);
    mctx.lineTo(px + Math.cos(a + 2.5) * 5, py + Math.sin(a + 2.5) * 5);
    mctx.lineTo(px + Math.cos(a - 2.5) * 5, py + Math.sin(a - 2.5) * 5);
    mctx.closePath();
    mctx.fill();
  }

  function updateHUD(game) {
    if (currentScreen !== 'play' && currentScreen !== 'pause') return;
    const p = game.player || {};
    const wanted = game.wanted || {};
    const starsN = wanted.stars ?? p.wanted ?? 0;

    setText(money, 'money', '$' + Math.floor(p.money || 0));
    const hp = Math.max(0, Math.round(p.health ?? p.hp ?? 100));
    if (last.hp !== hp) {
      last.hp = hp;
      healthFill.style.width = hp + '%';
      healthFill.style.background = hp < 30 ? '#e5322d' : '#37c24a';
    }
    if (last.stars !== starsN) {
      last.stars = starsN;
      [...stars.children].forEach((s, i) => {
        s.className = i < starsN ? 'on' : 'off';
      });
    }
    setText(district, 'district', game.district || 'Solmar Bay');

    // District banner: 3 s on change (tracked here; state only has district).
    // Suppressed in shot mode so staged screenshots show the game, not the banner.
    if (game.district && game.district !== lastDistrict) {
      lastDistrict = game.district;
      bannerUntil = (game.time || 0) + 3;
      banner.textContent = game.district;
    }
    const showBanner = (game.time || 0) < bannerUntil && currentScreen === 'play' && !window.__shotMode;
    if (last.banner !== showBanner) {
      last.banner = showBanner;
      banner.style.display = showBanner ? 'block' : 'none';
      banner.style.opacity = showBanner ? String(Math.min(1, bannerUntil - (game.time || 0))) : '0';
    }

    // Mission panel.
    const m = game.mission;
    let mTitleText = '';
    let mObjText = '';
    let mTimerText = '';
    if (m && m.active !== false && m.def) {
      mTitleText = m.def.title + (m.def.pay ? '  —  $' + m.def.pay : '');
      const step = m.def.steps ? m.def.steps[Math.min(m.step || 0, m.def.steps.length - 1)] : null;
      mObjText = step ? (step.text || step.label || '') : '';
      if (m.timer !== null && m.timer !== undefined && m.timer > 0) {
        mTimerText = Math.ceil(m.timer) + 's';
      }
    } else if (game.taxi && game.taxi.active) {
      mTitleText = 'Taxi Fare — $' + (game.taxi.fare || 0);
      mObjText = game.taxi.state === 'toClient' ? 'Pick up the waiting client' : 'Drive the client to the destination';
    } else if ((game.completedMissions && game.completedMissions.length >= 7) || (game.stats && (game.stats.missionsDone || 0) >= 7)) {
      mTitleText = 'Free Roam';
      mObjText = 'The story is done — Solmar Bay is yours.';
    } else {
      mTitleText = 'Solmar Bay';
      mObjText = 'Steal a car with E, or take a taxi fare.';
    }
    setText(mTitle, 'mtitle', mTitleText);
    setText(mObj, 'mobj', mObjText);
    setText(mTimer, 'mtimer', mTimerText);
    mTimer.style.display = mTimerText ? 'block' : 'none';

    // Bottom right: speed + car, or weapon + hint on foot.
    const onFoot = p.onFoot !== undefined ? p.onFoot : !p.car;
    const car = p.car || null;
    if (!onFoot && car) {
      const kmh = Math.round(Math.abs(car.speed || p.speed || 0) * 0.18);
      setText(speed, 'speed', kmh + ' km/h');
      setText(carName, 'carname', CAR_NAMES[car.model] || car.model || 'Car');
      setText(hint, 'hint', 'E — exit car · Space — handbrake');
    } else {
      setText(speed, 'speed', p.weapon === 'pistol' ? 'PISTOL' : 'FISTS');
      setText(carName, 'carname', p.hasPistol ? '1 — fists · 2 — pistol' : 'Fists only — earn the pistol in Hot Wheels');
      setText(hint, 'hint', 'E — enter car · F — punch');
    }

    // Toast: game.message while messageTimer runs.
    const msg = game.message || '';
    const msgT = game.messageTimer ?? 0;
    const showToast = !!msg && msgT > 0;
    if (last.toast !== showToast || last.toastMsg !== msg) {
      last.toast = showToast;
      last.toastMsg = msg;
      toast.style.display = showToast ? 'block' : 'none';
      if (showToast) toast.textContent = msg;
    }
    if (showToast) toast.style.opacity = String(Math.min(1, msgT));

    // Low-health vignette.
    const lowHp = hp < 30 && currentScreen === 'play';
    if (last.lowHp !== lowHp) {
      last.lowHp = lowHp;
      vignette.style.display = lowHp ? 'block' : 'none';
    }

    // Crosshair: pistol out, on foot, playing.
    const showCross = currentScreen === 'play' && onFoot && p.weapon === 'pistol';
    if (last.cross !== showCross) {
      last.cross = showCross;
      cross.style.display = showCross ? 'block' : 'none';
    }

    drawMinimap(game);
    const status = document.getElementById('status');
    if (status) {
      const s = `${game.district || 'Solmar Bay'}. Wanted ${starsN} stars. $${Math.floor(p.money || 0)}. Health ${hp}.`;
      if (last.status !== s) {
        last.status = s;
        status.textContent = s;
      }
    }
  }

  function setCrosshair(x, y) {
    cross.style.left = x + 'px';
    cross.style.top = y + 'px';
  }

  return { update: updateHUD, updateHUD, showScreen, setCrosshair, root };
}
