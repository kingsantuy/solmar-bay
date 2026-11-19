import { CONFIG } from './config.js';
import { hitBuilding, distToRect, nearestRoadPoint, randomRoadPoint } from './city.js';
import { createRng } from './rng.js';
let worldRng = null;
function getRng(game) {
  if (!worldRng) {
    const seed = game && typeof game.seed === 'number' ? game.seed : 1;
    worldRng = createRng((seed * 2654435761) >>> 0);
  }
  return worldRng;
}
function clampValue(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
function wrapAngle(a) {
  let r = a;
  while (r > Math.PI) r -= Math.PI * 2;
  while (r < -Math.PI) r += Math.PI * 2;
  return r;
}
function steerAngle(current, target, rate, dt) {
  const d = wrapAngle(target - current);
  const maxTurn = rate * dt;
  if (d > maxTurn) return current + maxTurn;
  if (d < -maxTurn) return current - maxTurn;
  return target;
}
function stepBlocked(game, x, y, r) {
  if (!game || !game.city) return false;
  return hitBuilding(game.city, x, y, r);
}
function pointClearOfBuildings(game, x, y, pad) {
  if (!game || !game.city) return true;
  for (const b of game.city.buildings) {
    if (distToRect(x, y, b) < pad) return false;
  }
  for (const c of game.city.containers || []) {
    if (distToRect(x, y, c) < pad) return false;
  }
  return true;
}
function pickRoadTarget(game, rng) {
  for (let i = 0; i < 4; i++) {
    const p = randomRoadPoint(rng);
    if (pointClearOfBuildings(game, p.x, p.y, 26)) return p;
  }
  return randomRoadPoint(rng);
}
function pickNearbyTarget(game, rng, x, y) {
  const nx = clampValue(x + rng.range(-320, 320), 130, CONFIG.world.w - 20);
  const ny = clampValue(y + rng.range(-320, 320), 20, CONFIG.world.h - 20);
  const snapped = nearestRoadPoint(nx, ny);
  if (pointClearOfBuildings(game, snapped.x, snapped.y, 20)) return snapped;
  return { x: nx, y: ny };
}
function moveActor(game, actor, nx, ny, r) {
  if (!stepBlocked(game, nx, ny, r)) {
    actor.x = clampValue(nx, 120, CONFIG.world.w - 12);
    actor.y = clampValue(ny, 12, CONFIG.world.h - 12);
    return true;
  }
  if (!stepBlocked(game, nx, actor.y, r)) {
    actor.x = clampValue(nx, 120, CONFIG.world.w - 12);
    return true;
  }
  if (!stepBlocked(game, actor.x, ny, r)) {
    actor.y = clampValue(ny, 12, CONFIG.world.h - 12);
    return true;
  }
  return false;
}
export function updateTraffic(game, dt) {
  if (!game || !Array.isArray(game.cars) || !game.city) return;
  const step = dt > 0 ? dt : 0;
  const rng = getRng(game);
  const cruiseMin = CONFIG.traffic.cruiseMin;
  const cruiseMax = CONFIG.traffic.cruiseMax;
  for (const car of game.cars) {
    if (!car || car.kind !== 'traffic') continue;
    if (typeof car.x !== 'number' || typeof car.y !== 'number') continue;
    if (car.tx == null || car.ty == null) {
      const p = pickRoadTarget(game, rng);
      car.tx = p.x;
      car.ty = p.y;
      car.cruise = rng.range(cruiseMin, cruiseMax);
    }
    const dx = car.tx - car.x;
    const dy = car.ty - car.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 42) {
      const p = pickRoadTarget(game, rng);
      car.tx = p.x;
      car.ty = p.y;
      car.cruise = rng.range(cruiseMin, cruiseMax);
      continue;
    }
    const desired = Math.atan2(dy, dx);
    const startAngle = typeof car.angle === 'number' ? car.angle : desired;
    car.angle = steerAngle(startAngle, desired, 2.4, step);
    const cruise = typeof car.cruise === 'number' ? car.cruise : 165;
    const currentSpeed = typeof car.speed === 'number' ? car.speed : 0;
    car.speed = clampValue(currentSpeed + (cruise - currentSpeed) * Math.min(1, 1.6 * step), 0, cruise);
    const nx = car.x + Math.cos(car.angle) * car.speed * step;
    const ny = car.y + Math.sin(car.angle) * car.speed * step;
    if (stepBlocked(game, nx, ny, 24)) {
      const snap = nearestRoadPoint(car.x, car.y);
      car.x = snap.x;
      car.y = snap.y;
      const p = pickRoadTarget(game, rng);
      car.tx = p.x;
      car.ty = p.y;
      car.cruise = rng.range(cruiseMin, cruiseMax);
      continue;
    }
    car.x = clampValue(nx, 120, CONFIG.world.w - 12);
    car.y = clampValue(ny, 12, CONFIG.world.h - 12);
    for (const other of game.cars) {
      if (!other || other === car || other.kind !== 'traffic') continue;
      const ox = car.x - other.x;
      const oy = car.y - other.y;
      const od = Math.hypot(ox, oy);
      if (od > 0.01 && od < 64) {
        const px = car.x + (ox / od) * (64 - od) * 0.5;
        const py = car.y + (oy / od) * (64 - od) * 0.5;
        if (!stepBlocked(game, px, py, 24)) {
          car.x = px;
          car.y = py;
        }
      }
    }
  }
}
export function updatePedestrians(game, dt) {
  if (!game || !Array.isArray(game.peds) || !game.city) return;
  const step = dt > 0 ? dt : 0;
  const rng = getRng(game);
  const player = game.player || null;
  const px = player && typeof player.x === 'number' ? player.x : -9999;
  const py = player && typeof player.y === 'number' ? player.y : -9999;
  const stars = game.wanted && typeof game.wanted.stars === 'number' ? game.wanted.stars : 0;
  const bullets = Array.isArray(game.bullets) ? game.bullets : [];
  for (const ped of game.peds) {
    if (!ped || typeof ped.x !== 'number' || typeof ped.y !== 'number') continue;
    const speed = typeof ped.speed === 'number' && ped.speed > 0 ? ped.speed : 70;
    const distPlayer = Math.hypot(ped.x - px, ped.y - py);
    if (ped.kind === 'cop') {
      if (!player) continue;
      const want = Math.atan2(py - ped.y, px - ped.x);
      const startAngle = typeof ped.angle === 'number' ? ped.angle : want;
      ped.angle = steerAngle(startAngle, want, 5, step);
      const nx = ped.x + Math.cos(ped.angle) * speed * step;
      const ny = ped.y + Math.sin(ped.angle) * speed * step;
      moveActor(game, ped, nx, ny, 12);
      const hold = typeof ped.hold === 'number' ? ped.hold : 0;
      if (distPlayer < 22) ped.hold = hold + step;
      else ped.hold = Math.max(0, hold - step);
      continue;
    }
    let bulletNear = false;
    for (const b of bullets) {
      if (b && Math.hypot(b.x - ped.x, b.y - ped.y) < 160) {
        bulletNear = true;
        break;
      }
    }
    if (ped.state !== 'flee' && distPlayer < 120 && stars > 0) {
      ped.state = 'flee';
      ped.fleeTimer = 3;
    }
    if (ped.state !== 'flee' && bulletNear) {
      ped.state = 'flee';
      ped.fleeTimer = 3;
    }
    if (ped.state === 'flee') {
      const away = Math.atan2(ped.y - py, ped.x - px);
      const startAngle = typeof ped.angle === 'number' ? ped.angle : away;
      ped.angle = steerAngle(startAngle, away, 6, step);
      const runSpeed = speed * 1.9;
      const nx = ped.x + Math.cos(ped.angle) * runSpeed * step;
      const ny = ped.y + Math.sin(ped.angle) * runSpeed * step;
      if (!moveActor(game, ped, nx, ny, 12)) {
        const t = pickNearbyTarget(game, rng, ped.x, ped.y);
        ped.tx = t.x;
        ped.ty = t.y;
      }
      const timer = typeof ped.fleeTimer === 'number' ? ped.fleeTimer : 0;
      ped.fleeTimer = timer - step;
      if (ped.fleeTimer <= 0 && distPlayer > 200) {
        ped.state = 'walk';
        const t = pickNearbyTarget(game, rng, ped.x, ped.y);
        ped.tx = t.x;
        ped.ty = t.y;
      }
      continue;
    }
    if (ped.state !== 'walk') ped.state = 'walk';
    if (ped.tx == null || ped.ty == null) {
      const t = pickNearbyTarget(game, rng, ped.x, ped.y);
      ped.tx = t.x;
      ped.ty = t.y;
    }
    const dx = ped.tx - ped.x;
    const dy = ped.ty - ped.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 24) {
      const t = pickNearbyTarget(game, rng, ped.x, ped.y);
      ped.tx = t.x;
      ped.ty = t.y;
      continue;
    }
    const want = Math.atan2(dy, dx);
    const startAngle = typeof ped.angle === 'number' ? ped.angle : want;
    ped.angle = steerAngle(startAngle, want, 4, step);
    const nx = ped.x + Math.cos(ped.angle) * speed * step;
    const ny = ped.y + Math.sin(ped.angle) * speed * step;
    if (!moveActor(game, ped, nx, ny, 12)) {
      const t = pickNearbyTarget(game, rng, ped.x, ped.y);
      ped.tx = t.x;
      ped.ty = t.y;
    }
  }
}
export function updateTaxi(game, dt) {
  if (!game || !game.taxi || game.mission) return;
  const taxi = game.taxi;
  const step = dt > 0 ? dt : 0;
  const rng = getRng(game);
  if (!taxi.active) {
    if (typeof taxi.timer !== 'number') taxi.timer = CONFIG.taxi.gapMin;
    taxi.timer -= step;
    if (taxi.timer > 0) return;
    const start = pickRoadTarget(game, rng);
    const end = pickRoadTarget(game, rng);
    taxi.active = true;
    taxi.client = { x: start.x, y: start.y };
    taxi.state = 'pickup';
    taxi.destX = end.x;
    taxi.destY = end.y;
    taxi.fare = rng.int(CONFIG.taxi.fareMin, CONFIG.taxi.fareMax);
    return;
  }
  if (!taxi.client || typeof taxi.destX !== 'number' || typeof taxi.destY !== 'number') {
    taxi.active = false;
    taxi.client = null;
    taxi.state = null;
    taxi.timer = rng.range(CONFIG.taxi.gapMin, CONFIG.taxi.gapMax);
    return;
  }
  const player = game.player;
  if (!player || typeof player.x !== 'number' || typeof player.y !== 'number') return;
  if (taxi.state === 'pickup') {
    if (Math.hypot(player.x - taxi.client.x, player.y - taxi.client.y) < 90) taxi.state = 'toDest';
    return;
  }
  if (taxi.state === 'toDest') {
    if (Math.hypot(player.x - taxi.destX, player.y - taxi.destY) < 110) {
      const fare = typeof taxi.fare === 'number' ? taxi.fare : CONFIG.taxi.fareMin;
      player.money = (typeof player.money === 'number' ? player.money : 0) + fare;
      if (game.stats) game.stats.fares = (typeof game.stats.fares === 'number' ? game.stats.fares : 0) + 1;
      if (game.respect) game.respect.pts = (typeof game.respect.pts === 'number' ? game.respect.pts : 0) + CONFIG.respect.perFare;
      taxi.active = false;
      taxi.client = null;
      taxi.state = null;
      taxi.fare = 0;
      taxi.timer = rng.range(CONFIG.taxi.gapMin, CONFIG.taxi.gapMax);
    }
  }
}
export function collideWorld(game, x, y, r) {
  const radius = typeof r === 'number' && r > 0 ? r : 10;
  if (typeof x !== 'number' || typeof y !== 'number') return true;
  if (x < 0 || x > CONFIG.world.w || y < 0 || y > CONFIG.world.h) return true;
  if (game && game.city && hitBuilding(game.city, x, y, radius)) return true;
  return false;
}
