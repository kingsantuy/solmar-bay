// Solmar Bay — city generation from a seed, plus collision queries.
// World 4800 x 3600. Roads: vertical x [420,980,1540,2100,2660,3220,3780,4340],
// horizontal y [420,980,1540,2100,2660,3220], 116 wide with a 26 px sidewalk
// each side (road band = centre ± 84). Sea west of x=110, sand x 110–300.
// RULE: no building or container ever blocks a road — landmark rects are
// nudged clear of every road band before planting (DESIGN.md §2).

import { createRng } from './rng.js';
import { CONFIG, LANDMARKS } from './config.js';

const BAND = CONFIG.roadW / 2 + CONFIG.sidewalk; // 84
const MARGIN = 16; // clearance kept around each road band

function overlap(a1, a2, b1, b2) { return a1 < b2 && a2 > b1; }

// Shift a centre-based rect until it clears every road band (+margin)
// and stays out of the sea. Returns the nudged centre.
export function nudgeRectClear(x, y, w, d) {
  let cx = Math.max(x, 130 + w / 2);
  let cy = y;
  for (let i = 0; i < 24; i++) {
    let moved = false;
    for (const c of CONFIG.roadsV) {
      const b1 = c - BAND - MARGIN, b2 = c + BAND + MARGIN;
      if (overlap(cx - w / 2, cx + w / 2, b1, b2)) {
        const shiftL = (cx + w / 2) - b1, shiftR = b2 - (cx - w / 2);
        cx += shiftL <= shiftR ? -shiftL - 1 : shiftR + 1;
        moved = true;
      }
    }
    for (const c of CONFIG.roadsH) {
      const b1 = c - BAND - MARGIN, b2 = c + BAND + MARGIN;
      if (overlap(cy - d / 2, cy + d / 2, b1, b2)) {
        const shiftU = (cy + d / 2) - b1, shiftD = b2 - (cy - d / 2);
        cy += shiftU <= shiftD ? -shiftU - 1 : shiftD + 1;
        moved = true;
      }
    }
    if (!moved) break;
  }
  cx = Math.min(Math.max(cx, 130 + w / 2), CONFIG.world.w - 10 - w / 2);
  cy = Math.min(Math.max(cy, 10 + d / 2), CONFIG.world.h - 10 - d / 2);
  return { x: cx, y: cy };
}

// Shift a point clear of every road band (+margin).
export function nudgePointClear(x, y, margin) {
  let px = Math.max(x, 120 + margin);
  let py = y;
  for (const c of CONFIG.roadsV) {
    if (Math.abs(px - c) < BAND + margin) px = c + (px >= c ? BAND + margin + 1 : -BAND - margin - 1);
  }
  for (const c of CONFIG.roadsH) {
    if (Math.abs(py - c) < BAND + margin) py = c + (py >= c ? BAND + margin + 1 : -BAND - margin - 1);
  }
  return { x: px, y: py };
}

function rectsOverlap(a, b, pad) {
  return overlap(a.x - a.w / 2 - pad, a.x + a.w / 2 + pad, b.x - b.w / 2, b.x + b.w / 2)
    && overlap(a.y - a.d / 2 - pad, a.y + a.d / 2 + pad, b.y - b.d / 2, b.y + b.d / 2);
}

// Free intervals between road bands along one axis.
function segments(min, max, centers) {
  const out = [];
  let start = min;
  for (const c of centers) {
    out.push([start, c - BAND]);
    start = c + BAND;
  }
  out.push([start, max]);
  return out;
}

export function generateCity(seed) {
  const rng = createRng(seed);
  const W = CONFIG.world.w, H = CONFIG.world.h;
  const buildings = [], parks = [], lots = [], trees = [], lamps = [], containers = [];

  // Landmark buildings first (nudged clear of roads); block buildings
  // later skip anything overlapping these.
  const lmDefs = [
    { key: 'hotel', ...LANDMARKS.hotel, w: 240, d: 170, floors: 12, color: '#c9a86a' },
    { key: 'casino', ...LANDMARKS.casino, w: 220, d: 160, floors: 4, color: '#7d5a7a' },
    { key: 'chopshop', ...LANDMARKS.chopshop, w: 160, d: 120, floors: 2, color: '#8a8a5a' },
    { key: 'hospital', ...LANDMARKS.hospital, w: 200, d: 150, floors: 5, color: '#e8e8e8' },
    { key: 'policehq', ...LANDMARKS.policehq, w: 180, d: 140, floors: 4, color: '#4f6b8a' },
    { key: 'hideout', ...LANDMARKS.hideout, w: 120, d: 100, floors: 2, color: '#a34d3d' },
  ];
  for (const L of lmDefs) {
    const p = nudgeRectClear(L.x, L.y, L.w, L.d);
    buildings.push({ x: p.x, y: p.y, w: L.w, d: L.d, h: L.floors * 11 + 14, floors: L.floors, color: L.color, landmark: L.key });
  }
  // Striped lighthouse tower on the north coast (nudged off the road).
  const lh = nudgePointClear(LANDMARKS.lighthouse.x, LANDMARKS.lighthouse.y, 46);
  buildings.push({ x: lh.x, y: lh.y, w: 56, d: 56, h: 64, floors: 1, color: '#d64545', landmark: 'lighthouse' });

  // Blocks between roads: ~1 in 8 a park, ~1 in 13 a parking lot,
  // otherwise 1–4 buildings. Downtown is taller and denser.
  const xSegs = segments(0, W, CONFIG.roadsV);
  const ySegs = segments(0, H, CONFIG.roadsH);
  for (const xs of xSegs) {
    for (const ys of ySegs) {
      const bx1 = Math.max(xs[0], CONFIG.beachX1), bx2 = xs[1];
      const by1 = ys[0], by2 = ys[1];
      if (bx2 - bx1 < 100 || by2 - by1 < 100) continue;
      const cx = (bx1 + bx2) / 2, cy = (by1 + by2) / 2;
      const roll = rng.next();
      if (roll < 0.125) {
        parks.push({ x: cx, y: cy, w: bx2 - bx1, d: by2 - by1 });
        const n = 5 + rng.int(0, 5);
        for (let i = 0; i < n; i++) {
          trees.push({ x: rng.range(bx1 + 20, bx2 - 20), y: rng.range(by1 + 20, by2 - 20), s: rng.range(0.8, 1.3) });
        }
        continue;
      }
      if (roll < 0.125 + 0.077) {
        lots.push({ x: cx, y: cy, w: bx2 - bx1, d: by2 - by1 });
        continue;
      }
      const downtown = cx > 1800 && cx < 3400 && cy > 1200 && cy < 2400;
      const n = downtown ? 2 + rng.int(0, 2) : 1 + rng.int(0, 3);
      for (let i = 0; i < n; i++) {
        for (let t = 0; t < 12; t++) {
          const w = 60 + rng.next() * 80, d = 60 + rng.next() * 60;
          const x = bx1 + 14 + w / 2 + rng.next() * Math.max(1, (bx2 - bx1) - 28 - w);
          const y = by1 + 14 + d / 2 + rng.next() * Math.max(1, (by2 - by1) - 28 - d);
          if (x - w / 2 < bx1 + 8 || x + w / 2 > bx2 - 8 || y - d / 2 < by1 + 8 || y + d / 2 > by2 - 8) continue;
          const rect = { x, y, w, d };
          if (buildings.some((b) => rectsOverlap(rect, b, 6))) continue;
          const floors = downtown ? 3 + rng.int(0, 6) : 1 + rng.int(0, 3);
          buildings.push({ x, y, w, d, h: floors * 11 + 14, floors, color: rng.pick(CONFIG.palette.roofs), landmark: null });
          break;
        }
      }
    }
  }

  // Trees and lamps lining the roads (on the grass just past the sidewalk).
  for (const c of CONFIG.roadsV) {
    for (let y = 120; y < H; y += 180) {
      if (rng.chance(0.55)) trees.push({ x: c - BAND - 14 - rng.range(0, 24), y: y + rng.range(-40, 40), s: rng.range(0.8, 1.3) });
      if (rng.chance(0.55)) trees.push({ x: c + BAND + 14 + rng.range(0, 24), y: y + rng.range(-40, 40), s: rng.range(0.8, 1.3) });
    }
  }
  for (const c of CONFIG.roadsH) {
    for (let x = 420; x < W; x += 180) {
      if (rng.chance(0.5)) trees.push({ x: x + rng.range(-40, 40), y: c - BAND - 14 - rng.range(0, 24), s: rng.range(0.8, 1.3) });
      if (rng.chance(0.5)) trees.push({ x: x + rng.range(-40, 40), y: c + BAND + 14 + rng.range(0, 24), s: rng.range(0.8, 1.3) });
    }
  }
  for (const vx of CONFIG.roadsV) {
    for (const hy of CONFIG.roadsH) {
      if (rng.chance(0.7)) lamps.push({ x: vx - BAND - 6, y: hy - BAND - 6 });
      if (rng.chance(0.7)) lamps.push({ x: vx + BAND + 6, y: hy + BAND + 6 });
    }
  }

  // Port containers: the block east of the coast road, south of the
  // marina road — never on a road. Centres sit a container half-width
  // clear of the road band (3780 band ends at 3864, container half is 36).
  const contX0 = 3780 + BAND + 66, contY0 = 3220 + BAND + 30;
  for (let r = 0; r < 3; r++) {
    for (let col = 0; col < 4; col++) {
      if (rng.chance(0.25)) continue;
      containers.push({
        x: contX0 + col * 92, y: contY0 + r * 62, w: 72, d: 34,
        color: rng.pick(CONFIG.palette.containers),
      });
    }
  }

  return {
    roadsV: [...CONFIG.roadsV],
    roadsH: [...CONFIG.roadsH],
    roadW: CONFIG.roadW,
    sidewalk: CONFIG.sidewalk,
    buildings, parks, lots, trees, lamps, containers,
    pier: { x: LANDMARKS.pier.x, y: LANDMARKS.pier.y, w: 150, d: 260 },
    lighthouse: { x: lh.x, y: lh.y },
    seaX: CONFIG.seaX,
    beachX1: CONFIG.beachX1,
    landmarks: {
      hotel: { ...LANDMARKS.hotel },
      casino: { ...LANDMARKS.casino },
      chopshop: { ...LANDMARKS.chopshop },
      hospital: { ...LANDMARKS.hospital },
      policehq: { ...LANDMARKS.policehq },
      hideout: { ...LANDMARKS.hideout },
      lighthouse: { ...LANDMARKS.lighthouse },
      pier: { ...LANDMARKS.pier },
      docks: { ...LANDMARKS.docks },
    },
  };
}

// --- Collision / road queries ---------------------------------------------

function circleHitsRect(x, y, r, b) {
  const nx = Math.max(b.x - b.w / 2, Math.min(x, b.x + b.w / 2));
  const ny = Math.max(b.y - b.d / 2, Math.min(y, b.y + b.d / 2));
  const dx = x - nx, dy = y - ny;
  return dx * dx + dy * dy < r * r;
}

export function hitBuilding(city, x, y, r) {
  for (const b of city.buildings) if (circleHitsRect(x, y, r, b)) return true;
  for (const c of city.containers) if (circleHitsRect(x, y, r, c)) return true;
  return false;
}

// Push a circle out of whatever building/container it overlaps.
// Returns { x, y, hit }.
export function pushOutOfBuildings(city, x, y, r) {
  let hit = false;
  for (let pass = 0; pass < 2; pass++) {
    for (const b of [...city.buildings, ...city.containers]) {
      const x1 = b.x - b.w / 2 - r, x2 = b.x + b.w / 2 + r;
      const y1 = b.y - b.d / 2 - r, y2 = b.y + b.d / 2 + r;
      if (x <= x1 || x >= x2 || y <= y1 || y >= y2) continue;
      hit = true;
      const pushL = x - x1, pushR = x2 - x, pushU = y - y1, pushD = y2 - y;
      const m = Math.min(pushL, pushR, pushU, pushD);
      if (m === pushL) x = x1;
      else if (m === pushR) x = x2;
      else if (m === pushU) y = y1;
      else y = y2;
    }
  }
  return { x, y, hit };
}

// Distance from a point to a rect (0 when inside) — used for mission
// targets that sit inside a landmark building: the step counts from the
// building's edge, where the player can actually stand.
export function distToRect(x, y, b) {
  const nx = Math.max(b.x - b.w / 2, Math.min(x, b.x + b.w / 2));
  const ny = Math.max(b.y - b.d / 2, Math.min(y, b.y + b.d / 2));
  return Math.hypot(x - nx, y - ny);
}

export function onRoad(city, x, y) {
  const half = city.roadW / 2;
  for (const c of city.roadsV) if (Math.abs(x - c) <= half) return true;
  for (const c of city.roadsH) if (Math.abs(y - c) <= half) return true;
  return false;
}

export function nearestRoadPoint(city, x, y) {
  let best = null, bestD = Infinity;
  const W = CONFIG.world.w, H = CONFIG.world.h;
  for (const c of city.roadsV) {
    const py = Math.max(0, Math.min(y, H));
    const d = Math.hypot(x - c, y - py);
    if (d < bestD) { bestD = d; best = { x: c, y: py }; }
  }
  for (const c of city.roadsH) {
    const px = Math.max(0, Math.min(x, W));
    const d = Math.hypot(x - px, y - c);
    if (d < bestD) { bestD = d; best = { x: px, y: c }; }
  }
  return best;
}

export function randomRoadPoint(rng) {
  if (rng.chance(0.5)) {
    return { x: rng.pick(CONFIG.roadsV), y: rng.range(40, CONFIG.world.h - 40) };
  }
  return { x: rng.range(40, CONFIG.world.w - 40), y: rng.pick(CONFIG.roadsH) };
}

export function districtAt(x, y) {
  if (x < 300) return 'Solmar Beach';
  if (y > 3050) return x > 3400 ? 'Portside' : 'Marina';
  if (x > 4000 && y < 900) return 'The Hills';
  if (x > 3400) return 'Old Town';
  if (x >= 1800 && x <= 3400 && y >= 1200 && y <= 2400) return 'Downtown';
  return 'Solmar Bay';
}
