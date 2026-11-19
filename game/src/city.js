// Solmar Bay itself: a seeded city of roads, blocks, buildings, parks,
// parking lots, trees, lamps and landmarks, plus the collision queries the
// game runs against it. The city is a pure function of the seed.
import { CONFIG, districtAt } from './config.js';
import { range, int, pick, chance } from './rng.js';

export { districtAt };

export function generateCity(rng) {
  const { roadsV, roadsH, roadW, sidewalk, world, roofColors, containerColors } = CONFIG;
  const buildings = [];
  const parks = [];
  const lots = [];
  const trees = [];
  const lamps = [];

  // Blocks between neighbouring roads.
  for (let vi = 0; vi < roadsV.length - 1; vi++) {
    for (let hi = 0; hi < roadsH.length - 1; hi++) {
      const x0 = roadsV[vi] + roadW / 2 + sidewalk + 8;
      const x1 = roadsV[vi + 1] - roadW / 2 - sidewalk - 8;
      const y0 = roadsH[hi] + roadW / 2 + sidewalk + 8;
      const y1 = roadsH[hi + 1] - roadW / 2 - sidewalk - 8;
      const bw = x1 - x0;
      const bh = y1 - y0;
      const downtown = x0 > 1700 && x0 < 3400 && y0 > 1100 && y0 < 2400;
      const roll = rng();
      if (roll < 0.12) {
        parks.push({ x: x0, y: y0, w: bw, h: bh });
        const n = Math.floor(bw * bh / 9000);
        for (let i = 0; i < n; i++) {
          trees.push({ x: range(rng, x0 + 20, x1 - 20), y: range(rng, y0 + 20, y1 - 20), r: range(rng, 9, 15) });
        }
        continue;
      }
      if (roll < 0.12 + 0.077) {
        lots.push({ x: x0, y: y0, w: bw, h: bh });
        continue;
      }
      // One to four buildings per block.
      const n = downtown ? int(rng, 2, 4) : int(rng, 1, 3);
      const cols = n <= 2 ? 2 : 2;
      const rows = Math.ceil(n / cols);
      const cw = bw / cols;
      const ch = bh / rows;
      for (let i = 0; i < n; i++) {
        const c = i % cols;
        const r = Math.floor(i / cols);
        const w = range(rng, cw * 0.45, cw * 0.8);
        const h = range(rng, ch * 0.45, ch * 0.8);
        const x = x0 + c * cw + (cw - w) / 2 + range(rng, -8, 8);
        const y = y0 + r * ch + (ch - h) / 2 + range(rng, -8, 8);
        const floors = downtown ? int(rng, 3, 9) : int(rng, 1, 4);
        buildings.push({ x, y, w, h, floors, color: pick(rng, roofColors), landmark: null });
      }
    }
  }

  // Fixed landmarks sit on their own plots: clear any building overlapping
  // them, then plant the landmark building. The design coordinates for some
  // landmarks fall on a road or an intersection, so each rect is first
  // nudged clear of every road band — a building must never block a road,
  // or cars driving down that road would smash into it.
  const landmarks = {};
  const band = roadW / 2 + sidewalk + 8;
  const nudgeClearOfRoads = (rect) => {
    for (let pass = 0; pass < 4; pass++) {
      let moved = false;
      for (const rx of roadsV) {
        if (rect.x < rx + band && rect.x + rect.w > rx - band) {
          rect.x = rect.x + rect.w / 2 < rx ? rx - band - rect.w : rx + band;
          moved = true;
        }
      }
      for (const ry of roadsH) {
        if (rect.y < ry + band && rect.y + rect.h > ry - band) {
          rect.y = rect.y + rect.h / 2 < ry ? ry - band - rect.h : ry + band;
          moved = true;
        }
      }
      if (!moved) break;
    }
    return rect;
  };
  const landmarkDefs = [
    ['hotel', CONFIG.landmarks.hotel, 190, 150, 12, '#d9a441'],
    ['casino', CONFIG.landmarks.casino, 210, 140, 3, '#7d5a7a'],
    ['chopshop', CONFIG.landmarks.chopshop, 170, 120, 2, '#b0523c'],
    ['hospital', CONFIG.landmarks.hospital, 180, 140, 5, '#e5e0d0'],
    ['policeHq', CONFIG.landmarks.policeHq, 180, 140, 4, '#4f7dc9'],
    ['hideout', CONFIG.landmarks.hideout, 120, 100, 2, '#8a8f4f'],
  ];
  for (const [key, pos, w, h, floors, color] of landmarkDefs) {
    const rect = nudgeClearOfRoads({ x: pos.x - w / 2, y: pos.y - h / 2, w, h });
    for (let i = buildings.length - 1; i >= 0; i--) {
      const b = buildings[i];
      if (rectsOverlap(rect, b)) buildings.splice(i, 1);
    }
    buildings.push({ x: rect.x, y: rect.y, w, h, floors, color, landmark: key });
    landmarks[key] = { x: pos.x, y: pos.y, name: pos.name };
  }
  landmarks.lighthouse = { x: 600, y: 350, name: 'Lighthouse' };
  landmarks.pier = { x: 2350, y: 3350, name: 'Marina Pier' };
  landmarks.docks = { x: 3900, y: 3350, name: 'Portside Docks' };

  // Shipping containers at the port, in the block east of the coast road
  // and south of the marina road — never on a road itself.
  const containers = [];
  for (let col = 0; col < 3; col++) {
    for (let row = 0; row < 6; row++) {
      containers.push({
        x: 3960 + col * 90 + range(rng, -10, 10),
        y: 3330 + row * 40 + range(rng, -4, 4),
        w: 72, h: 26,
        color: pick(rng, containerColors),
      });
    }
  }

  // Trees and lamps along the roads.
  for (const x of roadsV) {
    for (let y = 200; y < world.h - 100; y += 190) {
      if (chance(rng, 0.5)) trees.push({ x: x - roadW / 2 - sidewalk - 14, y: y + range(rng, -30, 30), r: range(rng, 9, 14) });
      if (chance(rng, 0.4)) lamps.push({ x: x + roadW / 2 + sidewalk + 8, y });
    }
  }
  for (const y of roadsH) {
    for (let x = 400; x < world.w - 100; x += 190) {
      if (chance(rng, 0.4)) trees.push({ x: x + range(rng, -30, 30), y: y - roadW / 2 - sidewalk - 14, r: range(rng, 9, 14) });
      if (chance(rng, 0.4)) lamps.push({ x, y: y + roadW / 2 + sidewalk + 8 });
    }
  }

  return { buildings, parks, lots, trees, lamps, containers, landmarks };
}

export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function circleRectHit(cx, cy, r, b) {
  const nx = Math.max(b.x, Math.min(cx, b.x + b.w));
  const ny = Math.max(b.y, Math.min(cy, b.y + b.h));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

// True when a circle of radius r at (x, y) touches a building, the sea or
// the world edge.
export function hitsSolid(city, x, y, r) {
  const { world, seaX } = CONFIG;
  if (x < seaX + r || x > world.w - r || y < r || y > world.h - r) return true;
  for (const b of city.buildings) {
    if (circleRectHit(x, y, r, b)) return true;
  }
  for (const c of city.containers) {
    if (circleRectHit(x, y, r, c)) return true;
  }
  return false;
}

// Push a circle out of whatever solid it overlaps (buildings, containers,
// world edge). Returns true when anything was pushed.
export function pushOutOfSolid(city, p, r) {
  const { world, seaX } = CONFIG;
  let pushed = false;
  if (p.x < seaX + r) { p.x = seaX + r; pushed = true; }
  if (p.x > world.w - r) { p.x = world.w - r; pushed = true; }
  if (p.y < r) { p.y = r; pushed = true; }
  if (p.y > world.h - r) { p.y = world.h - r; pushed = true; }
  const solids = city.buildings.concat(city.containers);
  for (const b of solids) {
    if (!circleRectHit(p.x, p.y, r, b)) continue;
    const nx = Math.max(b.x, Math.min(p.x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(p.y, b.y + b.h));
    let dx = p.x - nx;
    let dy = p.y - ny;
    if (dx === 0 && dy === 0) {
      // Centre inside the rectangle: push out along the shortest side.
      const left = p.x - b.x;
      const right = b.x + b.w - p.x;
      const top = p.y - b.y;
      const bottom = b.y + b.h - p.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) p.x = b.x - r;
      else if (m === right) p.x = b.x + b.w + r;
      else if (m === top) p.y = b.y - r;
      else p.y = b.y + b.h + r;
    } else {
      const len = Math.hypot(dx, dy) || 1;
      const push = r - len;
      p.x += (dx / len) * push;
      p.y += (dy / len) * push;
    }
    pushed = true;
  }
  return pushed;
}

// True when the point is on a road surface (not the sidewalk).
export function isOnRoad(x, y) {
  const { roadsV, roadsH, roadW } = CONFIG;
  for (const rx of roadsV) if (Math.abs(x - rx) < roadW / 2) return true;
  for (const ry of roadsH) if (Math.abs(y - ry) < roadW / 2) return true;
  return false;
}

// A random point on a road, for spawning traffic.
export function randomRoadPoint(rng) {
  const { roadsV, roadsH, roadW, world } = CONFIG;
  if (rng() < 0.5) {
    const rx = pick(rng, roadsV);
    return { x: rx + range(rng, -roadW / 2 + 12, roadW / 2 - 12), y: range(rng, 100, world.h - 100), vertical: true, road: rx };
  }
  const ry = pick(rng, roadsH);
  return { x: range(rng, 400, world.w - 100), y: ry + range(rng, -roadW / 2 + 12, roadW / 2 - 12), vertical: false, road: ry };
}

// The nearest point on a road centre line.
export function nearestRoadPoint(x, y) {
  const { roadsV, roadsH } = CONFIG;
  let best = null;
  let bestD = Infinity;
  for (const rx of roadsV) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y, vertical: true, road: rx }; }
  }
  for (const ry of roadsH) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x, y: ry, vertical: false, road: ry }; }
  }
  return best;
}
