// Solmar Bay — boot and the one loop.
// Reads the URL parameters (seed, shot), builds the game, and runs the
// fixed-step loop with input each frame. Screen transitions belong to
// the logic layer (stepGame); main only adds the pause-screen extras:
// R restarts, Q saves and quits. In shot mode the staged scene is
// painted twice and the ready flag is set for the screenshot tool.
//
// Just-pressed keys (E, F, 1, 2, Esc, M, R, Enter, Q) are edge flags:
// the input builder is the ONLY place that consumes them, and a built
// input is used for one fixed step only — later steps in the same frame
// get a copy with the edge flags cleared, so one press can never fire
// twice (resume-then-instantly-pause, or resume-then-start-a-job).

import { createGame, stepGame } from './state.js';
import { createRenderer } from './render3d.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { loadSave, saveGame, clearSave } from './save.js';
import { stageShot } from './shots.js';
import { loadModels } from './models.js';

const STEP = 1 / 60;
const canvas = document.getElementById('game');
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed')) || 1;
const shot = params.get('shot');

const audio = createAudio();
let game = createGame(seed, shot ? null : loadSave(), audio);
const renderer = createRenderer(canvas);
renderer.buildCity(game);
const hud = createHud(renderer.projectToScreen, { shotMode: !!shot });

window.__solmar = { game, renderer, hud, seed, shot: shot || null };
window.__solmarReady = false;

function setGame(next) {
  game = next;
  window.__solmar.game = next;
  renderer.snapCamera();
}

// ---------------------------------------------------------------- input ---

const held = new Set(); // logical keys currently down
const justPressed = new Set(); // edge flags, consumed by buildInput only
let mouseHeld = false;
let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
let audioUnlocked = false;

const KEY_MAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
  Space: 'handbrake',
  KeyE: 'enter',
  KeyF: 'punch',
  Digit1: 'weapon1',
  Digit2: 'weapon2',
  Escape: 'pause', KeyP: 'pause',
  KeyM: 'mute',
  Enter: 'confirm',
  KeyR: 'radio',
  KeyQ: 'quit',
};
const EDGE_KEYS = new Set([
  'enter', 'punch', 'weapon1', 'weapon2', 'pause', 'mute',
  'confirm', 'radio', 'quit',
]);

function unlockAudio() {
  if (!audioUnlocked) {
    audioUnlocked = true;
    audio.unlock();
  }
}

window.addEventListener('keydown', (e) => {
  const name = KEY_MAP[e.code];
  if (!name) return;
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  unlockAudio();
  held.add(name);
  if (!e.repeat && EDGE_KEYS.has(name)) justPressed.add(name);
});
window.addEventListener('keyup', (e) => {
  const name = KEY_MAP[e.code];
  if (name) held.delete(name);
});
window.addEventListener('blur', () => {
  held.clear();
  mouseHeld = false;
});
canvas.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
  hud.setMouse(mouseX, mouseY);
});
canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  unlockAudio();
  mouseHeld = true;
  mouseX = e.clientX;
  mouseY = e.clientY;
  hud.setMouse(mouseX, mouseY);
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) mouseHeld = false;
});
window.addEventListener('resize', () => renderer.resize());

function currentAim() {
  const ground = renderer.screenToGround(mouseX, mouseY);
  if (ground) return ground;
  return { x: game.player.x, y: game.player.y };
}

// Build one frame's input and consume the edge flags. The ONLY place
// that clears justPressed.
function buildInput() {
  const aim = currentAim();
  const input = {
    up: held.has('up'),
    down: held.has('down'),
    left: held.has('left'),
    right: held.has('right'),
    run: held.has('run'),
    enter: justPressed.has('enter'),
    handbrake: held.has('handbrake'),
    punch: justPressed.has('punch'),
    shoot: mouseHeld,
    aimX: aim.x,
    aimY: aim.y,
    weapon1: justPressed.has('weapon1'),
    weapon2: justPressed.has('weapon2'),
    pause: justPressed.has('pause'),
    mute: justPressed.has('mute'),
    confirm: justPressed.has('confirm'),
    radio: justPressed.has('radio'),
    quit: justPressed.has('quit'),
  };
  justPressed.clear();
  return input;
}

// The same input with every edge flag cleared, for the second and later
// fixed steps of one frame.
function clearedInput(input) {
  return {
    ...input,
    enter: false, punch: false, weapon1: false, weapon2: false,
    pause: false, mute: false, confirm: false, radio: false, quit: false,
  };
}

// ----------------------------------------------------------------- loop ---

let last = performance.now();
let acc = 0;

function frame(now) {
  // Catch-up cap: at most 0.25 s of game time per presented frame (15
  // fixed steps). At 60 fps a frame needs one step and the cap never
  // bites; on slow software rendering (headless SwiftShader runs near
  // 2 fps) it keeps game time as close to real time as the machine
  // allows instead of falling to a fifth of real time. Logic steps are
  // cheap next to a frame render, so the extra steps cost nothing.
  const frameDt = Math.min(Math.max((now - last) / 1000, 0), 0.25);
  last = now;
  const input = buildInput();

  if (game.screen === 'pause' && input.radio) {
    // R on the pause screen: restart from scratch (save cleared).
    clearSave();
    setGame(createGame(seed, null, audio));
  } else if (game.screen === 'pause' && input.quit) {
    // Q on the pause screen: save and quit back to the title screen,
    // where the save offers Continue.
    saveGame(game);
    setGame(createGame(seed, loadSave(), audio));
  } else {
    acc += frameDt;
    let steps = 0;
    while (acc >= STEP && steps < 15) {
      stepGame(game, steps === 0 ? input : clearedInput(input), STEP);
      acc -= STEP;
      steps++;
    }
    if (steps === 15) acc = 0; // drop the backlog, never spiral
  }

  renderer.sync(game, frameDt);
  hud.update(game);
  requestAnimationFrame(frame);
}

// ----------------------------------------------------------------- boot ---

if (shot) {
  // Shot mode: stage the deterministic scene, let the models arrive so
  // the frame shows them, paint twice, then set the ready flag. No loop:
  // the staged frame is static.
  stageShot(game, shot);
  await Promise.race([
    loadModels(),
    new Promise((resolve) => setTimeout(resolve, 8000)),
  ]);
  renderer.sync(game, STEP);
  renderer.sync(game, STEP);
  hud.update(game);
  window.__solmarReady = true;
} else {
  renderer.resize();
  requestAnimationFrame(frame);
}
