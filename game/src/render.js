// Everything drawn: the camera transform, the ground (sea, sand, parks,
// lots, roads, pier, containers), buildings, trees, lamps and the
// lighthouse, cars, pedestrians, the player, bullets and particles, the
// mission marker and its edge arrow, the HUD (money, health, stars,
// district, minimap, mission text, speed, weapon, toasts, hints, crosshair,
// low-health vignette) and the title, pause, busted and wasted screens.
import { CONFIG } from './config.js';
import { currentTarget } from './missions.js';

const SEA = '#1e6f8e';
const DEEP = '#155a75';
const SAND = '#e8d5a3';
const GRASS = '#79a75a';
const PARK = '#6a9a4a';
const ROAD = '#3a3a40';
const WALK = '#9a9a92';
const LOT = '#55555c';

export function render(ctx, state, view) {
  const { w, h } = view;
  ctx.clearRect(0, 0, w, h);
  if (state.screen === 'title') {
    drawTitle(ctx, state, view);
    return;
  }
  drawWorld(ctx, state, view);
  drawHud(ctx, state, view);
  if (state.screen === 'pause') drawPause(ctx, view);
  if (state.screen === 'busted') drawEnd(ctx, view, 'BUSTED', 'The cops hauled you in. You wake up at Police HQ, $100 lighter.');
  if (state.screen === 'wasted') drawEnd(ctx, view, 'WASTED', 'You wake up at Solmar General, patched up and $100 lighter.');
}

function drawWorld(ctx, state, view) {
  const { w, h } = view;
  const cam = state.camera;
  const shakeX = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake : 0;
  const shakeY = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake : 0;
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x + shakeX, -cam.y + shakeY);

  const vx0 = cam.x - w / 2 / cam.zoom - 60;
  const vx1 = cam.x + w / 2 / cam.zoom + 60;
  const vy0 = cam.y - h / 2 / cam.zoom - 60;
  const vy1 = cam.y + h / 2 / cam.zoom + 60;
  const inView = (x, y, m) => x > vx0 - m && x < vx1 + m && y > vy0 - m && y < vy1 + m;

  // Ground: grass, sea, sand.
  ctx.fillStyle = GRASS;
  ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
  ctx.fillStyle = SAND;
  ctx.fillRect(Math.max(vx0, CONFIG.seaX), vy0, Math.min(vx1, CONFIG.sandX) - Math.max(vx0, CONFIG.seaX), vy1 - vy0);
  ctx.fillStyle = SEA;
  ctx.fillRect(vx0, vy0, Math.min(vx1, CONFIG.seaX) - vx0, vy1 - vy0);
  ctx.fillStyle = DEEP;
  for (let i = 0; i < 6; i++) {
    const wy = ((state.time * 12 + i * 613) % 3600);
    if (wy > vy0 && wy < vy1) {
      ctx.fillRect(Math.max(vx0, 0), wy, Math.min(vx1, CONFIG.seaX) - Math.max(vx0, 0), 3);
    }
  }

  // Parks and parking lots.
  for (const pk of state.city.parks) {
    if (!inView(pk.x + pk.w / 2, pk.y + pk.h / 2, Math.max(pk.w, pk.h))) continue;
    ctx.fillStyle = PARK;
    ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
  }
  for (const lot of state.city.lots) {
    if (!inView(lot.x + lot.w / 2, lot.y + lot.h / 2, Math.max(lot.w, lot.h))) continue;
    ctx.fillStyle = LOT;
    ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    for (let bx = lot.x + 24; bx < lot.x + lot.w - 10; bx += 48) {
      ctx.beginPath();
      ctx.moveTo(bx, lot.y + 10);
      ctx.lineTo(bx, lot.y + 34);
      ctx.stroke();
    }
  }

  // Roads: sidewalk, asphalt, dashed yellow centre line.
  ctx.fillStyle = WALK;
  for (const rx of CONFIG.roadsV) ctx.fillRect(rx - CONFIG.roadW / 2 - CONFIG.sidewalk, vy0, CONFIG.roadW + CONFIG.sidewalk * 2, vy1 - vy0);
  for (const ry of CONFIG.roadsH) ctx.fillRect(vx0, ry - CONFIG.roadW / 2 - CONFIG.sidewalk, vx1 - vx0, CONFIG.roadW + CONFIG.sidewalk * 2);
  ctx.fillStyle = ROAD;
  for (const rx of CONFIG.roadsV) ctx.fillRect(rx - CONFIG.roadW / 2, vy0, CONFIG.roadW, vy1 - vy0);
  for (const ry of CONFIG.roadsH) ctx.fillRect(vx0, ry - CONFIG.roadW / 2, vx1 - vx0, CONFIG.roadW);
  ctx.strokeStyle = '#f2c230';
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 22]);
  ctx.beginPath();
  for (const rx of CONFIG.roadsV) { ctx.moveTo(rx, vy0); ctx.lineTo(rx, vy1); }
  for (const ry of CONFIG.roadsH) { ctx.moveTo(vx0, ry); ctx.lineTo(vx1, ry); }
  ctx.stroke();
  ctx.setLineDash([]);

  // Marina pier and port containers.
  ctx.fillStyle = '#8a6a4f';
  ctx.fillRect(2280, 3330, 140, 16);
  ctx.fillStyle = '#6a4f38';
  for (let x = 2290; x < 2420; x += 18) ctx.fillRect(x, 3330, 3, 16);
  for (const c of state.city.containers) {
    if (!inView(c.x, c.y, 80)) continue;
    ctx.fillStyle = c.color;
    ctx.fillRect(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h);
  }

  // Buildings: roofs with window grids, glass cores on towers.
  for (const b of state.city.buildings) {
    if (!inView(b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h))) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 5, b.y + 7, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    if (b.floors >= 5) {
      ctx.fillStyle = 'rgba(180,220,235,0.85)';
      ctx.fillRect(b.x + b.w * 0.3, b.y + b.h * 0.3, b.w * 0.4, b.h * 0.4);
    }
    ctx.fillStyle = 'rgba(255,255,220,0.75)';
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 26));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if ((i * 7 + j * 3 + b.floors) % 3 === 0) continue;
        ctx.fillRect(b.x + 8 + i * ((b.w - 16) / cols), b.y + 8 + j * ((b.h - 16) / rows), 7, 9);
      }
    }
    if (b.landmark) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(CONFIG.landmarks[b.landmark].name, b.x + b.w / 2, b.y - 8);
    }
  }

  // Lighthouse: striped red-and-white tower on the north coast.
  const lh = state.city.landmarks.lighthouse;
  if (inView(lh.x, lh.y, 90)) {
    ctx.fillStyle = '#e5e0d0';
    ctx.fillRect(lh.x - 14, lh.y - 46, 28, 52);
    ctx.fillStyle = '#c9563c';
    ctx.fillRect(lh.x - 14, lh.y - 46, 28, 13);
    ctx.fillRect(lh.x - 14, lh.y - 20, 28, 13);
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.arc(lh.x, lh.y - 50, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  // Trees and lamps.
  for (const t of state.city.trees) {
    if (!inView(t.x, t.y, 30)) continue;
    ctx.fillStyle = '#4f7d3a';
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6a4f38';
    ctx.beginPath();
    ctx.arc(t.x, t.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#3a3a3a';
  for (const l of state.city.lamps) {
    if (!inView(l.x, l.y, 20)) continue;
    ctx.fillRect(l.x - 2, l.y - 8, 4, 16);
  }

  // Mission marker: a pulsing yellow diamond with an expanding ring.
  const target = currentTarget(state);
  if (target) {
    const pulse = 1 + Math.sin(state.time * 4) * 0.18;
    ctx.save();
    ctx.translate(target.x, target.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffd23e';
    ctx.fillRect(-13 * pulse, -13 * pulse, 26 * pulse, 26 * pulse);
    ctx.strokeStyle = '#7a5a00';
    ctx.lineWidth = 3;
    ctx.strokeRect(-13 * pulse, -13 * pulse, 26 * pulse, 26 * pulse);
    ctx.restore();
    ctx.strokeStyle = `rgba(255,210,62,${0.7 - ((state.time * 0.7) % 1) * 0.7})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 18 + ((state.time * 40) % 46), 0, Math.PI * 2);
    ctx.stroke();
  }

  // Cars.
  for (const car of state.cars) {
    if (!inView(car.x, car.y, 80)) continue;
    drawCar(ctx, car, state.time);
  }

  // Pedestrians.
  for (const ped of state.peds) {
    if (!inView(ped.x, ped.y, 40)) continue;
    drawPed(ctx, ped);
  }

  // The player on foot: a red jacket in a crowd, with a facing tick.
  const p = state.player;
  if (!p.inCar && state.screen !== 'title') {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#e5322d';
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd23e';
    ctx.fillRect(10, -2, 9, 4);
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath();
    ctx.arc(3, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Bullets and particles.
  ctx.fillStyle = '#ffd23e';
  for (const b of state.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const pt of state.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.restore();
}

function drawCar(ctx, car, time) {
  const def = CONFIG.models[car.model];
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const w = def.w;
  const h = def.h;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
  ctx.fillStyle = car.color;
  roundRect(ctx, -w / 2, -h / 2, w, h, 7);
  ctx.fill();
  // Windshield and rear window.
  ctx.fillStyle = 'rgba(30,40,55,0.85)';
  ctx.fillRect(w * 0.12, -h / 2 + 3, w * 0.2, h - 6);
  ctx.fillRect(-w * 0.32, -h / 2 + 3, w * 0.14, h - 6);
  if (car.model === 'police') {
    // Black-and-white patrol car with a flashing light bar.
    ctx.fillStyle = '#e5e5e5';
    ctx.fillRect(-w * 0.08, -h / 2 + 2, w * 0.2, h - 4);
    const flash = Math.floor(time * 4) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2d2d' : '#2d6fe5';
    ctx.fillRect(-6, -h / 2 - 3, 6, 5);
    ctx.fillStyle = flash ? '#2d6fe5' : '#ff2d2d';
    ctx.fillRect(0, -h / 2 - 3, 6, 5);
  }
  if (car.model === 'taxi') {
    ctx.fillStyle = '#20242c';
    ctx.fillRect(-4, -h / 2 - 4, 10, 6);
    ctx.fillStyle = '#ffd23e';
    for (let i = 0; i < 5; i++) ctx.fillRect(-w / 2 + 6 + i * 8, h / 2 - 4, 4, 3);
  }
  // Brake lights and headlights.
  if (car.brake) {
    ctx.fillStyle = '#ff2d2d';
    ctx.fillRect(-w / 2 - 2, -h / 2 + 2, 3, 5);
    ctx.fillRect(-w / 2 - 2, h / 2 - 7, 3, 5);
  }
  ctx.fillStyle = 'rgba(255,244,180,0.9)';
  ctx.fillRect(w / 2 - 1, -h / 2 + 3, 3, 4);
  ctx.fillRect(w / 2 - 1, h / 2 - 7, 3, 4);
  // Damage smoke puff above a hurt car.
  if (car.hp < 70) {
    ctx.fillStyle = 'rgba(120,120,120,0.7)';
    ctx.beginPath();
    ctx.arc(-w * 0.2, 0, 6 + Math.sin(time * 6) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPed(ctx, ped) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  if (ped.state === 'down') {
    ctx.fillStyle = '#8a8a8a';
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 6, ped.angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.rotate(ped.angle);
  ctx.fillStyle = ped.color;
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  if (ped.kind === 'cop') {
    ctx.fillStyle = '#101318';
    ctx.fillRect(4, -5, 6, 10);
  } else {
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath();
    ctx.arc(2, 0, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (ped.kind === 'client') {
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', ped.x, ped.y - 20);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---- HUD and screens (screen space) ----

function drawHud(ctx, state, view) {
  const { w, h } = view;
  const p = state.player;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Top left: money, health, wanted stars, district.
  ctx.fillStyle = '#3ecf6a';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('$' + p.money.toLocaleString('en-US'), 16, 34);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(16, 44, 170, 14);
  ctx.fillStyle = p.hp > 30 ? '#3ecf6a' : '#e5322d';
  ctx.fillRect(16, 44, Math.max(0, 170 * (p.hp / 100)), 14);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1;
  ctx.strokeRect(16, 44, 170, 14);
  ctx.font = '26px sans-serif';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < p.wanted ? '#ffd23e' : 'rgba(255,255,255,0.35)';
    ctx.fillText('★', 16 + i * 28, 92);
  }
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(state.district, 16, 114);

  // Top right: the minimap.
  drawMinimap(ctx, state, w - 206, 14, 190, 142);

  // Bottom left: mission title, objective, countdown.
  const target = currentTarget(state);
  const def = state.missions.active ? CONFIG.missions[state.missions.idx] : null;
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px sans-serif';
  if (def) {
    ctx.fillText(def.title + '  —  $' + def.pay, 16, h - 56);
    ctx.font = '14px sans-serif';
    ctx.fillText(target ? target.label : def.briefing, 16, h - 34);
    if (state.missions.timer !== null) {
      const t = Math.max(0, Math.ceil(state.missions.timer));
      ctx.fillStyle = t <= 15 ? '#ff5a4e' : '#ffd23e';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('⏱ ' + Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'), 16, h - 10);
    }
  } else if (state.taxi.state !== 'none' && target) {
    ctx.fillText('Taxi fare', 16, h - 56);
    ctx.font = '14px sans-serif';
    ctx.fillText(target.label, 16, h - 34);
  } else if (state.missions.storyComplete) {
    ctx.fillText('Free roam', 16, h - 56);
    ctx.font = '14px sans-serif';
    ctx.fillText('The story is done — Solmar Bay is yours.', 16, h - 34);
  }

  // Bottom right: speed and car, or weapon and hint on foot.
  ctx.textAlign = 'right';
  if (p.inCar) {
    const kmh = Math.round(Math.abs(p.inCar.speed || 0) * 0.18);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(kmh + ' km/h', w - 16, h - 34);
    ctx.font = '14px sans-serif';
    ctx.fillText(p.inCar.model.charAt(0).toUpperCase() + p.inCar.model.slice(1), w - 16, h - 12);
  } else {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(p.weapon === 'pistol' ? 'Pistol' : 'Fists', w - 16, h - 34);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('E — enter car    F — punch    1/2 — weapon', w - 16, h - 12);
  }
  ctx.textAlign = 'left';

  // Centre top: toast messages.
  ctx.textAlign = 'center';
  ctx.font = 'bold 16px sans-serif';
  state.messages.forEach((m, i) => {
    const alpha = Math.min(1, (6 - m.t) / 1.5);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const tw = ctx.measureText(m.text).width + 24;
    ctx.fillRect(w / 2 - tw / 2, 14 + i * 30, tw, 24);
    ctx.fillStyle = '#fff';
    ctx.fillText(m.text, w / 2, 31 + i * 30);
  });
  ctx.globalAlpha = 1;

  // District banner.
  if (state.districtT > 0) {
    ctx.globalAlpha = Math.min(1, state.districtT);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.district, w / 2, h * 0.3);
    ctx.globalAlpha = 1;
  }

  // Edge arrow with distance to an off-screen objective.
  if (target) drawEdgeArrow(ctx, state, view, target);

  // Crosshair while the pistol is out.
  if (!p.inCar && p.weapon === 'pistol' && state.screen === 'play') {
    const mx = state.mouseScreen ? state.mouseScreen.x : w / 2;
    const my = state.mouseScreen ? state.mouseScreen.y : h / 2;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mx - 10, my);
    ctx.lineTo(mx + 10, my);
    ctx.moveTo(mx, my - 10);
    ctx.lineTo(mx, my + 10);
    ctx.stroke();
  }

  // Low-health vignette.
  if (p.hp < 30 && p.hp > 0) {
    const a = (30 - p.hp) / 30 * 0.45;
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.7);
    g.addColorStop(0, 'rgba(200,0,0,0)');
    g.addColorStop(1, `rgba(200,0,0,${a})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}

function drawMinimap(ctx, state, x, y, mw, mh) {
  const sx = mw / CONFIG.world.w;
  const sy = mh / CONFIG.world.h;
  ctx.save();
  ctx.fillStyle = 'rgba(10,20,30,0.72)';
  ctx.fillRect(x - 4, y - 4, mw + 8, mh + 8);
  ctx.beginPath();
  ctx.rect(x, y, mw, mh);
  ctx.clip();
  ctx.fillStyle = SEA;
  ctx.fillRect(x, y, mw, mh);
  ctx.fillStyle = SAND;
  ctx.fillRect(x + CONFIG.seaX * sx, y, (CONFIG.sandX - CONFIG.seaX) * sx, mh);
  ctx.fillStyle = '#5a7d4a';
  ctx.fillRect(x + CONFIG.sandX * sx, y, mw - CONFIG.sandX * sx, mh);
  ctx.fillStyle = '#c9c9c2';
  for (const rx of CONFIG.roadsV) ctx.fillRect(x + (rx - 58) * sx, y, 116 * sx, mh);
  for (const ry of CONFIG.roadsH) ctx.fillRect(x, y + (ry - 58) * sy, mw, 116 * sy);
  const target = currentTarget(state);
  if (target) {
    ctx.fillStyle = '#ffd23e';
    ctx.save();
    ctx.translate(x + target.x * sx, y + target.y * sy);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
  }
  for (const car of state.cars) {
    ctx.fillStyle = car.kind === 'police' ? '#ff2d2d' : '#cfcfcf';
    ctx.fillRect(x + car.x * sx - 1, y + car.y * sy - 1, 3, 3);
  }
  // The player: a white arrow.
  const p = state.player;
  ctx.save();
  ctx.translate(x + p.x * sx, y + p.y * sy);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -4);
  ctx.lineTo(-4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 4, y - 4, mw + 8, mh + 8);
}

function drawEdgeArrow(ctx, state, view, target) {
  const { w, h } = view;
  const cam = state.camera;
  const sx = (target.x - cam.x) * cam.zoom + w / 2;
  const sy = (target.y - cam.y) * cam.zoom + h / 2;
  if (sx > 40 && sx < w - 40 && sy > 40 && sy < h - 40) return;
  let cx = Math.max(50, Math.min(w - 50, sx));
  const cy = Math.max(50, Math.min(h - 50, sy));
  // Keep the arrow clear of the speed readout at bottom right.
  if (cy > h - 110 && cx > w - 260) cx = w - 260;
  const ang = Math.atan2(sy - cy, sx - cx);
  const distM = Math.round(Math.hypot(target.x - state.player.x, target.y - state.player.y) / 10);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(-8, -9);
  ctx.lineTo(-8, 9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(distM + ' m', cx, cy + 26);
  ctx.textAlign = 'left';
}

function drawTitle(ctx, state, view) {
  const { w, h } = view;
  // Sunset over sea and sand.
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#2a1a4a');
  g.addColorStop(0.45, '#c95a3c');
  g.addColorStop(0.7, '#f2a541');
  g.addColorStop(1, '#e8d5a3');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath();
  ctx.arc(w * 0.72, h * 0.32, 54, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1e6f8e';
  ctx.fillRect(0, h * 0.62, w, h * 0.38);
  ctx.fillStyle = '#e8d5a3';
  ctx.fillRect(0, h * 0.58, w, h * 0.06);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, h * 0.62, w, 3);
  // A little skyline.
  ctx.fillStyle = 'rgba(40,20,50,0.8)';
  const skyline = [0.1, 0.16, 0.24, 0.31, 0.42, 0.5, 0.58, 0.66, 0.74, 0.86, 0.94];
  for (const fx of skyline) {
    const bw = 26 + ((fx * 97) % 30);
    const bh = 40 + ((fx * 173) % 90);
    ctx.fillRect(w * fx - bw / 2, h * 0.58 - bh, bw, bh);
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 72px sans-serif';
  ctx.fillText('SOLMAR BAY', w / 2, h * 0.3);
  ctx.font = '20px sans-serif';
  ctx.fillText('A sun-soaked coastal city. One driver. Five jobs. The whole bay to steal.', w / 2, h * 0.3 + 34);
  ctx.font = '15px sans-serif';
  const controls = [
    'WASD / Arrows — walk and drive    Shift — run    E — enter / steal a car    Space — handbrake',
    'F — punch    1 / 2 — fists / pistol    Mouse — aim and shoot    Esc — pause    M — mute',
  ];
  controls.forEach((line, i) => ctx.fillText(line, w / 2, h * 0.68 + i * 24));
  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = '#ffd23e';
  if (state.hasSave) {
    const done = state.missions.done.length;
    ctx.fillText(`Press Enter to continue — $${state.player.money}, ${done} job${done === 1 ? '' : 's'} done`, w / 2, h * 0.8);
  } else {
    ctx.fillText('Press Enter to start', w / 2, h * 0.8);
  }
  ctx.textAlign = 'left';
}

function drawPause(ctx, view) {
  const { w, h } = view;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 48px sans-serif';
  ctx.fillText('PAUSED', w / 2, h * 0.36);
  ctx.font = '18px sans-serif';
  ctx.fillText('Enter — resume', w / 2, h * 0.48);
  ctx.fillText('R — restart the story', w / 2, h * 0.48 + 32);
  ctx.fillText('Q — save and quit to title', w / 2, h * 0.48 + 64);
  ctx.textAlign = 'left';
}

function drawEnd(ctx, view, title, line) {
  const { w, h } = view;
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = title === 'BUSTED' ? '#5a8de5' : '#e5322d';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText(title, w / 2, h * 0.4);
  ctx.fillStyle = '#fff';
  ctx.font = '18px sans-serif';
  ctx.fillText(line, w / 2, h * 0.4 + 36);
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('Press Enter to keep playing', w / 2, h * 0.4 + 80);
  ctx.textAlign = 'left';
}
