// Cars: creation, traffic AI, the player's arcade driving, police chases
// and car-to-car collisions. One car is one object; the player's car is
// the one state.player.inCar points at.
import { CONFIG } from './config.js';
import { range, int, pick, chance } from './rng.js';
import { isOnRoad, randomRoadPoint, nearestRoadPoint, pushOutOfSolid } from './city.js';

let nextCarId = 1;

export function makeCar(model, x, y, angle, kind, color) {
  const def = CONFIG.models[model];
  const id = nextCarId++;
  // Deterministic default colour from the id, so a seed paints the same frame.
  const fallback = def.colors[id % def.colors.length];
  return {
    id,
    model,
    kind, // 'traffic' | 'parked' | 'police' | 'player'
    x, y,
    angle,
    vx: 0, vy: 0,
    hp: 100,
    color: color || fallback,
    road: 0,
    vertical: true,
    dir: 1,
    targetSpeed: 0,
    turnCd: 0,
    siren: kind === 'police',
    owned: false,
    smokeT: 0,
    brake: false,
  };
}

// Lane offset for right-hand traffic: on a vertical road the southbound
// lane sits 28 px left of the centre, northbound 28 px right; on a
// horizontal road eastbound is 28 px below centre, westbound 28 px above.
function laneOffset(vertical, dir) {
  if (vertical) return dir > 0 ? -28 : 28;
  return dir > 0 ? 28 : -28;
}

export function spawnTraffic(state) {
  const rng = state.rng;
  const models = ['sedan', 'taxi', 'van', 'classic', 'sedan', 'taxi', 'truck'];
  for (let i = 0; i < CONFIG.traffic.count; i++) {
    const p = randomRoadPoint(rng);
    const model = pick(rng, models);
    const car = makeCar(model, p.x, p.y, 0, 'traffic');
    car.vertical = p.vertical;
    car.road = p.road;
    car.dir = chance(rng, 0.5) ? 1 : -1;
    car.targetSpeed = range(rng, CONFIG.traffic.cruiseMin, CONFIG.traffic.cruiseMax);
    if (car.vertical) {
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      car.x = car.road + laneOffset(true, car.dir);
    } else {
      car.angle = car.dir > 0 ? 0 : Math.PI;
      car.y = car.road + laneOffset(false, car.dir);
    }
    state.cars.push(car);
  }
  // Parked cars along road edges, for stealing. Keep them clear of the
  // starter sedan, the Hot Wheels car and each other so no two cars spawn
  // overlapped.
  const keepClear = [
    { x: CONFIG.start.sedan.x, y: CONFIG.start.sedan.y },
    { x: CONFIG.hotWheelsCar.x, y: CONFIG.hotWheelsCar.y },
  ];
  for (let i = 0; i < CONFIG.parked.count; i++) {
    let p;
    let ok = false;
    for (let tries = 0; tries < 10 && !ok; tries++) {
      p = randomRoadPoint(rng);
      ok = keepClear.every((q) => Math.hypot(q.x - p.x, q.y - p.y) > 90);
    }
    keepClear.push({ x: p.x, y: p.y });
    const model = pick(rng, ['sedan', 'classic', 'van', 'sedan', 'taxi']);
    const car = makeCar(model, p.x, p.y, 0, 'parked');
    if (p.vertical) {
      car.angle = chance(rng, 0.5) ? Math.PI / 2 : -Math.PI / 2;
      car.x = p.road + (chance(rng, 0.5) ? -72 : 72);
      car.y = p.y;
    } else {
      car.angle = chance(rng, 0.5) ? 0 : Math.PI;
      car.y = p.road + (chance(rng, 0.5) ? -72 : 72);
      car.x = p.x;
    }
    state.cars.push(car);
  }
  // The starter sedan near the marina, and the red sportscar for Hot Wheels.
  // The starter sedan is the player's own: taking it costs no star.
  const starter = makeCar('sedan', CONFIG.start.sedan.x, CONFIG.start.sedan.y, 0, 'parked', '#4f7dc9');
  starter.owned = true;
  state.cars.push(starter);
  const hot = makeCar('sport', CONFIG.hotWheelsCar.x, CONFIG.hotWheelsCar.y, Math.PI / 2, 'parked', '#e5322d');
  hot.missionCar = true;
  state.cars.push(hot);
}

function carAhead(state, car, dist) {
  let best = null;
  let bestD = dist;
  for (const o of state.cars) {
    if (o === car || o.kind === 'parked') continue;
    if (o.road !== car.road || o.vertical !== car.vertical || o.dir !== car.dir) continue;
    const along = car.vertical ? (o.y - car.y) * car.dir : (o.x - car.x) * car.dir;
    if (along > 0 && along < bestD) {
      bestD = along;
      best = o;
    }
  }
  return best;
}

export function updateTraffic(state, dt) {
  const { world, roadsV, roadsH, roadW } = CONFIG;
  for (const car of state.cars) {
    if (car.kind !== 'traffic') continue;
    car.turnCd -= dt;
    // Slow for the car ahead in the same lane.
    const ahead = carAhead(state, car, 150);
    let speed = car.targetSpeed;
    if (ahead) {
      const gap = car.vertical ? Math.abs(ahead.y - car.y) : Math.abs(ahead.x - car.x);
      speed = gap < 46 ? 0 : Math.min(speed, (ahead.speed || ahead.targetSpeed) * 0.85);
    }
    car.speed = speed;
    const step = speed * dt;
    if (car.vertical) {
      car.y += step * car.dir;
      car.x += ((car.road + laneOffset(true, car.dir)) - car.x) * Math.min(1, dt * 4);
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      // Intersection: maybe turn onto the crossing road.
      for (const ry of roadsH) {
        if (Math.abs(car.y - ry) < 12 && car.turnCd <= 0 && chance(state.rng, 0.33)) {
          car.vertical = false;
          car.road = ry;
          car.dir = chance(state.rng, 0.5) ? 1 : -1;
          car.y = ry + laneOffset(false, car.dir);
          car.turnCd = 2;
          break;
        }
      }
      if (car.y < 80) { car.y = world.h - 100; car.road = car.road; }
      if (car.y > world.h - 80) car.y = 100;
    } else {
      car.x += step * car.dir;
      car.y += ((car.road + laneOffset(false, car.dir)) - car.y) * Math.min(1, dt * 4);
      car.angle = car.dir > 0 ? 0 : Math.PI;
      for (const rx of roadsV) {
        if (Math.abs(car.x - rx) < 12 && car.turnCd <= 0 && chance(state.rng, 0.33)) {
          car.vertical = true;
          car.road = rx;
          car.dir = chance(state.rng, 0.5) ? 1 : -1;
          car.x = rx + laneOffset(true, car.dir);
          car.turnCd = 2;
          break;
        }
      }
      if (car.x < 340) { car.x = world.w - 120; }
      if (car.x > world.w - 100) car.x = 360;
    }
    // Nudge out of buildings (traffic should stay on roads, but a turn can clip a corner).
    if (!isOnRoad(car.x, car.y)) {
      const p = nearestRoadPoint(car.x, car.y);
      if (p) {
        if (p.vertical) car.x += (p.x - car.x) * dt * 2;
        else car.y += (p.y - car.y) * dt * 2;
      }
    }
  }
}

// The player's arcade driving: a velocity vector, steering that grows with
// speed, lateral grip that bleeds off sideways slide, and a handbrake that
// drops grip so the car drifts.
export function updatePlayerCar(state, input, dt) {
  const car = state.player.inCar;
  if (!car) return;
  const def = CONFIG.models[car.model];
  const fwdX = Math.cos(car.angle);
  const fwdY = Math.sin(car.angle);
  let fwd = car.vx * fwdX + car.vy * fwdY;
  let lat = -car.vx * fwdY + car.vy * fwdX;

  const up = input.anyDown(['KeyW', 'ArrowUp']);
  const down = input.anyDown(['KeyS', 'ArrowDown']);
  const left = input.anyDown(['KeyA', 'ArrowLeft']);
  const right = input.anyDown(['KeyD', 'ArrowRight']);
  const brake = input.isDown('Space');

  if (up) fwd += def.accel * dt;
  if (down) {
    if (fwd > 20) fwd -= def.accel * 1.4 * dt;
    else fwd -= def.accel * 0.45 * dt;
  }
  if (!up && !down) fwd -= fwd * 0.6 * dt;
  fwd = Math.max(-def.top * 0.45, Math.min(def.top, fwd));

  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  const grip = brake ? 1.6 : def.grip;
  const steerRate = 2.4 * Math.min(1, Math.abs(fwd) / (def.top * 0.55));
  car.angle += steer * steerRate * dt * (fwd >= 0 ? 1 : -1);
  if (brake) fwd -= fwd * 1.2 * dt;

  lat *= Math.max(0, 1 - grip * dt);
  const nx = Math.cos(car.angle);
  const ny = Math.sin(car.angle);
  car.vx = nx * fwd + -ny * lat;
  car.vy = ny * fwd + nx * lat;
  car.speed = fwd;
  car.brake = brake || down;

  car.x += car.vx * dt;
  car.y += car.vy * dt;

  // Walls: bounce off buildings with damage and sparks.
  const before = { x: car.x, y: car.y };
  pushOutOfSolid(state.city, car, 20);
  if (before.x !== car.x || before.y !== car.y) {
    const impact = Math.hypot(car.vx, car.vy);
    if (impact > 120) {
      damageCar(state, car, impact * 0.03);
      addSparks(state, car.x, car.y, 8);
      state.camera.shake = Math.min(10, impact * 0.02);
      state.audio.crash();
      car.vx *= -0.35;
      car.vy *= -0.35;
    } else {
      car.vx *= 0.5;
      car.vy *= 0.5;
    }
  }

  // Smoke as the car wears down.
  car.smokeT -= dt;
  if (car.hp < 70 && car.smokeT <= 0) {
    car.smokeT = car.hp < 45 ? 0.08 : 0.2;
    addSmoke(state, car.x - Math.cos(car.angle) * 20, car.y - Math.sin(car.angle) * 20);
  }
  if (car.hp <= 0) wreckCar(state, car);
}

export function damageCar(state, car, amount) {
  car.hp -= amount;
  if (car.hp <= 0 && car.kind === 'player') wreckCar(state, car);
}

function wreckCar(state, car) {
  addSparks(state, car.x, car.y, 24);
  addSmoke(state, car.x, car.y);
  state.audio.crash();
  if (car === state.player.inCar) {
    state.player.inCar = null;
    state.player.x = car.x;
    state.player.y = car.y;
    state.player.angle = car.angle;
    toast(state, 'Your car is wrecked!');
  }
  const i = state.cars.indexOf(car);
  if (i >= 0) state.cars.splice(i, 1);
  // Traffic respawns elsewhere so the streets never empty.
  if (car.kind === 'traffic') {
    const p = randomRoadPoint(state.rng);
    const fresh = makeCar(pick(state.rng, ['sedan', 'taxi', 'van', 'classic']), p.x, p.y, 0, 'traffic');
    fresh.vertical = p.vertical;
    fresh.road = p.road;
    fresh.dir = chance(state.rng, 0.5) ? 1 : -1;
    fresh.targetSpeed = range(state.rng, CONFIG.traffic.cruiseMin, CONFIG.traffic.cruiseMax);
    state.cars.push(fresh);
  }
}

// Push cars apart and trade velocity on impact; both take damage on a
// hard hit. An impulse response (equal mass, parked cars immovable) keeps
// two cars from grinding each other down frame after frame: after the
// first hit they separate with their approach velocity removed.
export function collideCars(state, dt) {
  const cars = state.cars;
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const min = 34;
      if (dist >= min || dist === 0) continue;
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = min - dist;
      const aStatic = a.kind === 'parked';
      const bStatic = b.kind === 'parked';
      if (aStatic && bStatic) continue;
      // Positional separation: a parked car does not move.
      if (aStatic) { b.x += nx * overlap; b.y += ny * overlap; }
      else if (bStatic) { a.x -= nx * overlap; a.y -= ny * overlap; }
      else {
        a.x -= nx * overlap / 2;
        a.y -= ny * overlap / 2;
        b.x += nx * overlap / 2;
        b.y += ny * overlap / 2;
      }
      // Relative velocity along the normal; only approaching cars collide.
      const rvx = b.vx - a.vx;
      const rvy = b.vy - a.vy;
      const velAlongNormal = rvx * nx + rvy * ny;
      if (velAlongNormal >= 0) continue;
      const invA = aStatic ? 0 : 1;
      const invB = bStatic ? 0 : 1;
      const restitution = 0.4;
      const impulse = (-(1 + restitution) * velAlongNormal) / (invA + invB);
      a.vx -= impulse * invA * nx;
      a.vy -= impulse * invA * ny;
      b.vx += impulse * invB * nx;
      b.vy += impulse * invB * ny;
      const impact = -velAlongNormal;
      if (impact > 120) {
        const dmg = (impact - 120) * 0.02;
        damageCar(state, a, dmg);
        damageCar(state, b, dmg);
        addSparks(state, (a.x + b.x) / 2, (a.y + b.y) / 2, 5);
        if (a === state.player.inCar || b === state.player.inCar) {
          state.camera.shake = Math.min(8, impact * 0.02);
          state.audio.crash();
        }
      }
    }
  }
  void dt;
}

// Police: one plus half the wanted level, up to five patrol cars, spawning
// on a road 650–850 px from the player every 2.5 seconds while short.
export function updatePolice(state, dt) {
  const wanted = state.player.wanted;
  const target = wanted > 0 ? Math.min(5, 1 + Math.floor(wanted / 2)) : 0;
  const police = state.cars.filter((c) => c.kind === 'police');
  state.policeTimer = (state.policeTimer || 0) - dt;
  if (police.length < target && state.policeTimer <= 0) {
    state.policeTimer = 2.5;
    const p = randomRoadPoint(state.rng);
    // Pick a spawn point in the 650–850 px ring around the player.
    let sx = p.x;
    let sy = p.y;
    for (let tries = 0; tries < 12; tries++) {
      const cand = randomRoadPoint(state.rng);
      const d = Math.hypot(cand.x - state.player.x, cand.y - state.player.y);
      if (d > 650 && d < 850) { sx = cand.x; sy = cand.y; break; }
    }
    const car = makeCar('police', sx, sy, 0, 'police');
    state.cars.push(car);
    state.audio.siren(true);
  }
  if (wanted === 0) state.audio.siren(police.length > 0);

  for (const car of police) {
    if (!state.cars.includes(car)) continue;
    const dx = state.player.x - car.x;
    const dy = state.player.y - car.y;
    const dist = Math.hypot(dx, dy);
    if (wanted === 0) {
      // Heat gone: drive off and despawn beyond 1100 px.
      if (dist > 1100) {
        const i = state.cars.indexOf(car);
        if (i >= 0) state.cars.splice(i, 1);
        continue;
      }
      car.targetSpeed = 260;
      car.angle += 0.4 * dt;
      car.x += Math.cos(car.angle) * car.targetSpeed * dt;
      car.y += Math.sin(car.angle) * car.targetSpeed * dt;
      continue;
    }
    // Chase: steer toward the player and ram.
    const want = Math.atan2(dy, dx);
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const turn = Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
    car.angle += turn;
    const def = CONFIG.models.police;
    const fwd = Math.min(def.top, (car.speed || 0) + def.accel * dt);
    car.speed = fwd;
    car.vx = Math.cos(car.angle) * fwd;
    car.vy = Math.sin(car.angle) * fwd;
    car.x += car.vx * dt;
    car.y += car.vy * dt;
    const before = { x: car.x, y: car.y };
    pushOutOfSolid(state.city, car, 20);
    if (before.x !== car.x || before.y !== car.y) {
      car.vx *= -0.3;
      car.vy *= -0.3;
    }
    // Ram the player's car, or knock the player down on foot.
    if (dist < 46) {
      if (state.player.inCar) {
        damageCar(state, state.player.inCar, 8 * dt);
        state.camera.shake = 6;
      } else {
        damagePlayer(state, 10 * dt);
        state.player.x -= (dx / (dist || 1)) * 26 * dt;
        state.player.y -= (dy / (dist || 1)) * 26 * dt;
      }
    }
  }
}

export function nearestCar(state, x, y, maxDist, test) {
  let best = null;
  let bestD = maxDist;
  for (const car of state.cars) {
    if (test && !test(car)) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function addSparks(state, x, y, n) {
  for (let i = 0; i < n; i++) {
    state.particles.push({
      x, y,
      vx: range(state.rng, -160, 160),
      vy: range(state.rng, -160, 160),
      life: range(state.rng, 0.2, 0.5),
      maxLife: 0.5,
      color: pick(state.rng, ['#ffd23e', '#ff9a3e', '#ffffff']),
      size: range(state.rng, 2, 4),
    });
  }
}

export function addSmoke(state, x, y) {
  state.particles.push({
    x, y,
    vx: range(state.rng, -12, 12),
    vy: range(state.rng, -40, -20),
    life: range(state.rng, 0.6, 1.1),
    maxLife: 1.1,
    color: '#8a8a8a',
    size: range(state.rng, 6, 11),
  });
}

// Shared helpers used by other systems (imported by combat.js).
export function toast(state, text) {
  state.messages.push({ text, t: 0 });
  if (state.messages.length > 5) state.messages.shift();
}

export function damagePlayer(state, amount) {
  if (state.player.hp <= 0) return;
  state.player.hp -= amount;
  state.player.lastDamageAt = state.time;
  state.camera.shake = Math.max(state.camera.shake, 4);
}
