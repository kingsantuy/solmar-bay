// The player on foot, the crowds on the sidewalks, and the foot cops who
// run the player down. Pedestrians stroll, flee gunfire and speeding cars,
// wait as taxi clients, or chase the player in a dark uniform.
import { CONFIG } from './config.js';
import { range, int, pick, chance } from './rng.js';
import { pushOutOfSolid, nearestRoadPoint } from './city.js';
import { nearestCar, toast } from './vehicles.js';

const SHIRT_COLORS = ['#e5e0d0', '#7db8d9', '#d9a441', '#9a6a8a', '#6a8a6a', '#c96f4f', '#5a6a9a'];

export function makePed(x, y, kind, rng) {
  const r = rng || (() => 0.5);
  return {
    x, y,
    angle: range(r, 0, Math.PI * 2),
    speed: 0,
    kind: kind || 'civilian', // 'civilian' | 'cop' | 'client'
    state: 'walk', // 'walk' | 'flee' | 'down' | 'wait' | 'chase'
    tx: x, ty: y,
    hp: kind === 'cop' ? 60 : 30,
    color: kind === 'cop' ? '#20242c' : pick(r, SHIRT_COLORS),
    waitT: 0,
    fleeT: 0,
    downT: 0,
    bustT: 0,
    fare: null,
  };
}

export function spawnPeds(state) {
  for (let i = 0; i < CONFIG.peds.count; i++) {
    const p = nearestRoadPoint(
      range(state.rng, 400, CONFIG.world.w - 200),
      range(state.rng, 200, CONFIG.world.h - 200),
    );
    const ped = makePed(
      p.x + range(state.rng, -70, 70),
      p.y + range(state.rng, -70, 70),
      'civilian',
      state.rng,
    );
    ped.color = pick(state.rng, SHIRT_COLORS);
    pickStrollTarget(state, ped);
    state.peds.push(ped);
  }
}

function pickStrollTarget(state, ped) {
  ped.tx = Math.max(320, Math.min(CONFIG.world.w - 60, ped.x + range(state.rng, -420, 420)));
  ped.ty = Math.max(60, Math.min(CONFIG.world.h - 60, ped.y + range(state.rng, -420, 420)));
}

// The player on foot: walk or run, face the walk direction (or the mouse
// while the pistol is out), punch, switch weapon, enter a car.
export function updatePlayerOnFoot(state, input, dt) {
  const p = state.player;
  if (p.inCar) return;
  let dx = 0;
  let dy = 0;
  if (input.anyDown(['KeyW', 'ArrowUp'])) dy -= 1;
  if (input.anyDown(['KeyS', 'ArrowDown'])) dy += 1;
  if (input.anyDown(['KeyA', 'ArrowLeft'])) dx -= 1;
  if (input.anyDown(['KeyD', 'ArrowRight'])) dx += 1;
  const running = input.anyDown(['ShiftLeft', 'ShiftRight']);
  const speed = running ? CONFIG.player.run : CONFIG.player.walk;
  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    p.x += (dx / len) * speed * dt;
    p.y += (dy / len) * speed * dt;
    p.moveSpeed = speed;
    if (p.weapon !== 'pistol') p.angle = Math.atan2(dy, dx);
  } else {
    p.moveSpeed = 0;
  }
  if (p.weapon === 'pistol' && state.mouseWorld) {
    p.angle = Math.atan2(state.mouseWorld.y - p.y, state.mouseWorld.x - p.x);
  }
  pushOutOfSolid(state.city, p, CONFIG.player.radius);

  // Weapon switch.
  if (input.wasPressed('Digit1')) p.weapon = 'fists';
  if (input.wasPressed('Digit2') && p.hasPistol) p.weapon = 'pistol';

  // Punch.
  p.punchCd = Math.max(0, p.punchCd - dt);
  if (input.wasPressed('KeyF') && p.punchCd <= 0) {
    p.punchCd = CONFIG.player.punchRate;
    state.audio.punch();
    punch(state);
  }

  // Enter a car.
  if (input.wasPressed('KeyE')) enterNearestCar(state);
}

function punch(state) {
  const p = state.player;
  const reach = CONFIG.player.punchReach;
  let best = null;
  let bestD = reach;
  for (const ped of state.peds) {
    if (ped.state === 'down') continue;
    const d = Math.hypot(ped.x - p.x, ped.y - p.y);
    if (d > bestD) continue;
    const ang = Math.atan2(ped.y - p.y, ped.x - p.x);
    let diff = Math.abs(ang - p.angle);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff < 1.1) { best = ped; bestD = d; }
  }
  if (!best) return;
  best.hp -= CONFIG.player.punchDamage;
  best.x += Math.cos(p.angle) * 14;
  best.y += Math.sin(p.angle) * 14;
  addHitSpark(state, best.x, best.y);
  if (best.hp <= 0) {
    best.state = 'down';
    best.downT = 20;
    commitCrime(state, best.kind === 'cop' ? 2 : 1);
    toast(state, best.kind === 'cop' ? 'You knocked out a cop! +2 stars' : 'Pedestrian down! +1 star');
  }
}

export function commitCrime(state, stars) {
  const p = state.player;
  p.wanted = Math.min(CONFIG.wanted.max, p.wanted + stars);
  p.lastCrimeAt = state.time;
  state.wantedHeat.fadeT = 0;
}

// Steal or enter the nearest car. A parked car is taken; a traffic car's
// driver is pulled out and flees; a police car is locked.
export function enterNearestCar(state) {
  const p = state.player;
  const car = nearestCar(state, p.x, p.y, CONFIG.player.enterRange, (c) => c.kind !== 'police');
  if (!car) {
    const cop = nearestCar(state, p.x, p.y, CONFIG.player.enterRange, (c) => c.kind === 'police');
    if (cop) toast(state, 'The police car is locked.');
    return;
  }
  if (car.kind === 'traffic') {
    // Pull the driver out: they become a fleeing pedestrian.
    const driver = makePed(car.x, car.y, 'civilian', state.rng);
    driver.state = 'flee';
    driver.fleeT = 4;
    state.peds.push(driver);
    commitCrime(state, 1);
    state.stats.carsStolen++;
    toast(state, 'Car stolen! +1 star');
  } else if (car.kind === 'parked' && !car.owned) {
    commitCrime(state, 1);
    state.stats.carsStolen++;
    toast(state, 'Car stolen! +1 star');
  }
  car.kind = 'player';
  car.owned = true;
  car.vx = 0;
  car.vy = 0;
  car.speed = 0;
  p.inCar = car;
  p.x = car.x;
  p.y = car.y;
  state.audio.ensure();
}

export function exitCar(state) {
  const p = state.player;
  const car = p.inCar;
  if (!car) return;
  const side = Math.PI / 2;
  p.x = car.x + Math.cos(car.angle + side) * 34;
  p.y = car.y + Math.sin(car.angle + side) * 34;
  pushOutOfSolid(state.city, p, CONFIG.player.radius);
  car.kind = 'parked';
  car.vx = 0;
  car.vy = 0;
  car.speed = 0;
  p.inCar = null;
}

// Pedestrians: stroll between nearby points, flee gunfire and speeding
// cars, wait as taxi clients, and (as cops) run the player down.
export function updatePeds(state, dt) {
  const p = state.player;
  for (const ped of state.peds) {
    if (ped.state === 'down') {
      ped.downT -= dt;
      continue;
    }
    if (ped.state === 'wait') continue; // taxi client stands still
    if (ped.kind === 'cop') {
      updateCop(state, ped, dt);
      continue;
    }
    // Flee: gunfire, a speeding car, or a crime nearby.
    const threat = state.lastShotAt && state.time - state.lastShotAt < 2;
    const nearCar = state.player.inCar && Math.hypot(state.player.inCar.x - ped.x, state.player.inCar.y - ped.y) < 110
      && Math.abs(state.player.inCar.speed || 0) > 260;
    if ((threat && Math.hypot(p.x - ped.x, p.y - ped.y) < 320) || nearCar) {
      ped.state = 'flee';
      ped.fleeT = 2.5;
    }
    if (ped.state === 'flee') {
      ped.fleeT -= dt;
      const ax = ped.x - p.x;
      const ay = ped.y - p.y;
      const len = Math.hypot(ax, ay) || 1;
      ped.angle = Math.atan2(ay, ax);
      ped.x += (ax / len) * 230 * dt;
      ped.y += (ay / len) * 230 * dt;
      pushOutOfSolid(state.city, ped, 12);
      if (ped.fleeT <= 0) {
        ped.state = 'walk';
        pickStrollTarget(state, ped);
      }
      continue;
    }
    // Stroll.
    const dx = ped.tx - ped.x;
    const dy = ped.ty - ped.y;
    const d = Math.hypot(dx, dy);
    if (d < 12) {
      ped.waitT -= dt;
      if (ped.waitT <= 0) {
        pickStrollTarget(state, ped);
        ped.waitT = range(state.rng, 1, 4);
      }
      continue;
    }
    const speed = 55;
    ped.angle = Math.atan2(dy, dx);
    ped.x += (dx / d) * speed * dt;
    ped.y += (dy / d) * speed * dt;
    pushOutOfSolid(state.city, ped, 12);
  }
  // Remove the long-knocked-out.
  for (let i = state.peds.length - 1; i >= 0; i--) {
    if (state.peds[i].state === 'down' && state.peds[i].downT <= 0) state.peds.splice(i, 1);
  }
  // Foot cops appear once the wanted level reaches two stars.
  updateCopSpawns(state, dt);
}

function updateCop(state, cop, dt) {
  const p = state.player;
  const d = Math.hypot(p.x - cop.x, p.y - cop.y);
  if (p.wanted < 2) {
    // Heat gone: the cop walks off.
    cop.state = 'walk';
    cop.kind = 'civilian';
    cop.color = pick(state.rng, SHIRT_COLORS);
    pickStrollTarget(state, cop);
    return;
  }
  cop.angle = Math.atan2(p.y - cop.y, p.x - cop.x);
  if (d > 26) {
    cop.x += Math.cos(cop.angle) * 230 * dt;
    cop.y += Math.sin(cop.angle) * 230 * dt;
    pushOutOfSolid(state.city, cop, 12);
    cop.bustT = 0;
  } else {
    // Holding the player: 1.6 seconds and it is a bust (world.js applies it).
    cop.bustT += dt;
    p.bustHold = Math.max(p.bustHold, cop.bustT);
  }
}

function updateCopSpawns(state, dt) {
  const p = state.player;
  const want = p.wanted >= 2 ? Math.min(3, p.wanted - 1) : 0;
  const cops = state.peds.filter((q) => q.kind === 'cop');
  if (cops.length < want) {
    state.copTimer = (state.copTimer || 0) - dt;
    if (state.copTimer <= 0) {
      state.copTimer = 2;
      const a = range(state.rng, 0, Math.PI * 2);
      const cop = makePed(p.x + Math.cos(a) * 380, p.y + Math.sin(a) * 380, 'cop', state.rng);
      cop.state = 'chase';
      state.peds.push(cop);
    }
  }
}

export function addHitSpark(state, x, y) {
  for (let i = 0; i < 6; i++) {
    state.particles.push({
      x, y,
      vx: range(state.rng, -120, 120),
      vy: range(state.rng, -120, 120),
      life: 0.3, maxLife: 0.3,
      color: '#ffd23e', size: 3,
    });
  }
}
