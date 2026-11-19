// Boot and the one loop: read the URL parameters (seed, shot), build the
// game, run the fixed-step loop with input each frame, switch between the
// title, play, paused, busted and wasted screens, and in shot mode paint
// the staged scene twice and set the ready flag.
import { Input } from './input.js';
import { createGame, startPlay, stepGame, saveNow } from './world.js';
import { render } from './render.js';
import { stageShot, scriptedInput, SHOT_DEFS } from './shots.js';
import { loadSave } from './save.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusLine = document.getElementById('status');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const params = new URLSearchParams(window.location.search);
const seed = parseInt(params.get('seed') || '1', 10) || 1;
const shotName = params.get('shot');
const shotDef = SHOT_DEFS.find((s) => s.name === shotName);

const input = new Input(canvas);
let state = createGame(seed, shotName ? null : loadSave());

if (shotDef) {
  // Shot mode: stage the scene, simulate it, paint twice, flag ready.
  stageShot(state, shotDef.name);
  const fake = scriptedInput(shotDef.keys);
  const view = { w: canvas.width, h: canvas.height };
  state.mouseScreen = { x: canvas.width / 2, y: canvas.height / 2 };
  for (let i = 0; i < shotDef.steps; i++) {
    stepGame(state, fake, 1 / 60, view);
  }
  render(ctx, state, view);
  render(ctx, state, view);
  window.__shotReady = true;
  if (statusLine) statusLine.textContent = 'Shot ' + shotDef.name + ' ready.';
} else {
  // Normal play: fixed-step loop with real input.
  let last = performance.now();
  let acc = 0;
  const STEP = 1 / 60;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    acc += dt;

    // Screen switching.
    if (state.screen === 'title' && input.wasPressed('Enter')) {
      state.audio.ensure();
      state.audio.click();
      startPlay(state);
    } else if (state.screen === 'play' && (input.wasPressed('Escape') || input.wasPressed('KeyP'))) {
      state.screen = 'pause';
      state.screenT = 0;
    } else if (state.screen === 'pause') {
      if (input.wasPressed('Enter')) {
        state.screen = 'play';
      } else if (input.wasPressed('KeyR')) {
        state = createGame(seed, null);
        startPlay(state);
      } else if (input.wasPressed('KeyQ')) {
        saveNow(state);
        state = createGame(seed, loadSave());
        state.screen = 'title';
      }
    } else if ((state.screen === 'busted' || state.screen === 'wasted') && input.wasPressed('Enter')) {
      state.screen = 'play';
      state.player.bustHold = 0;
    }
    if (input.wasPressed('KeyM')) {
      state.audio.ensure();
      state.audio.setMuted(!state.audio.muted);
    }

    const view = { w: canvas.width, h: canvas.height };
    state.mouseScreen = { x: input.mouse.x, y: input.mouse.y };
    window.__solmar = state;
    let steps = 0;
    while (acc >= STEP && steps < 5) {
      if (state.screen === 'play') stepGame(state, input, STEP, view);
      else state.screenT += STEP;
      acc -= STEP;
      steps++;
    }
    if (steps === 5) acc = 0;
    render(ctx, state, view);
    input.endFrame();
    if (statusLine) {
      statusLine.textContent = state.screen === 'play'
        ? `${state.district}. Wanted ${state.player.wanted} stars. $${state.player.money}.`
        : state.screen;
    }
  }
  requestAnimationFrame(frame);
}
