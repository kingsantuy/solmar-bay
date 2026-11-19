// Solmar Bay — the whole 2D-plane simulation.
// World coords: x east 0..4800, y south 0..3600; angle 0 = east, increasing
// clockwise in the plane. createGame(seed, saveData?, audio?) builds the
// state; stepGame(game, input, dt) advances it one tick. Plain ES modules:
// the same files import in Node (headless test) and in the browser.
// The renderer consumes the exact state shape documented in the task —
// field names there are not changed; extra AI fields ride alongside.

import { createRng } from './rng.js';
import { CONFIG, CAR_MODELS, MISSIONS, LANDMARKS } from './config.js';
import {
  generateCity, hitBuilding, pushOutOfBuildings, distToRect,
  nearestRoadPoint, randomRoadPoint, districtAt,
} from './city.js';
import { saveGame } from './save.js';

const TAU = Math.PI * 2;
const W = CONFIG.world.w, H = CONFIG.world.h;

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function angTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
function angDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

// ---------------------------------------------------------------- create ---

let carIdSeq = 1;

function makeCar(game, model, x, y, angle) {
  const m = CAR_MODELS[model];
  return {
    id: 'car' + (carIdSeq++),
    model, x, y, angle: angle || 0,
    speed: 0, vx: 0, vy: 0,
    color: game.rng.pick(m.colors),
    kind: 'traffic', health: 100, owned: false, siren: false,
    // AI extras (renderer ignores these):
    road: 'v', roadC: CONFIG.roadsV[0], dir: 1, lane: -28,
    targetSpeed: 160, shootTimer: 0, smokeTimer: 0, missionCar: null,
  };
}

function spawnTrafficCar(game, farFromPlayer) {
  const rng = game.rng;
  for (let t = 0; t < 20; t++) {
    const p = randomRoadPoint(rng);
    if (farFromPlayer && dist(p.x, p.y, game.player.x, game.player.y) < 500) continue;
    const vertical = rng.chance(0.5);
    const roadC = vertical ? p.x : p.y;
    const dir = rng.chance(0.5) ? 1 : -1;
    const model = rng.pick(['sedan', 'sedan', 'taxi', 'van', 'classic', 'classic', 'truck']);
    const car = makeCar(game, model, p.x, p.y, 0);
    car.kind = 'traffic';
    car.road = vertical ? 'v' : 'h';
    car.roadC = roadC;
    car.dir = dir;
    car.lane = vertical ? (dir === 1 ? -28 : 28) : (dir === 1 ? 28 : -28);
    car.angle = vertical ? (dir === 1 ? Math.PI / 2 : -Math.PI / 2) : (dir === 1 ? 0 : Math.PI);
    if (vertical) car.x = roadC + car.lane; else car.y = roadC + car.lane;
    car.targetSpeed = rng.range(120, 210);
    car.speed = car.targetSpeed;
    game.cars.push(car);
    return car;
  }
  return null;
}

function spawnParkedCar(game) {
  const rng = game.rng;
  const keepClear = [
    [CONFIG.start.carX, CONFIG.start.carY],
    [560, 1200],   // beach lot — the Hot Wheels sportscar lives here
    [3900, 3350],  // Portside Docks — the gold truck lives here
  ];
  for (let t = 0; t < 30; t++) {
    const p = randomRoadPoint(rng);
    const vertical = rng.chance(0.5);
    const side = rng.chance(0.5) ? 1 : -1;
    const x = vertical ? p.x + side * (CONFIG.roadW / 2 + 12) : p.x;
    const y = vertical ? p.y : p.y + side * (CONFIG.roadW / 2 + 12);
    if (x < 340 || x > W - 40 || y < 40 || y > H - 40) continue;
    if (hitBuilding(game.city, x, y, 30)) continue;
    if (keepClear.some(([kx, ky]) => dist(x, y, kx, ky) < 130)) continue;
    if (game.cars.some((c) => dist(x, y, c.x, c.y) < 90)) continue;
    const model = rng.pick(['sedan', 'sedan', 'taxi', 'van', 'classic', 'classic']);
    const car = makeCar(game, model, x, y, vertical ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI));
    car.kind = 'parked';
    game.cars.push(car);
    return car;
  }
  return null;
}

function spawnPed(game, nearX, nearY) {
  const rng = game.rng;
  let x = nearX, y = nearY;
  if (nearX === undefined) {
    const p = randomRoadPoint(rng);
    x = p.x + rng.range(-80, 80);
    y = p.y + rng.range(-80, 80);
  }
  x = clamp(x, 320, W - 20); y = clamp(y, 20, H - 20);
  const ped = {
    x, y, angle: rng.range(0, TAU), kind: 'civilian', state: 'walk',
    speed: rng.range(45, 65),
    color: rng.pick(['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#ecf0f1', '#e67e22']),
    health: 100, tx: x, ty: y, hold: 0, fleeTimer: 0,
  };
  game.peds.push(ped);
  return ped;
}

function setMessage(game, text) {
  game.message = text;
  game.messageTimer = 6;
}

function commitCrime(game, n) {
  game.wanted.stars = Math.min(CONFIG.wanted.max, game.wanted.stars + n);
  game.wanted.quietTimer = 0;
  game.wanted.decayTimer = 0;
}

export function createGame(seed, saveData, audio) {
  const rng = createRng(seed);
  const city = generateCity(seed);
  const game = {
    seed, time: 0,
    screen: 'title',
    city,
    player: {
      x: CONFIG.start.x, y: CONFIG.start.y, angle: -Math.PI / 2,
      onFoot: true, car: null,
      health: CONFIG.player.health, money: 0,
      weapon: 'fists', hasPistol: false, speed: 0, moving: false,
      punchTimer: 0, shootTimer: 0,
    },
    cars: [], peds: [], bullets: [], particles: [],
    heli: { active: false, x: CONFIG.start.x, y: CONFIG.start.y, z: 120, angle: 0, rotor: 0 },
    wanted: { stars: 0, quietTimer: 0, decayTimer: 0 },
    mission: null,
    completedMissions: [],
    taxi: { active: false, state: 'toClient', client: null, destX: 0, destY: 0, fare: 0, timer: rng.range(CONFIG.taxi.minWait, CONFIG.taxi.maxWait) },
    stats: { carsStolen: 0, shotsFired: 0, missionsDone: 0, fares: 0, moneyEarned: 0 },
    camera: { shake: 0 },
    message: '', messageTimer: 0,
    district: districtAt(CONFIG.start.x, CONFIG.start.y),
    audio: audio || null,
    rng,
    policeTimer: 0, copTimer: 0,
  };

  // Starter sedan — the player's own, parked by the marina.
  const starter = makeCar(game, 'sedan', CONFIG.start.carX, CONFIG.start.carY, 0);
  starter.kind = 'player';
  starter.owned = true;
  starter.color = '#c0392b';
  game.cars.push(starter);

  for (let i = 0; i < CONFIG.trafficCount; i++) spawnTrafficCar(game, false);
  for (let i = 0; i < CONFIG.parkedCount; i++) spawnParkedCar(game);
  for (let i = 0; i < CONFIG.pedCount; i++) spawnPed(game);

  if (saveData) {
    if (typeof saveData.money === 'number') game.player.money = saveData.money;
    if (Array.isArray(saveData.completed)) game.completedMissions = [...saveData.completed];
    if (saveData.stats) game.stats = { ...game.stats, ...saveData.stats };
    if (saveData.player) {
      game.player.x = clamp(saveData.player.x || CONFIG.start.x, 120, W - 10);
      game.player.y = clamp(saveData.player.y || CONFIG.start.y, 10, H - 10);
    }
  }
  game.district = districtAt(game.player.x, game.player.y);
  return game;
}

// --------------------------------------------------------------- missions ---

function spawnMissionClient(game, x, y) {
  const ped = spawnPed(game, x, y);
  ped.kind = 'client';
  ped.state = 'wait';
  ped.speed = 0;
  return ped;
}

function spawnMissionCar(game, model, x, y, color, missionCar) {
  const spots = [[0, 0], [50, 0], [-50, 0], [0, 50], [0, -50], [100, 0], [-100, 0], [0, 100], [50, 50], [-50, -50]];
  for (const [dx, dy] of spots) {
    const px = x + dx, py = y + dy;
    if (px < 340 || px > W - 40 || py < 40 || py > H - 40) continue;
    if (hitBuilding(game.city, px, py, 34)) continue;
    if (game.cars.some((c) => dist(px, py, c.x, c.y) < 70)) continue;
    const car = makeCar(game, model, px, py, 0);
    car.kind = 'parked';
    car.color = color;
    car.missionCar = missionCar;
    game.cars.push(car);
    return car;
  }
  return null;
}

function spawnPatrolCars(game) {
  for (const y of [800, 1700]) {
    const car = makeCar(game, 'police', 420 - 28, y, Math.PI / 2);
    car.kind = 'police';
    car.road = 'v'; car.roadC = 420; car.dir = 1; car.lane = -28;
    car.targetSpeed = 180;
    game.cars.push(car);
  }
}

function startMission(game, index) {
  const def = MISSIONS[index];
  if (!def) return;
  game.mission = { index, def, step: 0, timer: def.timeLimit || null, active: true };
  setMessage(game, def.title + ' — ' + def.steps[0].text);
  if (def.id === 'hot-wheels') spawnMissionCar(game, 'sport', 560, 1200, '#d21f2b', 'sport');
  if (def.id === 'the-drop') spawnPatrolCars(game);
  if (def.id === 'the-big-one') spawnMissionCar(game, 'truck', 3900, 3350, '#d4af37', 'goldtruck');
  if (def.id === 'night-shift') { game.wanted.stars = 2; game.wanted.quietTimer = 0; }
  const step = def.steps[0];
  if (step.kind === 'pickup' && (def.id === 'first-fare' || def.id === 'night-shift')) {
    game.mission.clientPed = spawnMissionClient(game, step.x, step.y);
  }
}

function nextMissionIndex(game) {
  return MISSIONS.findIndex((m) => !game.completedMissions.includes(m.id));
}

function completeStep(game) {
  const m = game.mission;
  const step = m.def.steps[m.step];
  if (step.kind === 'grab' && m.def.id === 'bay-heist') {
    game.wanted.stars = 2;
    game.wanted.quietTimer = 0;
    game.wanted.decayTimer = 0;
    setMessage(game, 'Cash grabbed! Lose the heat, then reach the Hideout.');
    if (game.audio) game.audio.pickup();
  } else if (step.kind === 'pickup' && m.clientPed) {
    const i = game.peds.indexOf(m.clientPed);
    if (i >= 0) game.peds.splice(i, 1);
    m.clientPed = null;
    if (game.audio) game.audio.pickup();
  }
  m.step++;
  if (m.step >= m.def.steps.length) {
    completeMission(game);
    return;
  }
  const next = m.def.steps[m.step];
  setMessage(game, next.text);
  if (next.kind === 'pickup' && (m.def.id === 'first-fare' || m.def.id === 'night-shift')) {
    m.clientPed = spawnMissionClient(game, next.x, next.y);
  }
}

function completeMission(game) {
  const m = game.mission;
  const def = m.def;
  game.player.money += def.pay;
  game.stats.moneyEarned += def.pay;
  game.stats.missionsDone++;
  game.completedMissions.push(def.id);
  if (def.id === 'hot-wheels') {
    game.player.hasPistol = true;
    setMessage(game, 'Job done! +$' + def.pay + ' — the crew gave you a pistol (press 2).');
  } else {
    setMessage(game, 'Job done! +$' + def.pay);
  }
  if (game.audio) game.audio.success();
  game.mission = null;
  try { saveGame(game); } catch (e) { /* autosave must never break play */ }
  const next = nextMissionIndex(game);
  if (next >= 0) startMission(game, next);
}

function failMission(game) {
  setMessage(game, "Time's up — the job failed. Press Enter to retry it.");
  if (game.audio) game.audio.fail();
  game.mission = null;
}

function stepDistToTarget(game, step) {
  const p = game.player;
  const b = game.city.buildings.find(
    (bb) => step.x >= bb.x - bb.w / 2 && step.x <= bb.x + bb.w / 2
      && step.y >= bb.y - bb.d / 2 && step.y <= bb.y + bb.d / 2,
  );
  if (b) return distToRect(p.x, p.y, b);
  return dist(p.x, p.y, step.x, step.y);
}

function updateMission(game, dt) {
  const m = game.mission;
  if (!m) return;
  if (m.def.timeLimit) {
    m.timer -= dt;
    if (m.timer <= 0) { failMission(game); return; }
  }
  const step = m.def.steps[m.step];
  if (!step) return;
  if (step.kind === 'steal') return; // completes when the car is entered
  if (step.kind === 'escape') {
    if (game.wanted.stars === 0) completeStep(game);
    return;
  }
  if (step.needQuiet && game.wanted.stars > 0) return;
  if (stepDistToTarget(game, step) <= step.radius) completeStep(game);
}

// ------------------------------------------------------------------ taxi ---

function updateTaxi(game, dt) {
  const t = game.taxi;
  if (game.mission) return; // fares only run between jobs
  if (!t.active) {
    t.timer -= dt;
    if (t.timer > 0) return;
    const p = randomRoadPoint(game.rng);
    for (let tries = 0; tries < 12; tries++) {
      const cand = randomRoadPoint(game.rng);
      const d = dist(cand.x, cand.y, game.player.x, game.player.y);
      if (d > 300 && d < 700) { p.x = cand.x; p.y = cand.y; break; }
    }
    const dest = randomRoadPoint(game.rng);
    const client = spawnPed(game, p.x, p.y);
    client.kind = 'client';
    client.state = 'wait';
    client.speed = 0;
    t.active = true;
    t.state = 'toClient';
    t.client = client;
    t.destX = dest.x; t.destY = dest.y;
    t.fare = CONFIG.taxi.minFare + game.rng.int(0, CONFIG.taxi.maxFare - CONFIG.taxi.minFare);
    setMessage(game, 'Taxi fare: a client is waiting ($' + t.fare + '). Pick them up!');
    return;
  }
  if (t.state === 'toClient') {
    if (!t.client || !game.peds.includes(t.client)) { t.active = false; t.timer = CONFIG.taxi.minWait; return; }
    if (dist(game.player.x, game.player.y, t.client.x, t.client.y) < 60) {
      const i = game.peds.indexOf(t.client);
      if (i >= 0) game.peds.splice(i, 1);
      t.client = null;
      t.state = 'toDest';
      setMessage(game, 'Client aboard — drive to the marker.');
      if (game.audio) game.audio.pickup();
    }
  } else if (dist(game.player.x, game.player.y, t.destX, t.destY) < 70) {
    game.player.money += t.fare;
    game.stats.moneyEarned += t.fare;
    game.stats.fares++;
    setMessage(game, 'Fare complete! +$' + t.fare);
    if (game.audio) game.audio.cash();
    t.active = false;
    t.timer = game.rng.range(CONFIG.taxi.minWait, CONFIG.taxi.maxWait);
  }
}

// ---------------------------------------------------------------- combat ---

function damagePlayer(game, n) {
  const p = game.player;
  if (game.screen !== 'play' || p.health <= 0) return;
  p.health -= n;
  game.camera.shake = Math.max(game.camera.shake, 0.35);
  if (p.health <= 0) {
    p.health = 0;
    game.screen = 'wasted';
    if (game.audio) game.audio.fail();
    setMessage(game, 'Wasted!');
  }
}

function bustPlayer(game) {
  game.screen = 'busted';
  if (game.audio) game.audio.fail();
  setMessage(game, 'Busted!');
  for (const c of game.cars) if (c.kind === 'police') c.siren = false;
  if (game.audio) game.audio.siren(false);
}

function respawn(game, place) {
  const p = game.player;
  const spot = place === 'hospital' ? LANDMARKS.hospital : LANDMARKS.policehq;
  p.x = spot.x; p.y = spot.y; p.angle = -Math.PI / 2;
  p.onFoot = true; p.car = null;
  p.health = CONFIG.player.health;
  p.money = Math.max(0, p.money - CONFIG.wanted.respawnCost);
  game.wanted.stars = 0;
  game.wanted.quietTimer = 0;
  game.wanted.decayTimer = 0;
  game.cars = game.cars.filter((c) => c.kind !== 'police');
  game.peds = game.peds.filter((pd) => pd.kind !== 'cop');
  game.heli.active = false;
  game.screen = 'play';
  setMessage(game, (place === 'hospital' ? 'Wasted! ' : 'Busted! ') + 'You woke up at ' + (place === 'hospital' ? 'Solmar General' : 'Police HQ') + ' — $100 lighter.');
  try { saveGame(game); } catch (e) { /* ignore */ }
}

function addParticles(game, x, y, kind, n, color) {
  for (let i = 0; i < n; i++) {
    const a = game.rng.range(0, TAU);
    const sp = game.rng.range(20, 120);
    game.particles.push({
      x, y, z: kind === 'smoke' ? 10 : 4,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      vz: kind === 'smoke' ? game.rng.range(15, 40) : game.rng.range(40, 140),
      life: kind === 'smoke' ? game.rng.range(0.6, 1.4) : game.rng.range(0.15, 0.4),
      maxLife: 1, color, size: kind === 'smoke' ? game.rng.range(6, 12) : game.rng.range(2, 4),
      kind,
    });
  }
  for (const pt of game.particles) if (!pt.maxLife || pt.maxLife === 1) pt.maxLife = pt.life;
}

function scatterPeds(game, x, y, radius) {
  for (const ped of game.peds) {
    if (ped.kind === 'cop') continue;
    if (dist(ped.x, ped.y, x, y) < radius) {
      ped.state = 'flee';
      ped.fleeTimer = 2.5;
      ped.angle = angTo(x, y, ped.x, ped.y);
    }
  }
}

// -------------------------------------------------------------- vehicles ---

function damageCar(game, car, dmg) {
  car.health -= dmg;
  if (car.health > 0) return;
  car.health = 0;
  addParticles(game, car.x, car.y, 'smoke', 14, '#555555');
  addParticles(game, car.x, car.y, 'spark', 10, '#ffaa00');
  const i = game.cars.indexOf(car);
  if (i >= 0) game.cars.splice(i, 1);
  if (game.player.car === car) {
    game.player.car = null;
    game.player.onFoot = true;
    game.player.x = car.x; game.player.y = car.y;
    setMessage(game, 'Your car is wrecked!');
  }
  if (car.kind === 'traffic') spawnTrafficCar(game, true);
}

function collideCars(game) {
  const cars = game.cars;
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      const ra = CAR_MODELS[a.model].len / 2, rb = CAR_MODELS[b.model].len / 2;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = ra + rb - 6;
      if (d >= min || d === 0) continue;
      const nx = dx / d, ny = dy / d;
      const overlapAmt = min - d;
      const aFixed = a.kind === 'parked', bFixed = b.kind === 'parked';
      if (!aFixed) { a.x -= nx * overlapAmt * (bFixed ? 1 : 0.5); a.y -= ny * overlapAmt * (bFixed ? 1 : 0.5); }
      if (!bFixed) { b.x += nx * overlapAmt * (aFixed ? 1 : 0.5); b.y += ny * overlapAmt * (aFixed ? 1 : 0.5); }
      const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
      const rel = rvx * nx + rvy * ny;
      if (rel < 0) {
        const imp = -rel * 0.6;
        if (!aFixed) { a.vx -= nx * imp; a.vy -= ny * imp; }
        if (!bFixed) { b.vx += nx * imp; b.vy += ny * imp; }
        if (-rel > 140) {
          addParticles(game, (a.x + b.x) / 2, (a.y + b.y) / 2, 'spark', 6, '#ffcc33');
          if (!aFixed) damageCar(game, a, -rel * 0.05);
          if (!bFixed) damageCar(game, b, -rel * 0.05);
          if (a === game.player.car || b === game.player.car) {
            game.camera.shake = Math.max(game.camera.shake, 0.4);
            if (game.audio) game.audio.crash();
          }
        }
      }
    }
  }
}

function driveCar(game, car, input, dt) {
  const m = CAR_MODELS[car.model];
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  let f = car.vx * fx + car.vy * fy;
  let l = car.vx * -fy + car.vy * fx;
  if (input.up) f += m.accel * dt;
  if (input.down) f -= (f > 0 ? m.accel * 1.1 : m.accel * 0.5) * dt;
  f -= f * 0.35 * dt;
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const authority = Math.min(1, Math.abs(f) / 100);
  car.angle += steer * 2.4 * authority * Math.sign(f || 1) * dt;
  const gripRate = input.handbrake ? 2.2 : m.grip;
  l *= Math.exp(-gripRate * dt);
  if (input.handbrake) f *= Math.exp(-0.6 * dt);
  f = clamp(f, -140, m.topSpeed);
  const nfx = Math.cos(car.angle), nfy = Math.sin(car.angle);
  car.vx = nfx * f - nfy * l;
  car.vy = nfy * f + nfx * l;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  car.speed = Math.hypot(car.vx, car.vy);
  // World bounds + sea.
  car.x = clamp(car.x, 112, W - 12);
  car.y = clamp(car.y, 12, H - 12);
  const r = 24;
  if (hitBuilding(game.city, car.x, car.y, r)) {
    const impact = Math.abs(f);
    const fixed = pushOutOfBuildings(game.city, car.x, car.y, r);
    car.x = fixed.x; car.y = fixed.y;
    if (impact > 60) {
      damageCar(game, car, impact * 0.12);
      addParticles(game, car.x, car.y, 'spark', 8, '#ffcc33');
      game.camera.shake = Math.max(game.camera.shake, 0.3);
      if (impact > 180 && game.audio) game.audio.crash();
    }
    f *= -0.35;
    car.vx = nfx * f - nfy * l;
    car.vy = nfy * f + nfx * l;
    car.speed = Math.hypot(car.vx, car.vy);
  }
  // Smoke when hurt.
  if (car.health < 70) {
    car.smokeTimer -= dt;
    if (car.smokeTimer <= 0) {
      car.smokeTimer = car.health < 45 ? 0.08 : 0.25;
      addParticles(game, car.x, car.y, 'smoke', 1, '#777777');
    }
  }
  return f;
}

function updateTraffic(game, dt) {
  for (const car of [...game.cars]) {
    if (car.kind !== 'traffic') continue;
    // Slow for the car ahead in the same lane.
    let target = car.targetSpeed;
    for (const other of game.cars) {
      if (other === car || other.kind === 'police') continue;
      const along = car.road === 'v'
        ? (other.y - car.y) * car.dir
        : (other.x - car.x) * car.dir;
      const across = car.road === 'v' ? Math.abs(other.x - car.x) : Math.abs(other.y - car.y);
      if (along > 0 && along < 110 && across < 34) {
        target = along < 55 ? 0 : Math.min(target, other.speed * 0.8);
      }
    }
    const accel = target > car.speed ? 160 : -260;
    car.speed = clamp(car.speed + accel * dt, 0, Math.max(target, 0));
    // Move along the road.
    let px = car.x, py = car.y;
    if (car.road === 'v') py += car.dir * car.speed * dt;
    else px += car.dir * car.speed * dt;
    // Intersection turn (~1 in 3).
    const crosses = car.road === 'v' ? CONFIG.roadsH : CONFIG.roadsV;
    const alongPos = car.road === 'v' ? py : px;
    for (const c of crosses) {
      if (Math.abs(alongPos - c) < 26 && !car.justTurned && car.speed > 40 && game.rng.chance(0.33)) {
        car.justTurned = true;
        const newDir = game.rng.chance(0.5) ? 1 : -1;
        if (car.road === 'v') {
          car.road = 'h'; car.roadC = c; car.dir = newDir;
          car.lane = newDir === 1 ? 28 : -28;
          car.angle = newDir === 1 ? 0 : Math.PI;
          py = c + car.lane; px = car.x;
        } else {
          car.road = 'v'; car.roadC = c; car.dir = newDir;
          car.lane = newDir === 1 ? -28 : 28;
          car.angle = newDir === 1 ? Math.PI / 2 : -Math.PI / 2;
          px = c + car.lane; py = car.y;
        }
        break;
      }
      if (Math.abs(alongPos - c) > 70) car.justTurned = false;
    }
    car.x = px; car.y = py;
    // Wrap around the world edges so the streets never empty.
    if (car.road === 'v') {
      if (car.y > H + 40) car.y = -40;
      if (car.y < -40) car.y = H + 40;
    } else {
      if (car.x > W + 40) car.x = -40;
      if (car.x < -40) car.x = W + 40;
    }
    const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
    car.vx = fx * car.speed; car.vy = fy * car.speed;
  }
}

function spawnPoliceCar(game) {
  for (let t = 0; t < 14; t++) {
    const p = randomRoadPoint(game.rng);
    const d = dist(p.x, p.y, game.player.x, game.player.y);
    if (d < CONFIG.wanted.policeMinDist || d > CONFIG.wanted.policeMaxDist) continue;
    const car = makeCar(game, 'police', p.x, p.y, 0);
    car.kind = 'police';
    car.siren = true;
    game.cars.push(car);
    return true;
  }
  return false;
}

function updatePolice(game, dt) {
  const p = game.player;
  const stars = game.wanted.stars;
  const police = game.cars.filter((c) => c.kind === 'police');
  // Spawn to the wanted level: 1 + stars/2, up to 5.
  if (stars > 0) {
    const desired = Math.min(5, 1 + Math.floor(stars / 2));
    game.policeTimer -= dt;
    if (police.length < desired && game.policeTimer <= 0) {
      if (spawnPoliceCar(game)) game.policeTimer = CONFIG.wanted.policeSpawnEvery;
    }
  }
  for (const car of [...game.cars]) {
    if (car.kind !== 'police') continue;
    const d = dist(car.x, car.y, p.x, p.y);
    let targetAngle, desiredSpeed;
    if (stars === 0) {
      // Heat gone: drive off, despawn beyond 1100 px.
      targetAngle = angTo(p.x, p.y, car.x, car.y);
      desiredSpeed = CAR_MODELS.police.topSpeed * 0.8;
      if (d > CONFIG.wanted.policeDespawn) {
        const i = game.cars.indexOf(car);
        if (i >= 0) game.cars.splice(i, 1);
        continue;
      }
    } else if (p.onFoot && d < 520) {
      // Standoff: don't run the player over, ease in and hold at ~320 px.
      // Proportional approach so the car never overshoots into the
      // 250 px "police nearby" radius that pauses wanted decay.
      targetAngle = angTo(car.x, car.y, p.x, p.y);
      desiredSpeed = clamp((d - 320) / 180, 0, 1) * CAR_MODELS.police.topSpeed;
      if (d < 305) desiredSpeed = -60;
    } else {
      targetAngle = angTo(car.x, car.y, p.x, p.y);
      desiredSpeed = CAR_MODELS.police.topSpeed;
    }
    car.angle += clamp(angDiff(car.angle, targetAngle), -3 * dt, 3 * dt);
    car.speed = clamp(car.speed + (desiredSpeed > car.speed ? 420 : -520) * dt, -60, CAR_MODELS.police.topSpeed);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = clamp(car.x, 112, W - 12);
    car.y = clamp(car.y, 12, H - 12);
    car.vx = Math.cos(car.angle) * car.speed;
    car.vy = Math.sin(car.angle) * car.speed;
    if (hitBuilding(game.city, car.x, car.y, 24)) {
      const fixed = pushOutOfBuildings(game.city, car.x, car.y, 24);
      car.x = fixed.x; car.y = fixed.y;
      car.angle += (game.rng.chance(0.5) ? 1 : -1) * 1.1;
      car.speed *= 0.5;
    }
    // Ram the player's car.
    if (!p.onFoot && p.car && d < 48) {
      damageCar(game, p.car, 6 * dt * 60 * 0.1 + 0.15);
      p.car.vx += Math.cos(car.angle) * 60 * dt;
      p.car.vy += Math.sin(car.angle) * 60 * dt;
      game.camera.shake = Math.max(game.camera.shake, 0.25);
    }
    // Shoot at 3+ stars.
    if (stars >= CONFIG.wanted.shootStars && d < CONFIG.wanted.policeShootRange) {
      car.shootTimer -= dt;
      if (car.shootTimer <= 0) {
        car.shootTimer = CONFIG.wanted.policeShotCd;
        const spread = game.rng.range(-0.16, 0.16);
        game.bullets.push({
          x: car.x, y: car.y,
          angle: angTo(car.x, car.y, p.x, p.y) + spread,
          speed: CONFIG.player.bulletSpeed, from: 'police', life: 1.4,
        });
        addParticles(game, car.x, car.y, 'muzzle', 2, '#ffdd55');
      }
    }
  }
  if (game.audio) game.audio.siren(police.length > 0 && stars > 0);
  // Helicopter at 3+ stars.
  const heli = game.heli;
  heli.active = stars >= CONFIG.wanted.heliStars;
  if (heli.active) {
    heli.x += (p.x - heli.x) * Math.min(1, dt * 1.2);
    heli.y += (p.y - heli.y) * Math.min(1, dt * 1.2);
    heli.angle = angTo(heli.x, heli.y, p.x, p.y);
    heli.rotor += dt * 28;
  } else {
    heli.x = p.x; heli.y = p.y;
  }
}

// ------------------------------------------------------------------ peds ---

function spawnFootCop(game) {
  for (let t = 0; t < 12; t++) {
    const pt = randomRoadPoint(game.rng);
    const d = dist(pt.x, pt.y, game.player.x, game.player.y);
    if (d < 300 || d > 450) continue;
    const ped = {
      x: pt.x, y: pt.y, angle: 0, kind: 'cop', state: 'chase',
      speed: 240, color: '#1c2b4a', health: 100,
      tx: pt.x, ty: pt.y, hold: 0, fleeTimer: 0,
    };
    game.peds.push(ped);
    return true;
  }
  return false;
}

function updatePeds(game, dt) {
  const p = game.player;
  // Foot cops at 2+ stars.
  if (game.wanted.stars >= 2) {
    const cops = game.peds.filter((pd) => pd.kind === 'cop');
    const desired = Math.min(3, game.wanted.stars - 1);
    game.copTimer -= dt;
    if (cops.length < desired && game.copTimer <= 0) {
      if (spawnFootCop(game)) game.copTimer = 3;
    }
  } else {
    game.peds = game.peds.filter((pd) => pd.kind !== 'cop');
  }

  for (const ped of [...game.peds]) {
    if (ped.kind === 'cop') {
      // Chase the player on foot; hold 1.6 s to bust.
      const d = dist(ped.x, ped.y, p.x, p.y);
      if (p.onFoot) {
        ped.angle = angTo(ped.x, ped.y, p.x, p.y);
        if (d > 26) {
          ped.x += Math.cos(ped.angle) * ped.speed * dt;
          ped.y += Math.sin(ped.angle) * ped.speed * dt;
        }
        if (d < 30) {
          ped.hold += dt;
          if (ped.hold >= CONFIG.wanted.bustHold) { bustPlayer(game); return; }
        } else ped.hold = 0;
        // Foot cops shoot at 3+ stars within 320 px.
        if (game.wanted.stars >= CONFIG.wanted.shootStars && d < CONFIG.wanted.copShootRange) {
          ped.shootTimer = (ped.shootTimer || 0) - dt;
          if (ped.shootTimer <= 0) {
            ped.shootTimer = CONFIG.wanted.policeShotCd;
            game.bullets.push({
              x: ped.x, y: ped.y,
              angle: angTo(ped.x, ped.y, p.x, p.y) + game.rng.range(-0.18, 0.18),
              speed: CONFIG.player.bulletSpeed, from: 'police', life: 1.2,
            });
          }
        }
      } else {
        // Player is driving: cops run after the car but can't catch it.
        ped.angle = angTo(ped.x, ped.y, p.x, p.y);
        ped.x += Math.cos(ped.angle) * ped.speed * dt;
        ped.y += Math.sin(ped.angle) * ped.speed * dt;
        ped.hold = 0;
      }
      continue;
    }
    if (ped.state === 'wait') continue; // taxi client / mission client
    if (ped.state === 'flee') {
      ped.fleeTimer -= dt;
      ped.x += Math.cos(ped.angle) * 200 * dt;
      ped.y += Math.sin(ped.angle) * 200 * dt;
      const fixed = pushOutOfBuildings(game.city, ped.x, ped.y, 10);
      ped.x = fixed.x; ped.y = fixed.y;
      ped.x = clamp(ped.x, 115, W - 10); ped.y = clamp(ped.y, 10, H - 10);
      if (ped.fleeTimer <= 0) { ped.state = 'walk'; ped.tx = ped.x; ped.ty = ped.y; }
      continue;
    }
    // Stroll between random nearby points.
    if (dist(ped.x, ped.y, ped.tx, ped.ty) < 12) {
      const np = nearestRoadPoint(game.city, ped.x, ped.y);
      ped.tx = clamp(np.x + game.rng.range(-260, 260), 320, W - 20);
      ped.ty = clamp(np.y + game.rng.range(-260, 260), 20, H - 20);
    }
    ped.angle = angTo(ped.x, ped.y, ped.tx, ped.ty);
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
    const fixed = pushOutOfBuildings(game.city, ped.x, ped.y, 10);
    ped.x = fixed.x; ped.y = fixed.y;
    ped.x = clamp(ped.x, 115, W - 10); ped.y = clamp(ped.y, 10, H - 10);
    // Flee from a speeding car.
    for (const car of game.cars) {
      if (car.speed > 150 && dist(ped.x, ped.y, car.x, car.y) < 90) {
        ped.state = 'flee';
        ped.fleeTimer = 2;
        ped.angle = angTo(car.x, car.y, ped.x, ped.y);
        break;
      }
    }
  }
}

// --------------------------------------------------------------- bullets ---

function updateBullets(game, dt) {
  for (const b of [...game.bullets]) {
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    b.life -= dt;
    let dead = b.life <= 0 || b.x < 0 || b.x > W || b.y < 0 || b.y > H;
    if (!dead && hitBuilding(game.city, b.x, b.y, 2)) {
      addParticles(game, b.x, b.y, 'spark', 3, '#ffcc33');
      dead = true;
    }
    if (!dead && b.from === 'player') {
      for (const ped of [...game.peds]) {
        if (dist(b.x, b.y, ped.x, ped.y) < 16) {
          ped.health -= CONFIG.player.pistolDmg;
          addParticles(game, b.x, b.y, 'spark', 4, '#ff5544');
          if (ped.health <= 0) {
            const i = game.peds.indexOf(ped);
            if (i >= 0) game.peds.splice(i, 1);
            commitCrime(game, ped.kind === 'cop' ? 2 : 1);
            setMessage(game, ped.kind === 'cop' ? 'You shot a cop! +2 stars' : 'Pedestrian down! +1 star');
            scatterPeds(game, b.x, b.y, 260);
          } else {
            ped.state = 'flee';
            ped.fleeTimer = 2.5;
            ped.angle = angTo(game.player.x, game.player.y, ped.x, ped.y);
          }
          dead = true;
          break;
        }
      }
      if (!dead) {
        for (const car of [...game.cars]) {
          if (car === game.player.car) continue;
          if (dist(b.x, b.y, car.x, car.y) < 26) {
            damageCar(game, car, CONFIG.player.pistolDmg);
            addParticles(game, b.x, b.y, 'spark', 4, '#ffcc33');
            dead = true;
            break;
          }
        }
      }
    }
    if (!dead && b.from === 'police') {
      if (dist(b.x, b.y, game.player.x, game.player.y) < 14) {
        damagePlayer(game, CONFIG.wanted.policeBulletDmg);
        dead = true;
      }
    }
    if (dead) {
      const i = game.bullets.indexOf(b);
      if (i >= 0) game.bullets.splice(i, 1);
    }
  }
}

function updateParticles(game, dt) {
  for (const pt of [...game.particles]) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.z += pt.vz * dt;
    if (pt.kind === 'spark') {
      pt.vz -= 500 * dt;
      if (pt.z < 0) { pt.z = 0; pt.vz = 0; }
    }
    pt.life -= dt;
    if (pt.life <= 0) {
      const i = game.particles.indexOf(pt);
      if (i >= 0) game.particles.splice(i, 1);
    }
  }
}

// ---------------------------------------------------------------- player ---

function nearestEnterableCar(game, maxDist) {
  const p = game.player;
  let best = null, bestD = maxDist;
  for (const car of game.cars) {
    if (car.kind === 'police' || car.health <= 0) continue; // police cars cannot be stolen
    const d = dist(p.x, p.y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function enterCar(game, car) {
  const p = game.player;
  const m = game.mission;
  const isMissionCar = car.missionCar
    && m && m.def.steps[m.step] && m.def.steps[m.step].kind === 'steal';
  if (!car.owned) {
    commitCrime(game, 1);
    game.stats.carsStolen++;
    setMessage(game, 'Car stolen! +1 star');
    car.owned = true; // it's yours now — getting back in costs no star
    if (car.kind === 'traffic') {
      // Pull the driver out — they flee on foot.
      const driver = spawnPed(game, car.x + 20, car.y);
      driver.state = 'flee';
      driver.fleeTimer = 3;
      driver.angle = game.rng.range(0, TAU);
    }
  }
  car.kind = 'player';
  car.speed = 0; car.vx = 0; car.vy = 0;
  p.onFoot = false;
  p.car = car;
  p.angle = car.angle;
  if (isMissionCar) {
    if (car.missionCar === 'goldtruck') {
      game.wanted.stars = 4;
      game.wanted.quietTimer = 0;
      game.wanted.decayTimer = 0;
      setMessage(game, 'Gold truck stolen! 4 stars — lose the cops!');
    } else {
      setMessage(game, 'Sportscar stolen — deliver it to the Chop Shop!');
    }
    car.missionCar = null;
    completeStep(game);
  }
  if (game.audio) game.audio.pickup();
}

function exitCar(game) {
  const p = game.player;
  const car = p.car;
  if (!car) return;
  car.kind = 'parked';
  car.speed = 0; car.vx = 0; car.vy = 0;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  const fixed = pushOutOfBuildings(game.city, p.x, p.y, 12);
  p.x = fixed.x; p.y = fixed.y;
  p.x = clamp(p.x, 115, W - 10); p.y = clamp(p.y, 10, H - 10);
  p.onFoot = true;
  p.car = null;
  p.angle = car.angle;
}

function updatePlayerFoot(game, input, dt) {
  const p = game.player;
  const pc = CONFIG.player;
  let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const mag = Math.hypot(dx, dy);
  p.moving = mag > 0;
  if (mag > 0) {
    dx /= mag; dy /= mag;
    const speed = input.run ? pc.run : pc.walk;
    p.x += dx * speed * dt;
    p.y += dy * speed * dt;
    p.speed = speed;
    if (p.weapon !== 'pistol') p.angle = Math.atan2(dy, dx);
  } else {
    p.speed = 0;
  }
  if (p.weapon === 'pistol' && p.hasPistol) {
    p.angle = Math.atan2((input.aimY ?? p.y) - p.y, (input.aimX ?? p.x) - p.x);
  }
  // Collision: buildings, sea, world edge.
  const fixed = pushOutOfBuildings(game.city, p.x, p.y, 12);
  p.x = fixed.x; p.y = fixed.y;
  p.x = clamp(p.x, 115, W - 10);
  p.y = clamp(p.y, 10, H - 10);

  p.punchTimer = Math.max(0, p.punchTimer - dt);
  p.shootTimer = Math.max(0, p.shootTimer - dt);

  if (input.weapon1) p.weapon = 'fists';
  if (input.weapon2 && p.hasPistol) p.weapon = 'pistol';

  if (input.punch && p.punchTimer <= 0) {
    p.punchTimer = pc.punchCd;
    let best = null, bestD = pc.punchRange + 8;
    for (const ped of game.peds) {
      const d = dist(p.x, p.y, ped.x, ped.y);
      if (d < bestD) { bestD = d; best = ped; }
    }
    if (best) {
      best.health -= pc.punchDmg;
      if (best.health <= 0) {
        const i = game.peds.indexOf(best);
        if (i >= 0) game.peds.splice(i, 1);
        commitCrime(game, best.kind === 'cop' ? 2 : 1);
        setMessage(game, best.kind === 'cop' ? 'You knocked out a cop! +2 stars' : 'Pedestrian knocked out! +1 star');
        scatterPeds(game, p.x, p.y, 200);
      } else {
        best.state = 'flee';
        best.fleeTimer = 2;
        best.angle = angTo(p.x, p.y, best.x, best.y);
      }
    }
  }

  if (input.shoot && p.weapon === 'pistol' && p.hasPistol && p.shootTimer <= 0) {
    p.shootTimer = pc.pistolCd;
    const a = p.angle;
    game.bullets.push({
      x: p.x + Math.cos(a) * 20, y: p.y + Math.sin(a) * 20,
      angle: a, speed: pc.bulletSpeed, from: 'player', life: 1.5,
    });
    game.stats.shotsFired++;
    addParticles(game, p.x + Math.cos(a) * 24, p.y + Math.sin(a) * 24, 'muzzle', 2, '#ffdd55');
    scatterPeds(game, p.x, p.y, 260);
    if (game.audio) game.audio.shot();
  }

  if (input.enter) {
    const car = nearestEnterableCar(game, pc.enterRange);
    if (car) enterCar(game, car);
  }
}

function updatePlayerCar(game, input, dt) {
  const p = game.player;
  const car = p.car;
  if (!car || !game.cars.includes(car)) {
    p.car = null; p.onFoot = true;
    return;
  }
  driveCar(game, car, input, dt);
  if (!game.cars.includes(car)) return; // car wrecked inside driveCar
  p.x = car.x; p.y = car.y; p.angle = car.angle;
  p.speed = car.speed;
  p.moving = car.speed > 5;
  // Running over a pedestrian at speed is a crime.
  if (car.speed > 150) {
    for (const ped of [...game.peds]) {
      if (ped.kind === 'client') continue;
      if (dist(ped.x, ped.y, car.x, car.y) < 26) {
        const i = game.peds.indexOf(ped);
        if (i >= 0) game.peds.splice(i, 1);
        commitCrime(game, ped.kind === 'cop' ? 2 : 1);
        setMessage(game, 'Pedestrian hit! +1 star');
        addParticles(game, ped.x, ped.y, 'spark', 6, '#ff5544');
        scatterPeds(game, ped.x, ped.y, 220);
      }
    }
  }
  if (input.enter) exitCar(game);
}

// ------------------------------------------------------------------ step ---

export function stepGame(game, input, dt) {
  dt = clamp(dt || 1 / 60, 0, 0.05);
  input = input || {};

  if (input.mute && game.audio) game.audio.toggleMute();

  if (game.screen === 'title') {
    if (input.confirm) {
      game.screen = 'play';
      if (game.audio) game.audio.unlock();
      const next = nextMissionIndex(game);
      if (next >= 0) startMission(game, next);
      else setMessage(game, 'Free roam — Solmar Bay is yours.');
    }
    return;
  }

  if (game.screen === 'pause') {
    if (input.pause || input.confirm) game.screen = 'play';
    return;
  }

  if (game.screen === 'busted' || game.screen === 'wasted') {
    if (input.confirm) respawn(game, game.screen === 'wasted' ? 'hospital' : 'policehq');
    return;
  }

  // --- play ---
  game.time += dt;

  if (input.pause) {
    game.screen = 'pause';
    if (game.audio) { game.audio.engine(false, 0); game.audio.siren(false); }
    try { saveGame(game); } catch (e) { /* ignore */ }
    return;
  }
  if (input.radio && game.audio) {
    game.audio.setStation((game.audio.station + 1) % 3);
    setMessage(game, 'Radio: station ' + (game.audio.station + 1) + ' of 3');
  }
  // Enter with no job open starts (or retries) the next job.
  if (input.confirm && !game.mission) {
    const next = nextMissionIndex(game);
    if (next >= 0) startMission(game, next);
  }

  const p = game.player;
  if (p.onFoot) updatePlayerFoot(game, input, dt);
  else updatePlayerCar(game, input, dt);

  updateTraffic(game, dt);
  updatePolice(game, dt);
  collideCars(game);
  updatePeds(game, dt);
  updateBullets(game, dt);
  updateMission(game, dt);
  updateTaxi(game, dt);
  updateParticles(game, dt);

  // Wanted decay: 20 s quiet, then -1 star per 14 s, paused while
  // police are close.
  const w = game.wanted;
  if (w.stars > 0) {
    w.quietTimer += dt;
    if (w.quietTimer > CONFIG.wanted.quietAfter) {
      const nearPolice = game.cars.some((c) => c.kind === 'police' && dist(c.x, c.y, p.x, p.y) < CONFIG.wanted.policeNear)
        || game.peds.some((pd) => pd.kind === 'cop' && dist(pd.x, pd.y, p.x, p.y) < CONFIG.wanted.policeNear);
      if (!nearPolice) {
        w.decayTimer += dt;
        if (w.decayTimer >= CONFIG.wanted.decayEvery) {
          w.stars--;
          w.decayTimer = 0;
        }
      }
    }
  } else {
    w.quietTimer = 0;
    w.decayTimer = 0;
  }

  // Health regen 4/s after 8 quiet seconds.
  if (w.quietTimer > CONFIG.player.regenAfter && p.health > 0 && p.health < CONFIG.player.health) {
    p.health = Math.min(CONFIG.player.health, p.health + CONFIG.player.regen * dt);
  }

  // Engine hum follows the car.
  if (game.audio) {
    if (!p.onFoot && p.car) game.audio.engine(true, p.car.speed / CAR_MODELS[p.car.model].topSpeed);
    else game.audio.engine(false, 0);
  }

  // Camera shake + district + message fade.
  game.camera.shake = Math.max(0, game.camera.shake - dt * 1.8);
  game.district = districtAt(p.x, p.y);
  if (game.messageTimer > 0) {
    game.messageTimer -= dt;
    if (game.messageTimer <= 0) game.message = '';
  }

  // Safety net: health already at/below zero means wasted.
  if (p.health <= 0 && game.screen === 'play') {
    p.health = 0;
    game.screen = 'wasted';
    if (game.audio) game.audio.fail();
    setMessage(game, 'Wasted!');
  }
}
