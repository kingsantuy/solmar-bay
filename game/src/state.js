import { CONFIG, CAR_MODELS, LANDMARKS, WEAPONS, GARAGE, CREW, CALLSIGNS, MISSIONS } from './config.js';
import { generateCity, hitBuilding, pushOutOfBuildings, nearestRoadPoint, randomRoadPoint, districtAt } from './city.js';
import { createRng } from './rng.js';
import { saveGame } from './save.js';
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const CAR_COLORS = ['#c94f4f', '#4f7dc9', '#e8e8e8', '#2a7a5a', '#e67e22', '#8e44ad', '#f2c200', '#5a5a5a'];
const PED_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1', '#fd79a8', '#00cec9'];
const MISSION_CAR_SPOTS = { sport: [448, 2100, '#e5322d'], truck: [3900, 3260, '#d4af37'] };
let carSeq = 0;
function wdef(game, id) { return game.weapons.list.find((x) => x.id === id) || WEAPONS.find((x) => x.id === id); }
function maxHealth(game, car) { return car === game.player.car ? 100 + game.garage.armour * GARAGE.armourBonus : 100; }
function topSpeed(game, car) { const m = CAR_MODELS[car.model] || CAR_MODELS.sedan; return m.topSpeed + (car === game.player.car ? game.garage.engine * GARAGE.engineBonus : 0); }
function toast(game, text) { game.message = text; game.messageTimer = 6; }
function addTrauma(game, n) { game.camera.shake = Math.min(1, game.camera.shake + n); }
function addStars(game, n) { game.wanted.stars = Math.min(CONFIG.maxStars, game.wanted.stars + n); game.wanted.quietTimer = 0; }
function spawnParticle(game, kind, x, y, life, size, color) { if (game.particles.length > 220) return; game.particles.push({ kind, x, y, life, maxLife: life, size: size || 6, color: color || '#ffffff', vx: 0, vy: 0 }); }
function clampPos(game, x, y, r) { const c = pushOutOfBuildings(game.city, x, y, r); return { x: clamp(c.x, 115, CONFIG.world.w - 20), y: clamp(c.y, 20, CONFIG.world.h - 20) }; }
function mkCar(game, model, x, y, angle, kind, color) { return { id: 'car' + (carSeq++), model, x, y, angle, speed: 0, vx: 0, vy: 0, color, kind, health: 100, maxHealth: 100, owned: false, siren: false, missionCar: null, road: null, dir: 1, line: 0, cruise: 0, intId: -1, smokeTimer: 0, crashCd: 0, shotCd: 0, firing: 0, callsign: null, roadblock: false, patrol: false }; }
function sidewalkPoint(game) { const rng = game.rng; if (rng.chance(0.5)) { const r = rng.pick(CONFIG.roadsV); return { x: r + (rng.chance(0.5) ? 71 : -71), y: rng.range(150, CONFIG.world.h - 150) }; } const r = rng.pick(CONFIG.roadsH); return { x: rng.range(380, CONFIG.world.w - 150), y: r + (rng.chance(0.5) ? 71 : -71) }; }
function spawnTraffic(game, far) {
  const rng = game.rng;
  let x = 0, y = 0, road = 'v', dir = 1, line = 0, placed = false;
  for (let t = 0; t < 12; t++) {
    const p = randomRoadPoint(rng);
    const vert = CONFIG.roadsV.includes(p.x);
    if (far && dist(p.x, p.y, game.player.x, game.player.y) < 600) { if (t === 11) { /* fall through and take it */ } else continue; }
    if (vert) { road = 'v'; line = p.x; dir = rng.chance(0.5) ? 1 : -1; x = line + (dir > 0 ? -28 : 28); y = p.y; }
    else { road = 'h'; line = p.y; dir = rng.chance(0.5) ? 1 : -1; x = p.x; y = line + (dir > 0 ? 28 : -28); }
    placed = true;
    break;
  }
  if (!placed) { x = 2100; y = 2100; road = 'v'; line = 2100; dir = 1; }
  const models = ['sedan', 'taxi', 'van', 'classic', 'sedan', 'taxi', 'truck', 'classic'];
  const car = mkCar(game, rng.pick(models), x, y, road === 'v' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI), 'traffic', rng.pick(CAR_COLORS));
  car.road = road; car.dir = dir; car.line = line; car.cruise = rng.range(120, 210);
  game.cars.push(car);
  return car;
}
function spawnParked(game) {
  const rng = game.rng;
  const models = ['sedan', 'classic', 'taxi', 'van', 'sedan', 'classic'];
  for (let i = 0; i < CONFIG.parkedCount; i++) {
    let x = 0, y = 0, angle = 0;
    for (let t = 0; t < 30; t++) {
      if (rng.chance(0.5)) { const r = rng.pick(CONFIG.roadsV); x = r + (rng.chance(0.5) ? 72 : -72); y = rng.range(200, 3400); angle = rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2; }
      else { const r = rng.pick(CONFIG.roadsH); x = rng.range(500, 4600); y = r + (rng.chance(0.5) ? 72 : -72); angle = rng.chance(0.5) ? 0 : Math.PI; }
      if (dist(x, y, 2440, 3240) > 200 && dist(x, y, 448, 2100) > 200) break;
    }
    game.cars.push(mkCar(game, rng.pick(models), x, y, angle, 'parked', rng.pick(CAR_COLORS)));
  }
}
export function createGame(seed, save, audio) {
  const city = generateCity(seed);
  const rng = createRng((seed * 2654435761) >>> 0);
  const game = {
    seed, rng, city, audio: audio || null, screen: 'title', time: 0, shotMode: false, hasSave: !!save, cameraSnap: false,
    player: { x: 2350, y: 3180, angle: -Math.PI / 2, onFoot: true, car: null, money: 0, health: CONFIG.playerHealth, moving: false, weapon: 'fists', hasPistol: false, speed: 0, punchCd: 0, shootCd: 0, hitFlash: 0 },
    cars: [], peds: [], bullets: [], particles: [],
    heli: { active: false, x: 0, y: 0, z: 120, angle: 0, rotor: 0 },
    wanted: { stars: 0, quietTimer: 0, decayTimer: 0 },
    mission: null, missionIndex: 0, completedMissions: [],
    stats: { carsStolen: 0, shotsFired: 0, missionsDone: 0, fares: 0, moneyEarned: 0 },
    message: '', messageTimer: 0, district: 'Marina', banner: '', bannerTimer: 0,
    camera: { shake: 0 },
    taxi: { active: false, state: '', client: null, destX: 0, destY: 0, timer: 30 },
    weapons: { list: WEAPONS.map((w) => ({ ...w })), cur: 0 },
    respect: { pts: 0 },
    garage: { engine: 0, armour: 0, paint: 0 },
    roadblocks: [], dispatch: [],
    ui: { wheel: false, garage: false },
    dialogue: null, policeTimer: 0, copTimer: 0, callsignN: 0, gunshotTimer: 0,
  };
  for (let i = 0; i < CONFIG.trafficCount; i++) spawnTraffic(game, false);
  spawnParked(game);
  const starter = mkCar(game, 'sedan', 2440, 3240, 0, 'player', '#4f7dc9');
  starter.owned = true;
  game.cars.push(starter);
  for (let i = 0; i < CONFIG.pedCount; i++) {
    const sp = sidewalkPoint(game);
    const tp = sidewalkPoint(game);
    game.peds.push({ x: sp.x, y: sp.y, angle: rng.range(0, TAU), kind: 'civilian', state: 'walk', speed: rng.range(40, 70), color: rng.pick(PED_COLORS), health: 100, tx: tp.x, ty: tp.y, hold: 0, fleeTimer: 0, shootCd: 0 });
  }
  if (save) {
    game.player.money = save.money || 0;
    game.completedMissions = (save.completed || []).slice();
    game.missionIndex = Math.min(save.missionIndex || 0, MISSIONS.length);
    if (save.stats) Object.assign(game.stats, save.stats);
    if (typeof save.respect === 'number') game.respect.pts = save.respect;
    if (save.garage) Object.assign(game.garage, save.garage);
    if (save.weapons) {
      for (const id of save.weapons.owned || []) { const w = game.weapons.list.find((x) => x.id === id); if (w) w.owned = true; }
      game.weapons.cur = clamp(save.weapons.cur || 0, 0, game.weapons.list.length - 1);
      game.player.weapon = game.weapons.list[game.weapons.cur].id;
    }
    game.player.hasPistol = !!game.weapons.list.find((x) => x.id === 'pistol' && x.owned);
    if (save.pos) { game.player.x = save.pos.x; game.player.y = save.pos.y; }
  }
  return game;
}
function nearestCar(game, x, y, range) { let best = null, bd = range; for (const c of game.cars) { const d = dist(x, y, c.x, c.y); if (d < bd) { bd = d; best = c; } } return best; }
function nearestPed(game, x, y, range) { let best = null, bd = range; for (const pd of game.peds) { const d = dist(x, y, pd.x, pd.y); if (d < bd) { bd = d; best = pd; } } return best; }
function nearChopshop(game) { return dist(game.player.x, game.player.y, LANDMARKS.chopshop.x, LANDMARKS.chopshop.y) < 320; }
function tryOpenGarage(game) {
  if (!nearChopshop(game)) return false;
  const p = game.player;
  if (p.onFoot || !p.car) { toast(game, 'Drive your car into the Chop Shop to tune it'); return false; }
  game.ui.garage = true;
  return true;
}
function hurtPlayer(game, dmg) {
  const p = game.player;
  if (p.health <= 0) return;
  p.health -= dmg;
  p.hitFlash = 0.4;
  addTrauma(game, 0.2);
  if (p.health <= 0) { p.health = 0; game.screen = 'wasted'; if (game.audio) game.audio.fail(); }
}
function hurtPed(game, pd, dmg) {
  pd.health -= dmg;
  spawnParticle(game, 'spark', pd.x, pd.y, 0.25, 6, '#ff5a5a');
  if (pd.health > 0) { if (pd.kind === 'civilian' || pd.kind === 'client') { pd.state = 'flee'; pd.fleeTimer = 2.5; } return; }
  game.peds = game.peds.filter((x) => x !== pd);
  if (pd === game.taxi.client) cancelTaxi(game);
  toast(game, pd.kind === 'cop' ? 'Cop down! +2 stars' : 'Pedestrian down! +1 star');
}
function damageCar(game, car, amount, impact) {
  if (!car || car.health <= 0) return;
  car.health -= amount;
  if (impact && (car.crashCd || 0) <= 0) {
    car.crashCd = 0.5;
    car.vx *= 0.5; car.vy *= 0.5;
    if (car === game.player.car) { addTrauma(game, 0.25); if (game.audio) game.audio.crash(); }
    spawnParticle(game, 'spark', car.x, car.y, 0.3, 6, '#ffd24a');
  }
  if (car.health <= 0) wreckCar(game, car);
}
function wreckCar(game, car) {
  game.cars = game.cars.filter((c) => c !== car);
  spawnParticle(game, 'smoke', car.x, car.y, 1, 20, '#555555');
  if (car === game.player.car) {
    const p = game.player;
    p.car = null; p.onFoot = true; p.x = car.x; p.y = car.y;
    toast(game, 'Your car is wrecked!');
    if (game.audio) game.audio.crash();
  } else if (car.kind === 'traffic') spawnTraffic(game, true);
  else if (car.missionCar && MISSION_CAR_SPOTS[car.missionCar]) {
    const s = MISSION_CAR_SPOTS[car.missionCar];
    spawnMissionCar(game, car.missionCar, s[0], s[1], s[2]);
  }
}
function spawnMissionCar(game, kind, x, y, color) {
  if (game.cars.some((c) => c.missionCar === kind)) return;
  const car = mkCar(game, kind === 'sport' ? 'sport' : 'truck', x, y, 0, 'parked', color);
  car.missionCar = kind;
  game.cars.push(car);
}
function scarePeds(game, x, y, radius) { for (const pd of game.peds) { if ((pd.kind === 'civilian' || pd.kind === 'client') && dist(pd.x, pd.y, x, y) < radius) { pd.state = 'flee'; pd.fleeTimer = 2; } } }
function fireBullet(game, x, y, angle, dmg, fromPlayer) {
  const sp = fromPlayer ? CONFIG.bulletSpeed : CONFIG.policeBulletSpeed;
  game.bullets.push({ x: x + Math.cos(angle) * 20, y: y + Math.sin(angle) * 20, angle, vx: Math.cos(angle) * sp, vy: Math.sin(angle) * sp, life: 1.5, dmg, fromPlayer });
  if (!fromPlayer) return;
  game.stats.shotsFired++;
  game.gunshotTimer = 1.5;
  spawnParticle(game, 'muzzle', x + Math.cos(angle) * 24, y + Math.sin(angle) * 24, 0.08, 8, '#ffe08a');
  addTrauma(game, 0.05);
  scarePeds(game, x, y, 320);
  if (game.audio) game.audio.shot();
}
function canFire(game) { const w = wdef(game, game.player.weapon); return !!w && (w.owned || (game.player.weapon === 'pistol' && game.player.hasPistol)); }
function driveCar(game, car, ctl, dt) {
  const m = CAR_MODELS[car.model] || CAR_MODELS.sedan;
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  let f = car.vx * fx + car.vy * fy;
  let l = car.vx * (-fy) + car.vy * fx;
  if (ctl.up) f += m.accel * dt;
  if (ctl.down) f -= (f > 0 ? m.accel * 1.2 : m.accel * 0.6) * dt;
  f -= f * 0.25 * dt;
  const top = topSpeed(game, car);
  if (f > top) f = top;
  if (f < -top * 0.45) f = -top * 0.45;
  const steer = ((ctl.right ? 1 : 0) - (ctl.left ? 1 : 0)) * 2.4 * Math.min(1, Math.abs(f) / 160) * (f >= 0 ? 1 : -1);
  car.angle += steer * dt;
  const grip = ctl.handbrake ? 1.5 : m.grip;
  l *= Math.exp(-grip * dt);
  const nx = Math.cos(car.angle), ny = Math.sin(car.angle);
  car.vx = nx * f - ny * l; car.vy = ny * f + nx * l;
  car.x += car.vx * dt; car.y += car.vy * dt;
  car.speed = Math.hypot(car.vx, car.vy);
  const ox = car.x, oy = car.y;
  const cl = pushOutOfBuildings(game.city, car.x, car.y, 24);
  car.x = clamp(cl.x, 115, CONFIG.world.w - 20); car.y = clamp(cl.y, 20, CONFIG.world.h - 20);
  if ((cl.x !== ox || cl.y !== oy) && car.speed > 120) damageCar(game, car, car.speed * 0.02, true);
}
function enterCar(game, car) {
  const p = game.player;
  if (car.kind === 'traffic') { ejectDriver(game, car); addStars(game, 1); game.stats.carsStolen++; toast(game, 'Carjacked! +1 star'); }
  else if (car.kind === 'parked' && !car.owned) { addStars(game, 1); game.stats.carsStolen++; toast(game, 'Car stolen! +1 star'); }
  car.kind = 'player'; car.owned = true;
  p.car = car; p.onFoot = false; p.x = car.x; p.y = car.y; p.angle = car.angle;
  if (game.garage.paint > 0) car.color = CONFIG.paintColors[game.garage.paint % CONFIG.paintColors.length];
  car.maxHealth = maxHealth(game, car);
  const step = game.mission ? game.mission.def.steps[game.mission.step] : null;
  if (step && step.kind === 'steal' && car.missionCar === step.car) advanceMission(game);
}
function ejectDriver(game, car) {
  game.peds.push({ x: car.x + 30, y: car.y, angle: 0, kind: 'civilian', state: 'flee', speed: 60, color: '#e67e22', health: 100, tx: car.x, ty: car.y, hold: 0, fleeTimer: 3, shootCd: 0 });
}
function exitCar(game) {
  const p = game.player; const car = p.car;
  if (!car) return;
  car.kind = 'parked'; car.speed = 0; car.vx = 0; car.vy = 0;
  p.car = null; p.onFoot = true;
  p.x = car.x - Math.sin(car.angle) * 40; p.y = car.y + Math.cos(car.angle) * 40;
  const cl = clampPos(game, p.x, p.y, CONFIG.playerRadius); p.x = cl.x; p.y = cl.y;
  p.angle = car.angle;
}
function updatePlayer(game, input, dt) {
  const p = game.player;
  p.punchCd = Math.max(0, p.punchCd - dt); p.shootCd = Math.max(0, p.shootCd - dt);
  if (input.enter) {
    if (p.onFoot) {
      const car = nearestCar(game, p.x, p.y, 64);
      if (car) { if (car.kind === 'police') toast(game, 'You can\'t steal a police car'); else enterCar(game, car); }
    } else if (nearChopshop(game)) game.ui.garage = true;
    else exitCar(game);
    if (game.ui.garage) return;
  }
  if (p.onFoot) {
    let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const mag = Math.hypot(mx, my);
    p.moving = mag > 0;
    if (mag > 0) {
      mx /= mag; my /= mag;
      const sp = input.run ? CONFIG.runSpeed : CONFIG.walkSpeed;
      p.x += mx * sp * dt; p.y += my * sp * dt;
      p.speed = sp;
    } else p.speed = 0;
    if (p.weapon !== 'fists' && (input.aimX || input.aimY)) p.angle = Math.atan2(input.aimY - p.y, input.aimX - p.x);
    else if (mag > 0) p.angle = Math.atan2(my, mx);
    const cl = clampPos(game, p.x, p.y, CONFIG.playerRadius); p.x = cl.x; p.y = cl.y;
    if ((input.punch || (input.shoot && p.weapon === 'fists')) && p.punchCd <= 0) {
      p.punchCd = CONFIG.punchRate;
      const target = nearestPed(game, p.x, p.y, CONFIG.punchReach);
      if (target) { addStars(game, target.kind === 'cop' ? 2 : 1); hurtPed(game, target, CONFIG.punchDmg); }
      addTrauma(game, 0.06);
    }
    if (input.shoot && p.weapon !== 'fists' && p.shootCd <= 0 && canFire(game)) {
      const w = wdef(game, p.weapon);
      p.shootCd = w.rate;
      fireBullet(game, p.x, p.y, Math.atan2(input.aimY - p.y, input.aimX - p.x), w.dmg, true);
    }
    if (game.audio) game.audio.engine(false, 0);
  } else {
    driveCar(game, p.car, input, dt);
    p.x = p.car.x; p.y = p.car.y; p.angle = p.car.angle; p.speed = p.car.speed; p.moving = p.car.speed > 5;
    if (game.audio) game.audio.engine(true, p.car.speed / topSpeed(game, p.car));
  }
}
function aheadGap(a, b) {
  if (!a.road || a.road !== b.road || a.dir !== b.dir || a.line !== b.line) return -1;
  if (a.road === 'v') { if (Math.abs(b.x - a.x) > 60) return -1; return (b.y - a.y) * a.dir; }
  if (Math.abs(b.y - a.y) > 60) return -1;
  return (b.x - a.x) * a.dir;
}
function moveAlongRoad(game, car, dt, sp) {
  const speed = sp === undefined ? car.cruise : sp;
  if (car.road === 'v') {
    car.y += car.dir * speed * dt;
    car.x = car.line + (car.dir > 0 ? -28 : 28);
    for (const r of CONFIG.roadsH) {
      if (Math.abs(car.y - r) < 26 && car.intId !== r) { car.intId = r; if (game.rng.chance(0.33)) { car.road = 'h'; car.line = r; car.dir = game.rng.chance(0.5) ? 1 : -1; car.y = r + (car.dir > 0 ? 28 : -28); car.intId = -1; } break; }
    }
    if (car.intId !== -1 && !CONFIG.roadsH.some((r) => Math.abs(car.y - r) < 60)) car.intId = -1;
    if (car.y < -40) car.y = CONFIG.world.h + 40;
    if (car.y > CONFIG.world.h + 40) car.y = -40;
  } else {
    car.x += car.dir * speed * dt;
    car.y = car.line + (car.dir > 0 ? 28 : -28);
    for (const r of CONFIG.roadsV) {
      if (Math.abs(car.x - r) < 26 && car.intId !== r) { car.intId = r; if (game.rng.chance(0.33)) { car.road = 'v'; car.line = r; car.dir = game.rng.chance(0.5) ? 1 : -1; car.x = r + (car.dir > 0 ? -28 : 28); car.intId = -1; } break; }
    }
    if (car.intId !== -1 && !CONFIG.roadsV.some((r) => Math.abs(car.x - r) < 60)) car.intId = -1;
    if (car.x < -40) car.x = CONFIG.world.w + 40;
    if (car.x > CONFIG.world.w + 40) car.x = -40;
  }
  car.angle = car.road === 'v' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
  car.vx = Math.cos(car.angle) * speed; car.vy = Math.sin(car.angle) * speed; car.speed = speed;
}
function updateTraffic(game, dt) {
  for (const car of [...game.cars]) {
    if (car.kind !== 'traffic') continue;
    let sp = car.cruise;
    for (const o of game.cars) { if (o !== car) { const gap = aheadGap(car, o); if (gap > 0 && gap < 130) { sp = 50; break; } } }
    moveAlongRoad(game, car, dt, sp);
  }
}
function spawnPolice(game) {
  const p = game.player;
  let bx = 0, by = 0, found = false;
  for (let t = 0; t < 14 && !found; t++) {
    const rp = randomRoadPoint(game.rng);
    const d = dist(rp.x, rp.y, p.x, p.y);
    if (d >= CONFIG.policeSpawnMin && d <= CONFIG.policeSpawnMax) { bx = rp.x; by = rp.y; found = true; }
  }
  if (!found) { const a = game.rng.range(0, TAU); const np = nearestRoadPoint(game.city, p.x + Math.cos(a) * 750, p.y + Math.sin(a) * 750); bx = np.x; by = np.y; }
  const cs = CALLSIGNS[game.callsignN % CALLSIGNS.length]; game.callsignN++;
  const car = mkCar(game, 'police', bx, by, Math.atan2(p.y - by, p.x - bx), 'police', '#20242c');
  car.siren = true; car.callsign = cs;
  game.cars.push(car);
}
function updatePolice(game, dt) {
  const p = game.player;
  const wanted = game.wanted.stars;
  const cops = game.cars.filter((c) => c.kind === 'police' && !c.roadblock);
  const desired = wanted > 0 ? Math.min(CONFIG.maxPolice, 1 + Math.floor(wanted / 2)) : 0;
  game.policeTimer += dt;
  if (wanted > 0 && cops.length < desired && game.policeTimer >= CONFIG.policeSpawnEvery) { game.policeTimer = 0; spawnPolice(game); }
  game.copTimer += dt;
  if (wanted >= 2 && game.copTimer >= 3) {
    game.copTimer = 0;
    if (game.peds.filter((pd) => pd.kind === 'cop').length < 3) {
      const a = game.rng.range(0, TAU);
      const np = nearestRoadPoint(game.city, p.x + Math.cos(a) * 350, p.y + Math.sin(a) * 350);
      game.peds.push({ x: np.x, y: np.y, angle: 0, kind: 'cop', state: 'chase', speed: 240, color: '#1c2b4a', health: 100, tx: p.x, ty: p.y, hold: 0, fleeTimer: 0, shootCd: 0 });
    }
  }
  for (const car of [...game.cars]) {
    if (car.kind !== 'police') continue;
    car.crashCd = Math.max(0, (car.crashCd || 0) - dt);
    car.firing = Math.max(0, (car.firing || 0) - dt);
    car.shotCd = Math.max(0, (car.shotCd || 0) - dt);
    if (car.roadblock) continue;
    const d = dist(car.x, car.y, p.x, p.y);
    if (wanted === 0) {
      if (car.patrol) { moveAlongRoad(game, car, dt); continue; }
      if (d > CONFIG.policeDespawn) { game.cars = game.cars.filter((c) => c !== car); continue; }
      const want = Math.atan2(car.y - p.y, car.x - p.x);
      const diff = angDiff(want, car.angle);
      driveCar(game, car, { up: true, down: false, left: diff < -0.08, right: diff > 0.08, handbrake: false }, dt);
      continue;
    }
    if (car.patrol) { /* patrol cars chase like the rest once the heat is on */ }
    const want = Math.atan2(p.y - car.y, p.x - car.x);
    const diff = angDiff(want, car.angle);
    const fwd = car.vx * Math.cos(car.angle) + car.vy * Math.sin(car.angle);
    const des = p.onFoot ? clamp((d - 340) / 300, 0, 1) * 500 : 500;
    driveCar(game, car, { up: fwd < des, down: fwd > des + 20, left: diff < -0.08, right: diff > 0.08, handbrake: false }, dt);
    if (d < 60) {
      if (p.onFoot) { hurtPlayer(game, 15); p.x += (p.x - car.x) * 0.2; p.y += (p.y - car.y) * 0.2; }
      else if (car.speed > 80 || p.car.speed > 80) { damageCar(game, p.car, 8, true); car.vx *= -0.3; car.vy *= -0.3; }
    }
    if (wanted >= 3 && d < CONFIG.policeShootRange && car.shotCd <= 0) {
      car.shotCd = CONFIG.policeShotEvery; car.firing = 0.5;
      const aim = Math.atan2(p.y - car.y, p.x - car.x) + (game.rng.next() - 0.5) * 0.24;
      fireBullet(game, car.x, car.y, aim, CONFIG.policeBulletDmg, false);
    }
  }
}
function updateHeli(game, dt) {
  const h = game.heli; const p = game.player;
  h.active = game.wanted.stars >= CONFIG.heliFromStars;
  if (!h.active) return;
  h.angle += dt * 0.5;
  h.x = p.x + Math.cos(h.angle) * 260;
  h.y = p.y + Math.sin(h.angle) * 260;
  h.z = 120;
  h.rotor += dt * 25;
}
function updateCarCollisions(game) {
  const cars = [...game.cars];
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      if (!game.cars.includes(a) || !game.cars.includes(b)) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = 48;
      if (d >= min || d === 0) continue;
      const push = (min - d) / 2;
      const nx = dx / d, ny = dy / d;
      const rel = Math.abs((a.vx - b.vx) * nx + (a.vy - b.vy) * ny);
      if (a.roadblock) { b.x += nx * push * 2; b.y += ny * push * 2; }
      else if (b.roadblock) { a.x -= nx * push * 2; a.y -= ny * push * 2; }
      else { a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push; }
      if (rel > 120) {
        if (a === game.player.car) damageCar(game, a, rel * 0.03, true);
        if (b === game.player.car) damageCar(game, b, rel * 0.03, true);
      }
    }
  }
}
function updatePedCarHits(game) {
  const p = game.player;
  if (p.onFoot || !p.car) return;
  for (const pd of [...game.peds]) {
    if (dist(pd.x, pd.y, p.car.x, p.car.y) < 40 && p.car.speed > 120) {
      addStars(game, pd.kind === 'cop' ? 2 : 1);
      hurtPed(game, pd, 200);
      addTrauma(game, 0.15);
    }
  }
}
function updatePeds(game, dt) {
  const p = game.player;
  for (const pd of [...game.peds]) {
    if (pd.kind === 'cop') {
      const d = dist(pd.x, pd.y, p.x, p.y);
      if (game.wanted.stars === 0 && d > 800) { game.peds = game.peds.filter((x) => x !== pd); continue; }
      const a = Math.atan2(p.y - pd.y, p.x - pd.x);
      pd.angle = a;
      if (d > 26) { pd.x += Math.cos(a) * pd.speed * dt; pd.y += Math.sin(a) * pd.speed * dt; }
      if (d < 30 && p.onFoot) {
        pd.hold = (pd.hold || 0) + dt;
        if (pd.hold >= CONFIG.bustHold) { game.screen = 'busted'; if (game.audio) game.audio.fail(); return; }
      } else pd.hold = Math.max(0, (pd.hold || 0) - dt);
      pd.shootCd = Math.max(0, (pd.shootCd || 0) - dt);
      if (game.wanted.stars >= 3 && d < CONFIG.copShootRange && pd.shootCd <= 0) {
        pd.shootCd = CONFIG.policeShotEvery;
        const aim = Math.atan2(p.y - pd.y, p.x - pd.x) + (game.rng.next() - 0.5) * 0.3;
        fireBullet(game, pd.x, pd.y, aim, CONFIG.policeBulletDmg, false);
      }
      const cl = clampPos(game, pd.x, pd.y, 12); pd.x = cl.x; pd.y = cl.y;
      continue;
    }
    if (pd.kind === 'client') continue;
    if (pd.state === 'flee') {
      pd.fleeTimer -= dt;
      const a = Math.atan2(pd.y - p.y, pd.x - p.x);
      pd.angle = a;
      pd.x += Math.cos(a) * 200 * dt; pd.y += Math.sin(a) * 200 * dt;
      if (pd.fleeTimer <= 0) pd.state = 'walk';
    } else {
      const d = dist(pd.x, pd.y, pd.tx, pd.ty);
      if (d < 20) { const np = sidewalkPoint(game); pd.tx = np.x; pd.ty = np.y; }
      const a = Math.atan2(pd.ty - pd.y, pd.tx - pd.x);
      pd.angle = a;
      pd.x += Math.cos(a) * pd.speed * dt; pd.y += Math.sin(a) * pd.speed * dt;
      if (game.gunshotTimer > 0 && dist(pd.x, pd.y, p.x, p.y) < 320) { pd.state = 'flee'; pd.fleeTimer = 2; }
      if (!p.onFoot && p.car && p.car.speed > 150 && dist(pd.x, pd.y, p.car.x, p.car.y) < 60) { pd.state = 'flee'; pd.fleeTimer = 2; }
    }
    const cl = clampPos(game, pd.x, pd.y, 12); pd.x = cl.x; pd.y = cl.y;
  }
}
function updateBullets(game, dt) {
  const p = game.player;
  for (const b of [...game.bullets]) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && hitBuilding(game.city, b.x, b.y, 2)) { spawnParticle(game, 'spark', b.x, b.y, 0.2, 5, '#ffd24a'); dead = true; }
    if (!dead && b.fromPlayer) {
      for (const pd of [...game.peds]) {
        if (dist(b.x, b.y, pd.x, pd.y) < 18) {
          addStars(game, pd.kind === 'cop' ? 2 : 1);
          hurtPed(game, pd, b.dmg);
          spawnParticle(game, 'spark', b.x, b.y, 0.25, 6, '#ff5a5a');
          dead = true; break;
        }
      }
      if (!dead) {
        for (const car of [...game.cars]) {
          if (car === p.car) continue;
          if (dist(b.x, b.y, car.x, car.y) < 34) {
            if (car.kind === 'police') { addStars(game, 1); toast(game, 'You shot a police car! +1 star'); }
            damageCar(game, car, b.dmg, false);
            spawnParticle(game, 'spark', b.x, b.y, 0.25, 6, '#ffd24a');
            dead = true; break;
          }
        }
      }
    }
    if (!dead && !b.fromPlayer) {
      if (dist(b.x, b.y, p.x, p.y) < 18) {
        if (p.onFoot) hurtPlayer(game, b.dmg);
        else if (p.car) damageCar(game, p.car, b.dmg, false);
        dead = true;
      }
    }
    if (dead) game.bullets = game.bullets.filter((x) => x !== b);
  }
}
function currentStep(game) { return game.mission ? game.mission.def.steps[game.mission.step] : null; }
function startMission(game, index) {
  if (index >= MISSIONS.length) { game.mission = null; return; }
  const def = MISSIONS[index];
  game.mission = { index, def, step: 0, timer: def.timeLimit || null, active: true };
  game.missionIndex = index;
  if (def.id === 'night-shift') { game.wanted.stars = 2; game.wanted.quietTimer = 0; }
  if (def.id === 'hot-wheels') spawnMissionCar(game, 'sport', 448, 2100, '#e5322d');
  if (def.id === 'the-big-one') spawnMissionCar(game, 'truck', 3900, 3260, '#d4af37');
  if (def.id === 'the-drop') spawnPatrols(game);
  const sp = CREW[def.speaker] || CREW.mara;
  game.dialogue = { name: sp.name, role: sp.role, init: sp.init, color: sp.color, text: def.line, timer: 6 };
  toast(game, def.briefing);
  if (game.audio) game.audio.pickup();
  enterStep(game);
}
function enterStep(game) {
  const step = currentStep(game);
  if (!step) return;
  if (step.kind === 'escape' && step.stars) { game.wanted.stars = step.stars; game.wanted.quietTimer = 0; toast(game, 'Lose the heat!'); }
}
function advanceMission(game) {
  const m = game.mission;
  if (!m) return;
  m.step++;
  if (m.step >= m.def.steps.length) { completeMission(game); return; }
  if (game.audio) game.audio.pickup();
  toast(game, m.def.steps[m.step].label);
  enterStep(game);
}
function completeMission(game) {
  const m = game.mission; const def = m.def;
  game.player.money += def.pay;
  game.stats.missionsDone++;
  game.stats.moneyEarned += def.pay;
  game.respect.pts += 100;
  game.completedMissions.push(def.id);
  const pistolEarned = def.id === 'hot-wheels';
  if (pistolEarned) { game.player.hasPistol = true; const w = game.weapons.list.find((x) => x.id === 'pistol'); if (w) w.owned = true; }
  removePatrols(game);
  saveGame(game);
  const next = m.index + 1;
  game.mission = null;
  if (next >= MISSIONS.length) { game.missionIndex = next; toast(game, 'Story complete — Solmar Bay is yours. Free roam!'); }
  else startMission(game, next);
  toast(game, 'Job done! +$' + def.pay + '  Respect +100' + (pistolEarned ? ' — pistol earned, press 2' : ''));
  if (game.audio) game.audio.success();
}
function failMission(game, why) {
  removePatrols(game);
  game.mission = null;
  toast(game, (why || 'Job failed') + ' — press Enter to retry');
  if (game.audio) game.audio.fail();
}
function updateMissions(game, dt) {
  const m = game.mission;
  if (!m) return;
  if (m.timer !== null && m.timer !== undefined) { m.timer -= dt; if (m.timer <= 0) { failMission(game, 'Out of time!'); return; } }
  const step = m.def.steps[m.step];
  if (!step) return;
  const p = game.player;
  if (step.kind === 'go') {
    if (step.onFoot && !p.onFoot) return;
    if (step.needStars !== undefined && game.wanted.stars > step.needStars) return;
    if (dist(p.x, p.y, step.x, step.y) < 120) {
      const wasHeistGrab = m.def.id === 'bay-heist' && m.step === 0;
      advanceMission(game);
      if (wasHeistGrab) { addStars(game, 2); toast(game, 'Cash grabbed! Lose the heat!'); }
    }
  } else if (step.kind === 'escape') {
    if (game.wanted.stars === 0) advanceMission(game);
  }
}
function spawnPatrols(game) {
  removePatrols(game);
  for (const [x, y, dir] of [[420, 1000, 1], [420, 2600, -1]]) {
    const car = mkCar(game, 'police', x, y, dir > 0 ? Math.PI / 2 : -Math.PI / 2, 'police', '#20242c');
    car.siren = true; car.patrol = true; car.road = 'v'; car.dir = dir; car.line = 420; car.cruise = 160;
    car.callsign = dir > 0 ? 'GULL-11' : 'CORAL-25';
    game.cars.push(car);
  }
}
function removePatrols(game) { game.cars = game.cars.filter((c) => !c.patrol); }
function cancelTaxi(game) { const t = game.taxi; if (t.client) game.peds = game.peds.filter((x) => x !== t.client); t.active = false; t.client = null; }
function updateTaxi(game, dt) {
  const t = game.taxi; const p = game.player;
  if (game.mission) { if (t.active) cancelTaxi(game); t.timer = game.rng.range(CONFIG.taxiMin, CONFIG.taxiMax); return; }
  if (!t.active) {
    t.timer -= dt;
    if (t.timer > 0) return;
    const cp = randomRoadPoint(game.rng);
    const dp = randomRoadPoint(game.rng);
    const client = { x: cp.x, y: cp.y, angle: 0, kind: 'client', state: 'wait', speed: 0, color: '#f2c200', health: 100, tx: cp.x, ty: cp.y, hold: 0, fleeTimer: 0, shootCd: 0 };
    game.peds.push(client);
    t.client = client; t.destX = dp.x; t.destY = dp.y; t.state = 'toClient'; t.active = true;
    toast(game, 'Taxi fare waiting — pick up the client');
    return;
  }
  if (t.state === 'toClient' && t.client) {
    if (!p.onFoot && p.car && dist(p.x, p.y, t.client.x, t.client.y) < 90) {
      game.peds = game.peds.filter((x) => x !== t.client);
      t.state = 'toDest';
      toast(game, 'Client aboard — take them to the destination');
      if (game.audio) game.audio.pickup();
    }
  } else if (t.state === 'toDest') {
    if (!p.onFoot && p.car && dist(p.x, p.y, t.destX, t.destY) < 90) {
      const fare = game.rng.int(CONFIG.fareMin, CONFIG.fareMax);
      p.money += fare; game.stats.fares++; game.stats.moneyEarned += fare; game.respect.pts += 15;
      toast(game, 'Fare paid! +$' + fare + '  Respect +15');
      if (game.audio) game.audio.cash();
      t.active = false; t.client = null; t.timer = game.rng.range(CONFIG.taxiMin, CONFIG.taxiMax);
    }
  }
}
function updateRoadblocks(game) {
  const p = game.player;
  if (game.wanted.stars < 4) {
    if (game.roadblocks.length) { game.cars = game.cars.filter((c) => !c.roadblock); game.roadblocks = []; }
    return;
  }
  while (game.roadblocks.length < 2) {
    const ahead = 650 + game.roadblocks.length * 350;
    const tx = p.x + Math.cos(p.angle) * ahead, ty = p.y + Math.sin(p.angle) * ahead;
    const np = nearestRoadPoint(game.city, tx, ty);
    if (game.roadblocks.some((r) => dist(r.x, r.y, np.x, np.y) < 200)) break;
    let dv = Infinity, dh = Infinity;
    for (const r of CONFIG.roadsV) dv = Math.min(dv, Math.abs(tx - r));
    for (const r of CONFIG.roadsH) dh = Math.min(dh, Math.abs(ty - r));
    const ang = dv <= dh ? Math.PI / 2 : 0;
    const ax = -Math.sin(ang), ay = Math.cos(ang);
    game.roadblocks.push({ x: np.x, y: np.y, ang });
    for (const s of [42, -42]) {
      const car = mkCar(game, 'police', np.x + ax * s, np.y + ay * s, ang + Math.PI / 2, 'police', '#20242c');
      car.siren = true; car.roadblock = true;
      car.callsign = CALLSIGNS[game.callsignN % CALLSIGNS.length]; game.callsignN++;
      game.cars.push(car);
    }
  }
}
function updateDispatch(game) {
  const p = game.player;
  const units = [];
  for (const c of game.cars) {
    if (c.kind !== 'police') continue;
    units.push({ name: c.callsign || 'UNIT', distM: Math.round(dist(c.x, c.y, p.x, p.y) / 10), status: c.roadblock ? 'ROADBLOCK' : (c.firing > 0 ? 'FIRING' : (c.patrol && game.wanted.stars === 0 ? 'PATROL' : 'RAMMING')) });
  }
  if (game.heli.active) units.push({ name: 'AIR-1', distM: Math.round(dist(game.heli.x, game.heli.y, p.x, p.y) / 10), status: 'SPOTLIGHT' });
  units.sort((a, b) => a.distM - b.distM);
  game.dispatch = units.slice(0, 5);
}
function updateParticles(game, dt) {
  for (const pt of [...game.particles]) {
    pt.life -= dt;
    pt.x += (pt.vx || 0) * dt; pt.y += (pt.vy || 0) * dt;
    if (pt.life <= 0) game.particles = game.particles.filter((x) => x !== pt);
  }
  for (const car of game.cars) {
    car.smokeTimer = Math.max(0, (car.smokeTimer || 0) - dt);
    if (car.health < 70 && car.smokeTimer <= 0) { car.smokeTimer = car.health < 45 ? 0.06 : 0.12; spawnParticle(game, 'smoke', car.x, car.y, 0.9, car.health < 45 ? 14 : 9, '#777777'); }
  }
}
function updateWanted(game, dt) {
  const w = game.wanted;
  if (w.stars <= 0) { w.stars = 0; return; }
  w.quietTimer += dt;
  const nearPolice = game.cars.some((c) => c.kind === 'police' && dist(c.x, c.y, game.player.x, game.player.y) < 200)
    || game.peds.some((pd) => pd.kind === 'cop' && dist(pd.x, pd.y, game.player.x, game.player.y) < 200);
  if (w.quietTimer > CONFIG.quietTime && !nearPolice) {
    w.decayTimer += dt;
    if (w.decayTimer >= CONFIG.decayEvery) { w.decayTimer = 0; w.stars--; if (w.stars === 0) toast(game, 'You lost the cops!'); }
  }
}
function respawn(game) {
  const p = game.player;
  const hosp = game.screen === 'wasted';
  p.money = Math.max(0, p.money - CONFIG.respawnCost);
  p.health = CONFIG.playerHealth;
  p.hitFlash = 0;
  if (p.car) { p.car.kind = 'parked'; p.car = null; }
  p.onFoot = true;
  p.x = hosp ? LANDMARKS.hospital.x : LANDMARKS.policehq.x;
  p.y = hosp ? LANDMARKS.hospital.y : LANDMARKS.policehq.y;
  p.angle = 0;
  game.wanted.stars = 0; game.wanted.quietTimer = 0; game.wanted.decayTimer = 0;
  game.heli.active = false;
  game.bullets = [];
  game.screen = 'play';
  game.cameraSnap = true;
  game.ui.wheel = false; game.ui.garage = false;
  toast(game, hosp ? 'Patched up at Solmar General — $100' : 'Released from Police HQ — $100');
}
function digitPressed(input) {
  if (input.weapon1) return 1;
  if (input.weapon2) return 2;
  if (input.weapon3) return 3;
  if (input.weapon4) return 4;
  if (input.weapon5) return 5;
  return 0;
}
export function selectWeapon(game, idx) {
  const list = game.weapons.list;
  if (idx < 0 || idx >= list.length) return false;
  const w = list[idx];
  if (w.id === 'pistol' && game.player.hasPistol) w.owned = true;
  if (!w.owned) { toast(game, w.reqRespect > 0 && game.respect.pts < w.reqRespect ? w.name + ' locked — need ' + w.reqRespect + ' respect' : w.name + ' not owned yet — open the wheel (Q) to buy it'); return false; }
  if (w.reqRespect > 0 && game.respect.pts < w.reqRespect) { toast(game, w.name + ' locked — need ' + w.reqRespect + ' respect'); return false; }
  game.weapons.cur = idx;
  game.player.weapon = w.id;
  return true;
}
export function buyWeapon(game, id) {
  const w = game.weapons.list.find((x) => x.id === id);
  if (!w) return false;
  if (w.owned) { selectWeapon(game, game.weapons.list.indexOf(w)); return true; }
  if (w.reqRespect > 0 && game.respect.pts < w.reqRespect) { toast(game, w.name + ' locked — need ' + w.reqRespect + ' respect'); return false; }
  if (game.player.money < w.price) { toast(game, 'Not enough cash for the ' + w.name); return false; }
  game.player.money -= w.price;
  w.owned = true;
  selectWeapon(game, game.weapons.list.indexOf(w));
  toast(game, w.name + ' bought for $' + w.price);
  if (game.audio) game.audio.cash();
  saveGame(game);
  return true;
}
export function buyGarage(game, item) {
  const p = game.player;
  if (!p.car) { toast(game, 'You need to be in a car'); return false; }
  const car = p.car;
  if (item === 'repair') {
    if (car.health >= maxHealth(game, car)) { toast(game, 'Already in perfect shape'); return false; }
    if (p.money < GARAGE.repair) { toast(game, 'Not enough cash for a repair'); return false; }
    p.money -= GARAGE.repair; car.health = maxHealth(game, car);
  } else if (item === 'paint') {
    if (p.money < GARAGE.paint) { toast(game, 'Not enough cash for a respray'); return false; }
    p.money -= GARAGE.paint; game.garage.paint = (game.garage.paint + 1) % CONFIG.paintColors.length;
    car.color = CONFIG.paintColors[game.garage.paint];
  } else if (item === 'engine') {
    if (game.garage.engine >= GARAGE.engineMax) { toast(game, 'Engine already maxed'); return false; }
    if (p.money < GARAGE.engine) { toast(game, 'Not enough cash for an engine tune'); return false; }
    p.money -= GARAGE.engine; game.garage.engine++;
  } else if (item === 'armour') {
    if (game.garage.armour >= GARAGE.armourMax) { toast(game, 'Armour already maxed'); return false; }
    if (p.money < GARAGE.armour) { toast(game, 'Not enough cash for armour'); return false; }
    p.money -= GARAGE.armour; game.garage.armour++;
    car.maxHealth = maxHealth(game, car); car.health = Math.min(car.maxHealth, car.health + GARAGE.armourBonus);
  } else return false;
  toast(game, 'Chop Shop: ' + item + ' done');
  if (game.audio) game.audio.cash();
  saveGame(game);
  return true;
}
export function stepGame(game, input, dt) {
  input = input || {};
  if (game.screen === 'title') { if (input.confirm) { game.screen = 'play'; startMission(game, game.missionIndex); if (game.audio) game.audio.unlock(); } return; }
  if (game.screen === 'pause') { if (input.confirm || input.pause) game.screen = 'play'; return; }
  if (game.screen === 'busted' || game.screen === 'wasted') { if (input.confirm) respawn(game); return; }
  if (game.screen !== 'play') return;
  if (game.player.health <= 0) { game.screen = 'wasted'; return; }
  if (game.ui.garage) { if (input.garage || input.pause || input.enter) game.ui.garage = false; return; }
  if (game.ui.wheel) {
    if (input.wheel || input.pause) game.ui.wheel = false;
    else { const dg = digitPressed(input); if (dg) { selectWeapon(game, dg - 1); game.ui.wheel = false; } }
    return;
  }
  let confirmUsed = false;
  if (game.dialogue) {
    game.dialogue.timer -= dt;
    if (game.dialogue.timer <= 0) game.dialogue = null;
    else if (input.confirm) { game.dialogue = null; confirmUsed = true; }
  }
  game.time += dt;
  if (input.pause) { game.screen = 'pause'; saveGame(game); return; }
  if (input.mute && game.audio) game.audio.toggleMute();
  if (input.radio && game.audio) game.audio.setStation(game.audio.station + 1);
  if (input.wheel) { game.ui.wheel = true; return; }
  if (input.garage) { if (tryOpenGarage(game)) return; }
  const dg = digitPressed(input);
  if (dg) selectWeapon(game, dg - 1);
  if (!game.mission && !confirmUsed && input.confirm && game.missionIndex < MISSIONS.length) startMission(game, game.missionIndex);
  updatePlayer(game, input, dt);
  if (game.screen !== 'play') return;
  updateTraffic(game, dt);
  updatePolice(game, dt);
  updateHeli(game, dt);
  updateCarCollisions(game);
  updatePedCarHits(game);
  updatePeds(game, dt);
  if (game.screen !== 'play') return;
  updateBullets(game, dt);
  if (game.screen !== 'play') return;
  updateMissions(game, dt);
  updateTaxi(game, dt);
  updateRoadblocks(game);
  updateDispatch(game);
  updateParticles(game, dt);
  updateWanted(game, dt);
  const p = game.player;
  if (game.wanted.quietTimer > CONFIG.regenDelay && p.health > 0 && p.health < CONFIG.playerHealth) p.health = Math.min(CONFIG.playerHealth, p.health + CONFIG.regenRate * dt);
  game.messageTimer = Math.max(0, game.messageTimer - dt);
  if (game.messageTimer === 0) game.message = '';
  game.bannerTimer = Math.max(0, game.bannerTimer - dt);
  game.gunshotTimer = Math.max(0, game.gunshotTimer - dt);
  p.hitFlash = Math.max(0, p.hitFlash - dt);
  game.camera.shake = Math.max(0, game.camera.shake - 1.2 * dt);
  const d = districtAt(p.x, p.y);
  if (d !== game.district) { game.district = d; if (!game.shotMode) { game.banner = d; game.bannerTimer = 2.5; } }
  if (game.audio) game.audio.siren(game.cars.some((c) => c.kind === 'police'));
}
