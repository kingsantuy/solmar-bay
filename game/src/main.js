// Solmar Bay — boot + loop. Reads URL params (seed, shot), builds the game,
// runs fixed 1/60 steps with input from keyboard/mouse each frame. The
// LOGIC layer (state.js) owns every screen transition: title + Enter starts
// play and the next mission, Esc/P pauses, Enter on busted/wasted respawns.
// Main only adds restart (R) and save-and-quit (Q) on the pause screen,
// passes just-pressed flags through exactly once, and mirrors the screen
// into the HUD overlays. In shot mode (?shot=name&seed=N) the scene is
// staged, rendered twice, and window.__shotReady is set for screenshots.
import { createAudio } from './audio.js';
import { loadSave, saveGame, clearSave } from './save.js';
import * as State from './state.js';
import { createRenderer } from './render3d.js';
import { createHUD } from './hud.js';
import { stageShot, SHOTS } from './shots.js';

const { createGame, stepGame } = State;

const canvas = document.getElementById('game');
const statusLine = document.getElementById('status');

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const params = new URLSearchParams(window.location.search);
const seed = parseInt(params.get('seed') || '1', 10) || 1;
const shotName = params.get('shot');
const shotDef = SHOTS.find((s) => s.name === shotName);
if (shotDef) window.__shotMode = true; // suppress the district banner in staged shots

const saveData = shotName ? null : loadSave();
const audio = createAudio();
const renderer = createRenderer(canvas);
const hud = createHUD({
  hasSave: !!saveData,
  saveSummary: saveData
    ? `$${Math.floor(saveData.money || 0)} · ${((saveData.completed || saveData.done) || []).length} job${((saveData.completed || saveData.done) || []).length === 1 ? '' : 's'} done`
    : '',
});

let game = createGame(seed, saveData, audio);
window.__game = game;
window.__renderer = renderer;
renderer.buildCity(game);
renderer.resize(canvas.width, canvas.height);
window.addEventListener('resize', () => renderer.resize(canvas.width, canvas.height));
hud.showScreen(game.screen || 'title');

// --- Input ---------------------------------------------------------------
const held = new Set();
const pressed = new Set();
let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;
let mouseClicked = false;
let audioUnlocked = false;

function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  if (audio && typeof audio.unlock === 'function') audio.unlock();
  else if (audio && typeof audio.ensure === 'function') audio.ensure();
}
window.addEventListener('keydown', (e) => {
  unlockAudio();
  if (e.repeat) return;
  held.add(e.code);
  pressed.add(e.code);
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => held.delete(e.code));
window.addEventListener('blur', () => held.clear());
window.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});
canvas.addEventListener('mousedown', (e) => {
  unlockAudio();
  mouseX = e.clientX;
  mouseY = e.clientY;
  mouseClicked = true;
});

function buildInput() {
  const aim = renderer.screenToGround(mouseX, mouseY);
  return {
    up: held.has('KeyW') || held.has('ArrowUp'),
    down: held.has('KeyS') || held.has('ArrowDown'),
    left: held.has('KeyA') || held.has('ArrowLeft'),
    right: held.has('KeyD') || held.has('ArrowRight'),
    run: held.has('ShiftLeft') || held.has('ShiftRight'),
    enter: pressed.has('KeyE'),
    handbrake: held.has('Space'),
    punch: pressed.has('KeyF'),
    shoot: mouseClicked,
    aimX: aim.x,
    aimY: aim.y,
    weapon1: pressed.has('Digit1'),
    weapon2: pressed.has('Digit2'),
    pause: pressed.has('Escape') || pressed.has('KeyP'),
    mute: pressed.has('KeyM'),
    confirm: pressed.has('Enter'),
    radio: pressed.has('KeyR'),
  };
}

// Just-pressed flags are consumed once per stepGame call: clear them after
// the first step of the frame so a second step cannot re-trigger them
// (e.g. pause on, then immediately off again).
function clearJustPressed(input) {
  input.enter = false;
  input.punch = false;
  input.shoot = false;
  input.weapon1 = false;
  input.weapon2 = false;
  input.pause = false;
  input.mute = false;
  input.confirm = false;
  input.radio = false;
}

function rebuildToTitle(withSave) {
  const save = withSave ? loadSave() : null;
  game = createGame(seed, save, audio);
  window.__game = game;
  renderer.buildCity(game);
  hud.showScreen('title');
}

// --- Shot mode -------------------------------------------------------------
if (shotDef) {
  stageShot(game, shotDef.name);
  hud.showScreen('play');
  hud.setCrosshair(mouseX, mouseY);
  renderer.sync(game, 0);
  renderer.sync(game, 0);
  hud.update(game);
  window.__shotReady = true;
  document.title = 'READY';
  if (statusLine) statusLine.textContent = 'Shot ' + shotDef.name + ' ready.';
} else {
  // --- Normal play: fixed-step loop ---------------------------------------
  const STEP = 1 / 60;
  let last = performance.now();
  let acc = 0;
  let shownScreen = game.screen || 'title';

  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    acc += dt;

    const input = buildInput();

    // Pause-screen extras (the logic owns pause/resume itself): R restarts
    // from scratch, Q saves and quits to the title screen.
    if (game.screen === 'pause') {
      if (pressed.has('KeyR')) {
        try { clearSave(); } catch { /* ignore */ }
        rebuildToTitle(false);
      } else if (pressed.has('KeyQ')) {
        try { saveGame(game); } catch { /* ignore */ }
        rebuildToTitle(true);
      }
    }

    // The logic step runs in every screen: it advances the world in play
    // and handles title / pause / busted / wasted transitions itself.
    let steps = 0;
    while (acc >= STEP && steps < 5) {
      stepGame(game, input, STEP);
      acc -= STEP;
      steps++;
      clearJustPressed(input);
    }
    if (steps === 5) acc = 0;
    pressed.clear();
    mouseClicked = false;

    if (game.screen !== shownScreen) {
      shownScreen = game.screen;
      hud.showScreen(game.screen);
    }
    hud.setCrosshair(mouseX, mouseY);
    renderer.sync(game, dt);
    hud.update(game);
  }
  requestAnimationFrame(frame);
}
