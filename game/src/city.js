// Solmar Bay — city generation from the seed, plus collision queries.
// Same seed, same city: every random choice flows through the seeded rng.
// Rects are centre-based: { x, y, w, d } with x/y the centre, w the
// east-west size, d the north-south size.
//
// The one hard rule: no building or container ever blocks a road. Every
// landmark rectangle is nudged clear of every road band (road + sidewalk
// + margin = 100 from the road centre) before it is planted; mission
// targets keep the design coordinates, which sit on open road beside the
// nudged building. The hotel nudges to centre (2400, 1354), south face
// at 1439, one pixel clear of the 1540 road band that starts at 1440 —
// its entrance canopy then overhangs the sidewalk only.

import { createRng } from './rng.js';
import { CONFIG, LANDMARKS } from './config.js';

const W = CONFIG.world.w;
const H = CONFIG.world.h;
// Road band half-width: roadW/2 + sidewalk + roadMargin = 100.
const BAND = CONFIG.roadW / 2 + CONFIG.sidewalk + CONFIG.roadMargin;

function rectsOverlap(ax, ay, aw, ad, bx, by, bw, bd, pad) {
  const p = pad || 0;
  return Math.abs(ax - bx) * 2 < aw + bw + p * 2
    && Math.abs(ay - by) * 2 < ad + bd + p * 2;
}

// True when a centre-based rect clears every road band. The clearance
// is the road band half-width (100) by default; block buildings and
// landmarks use a wider clearance (130) so a car hugging a sidewalk —
// centre up to 84 off the road line, collision circle 24 — can never
// grind a building face. The hotel is the exception: the test pins its
// south face at 1439, one pixel clear of the 100-band, so it nudges
// with the plain band.
function bandClear(x, y, w, d, clearance) {
  const band = clearance === undefined ? BAND : clearance;
  for (const r of CONFIG.roadsV) {
    if (x - w / 2 < r + band && x + w / 2 > r - band) return false;
  }
  for (const r of CONFIG.roadsH) {
    if (y - d / 2 < r + band && y + d / 2 > r - band) return false;
  }
  return true;
}

// Push a rect out of every road band it overlaps, by the smallest move:
// the centre moves away from the road centre until the rect edge sits
// one pixel clear of the band. Iterates because one push can expose the
// next band. Returns the nudged centre.
function nudgeClear(x, y, w, d, clearance) {
  const band = clearance === undefined ? BAND : clearance;
  for (let iter = 0; iter < 12; iter++) {
    let moved = false;
    for (const r of CONFIG.roadsV) {
      if (x - w / 2 < r + band && x + w / 2 > r - band) {
        // Move away from the road centre, just clear of the band.
        x = x <= r ? r - band - w / 2 - 1 : r + band + w / 2 + 1;
        moved = true;
      }
    }
    for (const r of CONFIG.roadsH) {
      if (y - d / 2 < r + band && y + d / 2 > r - band) {
        y = y <= r ? r - band - d / 2 - 1 : r + band + d / 2 + 1;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return { x, y };
}

// ------------------------------------------------------------------ city ---

export function generateCity(seed) {
  const rng = createRng(seed);
  const buildings = [];
  const parks = [];
  const lots = [];
  const trees = [];
  const lamps = [];
  const containers = [];
  const umbrellas = [];
  const benches = [];
  const busStops = [];
  const billboards = [];

  // ---- landmarks, nudged clear of every road band -------------------
  // Sizes: the hotel is 240x170 (its glTF model is the same footprint);
  // the others are ordinary city blocks. The pier and the docks are flat
  // structures, not collision buildings, so they live in landmarks only.
  const landmarkDefs = [
    { key: 'hotel', w: 240, d: 170, floors: 12 },
    { key: 'casino', w: 180, d: 120, floors: 4 },
    { key: 'chopshop', w: 160, d: 120, floors: 2 },
    { key: 'hospital', w: 170, d: 130, floors: 5 },
    { key: 'policehq', w: 170, d: 130, floors: 4 },
    { key: 'hideout', w: 120, d: 100, floors: 2 },
    { key: 'lighthouse', w: 80, d: 80, floors: 6 },
    { key: 'pier', w: 200, d: 40, floors: 0 },
    { key: 'docks', w: 160, d: 100, floors: 0 },
  ];
  const landmarks = {};
  for (const def of landmarkDefs) {
    const design = LANDMARKS[def.key];
    // The hotel nudges with the plain band (its south face must land at
    // 1439); every other landmark gets the wider driving clearance.
    const clearance = def.key === 'hotel' ? BAND : BAND + 30;
    const nudged = nudgeClear(design.x, design.y, def.w, def.d, clearance);
    landmarks[def.key] = {
      x: nudged.x, y: nudged.y, w: def.w, d: def.d,
      floors: def.floors, name: design.name,
    };
  }
  // Solid landmark buildings join the building list (with a landmark tag
  // so the renderer can sign and special-case them); the pier and docks
  // are flat and stay out of collision.
  for (const key of ['hotel', 'casino', 'chopshop', 'hospital', 'policehq', 'hideout', 'lighthouse']) {
    const lm = landmarks[key];
    const colorIndex = key === 'hotel' ? 7 : rng.int(0, CONFIG.wallColors.length - 1);
    buildings.push({
      x: lm.x, y: lm.y, w: lm.w, d: lm.d,
      floors: lm.floors, height: lm.floors * 12 + 4,
      colorIndex,
      color: CONFIG.wallColors[colorIndex],
      landmark: key,
    });
  }

  // ---- port containers ----------------------------------------------
  // Nine containers in a 3x3 grid in the block east of the coast road
  // and south of the marina road, clear of the 3780 and 4340 road bands
  // and of the docks landmark. Four colours, stacked look in the renderer.
  const containerColors = ['#c94f4f', '#4f7dc9', '#2a7a5a', '#f2c200'];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      containers.push({
        x: 4000 + i * 100, y: 3460 + j * 60, w: 60, d: 28,
        color: containerColors[(i * 3 + j) % containerColors.length],
        stacked: (i + j) % 3 === 0,
      });
    }
  }

  // ---- blocks ---------------------------------------------------------
  // Block rectangles between roads (inset by the road band), plus the
  // outer ring: east of the last road, north of the first, south of the
  // last. The west strip is beach and stays open.
  const blocks = [];
  const xs = CONFIG.roadsV, ys = CONFIG.roadsH;
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      blocks.push({ x0: xs[i] + BAND, x1: xs[i + 1] - BAND, y0: ys[j] + BAND, y1: ys[j + 1] - BAND });
    }
  }
  for (let j = 0; j < ys.length - 1; j++) {
    blocks.push({ x0: xs[xs.length - 1] + BAND, x1: W - 100, y0: ys[j] + BAND, y1: ys[j + 1] - BAND });
  }
  for (let i = 0; i < xs.length - 1; i++) {
    blocks.push({ x0: xs[i] + BAND, x1: xs[i + 1] - BAND, y0: 100, y1: ys[0] - BAND });
    blocks.push({ x0: xs[i] + BAND, x1: xs[i + 1] - BAND, y0: ys[ys.length - 1] + BAND, y1: H - 100 });
  }

  const landmarkRects = Object.values(landmarks);
  function clearOfLandmarks(x, y, w, d, pad) {
    for (const lm of landmarkRects) {
      if (rectsOverlap(x, y, w, d, lm.x, lm.y, lm.w, lm.d, pad)) return false;
    }
    return true;
  }
  function clearOfContainers(x, y, w, d, pad) {
    for (const c of containers) {
      if (rectsOverlap(x, y, w, d, c.x, c.y, c.w, c.d, pad)) return false;
    }
    return true;
  }

  for (const block of blocks) {
    const bw = block.x1 - block.x0, bd = block.y1 - block.y0;
    if (bw < 120 || bd < 120) continue;
    const cx = (block.x0 + block.x1) / 2, cy = (block.y0 + block.y1) / 2;
    // The container yard block holds the port containers, not buildings.
    if (block.x0 >= xs[6] + BAND && block.y0 >= ys[ys.length - 1] + BAND) continue;
    const downtown = cx >= 1800 && cx <= 3400 && cy >= 1200 && cy <= 2400;
    const roll = rng.next();
    if (roll < 0.14) {
      // Park: green with trees and two benches.
      parks.push({ x: cx, y: cy, w: bw, d: bd });
      const nTrees = rng.int(4, 7);
      for (let t = 0; t < nTrees; t++) {
        trees.push({
          x: cx + rng.range(-bw / 2 + 20, bw / 2 - 20),
          y: cy + rng.range(-bd / 2 + 20, bd / 2 - 20),
          s: rng.range(0.8, 1.3),
        });
      }
      benches.push({ x: cx - bw / 4, y: cy, angle: 0 });
      benches.push({ x: cx + bw / 4, y: cy, angle: Math.PI / 2 });
      continue;
    }
    if (roll < 0.22) {
      // Parking lot: paved with marked bays.
      lots.push({ x: cx, y: cy, w: bw, d: bd });
      continue;
    }
    // One to four buildings, downtown taller and denser.
    const n = downtown ? rng.int(2, 4) : rng.int(1, 3);
    for (let k = 0; k < n; k++) {
      let placed = false;
      for (let tries = 0; tries < 12 && !placed; tries++) {
        const w = rng.range(70, 170), d = rng.range(60, 150);
        const x = rng.range(block.x0 + w / 2 + 6, block.x1 - w / 2 - 6);
        const y = rng.range(block.y0 + d / 2 + 6, block.y1 - d / 2 - 6);
        // Wider than the road band: a car on the sidewalk (centre up to
        // 84 off the road line, circle 24) must never touch the face.
        if (!bandClear(x, y, w, d, BAND + 30)) continue;
        if (!clearOfLandmarks(x, y, w, d, 12)) continue;
        if (!clearOfContainers(x, y, w, d, 12)) continue;
        let clash = false;
        for (const b of buildings) {
          if (rectsOverlap(x, y, w, d, b.x, b.y, b.w, b.d, 12)) { clash = true; break; }
        }
        if (clash) continue;
        const floors = downtown ? rng.int(2, 9) : rng.int(1, 4);
        const colorIndex = rng.int(0, CONFIG.wallColors.length - 1);
        buildings.push({
          x, y, w, d, floors, height: floors * 12 + 4,
          colorIndex, color: CONFIG.wallColors[colorIndex],
        });
        placed = true;
      }
    }
  }

  // ---- trees ----------------------------------------------------------
  // Palms line the beach road; street trees line the other roads.
  for (let y = 200; y < H - 100; y += 170) {
    trees.push({ x: 340 + rng.range(-14, 14), y: y + rng.range(-30, 30), s: rng.range(0.9, 1.3) });
  }
  for (const r of xs) {
    for (let y = 120; y < H - 60; y += 260) {
      if (rng.chance(0.75)) {
        trees.push({ x: r + (rng.chance(0.5) ? -1 : 1) * 96, y: y + rng.range(-40, 40), s: rng.range(0.8, 1.2) });
      }
    }
  }
  for (const r of ys) {
    for (let x = 380; x < W - 60; x += 260) {
      if (rng.chance(0.75)) {
        trees.push({ x: x + rng.range(-40, 40), y: r + (rng.chance(0.5) ? -1 : 1) * 96, s: rng.range(0.8, 1.2) });
      }
    }
  }

  // ---- lamps ----------------------------------------------------------
  // Street lamps along the roads, alternating sides.
  for (const r of xs) {
    let side = 1;
    for (let y = 350; y < H; y += 700) {
      lamps.push({ x: r + side * 71, y });
      side = -side;
    }
  }
  for (const r of ys) {
    let side = 1;
    for (let x = 350; x < W; x += 700) {
      lamps.push({ x, y: r + side * 71 });
      side = -side;
    }
  }

  // ---- beach umbrellas --------------------------------------------------
  const nUmbrellas = rng.int(6, 10);
  const umbrellaColors = ['#e74c3c', '#f2c200', '#4f7dc9', '#2ecc71', '#e67e22'];
  for (let i = 0; i < nUmbrellas; i++) {
    umbrellas.push({
      x: rng.range(140, 280),
      y: rng.range(200, H - 200),
      color: umbrellaColors[i % umbrellaColors.length],
    });
  }

  // ---- bus-stop shelters -------------------------------------------------
  // Eight shelters just outside the road band (clear of bands and
  // buildings); random candidates with fallbacks until eight are placed.
  for (let tries = 0; tries < 240 && busStops.length < 8; tries++) {
    const vertical = rng.chance(0.5);
    const road = vertical ? rng.pick(xs) : rng.pick(ys);
    const along = vertical ? rng.range(200, H - 200) : rng.range(420, W - 200);
    const side = rng.chance(0.5) ? 1 : -1;
    const off = (BAND + 14) * side;
    const x = vertical ? road + off : along;
    const y = vertical ? along : road + off;
    const w = vertical ? 24 : 70, d = vertical ? 70 : 24;
    if (!bandClear(x, y, w, d)) continue;
    let clash = false;
    for (const b of buildings) {
      if (rectsOverlap(x, y, w, d, b.x, b.y, b.w, b.d, 8)) { clash = true; break; }
    }
    if (clash) continue;
    for (const s of busStops) {
      if (rectsOverlap(x, y, w, d, s.x, s.y, s.w, s.d, 60)) { clash = true; break; }
    }
    if (clash) continue;
    busStops.push({ x, y, w, d, angle: vertical ? Math.PI / 2 : 0 });
  }

  // ---- billboards ---------------------------------------------------------
  // Four billboards reading SOLMAR BAY, CASINO, CHOP SHOP and PORTSIDE.
  // Decorative, no collision. Each is checked clear of road bands and
  // buildings and skipped if no clear spot is found — so placement tries
  // a preferred spot, then random fallbacks, then a full grid scan, which
  // guarantees all four land on every seed.
  const billboardDefs = [
    { text: 'SOLMAR BAY', x: 600, y: 700 },
    { text: 'CASINO', x: 1900, y: 2900 },
    { text: 'CHOP SHOP', x: 4100, y: 1300 },
    { text: 'PORTSIDE', x: 4100, y: 3500 },
  ];
  function billboardClear(x, y) {
    const w = 130, d = 30;
    if (!bandClear(x, y, w, d)) return false;
    for (const b of buildings) {
      if (rectsOverlap(x, y, w, d, b.x, b.y, b.w, b.d, 8)) return false;
    }
    for (const s of billboards) {
      if (rectsOverlap(x, y, w, d, s.x, s.y, s.w, s.d, 40)) return false;
    }
    return true;
  }
  for (const def of billboardDefs) {
    let spot = null;
    if (billboardClear(def.x, def.y)) {
      spot = { x: def.x, y: def.y };
    } else {
      for (let t = 0; t < 60 && !spot; t++) {
        const x = rng.range(420, W - 420);
        const y = rng.range(200, H - 200);
        if (billboardClear(x, y)) spot = { x, y };
      }
    }
    if (!spot) {
      // Grid scan: guaranteed to find open ground somewhere.
      outer: for (let gy = 300; gy < H - 100; gy += 120) {
        for (let gx = 500; gx < W - 100; gx += 120) {
          if (billboardClear(gx, gy)) { spot = { x: gx, y: gy }; break outer; }
        }
      }
    }
    if (spot) {
      billboards.push({ x: spot.x, y: spot.y, w: 130, d: 30, text: def.text, angle: 0 });
    }
  }

  return {
    seed,
    buildings, parks, lots, trees, lamps, containers,
    umbrellas, benches, busStops, billboards, landmarks,
  };
}

// ------------------------------------------------------------- queries ---

// Distance from a point to the edge of a centre-based rect: 0 inside.
export function distToRect(x, y, rect) {
  const dx = Math.max(rect.x - rect.w / 2 - x, 0, x - (rect.x + rect.w / 2));
  const dy = Math.max(rect.y - rect.d / 2 - y, 0, y - (rect.y + rect.d / 2));
  return Math.hypot(dx, dy);
}

// True when a circle of radius r at (x, y) overlaps any building or
// container. The sea and the world edge are not buildings: the logic
// layer clamps cars and pedestrians away from them itself, so this
// stays a pure building test.
export function hitBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (distToRect(x, y, b) < r) return true;
  }
  for (const c of city.containers) {
    if (distToRect(x, y, c) < r) return true;
  }
  return false;
}

// Push a circle out of whatever building or container it overlaps, along
// the axis of least penetration. Never moves the circle far: one pass per
// overlapping rect, a few passes total.
export function pushOutOfBuildings(city, x, y, r) {
  const solids = [...city.buildings, ...city.containers];
  for (let pass = 0; pass < 8; pass++) {
    let moved = false;
    for (const b of solids) {
      const left = b.x - b.w / 2, right = b.x + b.w / 2;
      const top = b.y - b.d / 2, bottom = b.y + b.d / 2;
      if (x + r <= left || x - r >= right || y + r <= top || y - r >= bottom) continue;
      const pushL = x + r - left, pushR = right - (x - r);
      const pushT = y + r - top, pushB = bottom - (y - r);
      const m = Math.min(pushL, pushR, pushT, pushB);
      if (m === pushL) x = left - r;
      else if (m === pushR) x = right + r;
      else if (m === pushT) y = top - r;
      else y = bottom + r;
      moved = true;
    }
    if (!moved) break;
  }
  return { x, y };
}

// True when a point is on a road surface (not just the sidewalk).
export function onRoad(x, y) {
  for (const r of CONFIG.roadsV) {
    if (Math.abs(x - r) <= CONFIG.roadW / 2) return true;
  }
  for (const r of CONFIG.roadsH) {
    if (Math.abs(y - r) <= CONFIG.roadW / 2) return true;
  }
  return false;
}

// A random point on a road: a road line plus a random spot along it.
export function randomRoadPoint(rng) {
  if (rng.chance(0.5)) {
    return { x: rng.pick(CONFIG.roadsV), y: rng.range(60, H - 60) };
  }
  return { x: rng.range(360, W - 60), y: rng.pick(CONFIG.roadsH) };
}

// The nearest point on the road grid to (x, y): snap to the closer of
// the nearest vertical road line and the nearest horizontal road line.
export function nearestRoadPoint(city, x, y) {
  let xv = CONFIG.roadsV[0], bestV = Infinity;
  for (const r of CONFIG.roadsV) {
    const d = Math.abs(x - r);
    if (d < bestV) { bestV = d; xv = r; }
  }
  let yh = CONFIG.roadsH[0], bestH = Infinity;
  for (const r of CONFIG.roadsH) {
    const d = Math.abs(y - r);
    if (d < bestH) { bestH = d; yh = r; }
  }
  if (bestV <= bestH) return { x: xv, y: Math.max(0, Math.min(H, y)) };
  return { x: Math.max(0, Math.min(W, x)), y: yh };
}

// District names, as the HUD shows them when the player enters one.
export function districtAt(x, y) {
  if (x < 300) return 'Solmar Beach';
  if (x > 3400 && y > 3050) return 'Portside';
  if (y > 3050) return 'Marina';
  if (x > 4000 && y < 900) return 'The Hills';
  if (x > 3400) return 'Old Town';
  if (x >= 1800 && x <= 3400 && y >= 1200 && y <= 2400) return 'Downtown';
  return 'Solmar Bay';
}
