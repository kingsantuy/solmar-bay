// Staging the four screenshot scenes from a fresh game: place the player,
// police and traffic where the scene needs them, set wanted / mission state,
// then simulate a fixed number of steps with scripted inputs so the frame
// shows the game mid-action (a chase already running, a drive already
// moving, a mission already under way). Same seed, same frame.
// Only the state shape from state.js is used — cars are plain literals.
// Mission defs come from the logic layer's config (7 story jobs) so the
// staged scenes always match the real game.
import { MISSIONS } from './config.js';
import { stepGame } from './state.js';

export const SHOTS = [
  { name: 'cover', url: '?shot=cover&seed=1' },
  { name: 'drive', url: '?shot=drive&seed=1' },
  { name: 'onfoot', url: '?shot=onfoot&seed=1' },
  { name: 'mission', url: '?shot=mission&seed=1' },
];

export const SHOT_DEFS = [
  { name: 'cover', steps: 90, keys: ['up'] },
  { name: 'drive', steps: 90, keys: ['up'] },
  { name: 'onfoot', steps: 45, keys: ['up'] },
  { name: 'mission', steps: 40, keys: ['up'] },
];

function startMissionAt(game, index, step = 0) {
  const def = MISSIONS[index];
  game.mission = { index, def, step, timer: def.timeLimit || null, active: true };
}

let carSeq = 0;
function makeShotCar(model, x, y, angle, kind, color, speed = 0) {
  return {
    id: 'shot-' + (carSeq++) + '-' + model,
    model, x, y, angle, speed,
    color: color || '#c94f4f',
    kind, health: 100, owned: kind === 'player', siren: kind === 'police',
    vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
  };
}

function putPlayerInCar(game, car) {
  game.cars.push(car);
  const p = game.player;
  p.car = car;
  p.onFoot = false;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.speed = car.speed;
  p.moving = true;
}

function clearTrafficCorridor(game, x0, x1, y0, y1) {
  game.cars = (game.cars || []).filter(
    (c) => !(c.kind === 'traffic' && c.x > x0 && c.x < x1 && c.y > y0 && c.y < y1),
  );
}

function scriptedInput(held) {
  return {
    up: !!held.up, down: false, left: false, right: false,
    run: false, enter: false, handbrake: false, punch: false,
    shoot: false, aimX: 0, aimY: 0, weapon1: false, weapon2: false,
    pause: false, mute: false, confirm: false, radio: false,
  };
}

export function stageShot(game, name) {
  game.screen = 'play';
  if (game.camera) game.camera.shake = 0;
  const steps = (SHOT_DEFS.find((s) => s.name === name) || { steps: 60 }).steps;
  const input = scriptedInput({ up: true });

  if (name === 'cover') {
    // Three-star chase: player in a red sportscar on the downtown road,
    // three patrol cars closing in, helicopter overhead, first job on the
    // HUD. Drives in the eastbound lane (28 below the centre line) with
    // the corridor ahead cleared of traffic, so the chase reads.
    const car = makeShotCar('sport', 1800, 2128, 0, 'player', '#e5322d', 420);
    putPlayerInCar(game, car);
    clearTrafficCorridor(game, 1700, 2900, 2000, 2250);
    if (game.wanted) {
      game.wanted.stars = 3;
      game.wanted.quietTimer = 0;
      game.wanted.decayTimer = 0;
    }
    game.cars.push(makeShotCar('police', 2950, 2128, 0, 'police', '#20242c', 300));
    game.cars.push(makeShotCar('police', 3100, 2100, 0, 'police', '#20242c', 300));
    game.cars.push(makeShotCar('police', 2300, 2128, 0, 'police', '#20242c', 300));
    if (game.heli) Object.assign(game.heli, { active: true, x: 3200, y: 2000, z: 120, angle: 0, rotor: 0 });
    game.message = 'Lose the cops!';
    game.messageTimer = 6;
    startMissionAt(game, 0, 0);
  } else if (name === 'drive') {
    // Down the coastal avenue, northbound so the sea stays on the left:
    // sedan at ~77 km/h in the northbound lane (28 right of centre).
    const car = makeShotCar('sedan', 448, 2000, -Math.PI / 2, 'player', '#4f7dc9', 420);
    putPlayerInCar(game, car);
    clearTrafficCorridor(game, 330, 470, 1200, 2100);
    startMissionAt(game, 0, 0);
  } else if (name === 'onfoot') {
    // On foot downtown, among pedestrians and traffic, facing the
    // Grand Solmar Hotel to the east.
    const p = game.player;
    p.onFoot = true;
    p.car = null;
    p.x = 2100;
    p.y = 1610; // south sidewalk of the downtown road, facing the hotel
    p.angle = 0;
    p.moving = true;
    p.speed = 0;
    // Pistol equipped so the held gun mesh shows in the frame.
    const pw = game.weapons.list.find((w) => w.id === 'pistol');
    if (pw) { pw.owned = true; game.weapons.cur = game.weapons.list.indexOf(pw); p.weapon = 'pistol'; p.hasPistol = true; }
    const peds = game.peds || [];
    for (let i = 0; i < 6 && i < peds.length; i++) {
      peds[i].x = 2100 + ((i * 67) % 320) - 160;
      peds[i].y = 1610 + ((i * 113) % 80) - 40;
      peds[i].state = 'walk';
    }
    startMissionAt(game, 0, 0);
  } else if (name === 'mission') {
    // Hot Wheels, delivery step: the red sportscar racing east toward the
    // Chop Shop, the waypoint ring waiting ahead.
    const car = makeShotCar('sport', 3300, 1568, 0, 'player', '#e5322d', 380);
    putPlayerInCar(game, car);
    clearTrafficCorridor(game, 3200, 4000, 1450, 1650);
    startMissionAt(game, 1, 1);
  } else {
    throw new Error('unknown shot: ' + name);
  }

  // Simulate so the frame shows the game mid-action and the chase camera
  // has settled behind the player.
  for (let i = 0; i < steps; i++) {
    stepGame(game, scriptedInput({ up: true }), 1 / 60);
  }
  if (game.camera) game.camera.shake = 0;
  if (name === 'cover' && game.heli && game.heli.active) {
    // The heli chases the player and would end up behind the chase camera;
    // pull it ahead of the player for the frame so the chase reads.
    game.heli.x = game.player.x + 380;
    game.heli.y = game.player.y - 160;
    game.heli.z = 120;
  }
}
