// Staging the four screenshot scenes from a fresh game: reset the world,
// place the player and the police and traffic where the scene needs them,
// then simulate a fixed number of steps with scripted inputs so the frame
// shows the game mid-action. Same seed, same frame.
import { CONFIG } from './config.js';
import { makeCar } from './vehicles.js';
import { startMission } from './missions.js';
import { range } from './rng.js';

export const SHOT_DEFS = [
  { name: 'cover', steps: 60, keys: ['KeyW'], label: 'Three-star police chase' },
  { name: 'drive', steps: 75, keys: ['KeyW'], label: 'Driving down the coastal avenue' },
  { name: 'onfoot', steps: 45, keys: ['KeyW'], label: 'On foot downtown' },
  { name: 'mission', steps: 40, keys: [], label: 'A mission in progress' },
];

// A minimal stand-in for Input, with scripted held keys.
export function scriptedInput(heldCodes) {
  const held = new Set(heldCodes);
  return {
    keys: held,
    pressed: new Set(),
    mouse: { x: 640, y: 400, down: false, clicked: false },
    isDown: (c) => held.has(c),
    wasPressed: () => false,
    anyDown: (codes) => codes.some((c) => held.has(c)),
    endFrame() {},
  };
}

function putPlayerInCar(state, car) {
  car.kind = 'player';
  car.owned = true;
  car.vx = 0;
  car.vy = 0;
  car.speed = 0;
  state.player.inCar = car;
  state.player.x = car.x;
  state.player.y = car.y;
  state.player.angle = car.angle;
  state.camera.x = car.x;
  state.camera.y = car.y;
}

function placePolice(state, x, y, angle) {
  const car = makeCar('police', x, y, angle, 'police');
  car.speed = 300;
  car.vx = Math.cos(angle) * 300;
  car.vy = Math.sin(angle) * 300;
  state.cars.push(car);
  return car;
}

export function stageShot(state, name) {
  state.screen = 'play';
  state.screenT = 0;
  state.audio.ensure = () => {};
  if (name === 'cover') {
    // A three-star chase: the player in a sportscar on the downtown road,
    // three patrol cars closing in, the first job on the HUD. The car
    // drives in the eastbound lane (28 px below the centre line) and the
    // corridor ahead is cleared of traffic, so the chase reads instead of
    // a pile-up.
    const car = makeCar('sport', 1800, 2128, 0, 'parked', '#e5322d');
    state.cars.push(car);
    putPlayerInCar(state, car);
    car.vx = 420;
    car.speed = 420;
    state.cars = state.cars.filter(
      (c) => !(c.kind === 'traffic' && c.x > 1700 && c.x < 2900 && c.y > 2000 && c.y < 2250),
    );
    state.player.wanted = 3;
    state.player.lastCrimeAt = state.time;
    placePolice(state, 1520, 2100, 0);
    placePolice(state, 1440, 2128, 0);
    placePolice(state, 1580, 2072, 0);
    startMission(state, 0);
    return;
  }
  if (name === 'drive') {
    // Down the coastal avenue: sea and sand on the left, the city on the
    // right, traffic ahead. The car drives in the southbound lane (28 px
    // left of the centre line) and the corridor ahead is cleared of
    // traffic, so the run stays clean.
    const car = makeCar('sedan', 392, 1400, Math.PI / 2, 'parked', '#4f7dc9');
    state.cars.push(car);
    putPlayerInCar(state, car);
    car.vy = 350;
    car.speed = 350;
    state.cars = state.cars.filter(
      (c) => !(c.kind === 'traffic' && c.x > 330 && c.x < 470 && c.y > 1300 && c.y < 2300),
    );
    startMission(state, 0);
    return;
  }
  if (name === 'onfoot') {
    // On foot downtown, among pedestrians and traffic.
    state.player.x = 2100;
    state.player.y = 1560;
    state.player.angle = -Math.PI / 2;
    state.camera.x = 2100;
    state.camera.y = 1560;
    for (let i = 0; i < 6 && i < state.peds.length; i++) {
      const ped = state.peds[i];
      ped.x = 2100 + range(state.rng, -160, 160);
      ped.y = 1560 + range(state.rng, -120, 120);
    }
    startMission(state, 0);
    return;
  }
  if (name === 'mission') {
    // Hot Wheels: on foot at the beach lot, the red sportscar waiting, the
    // waypoint diamond on it.
    state.player.x = 560;
    state.player.y = 2100;
    state.player.angle = 0;
    state.camera.x = 560;
    state.camera.y = 2100;
    startMission(state, 1);
    return;
  }
  // Unknown scene: just play.
  startMission(state, 0);
}
