import { createGame, stepGame } from './state.js';
import { createRenderer } from './render3d.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { saveGame, loadSave, clearSave } from './save.js';
import { stageShot } from './shots.js';
const canvas = document.getElementById('game');
const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || '1', 10) || 1;
const shot = params.get('shot');
const audio = createAudio();
let game = createGame(seed, loadSave(), audio);
game.shotMode = !!shot;
const renderer = createRenderer(canvas);
renderer.buildCity(game);
const hud = createHud(game, renderer);
window.__solmar = { game, renderer, hud, seed, shot: shot || null };
window.__solmarReady = false;
const keys = {};
const pressed = {};
let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2, mouseDown = false;
function restart() {
  clearSave();
  game = createGame(seed, null, audio);
  hud.bind(game);
  window.__solmar.game = game;
  renderer.snapCamera();
}
function saveAndQuit() {
  saveGame(game);
  game = createGame(seed, loadSave(), audio);
  hud.bind(game);
  window.__solmar.game = game;
  renderer.snapCamera();
}
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (game.screen === 'pause' && e.code === 'KeyR') { restart(); return; }
  if (game.screen === 'pause' && e.code === 'KeyQ') { saveAndQuit(); return; }
  keys[e.code] = true;
  pressed[e.code] = true;
  if (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'Space') e.preventDefault();
  if (audio) audio.unlock();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
window.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; });
canvas.addEventListener('mousedown', (e) => { if (e.button === 0) mouseDown = true; if (audio) audio.unlock(); });
window.addEventListener('mouseup', () => { mouseDown = false; });
window.addEventListener('resize', () => renderer.resize());
function buildInput() {
  const aim = renderer.screenToGround(mouseX, mouseY);
  const inp = {
    up: !!(keys.KeyW || keys.ArrowUp), down: !!(keys.KeyS || keys.ArrowDown),
    left: !!(keys.KeyA || keys.ArrowLeft), right: !!(keys.KeyD || keys.ArrowRight),
    run: !!(keys.ShiftLeft || keys.ShiftRight), enter: !!pressed.KeyE,
    handbrake: !!keys.Space, punch: !!pressed.KeyF,
    shoot: mouseDown, aimX: aim ? aim.x : 0, aimY: aim ? aim.y : 0,
    weapon1: !!pressed.Digit1, weapon2: !!pressed.Digit2, weapon3: !!pressed.Digit3,
    weapon4: !!pressed.Digit4, weapon5: !!pressed.Digit5,
    wheel: !!pressed.KeyQ, garage: !!pressed.KeyG,
    pause: !!(pressed.Escape || pressed.KeyP), mute: !!pressed.KeyM,
    confirm: !!pressed.Enter, radio: !!pressed.KeyR,
  };
  for (const k of Object.keys(pressed)) pressed[k] = false;
  return inp;
}
const STEP = 1 / 60;
let acc = 0, lastT = performance.now();
function frame(now) {
  const frameDt = Math.min(0.25, Math.max(0, (now - lastT) / 1000));
  lastT = now;
  acc += frameDt;
  const inp = buildInput();
  let first = true, n = 0;
  while (acc >= STEP && n < 20) {
    if (first) { stepGame(game, inp, STEP); first = false; }
    else stepGame(game, { ...inp, enter: false, punch: false, weapon1: false, weapon2: false, weapon3: false, weapon4: false, weapon5: false, wheel: false, garage: false, pause: false, mute: false, confirm: false, radio: false }, STEP);
    acc -= STEP;
    n++;
  }
  if (n === 20) acc = 0;
  if (game.cameraSnap) { renderer.snapCamera(); game.cameraSnap = false; }
  renderer.sync(game, Math.min(frameDt, 0.1));
  hud.update();
  requestAnimationFrame(frame);
}
if (shot) {
  stageShot(game, shot);
  renderer.sync(game, STEP);
  hud.update();
  renderer.sync(game, STEP);
  hud.update();
  window.__solmarReady = true;
} else {
  requestAnimationFrame(frame);
}
