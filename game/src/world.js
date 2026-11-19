// The whole game state and the fixed 1/60-second step that advances it:
// player, traffic, police, collisions, pedestrians, bullets, missions,
// taxi, particles, camera, district banners, health regeneration, message
// fading and autosaving, in that order.
import { CONFIG, districtAt } from './config.js';
import { mulberry32 } from './rng.js';
import { generateCity } from './city.js';
import {
  spawnTraffic, updateTraffic, updatePlayerCar, updatePolice, collideCars,
} from './vehicles.js';
import { spawnPeds, updatePlayerOnFoot, updatePeds, exitCar } from './people.js';
import { startMission, updateMissions, updateTaxi } from './missions.js';
import {
  playerShoot, updateBullets, policeShoot, updateWanted, applyBusted, applyWasted,
} from './combat.js';
import { AudioEngine } from './audio.js';
import { saveGame } from './save.js';

export function createGame(seed, saveData) {
  const rng = mulberry32(seed);
  const city = generateCity(rng);
  const state = {
    seed,
    rng,
    city,
    time: 0,
    screen: 'title',
    screenT: 0,
    player: {
      x: CONFIG.start.player.x,
      y: CONFIG.start.player.y,
      angle: -Math.PI / 2,
      hp: CONFIG.player.hp,
      money: 0,
      wanted: 0,
      inCar: null,
      weapon: 'fists',
      hasPistol: false,
      lastCrimeAt: -999,
      lastDamageAt: -999,
      punchCd: 0,
      shootCd: 0,
      moveSpeed: 0,
      bustHold: 0,
    },
    cars: [],
    peds: [],
    bullets: [],
    particles: [],
    missions: {
      idx: 0, step: 0, active: false, timer: null,
      done: [], target: null, client: null, clientAboard: false,
      storyComplete: false,
    },
    taxi: { state: 'none', client: null, dest: null, pay: 0, timer: 30 },
    stats: { carsStolen: 0, shotsFired: 0, missionsDone: 0, fares: 0, moneyEarned: 0 },
    camera: { x: CONFIG.start.player.x, y: CONFIG.start.player.y, zoom: 0.9, shake: 0 },
    messages: [],
    district: 'Solmar Bay',
    districtT: 0,
    policeTimer: 0,
    copTimer: 0,
    wantedHeat: { fadeT: 0 },
    lastShotAt: -999,
    mouseWorld: null,
    audio: new AudioEngine(),
    pendingSave: false,
    hasSave: false,
  };
  if (saveData) {
    state.player.money = saveData.money || 0;
    state.missions.done = (saveData.done || []).slice();
    state.stats = { ...state.stats, ...(saveData.stats || {}) };
    if (typeof saveData.x === 'number') {
      state.player.x = saveData.x;
      state.player.y = saveData.y;
    }
    state.hasSave = true;
  }
  spawnTraffic(state);
  spawnPeds(state);
  return state;
}

// Begin (or resume) play from the title screen: the first uncompleted
// job starts; a finished story means free roam.
export function startPlay(state) {
  state.screen = 'play';
  state.screenT = 0;
  state.audio.ensure();
  const next = CONFIG.missions.findIndex((m) => !state.missions.done.includes(m.id));
  if (next >= 0) startMission(state, next);
  else state.missions.storyComplete = true;
}

export function snapshotSave(state) {
  return {
    money: state.player.money,
    done: state.missions.done.slice(),
    stats: { ...state.stats },
    x: state.player.x,
    y: state.player.y,
  };
}

export function saveNow(state) {
  return saveGame(snapshotSave(state));
}

// One fixed step. view is { w, h } in canvas pixels, for the mouse ray.
export function stepGame(state, input, dt, view) {
  if (state.screen !== 'play') return;
  state.time += dt;
  const p = state.player;

  // Mouse position in world coordinates (for aiming the pistol).
  if (view) {
    state.mouseWorld = {
      x: state.camera.x + (input.mouse.x - view.w / 2) / state.camera.zoom,
      y: state.camera.y + (input.mouse.y - view.h / 2) / state.camera.zoom,
    };
  }

  // Player: on foot or driving.
  if (p.inCar) {
    if (input.wasPressed('KeyE')) exitCar(state);
    else updatePlayerCar(state, input, dt);
    if (p.inCar) {
      p.x = p.inCar.x;
      p.y = p.inCar.y;
    }
  } else {
    updatePlayerOnFoot(state, input, dt);
  }
  playerShoot(state, input, dt);

  // Traffic, police, collisions.
  updateTraffic(state, dt);
  updatePolice(state, dt);
  collideCars(state, dt);

  // Crowds.
  updatePeds(state, dt);

  // Bullets, police fire, wanted decay.
  updateBullets(state, dt);
  policeShoot(state, dt);
  updateWanted(state, dt);

  // Jobs.
  updateMissions(state, dt);
  updateTaxi(state, dt);

  // Particles.
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const pt = state.particles[i];
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    if (pt.life <= 0) state.particles.splice(i, 1);
  }

  // Camera: follow with a smooth lag, zoom out while driving, shake on hits.
  const targetZoom = p.inCar ? 0.72 : 0.9;
  state.camera.zoom += (targetZoom - state.camera.zoom) * Math.min(1, dt * 2);
  state.camera.x += (p.x - state.camera.x) * Math.min(1, dt * 5);
  state.camera.y += (p.y - state.camera.y) * Math.min(1, dt * 5);
  state.camera.shake = Math.max(0, state.camera.shake - dt * 22);

  // District banner.
  const d = districtAt(p.x, p.y);
  if (d !== state.district) {
    state.district = d;
    state.districtT = 3;
  } else {
    state.districtT = Math.max(0, state.districtT - dt);
  }

  // Health regenerates after 8 quiet seconds.
  const quiet = Math.max(p.lastDamageAt, p.lastCrimeAt);
  if (state.time - quiet > CONFIG.player.regenDelay && p.hp > 0 && p.hp < CONFIG.player.hp) {
    p.hp = Math.min(CONFIG.player.hp, p.hp + CONFIG.player.regen * dt);
  }

  // Toasts fade after six seconds.
  for (let i = state.messages.length - 1; i >= 0; i--) {
    state.messages[i].t += dt;
    if (state.messages[i].t > 6) state.messages.splice(i, 1);
  }

  // Audio follows the game.
  const driving = !!p.inCar;
  const speed01 = driving && p.inCar
    ? Math.min(1, Math.abs(p.inCar.speed || 0) / CONFIG.models[p.inCar.model].top)
    : 0;
  state.audio.engine(speed01);
  state.audio.updateSiren(dt);
  state.audio.updateMusic(dt, driving);

  // Busted or wasted.
  if (p.hp <= 0) {
    applyWasted(state);
  } else if (p.bustHold >= CONFIG.wanted.bustHold) {
    applyBusted(state);
  }

  // Autosave after a mission pays out.
  if (state.pendingSave) {
    state.pendingSave = false;
    saveNow(state);
  }
}
