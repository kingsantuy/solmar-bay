// Solmar Bay — the DOM HUD and minimap, plus the title, pause,
// busted and wasted overlays.
// The HUD takes the game state and updates the DOM only when a value
// changes (the minimap canvas itself is redrawn every frame — it is a
// 190x142 canvas, and the moving dots need it). The project-to-screen
// function comes in through the creator (wired by main.js) and drives
// the edge arrow for off-screen objectives: one game unit is 0.05 m,
// the same scale as the speed readout.

import { CONFIG, LANDMARKS } from './config.js';

const TAU = Math.PI * 2;

const CAR_NAMES = {
  sedan: 'Sedan', taxi: 'Taxi', sport: 'Sport', truck: 'Truck',
  van: 'Van', police: 'Police', classic: 'Classic',
};

function el(tag, css, parent) {
  const d = document.createElement(tag);
  if (css) d.style.cssText = css;
  if (parent) parent.appendChild(d);
  return d;
}

export function createHud(projectToScreen, opts) {
  const shotMode = !!(opts && opts.shotMode);
  const root = el('div',
    'position:fixed;inset:0;pointer-events:none;z-index:10;'
    + 'font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#fff;'
    + 'text-shadow:0 1px 3px rgba(0,0,0,0.8);user-select:none;');
  root.id = 'hud';
  document.body.appendChild(root);

  // ---- top left: money, health, wanted stars, district -------------------
  const topLeft = el('div', 'position:absolute;left:16px;top:14px;', root);
  const moneyEl = el('div', 'font-size:22px;font-weight:700;color:#7dff8a;', topLeft);
  const healthWrap = el('div',
    'width:180px;height:14px;background:rgba(0,0,0,0.55);border:1px solid rgba(255,255,255,0.5);margin-top:6px;',
    topLeft);
  const healthFill = el('div', 'height:100%;width:100%;background:#3ecf6e;', healthWrap);
  const starsEl = el('div', 'font-size:22px;letter-spacing:3px;margin-top:4px;', topLeft);
  const districtEl = el('div', 'font-size:15px;color:#ffe9a0;margin-top:2px;', topLeft);

  // ---- top right: minimap -------------------------------------------------
  const mapWrap = el('div',
    'position:absolute;right:16px;top:14px;border:2px solid rgba(255,255,255,0.55);'
    + 'background:#101820;box-shadow:0 2px 10px rgba(0,0,0,0.5);',
    root);
  const minimap = document.createElement('canvas');
  minimap.width = 190;
  minimap.height = 142;
  minimap.style.display = 'block';
  mapWrap.appendChild(minimap);
  const mapCtx = minimap.getContext('2d');

  // ---- bottom left: mission ------------------------------------------------
  const missionEl = el('div', 'position:absolute;left:16px;bottom:16px;max-width:46vw;', root);
  const missionTitle = el('div', 'font-size:17px;font-weight:700;color:#ffd94a;', missionEl);
  const missionText = el('div', 'font-size:15px;margin-top:2px;', missionEl);

  // ---- bottom right: speed / weapon ---------------------------------------
  const speedEl = el('div', 'position:absolute;right:16px;bottom:16px;text-align:right;', root);
  const speedNum = el('div', 'font-size:26px;font-weight:700;', speedEl);
  const speedHint = el('div', 'font-size:14px;color:#ddd;margin-top:2px;', speedEl);

  // ---- centre top: toast + district banner ---------------------------------
  const toastEl = el('div',
    'position:absolute;left:50%;top:14px;transform:translateX(-50%);'
    + 'font-size:17px;font-weight:600;background:rgba(0,0,0,0.55);'
    + 'padding:6px 14px;border-radius:4px;white-space:nowrap;',
    root);
  const bannerEl = el('div',
    'position:absolute;left:50%;top:34%;transform:translate(-50%,-50%);'
    + 'font-size:46px;font-weight:800;letter-spacing:4px;color:#fff;'
    + 'text-shadow:0 2px 12px rgba(0,0,0,0.9);white-space:nowrap;display:none;',
    root);

  // ---- edge arrow + crosshair ----------------------------------------------
  const edgeEl = el('div',
    'position:absolute;display:none;font-size:20px;font-weight:700;color:#ffd94a;'
    + 'text-shadow:0 1px 4px rgba(0,0,0,0.9);white-space:nowrap;',
    root);
  const crossEl = el('div',
    'position:absolute;display:none;width:24px;height:24px;margin:-12px 0 0 -12px;'
    + 'border:2px solid rgba(255,255,255,0.9);border-radius:50%;',
    root);
  el('div', 'position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px 0 0 -2px;background:#fff;border-radius:50%;', crossEl);

  // ---- overlays -------------------------------------------------------------
  function overlay(bg) {
    return el('div',
      'position:absolute;inset:0;display:none;flex-direction:column;'
      + 'align-items:center;justify-content:center;text-align:center;'
      + 'pointer-events:none;padding:24px;' + bg,
      root);
  }
  const titleEl = overlay(
    'background:linear-gradient(180deg,#241a4e 0%,#5a3a72 34%,#c96a4a 62%,#ff9a4a 78%,#7a4a30 100%);');
  const titleInner = el('div', '', titleEl);
  el('div', 'font-size:64px;font-weight:800;letter-spacing:8px;color:#ffd94a;text-shadow:0 4px 18px rgba(0,0,0,0.6);', titleInner).textContent = 'SOLMAR BAY';
  el('div', 'font-size:19px;margin-top:10px;max-width:640px;', titleInner).textContent =
    'Rook Reyes, driver-for-hire, works seven jobs for the local crew in a sun-soaked coastal city. Steal cars, lose the cops, get paid.';
  el('div', 'font-size:15px;margin-top:16px;line-height:1.7;color:#ffe9c0;', titleInner).innerHTML =
    'WASD / arrows — move &nbsp;·&nbsp; Shift — run<br>'
    + 'E — enter / exit car &nbsp;·&nbsp; Space — handbrake &nbsp;·&nbsp; F — punch<br>'
    + '1 / 2 — fists / pistol &nbsp;·&nbsp; Mouse — aim, click — shoot<br>'
    + 'R — radio &nbsp;·&nbsp; M — mute &nbsp;·&nbsp; Esc — pause';
  const titlePrompt = el('div', 'font-size:22px;font-weight:700;margin-top:22px;color:#fff;', titleInner);

  const pauseEl = overlay('background:rgba(10,12,20,0.72);');
  el('div', 'font-size:44px;font-weight:800;letter-spacing:6px;', pauseEl).textContent = 'PAUSED';
  el('div', 'font-size:17px;margin-top:12px;line-height:1.8;', pauseEl).innerHTML =
    'Esc / Enter — resume<br>R — restart &nbsp;·&nbsp; Q — save and quit';

  const bustedEl = overlay('background:rgba(20,20,60,0.78);');
  el('div', 'font-size:48px;font-weight:800;letter-spacing:6px;color:#9ab0ff;', bustedEl).textContent = 'BUSTED';
  el('div', 'font-size:17px;margin-top:12px;', bustedEl).textContent =
    'The cops caught you. You woke up at Police HQ, $100 lighter. Press Enter to keep playing.';

  const wastedEl = overlay('background:rgba(60,10,10,0.78);');
  el('div', 'font-size:48px;font-weight:800;letter-spacing:6px;color:#ff8a8a;', wastedEl).textContent = 'WASTED';
  el('div', 'font-size:17px;margin-top:12px;', wastedEl).textContent =
    'You woke up at Solmar General, $100 lighter. Press Enter to keep playing.';

  // ---- cached values: the DOM is touched only on change ---------------------
  const last = {};
  let lastDistrict = null;
  let bannerUntil = 0;
  let mouseX = 0, mouseY = 0;
  const statusEl = document.getElementById('status');

  function setText(key, node, value) {
    if (last[key] !== value) {
      last[key] = value;
      node.textContent = value;
    }
  }

  function drawMinimap(game) {
    const ctx = mapCtx;
    const sx = 190 / CONFIG.world.w, sy = 142 / CONFIG.world.h;
    ctx.clearRect(0, 0, 190, 142);
    ctx.fillStyle = '#22301f';
    ctx.fillRect(0, 0, 190, 142);
    ctx.fillStyle = '#1a5f8a';
    ctx.fillRect(0, 0, 110 * sx, 142);
    ctx.fillStyle = '#d8c08a';
    ctx.fillRect(110 * sx, 0, 190 * sx, 142);
    // Brighter roads so the grid reads at a glance.
    ctx.strokeStyle = '#e8e8e8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (const r of CONFIG.roadsV) {
      ctx.moveTo(r * sx, 0);
      ctx.lineTo(r * sx, 142);
    }
    for (const r of CONFIG.roadsH) {
      ctx.moveTo(0, r * sy);
      ctx.lineTo(190, r * sy);
    }
    ctx.stroke();
    // Nine orange landmark dots.
    ctx.fillStyle = '#ff8c1a';
    for (const lm of Object.values(LANDMARKS)) {
      ctx.beginPath();
      ctx.arc(lm.x * sx, lm.y * sy, 3, 0, TAU);
      ctx.fill();
    }
    // Mission / taxi target as a yellow diamond.
    const target = objectiveTarget(game);
    if (target) {
      ctx.fillStyle = '#ffd94a';
      const tx = target.x * sx, ty = target.y * sy;
      ctx.beginPath();
      ctx.moveTo(tx, ty - 5);
      ctx.lineTo(tx + 5, ty);
      ctx.lineTo(tx, ty + 5);
      ctx.lineTo(tx - 5, ty);
      ctx.closePath();
      ctx.fill();
    }
    // Cars grey, police red, helicopter a red H.
    for (const car of game.cars) {
      ctx.fillStyle = car.kind === 'police' ? '#ff3333' : '#cccccc';
      ctx.fillRect(car.x * sx - 1.5, car.y * sy - 1.5, 3, 3);
    }
    if (game.heli && game.heli.active) {
      ctx.fillStyle = '#ff3333';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('H', game.heli.x * sx, game.heli.y * sy);
    }
    // Player arrow: white over a dark outline so it reads on any ground.
    const p = game.player;
    const px = p.x * sx, py = p.y * sy;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-6, -6);
    ctx.lineTo(-6, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, -4);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function objectiveTarget(game) {
    if (game.mission) {
      const step = game.mission.def.steps[game.mission.step];
      if (step && step.kind !== 'escape') return { x: step.x, y: step.y };
      return null;
    }
    if (game.taxi && game.taxi.active) {
      if (game.taxi.state === 'toClient' && game.taxi.client) {
        return { x: game.taxi.client.x, y: game.taxi.client.y };
      }
      return { x: game.taxi.destX, y: game.taxi.destY };
    }
    return null;
  }

  function update(game) {
    const p = game.player;
    const screen = game.screen;

    // Overlays follow the screen; only the active one shows.
    titleEl.style.display = screen === 'title' ? 'flex' : 'none';
    pauseEl.style.display = screen === 'pause' ? 'flex' : 'none';
    bustedEl.style.display = screen === 'busted' ? 'flex' : 'none';
    wastedEl.style.display = screen === 'wasted' ? 'flex' : 'none';
    const hudVisible = screen === 'play' || screen === 'pause';
    topLeft.style.display = hudVisible ? '' : 'none';
    mapWrap.style.display = hudVisible ? '' : 'none';
    missionEl.style.display = hudVisible ? '' : 'none';
    speedEl.style.display = hudVisible ? '' : 'none';
    toastEl.style.display = hudVisible && game.message ? '' : 'none';
    if (screen === 'title') {
      const done = (game.completedMissions || []).length;
      setText('titlePrompt', titlePrompt,
        done > 0
          ? `Continue — ${done} job${done === 1 ? '' : 's'} done, $${p.money} in your pocket. Press Enter.`
          : 'Press Enter to start');
    }
    if (statusEl) {
      setText('status', statusEl,
        'Solmar Bay — ' + screen
        + (game.mission ? ' — ' + game.mission.def.title : ''));
    }

    setText('money', moneyEl, '$' + p.money);
    const hpPct = Math.max(0, Math.round((p.health / 100) * 100));
    if (last.hp !== hpPct) {
      last.hp = hpPct;
      healthFill.style.width = hpPct + '%';
      healthFill.style.background = hpPct > 50 ? '#3ecf6e' : hpPct > 25 ? '#e87e2a' : '#e5484d';
    }
    const stars = game.wanted.stars;
    if (last.stars !== stars) {
      last.stars = stars;
      starsEl.innerHTML = '<span style="color:#ffd94a">' + '★'.repeat(stars) + '</span>'
        + '<span style="color:#777">' + '☆'.repeat(5 - stars) + '</span>';
    }
    setText('district', districtEl, game.district || '');

    // District banner flashes on entry (suppressed in shot mode, where
    // it would cover the centre of the frame).
    if (!shotMode && screen === 'play' && game.district !== lastDistrict) {
      lastDistrict = game.district;
      if (game.time > 2 && game.district) {
        bannerEl.textContent = game.district;
        bannerEl.style.display = '';
        bannerUntil = Date.now() + 2500;
      }
    }
    if (bannerUntil && Date.now() > bannerUntil) {
      bannerUntil = 0;
      bannerEl.style.display = 'none';
    }

    // Mission line, plus a countdown while a job is timed.
    if (game.mission) {
      const def = game.mission.def;
      const step = def.steps[game.mission.step];
      setText('missionTitle', missionTitle, def.title + '  ·  $' + def.pay);
      let text = step ? step.text : '';
      if (def.timeLimit && game.mission.timer != null) {
        text += '  —  ' + Math.max(0, Math.ceil(game.mission.timer)) + 's';
      }
      setText('missionText', missionText, text);
    } else if (game.taxi && game.taxi.active) {
      setText('missionTitle', missionTitle, 'Taxi fare  ·  $' + game.taxi.fare);
      setText('missionText', missionText,
        game.taxi.state === 'toClient' ? 'Pick up the waiting client.' : 'Drive the client to the marker.');
    } else if ((game.completedMissions || []).length >= 7) {
      setText('missionTitle', missionTitle, 'Free roam');
      setText('missionText', missionText, 'Solmar Bay is yours.');
    } else {
      setText('missionTitle', missionTitle, 'Solmar Bay');
      setText('missionText', missionText, 'Press Enter for the next job.');
    }

    // Speed in km/h (1 unit = 0.05 m) and the car name; on foot, the
    // weapon and the enter-car hint.
    if (!p.onFoot && p.car) {
      const kmh = Math.round((p.car.speed || 0) * 0.18);
      setText('speed', speedNum, kmh + ' km/h');
      setText('speedHint', speedHint, CAR_NAMES[p.car.model] || p.car.model);
    } else {
      setText('speed', speedNum, p.weapon === 'pistol' ? 'Pistol' : 'Fists');
      setText('speedHint', speedHint, p.hasPistol ? '1 fists · 2 pistol — E enter car' : 'E — enter car');
    }

    // Toast fades with the message timer.
    if (game.message) {
      setText('toast', toastEl, game.message);
      toastEl.style.opacity = game.messageTimer > 1 ? '1' : String(Math.max(0, game.messageTimer));
    }

    // Crosshair follows the mouse while the pistol is out.
    const aiming = screen === 'play' && p.weapon === 'pistol' && p.hasPistol;
    crossEl.style.display = aiming ? '' : 'none';
    if (aiming) {
      crossEl.style.left = mouseX + 'px';
      crossEl.style.top = mouseY + 'px';
    }

    // Edge arrow for an off-screen objective, with distance in metres.
    const target = objectiveTarget(game);
    let showEdge = false;
    if (target && screen === 'play' && projectToScreen) {
      const proj = projectToScreen(target.x, target.y);
      if (proj && !proj.visible) {
        const w = window.innerWidth, h = window.innerHeight;
        const cx = w / 2, cy = h / 2;
        // A point behind the camera projects mirrored through the
        // screen centre; mirror it back to recover the true direction.
        let px = proj.x, py = proj.y;
        if (proj.behind) { px = w - px; py = h - py; }
        const angle = Math.atan2(py - cy, px - cx);
        const margin = 46;
        // Clamp to the screen edge along the direction to the target.
        const dx = Math.cos(angle), dy = Math.sin(angle);
        const tx = dx === 0 ? Infinity : (dx > 0 ? (w - margin - cx) / dx : (margin - cx) / dx);
        const ty = dy === 0 ? Infinity : (dy > 0 ? (h - margin - cy) / dy : (margin - cy) / dy);
        const t = Math.min(tx, ty);
        const ex = cx + dx * t, ey = cy + dy * t;
        const metres = Math.round(Math.hypot(target.x - p.x, target.y - p.y) * 0.05);
        edgeEl.style.left = ex + 'px';
        edgeEl.style.top = ey + 'px';
        edgeEl.style.transform = `translate(-50%,-50%) rotate(${angle}rad)`;
        setText('edge', edgeEl, '➤ ' + metres + ' m');
        showEdge = true;
      }
    }
    edgeEl.style.display = showEdge ? '' : 'none';

    if (hudVisible) drawMinimap(game);
  }

  function setMouse(x, y) {
    mouseX = x;
    mouseY = y;
  }

  function destroy() {
    if (root.parentNode) root.parentNode.removeChild(root);
  }

  return { root, update, setMouse, destroy };
}
