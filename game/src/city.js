import { createRng } from './rng.js';
import { CONFIG, LANDMARKS } from './config.js';
const W = CONFIG.world.w, H = CONFIG.world.h;
const BAND = CONFIG.roadW / 2 + CONFIG.sidewalk + CONFIG.roadMargin;
const TAU = Math.PI * 2;
export function distToRect(x, y, r) { const dx = Math.max(Math.abs(x - r.x) - r.w / 2, 0); const dy = Math.max(Math.abs(y - r.y) - r.d / 2, 0); return Math.hypot(dx, dy); }
function nudge(x, y, w, d) {
  for (let i = 0; i < 8; i++) {
    let m = false;
    for (const r of CONFIG.roadsV) if (x - w / 2 < r + BAND && x + w / 2 > r - BAND) { const a = r - BAND - 1 - w / 2, b = r + BAND + 1 + w / 2; x = Math.abs(a - x) < Math.abs(b - x) ? a : b; m = true; }
    for (const r of CONFIG.roadsH) if (y - d / 2 < r + BAND && y + d / 2 > r - BAND) { const a = r - BAND - 1 - d / 2, b = r + BAND + 1 + d / 2; y = Math.abs(a - y) < Math.abs(b - y) ? a : b; m = true; }
    if (!m) break;
  }
  return { x: Math.max(w / 2 + 20, Math.min(W - w / 2 - 20, x)), y: Math.max(d / 2 + 20, Math.min(H - d / 2 - 20, y)) };
}
export function districtAt(x, y) {
  if (x < 300) return 'Solmar Beach';
  if (y > 3050) return x > 3400 ? 'Portside' : 'Marina';
  if (x > 4000 && y < 900) return 'The Hills';
  if (x >= 1800 && x <= 3400 && y >= 1200 && y <= 2400) return 'Downtown';
  if (x > 3400) return 'Old Town';
  return 'Solmar Bay';
}
export function hitBuilding(city, x, y, r) {
  for (const b of city.buildings) if (Math.abs(x - b.x) < b.w / 2 + r && Math.abs(y - b.y) < b.d / 2 + r) return true;
  for (const b of city.containers) if (Math.abs(x - b.x) < b.w / 2 + r && Math.abs(y - b.y) < b.d / 2 + r) return true;
  return false;
}
export function pushOutOfBuildings(city, x, y, r) {
  for (const b of city.buildings) {
    const cx = Math.max(b.x - b.w / 2, Math.min(b.x + b.w / 2, x));
    const cy = Math.max(b.y - b.d / 2, Math.min(b.y + b.d / 2, y));
    const dx = x - cx, dy = y - cy, d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    if (d2 > 0.01) { const d = Math.sqrt(d2); x = cx + dx / d * r; y = cy + dy / d * r; }
    else {
      const pl = x - (b.x - b.w / 2 - r), pr = (b.x + b.w / 2 + r) - x;
      const pt = y - (b.y - b.d / 2 - r), pb = (b.y + b.d / 2 + r) - y;
      const m = Math.min(pl, pr, pt, pb);
      if (m === pl) x = b.x - b.w / 2 - r; else if (m === pr) x = b.x + b.w / 2 + r;
      else if (m === pt) y = b.y - b.d / 2 - r; else y = b.y + b.d / 2 + r;
    }
  }
  for (const b of city.containers) {
    const cx = Math.max(b.x - b.w / 2, Math.min(b.x + b.w / 2, x));
    const cy = Math.max(b.y - b.d / 2, Math.min(b.y + b.d / 2, y));
    const dx = x - cx, dy = y - cy, d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    if (d2 > 0.01) { const d = Math.sqrt(d2); x = cx + dx / d * r; y = cy + dy / d * r; }
    else {
      const pl = x - (b.x - b.w / 2 - r), pr = (b.x + b.w / 2 + r) - x;
      const pt = y - (b.y - b.d / 2 - r), pb = (b.y + b.d / 2 + r) - y;
      const m = Math.min(pl, pr, pt, pb);
      if (m === pl) x = b.x - b.w / 2 - r; else if (m === pr) x = b.x + b.w / 2 + r;
      else if (m === pt) y = b.y - b.d / 2 - r; else y = b.y + b.d / 2 + r;
    }
  }
  return { x, y };
}
export function nearestRoadPoint(city, x, y) {
  let bv = CONFIG.roadsV[0], bd = Math.abs(x - bv);
  for (const r of CONFIG.roadsV) if (Math.abs(x - r) < bd) { bd = Math.abs(x - r); bv = r; }
  let bh = CONFIG.roadsH[0], hd = Math.abs(y - bh);
  for (const r of CONFIG.roadsH) if (Math.abs(y - r) < hd) { hd = Math.abs(y - r); bh = r; }
  return bd <= hd ? { x: bv, y } : { x, y: bh };
}
export function randomRoadPoint(rng) {
  if (rng.chance(0.5)) return { x: rng.pick(CONFIG.roadsV), y: rng.range(0, H) };
  return { x: rng.range(0, W), y: rng.pick(CONFIG.roadsH) };
}
export function generateCity(seed) {
  const rng = createRng(seed);
  const buildings = [], parks = [], lots = [], trees = [], lamps = [], containers = [];
  const umbrellas = [], towels = [], benches = [], streetSeats = [], busStops = [];
  const billboards = [], lotCars = [];
  const landmarks = {};
  const lm = [['hotel', 240, 170, 12], ['casino', 200, 150, 4], ['chopshop', 160, 120, 2], ['hospital', 180, 140, 4], ['policehq', 170, 130, 3], ['hideout', 120, 100, 2], ['lighthouse', 40, 40, 9], ['docks', 160, 110, 2]];
  for (const e of lm) {
    const p = nudge(LANDMARKS[e[0]].x, LANDMARKS[e[0]].y, e[1], e[2]);
    landmarks[e[0]] = { x: p.x, y: p.y };
    buildings.push({ x: p.x, y: p.y, w: e[1], d: e[2], floors: e[3], color: e[0] === 'hotel' ? 0 : rng.int(0, 10), variant: rng.int(0, 2), landmark: e[0] });
  }
  landmarks.pier = { x: LANDMARKS.pier.x, y: LANDMARKS.pier.y };
  function freeSpot(x, y, pad) {
    for (const b of buildings) if (Math.abs(x - b.x) < (b.w + pad) / 2 && Math.abs(y - b.y) < (b.d + pad) / 2) return false;
    return true;
  }
  const cols = [300, 420, 980, 1540, 2100, 2660, 3220, 3780, 4340, 4800];
  const rows = [0, 420, 980, 1540, 2100, 2660, 3220, 3600];
  for (let ci = 1; ci < cols.length - 1; ci++) {
    for (let ri = 0; ri < rows.length - 1; ri++) {
      const x0 = cols[ci] + BAND, x1 = cols[ci + 1] - BAND, y0 = rows[ri] + BAND, y1 = rows[ri + 1] - BAND;
      const bw = x1 - x0, bh = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      if (bw < 60 || bh < 60) continue;
      const roll = rng.next();
      if (roll < 0.125) {
        parks.push({ x: cx, y: cy, w: bw, d: bh });
        const nt = rng.int(4, 7);
        for (let i = 0; i < nt; i++) trees.push({ x: cx + rng.range(-bw / 2 + 30, bw / 2 - 30), y: cy + rng.range(-bh / 2 + 30, bh / 2 - 30), s: rng.range(0.9, 1.3) });
        for (let i = 0; i < 2; i++) benches.push({ x: cx + rng.range(-bw / 4, bw / 4), y: cy + rng.range(-bh / 4, bh / 4), ang: rng.range(0, TAU) });
      } else if (roll < 0.202) {
        lots.push({ x: cx, y: cy, w: bw, d: bh });
        const nc = rng.int(2, 4);
        for (let i = 0; i < nc; i++) lotCars.push({ x: cx - bw / 2 + 50 + (nc > 1 ? i * (bw - 100) / (nc - 1) : 0) + rng.range(-12, 12), y: cy + (i % 2 ? 34 : -34), ang: rng.chance(0.5) ? 0 : Math.PI, color: rng.pick(['#c94f4f', '#4f7dc9', '#e8e8e8', '#3a3a3a', '#7a9a5a', '#f2c200']) });
      } else {
        const nx = bw > 480 ? 3 : 2, ny = bh > 480 ? 3 : 2;
        const cw = bw / nx, ch = bh / ny;
        for (let ix = 0; ix < nx; ix++) {
          for (let iy = 0; iy < ny; iy++) {
            if (!rng.chance(0.85)) continue;
            const bx = x0 + cw * (ix + 0.5) + rng.range(-cw * 0.08, cw * 0.08);
            const by = y0 + ch * (iy + 0.5) + rng.range(-ch * 0.08, ch * 0.08);
            const w = cw * 0.72, d = ch * 0.72;
            if (!freeSpot(bx, by, Math.max(w, d) + 16)) continue;
            const downtown = bx >= 1800 && bx <= 3400 && by >= 1200 && by <= 2400;
            buildings.push({ x: bx, y: by, w, d, floors: downtown ? rng.int(5, 11) : rng.int(1, 4), color: rng.int(0, 10), variant: rng.int(0, 2), landmark: null });
          }
        }
        const nt = rng.int(2, 3);
        for (let i = 0; i < nt; i++) {
          const tx = x0 + rng.range(26, bw - 26), ty = y0 + rng.range(26, bh - 26);
          if (freeSpot(tx, ty, 40)) trees.push({ x: tx, y: ty, s: rng.range(0.8, 1.3) });
        }
      }
    }
  }
  for (let y = 60; y < H; y += 75) {
    if (rng.chance(0.75)) trees.push({ x: 345 + rng.range(-8, 8), y: y + rng.range(-15, 15), s: rng.range(0.9, 1.3) });
    if (rng.chance(0.45)) trees.push({ x: 505 + rng.range(-8, 8), y: y + rng.range(-15, 15), s: rng.range(0.9, 1.3) });
  }
  for (const r of CONFIG.roadsV) for (let y = 200; y < H; y += 380) if (rng.chance(0.6)) { const x = r + (rng.chance(0.5) ? BAND + 24 : -BAND - 24); if (x > 320 && freeSpot(x, y, 40)) trees.push({ x, y, s: rng.range(0.8, 1.2) }); }
  for (const r of CONFIG.roadsH) for (let x = 400; x < W; x += 380) if (rng.chance(0.6)) { const y = r + (rng.chance(0.5) ? BAND + 24 : -BAND - 24); if (freeSpot(x, y, 40)) trees.push({ x, y, s: rng.range(0.8, 1.2) }); }
  for (const r of CONFIG.roadsV) { let i = 0; for (let y = 130; y < H; y += 260) { lamps.push({ x: r + (i % 2 ? 84 : -84), y }); i++; } }
  for (const r of CONFIG.roadsH) { let i = 0; for (let x = 130; x < W; x += 260) { lamps.push({ x, y: r + (i % 2 ? 84 : -84) }); i++; } }
  const cc = ['#b03a2e', '#2e6db0', '#c9a227', '#3a7d5a'];
  let ci2 = 0;
  for (const gx of [3380, 3490, 3600]) for (const gy of [3360, 3440, 3520]) containers.push({ x: gx, y: gy, w: 80, d: 36, color: cc[ci2 % 4], stack: ci2 % 3 === 0, h: 34 }), ci2++;
  const uc = ['#ff5a3c', '#ffd23c', '#3cb8ff', '#ff8ad8', '#7dff6a'];
  const nu = rng.int(6, 10);
  for (let i = 0; i < nu; i++) umbrellas.push({ x: rng.range(140, 280), y: rng.range(120, H - 120), color: rng.pick(uc) });
  const ntw = rng.int(14, 20);
  for (let i = 0; i < ntw; i++) towels.push({ x: rng.range(130, 290), y: rng.range(100, H - 100), ang: rng.range(0, TAU), color: rng.pick(uc) });
  for (let i = 0; i < 10; i++) streetSeats.push({ x: 332, y: 200 + i * 340 + rng.range(-40, 40), ang: Math.PI });
  for (const s of [[980, 980], [1540, 1540], [2100, 980], [2660, 2100], [3220, 1540], [980, 2660], [2100, 3220], [3780, 980]]) busStops.push({ x: s[0] + 84, y: s[1] + 84, ang: Math.PI * 0.75 });
  for (const t of ['SOLMAR BAY', 'CASINO', 'CHOP SHOP', 'PORTSIDE']) {
    let placed = null;
    for (let i = 0; i < 40 && !placed; i++) {
      const x = rng.range(400, 4400), y = rng.range(200, 3400);
      if (!freeSpot(x, y, 130)) continue;
      let onRoad = false;
      for (const r of CONFIG.roadsV) if (Math.abs(x - r) < BAND + 30) onRoad = true;
      for (const r of CONFIG.roadsH) if (Math.abs(y - r) < BAND + 30) onRoad = true;
      if (!onRoad) placed = { x, y, ang: rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]), text: t };
    }
    if (!placed && parks.length) placed = { x: parks[0].x, y: parks[0].y, ang: 0, text: t };
    if (!placed) placed = { x: 200, y: 200, ang: 0, text: t };
    billboards.push(placed);
  }
  return { seed, buildings, parks, lots, trees, lamps, containers, umbrellas, towels, benches, streetSeats, busStops, billboards, lotCars, landmarks };
}
