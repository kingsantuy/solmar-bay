// The five story jobs and the taxi-fare side job. Each mission is a list
// of steps that point at a pulsing marker; finishing one pays out, saves
// and opens the next. Only the timed delivery can fail, and it stays open
// to retry.
import { CONFIG } from './config.js';
import { makePed, commitCrime } from './people.js';
import { toast } from './vehicles.js';
import { nearestRoadPoint, randomRoadPoint } from './city.js';
import { range, int } from './rng.js';

export function startMission(state, idx) {
  const def = CONFIG.missions[idx];
  if (!def) {
    state.missions.active = false;
    state.missions.idx = CONFIG.missions.length;
    state.missions.target = null;
    return;
  }
  state.missions.idx = idx;
  state.missions.step = 0;
  state.missions.active = true;
  state.missions.timer = null;
  state.missions.clientAboard = false;
  state.missions.target = null;
  toast(state, `New job: ${def.title} — $${def.pay}`);
  toast(state, def.briefing);
  setupStep(state);
}

function setupStep(state) {
  const def = CONFIG.missions[state.missions.idx];
  if (!def) return;
  const step = def.steps[state.missions.step];
  if (!step) return;
  state.missions.target = { x: step.x, y: step.y, label: step.label, radius: step.radius };
  if (step.type === 'pickup') {
    const client = makePed(step.x, step.y, 'client', state.rng);
    client.state = 'wait';
    state.peds.push(client);
    state.missions.client = client;
  }
  if (step.type === 'timed') {
    state.missions.timer = step.time;
  }
  if (step.police) {
    // The coast road is watched: two patrols, and the heat is on.
    if (state.player.wanted < 1) commitCrime(state, 1);
    for (const [px, py] of [[420, 900], [420, 1800]]) {
      state.cars.push({
        id: 9000 + Math.floor(px),
        model: 'police', kind: 'police',
        x: px, y: py, angle: Math.PI / 2, vx: 0, vy: 0,
        hp: 100, color: '#20242c', road: 420, vertical: true, dir: 1,
        targetSpeed: 0, turnCd: 0, siren: true, owned: false, smokeT: 0, brake: false,
      });
    }
  }
}

function advanceStep(state) {
  const def = CONFIG.missions[state.missions.idx];
  state.missions.step++;
  state.audio.pickup();
  if (state.missions.step >= def.steps.length) {
    finishMission(state);
    return;
  }
  setupStep(state);
}

function finishMission(state) {
  const def = CONFIG.missions[state.missions.idx];
  state.player.money += def.pay;
  state.stats.moneyEarned += def.pay;
  state.stats.missionsDone++;
  state.missions.done.push(def.id);
  state.audio.success();
  toast(state, `Job done: ${def.title} — $${def.pay}`);
  if (def.id === 'hotwheels') {
    state.player.hasPistol = true;
    state.player.weapon = 'pistol';
    toast(state, 'You earned a pistol. Press 2 to draw it.');
  }
  state.pendingSave = true;
  state.missions.active = false;
  state.missions.target = null;
  if (state.missions.idx + 1 < CONFIG.missions.length) {
    startMission(state, state.missions.idx + 1);
  } else {
    state.missions.storyComplete = true;
    toast(state, 'Story complete — Solmar Bay is yours. Free roam!');
  }
}

function failMission(state, why) {
  const def = CONFIG.missions[state.missions.idx];
  state.audio.fail();
  toast(state, `${def.title} failed: ${why} — the job is still open.`);
  // Back to the start of the same job.
  state.missions.active = false;
  state.missions.target = null;
  state.missions.timer = null;
  startMission(state, state.missions.idx);
}

// Distance to a step's target. When the target sits inside a building
// (the hotel, the casino, the chop shop), the player stops at the door:
// measure to the building's nearest edge, not its centre.
function distToStep(state, step) {
  const p = state.player;
  for (const b of state.city.buildings) {
    if (step.x >= b.x && step.x <= b.x + b.w && step.y >= b.y && step.y <= b.y + b.h) {
      const nx = Math.max(b.x, Math.min(p.x, b.x + b.w));
      const ny = Math.max(b.y, Math.min(p.y, b.y + b.h));
      return Math.hypot(p.x - nx, p.y - ny);
    }
  }
  return Math.hypot(p.x - step.x, p.y - step.y);
}

export function updateMissions(state, dt) {
  if (!state.missions.active) return;
  const def = CONFIG.missions[state.missions.idx];
  if (!def) return;
  const step = def.steps[state.missions.step];
  if (!step) return;
  const p = state.player;

  if (step.type === 'timed' && state.missions.timer !== null) {
    state.missions.timer -= dt;
    if (state.missions.timer <= 0) {
      failMission(state, 'out of time');
      return;
    }
  }

  const dist = distToStep(state, step);
  switch (step.type) {
    case 'pickup': {
      const client = state.missions.client;
      if (client && dist < step.radius) {
        const i = state.peds.indexOf(client);
        if (i >= 0) state.peds.splice(i, 1);
        state.missions.clientAboard = true;
        toast(state, 'Client aboard — drive to the destination.');
        advanceStep(state);
      }
      break;
    }
    case 'dropoff': {
      if (state.missions.clientAboard && p.inCar && dist < step.radius) {
        state.missions.clientAboard = false;
        advanceStep(state);
      }
      break;
    }
    case 'steal': {
      if (p.inCar && p.inCar.missionCar) advanceStep(state);
      break;
    }
    case 'deliver': {
      if (dist < step.radius) advanceStep(state);
      break;
    }
    case 'collect': {
      if (dist < step.radius) {
        toast(state, 'Package collected.');
        advanceStep(state);
      }
      break;
    }
    case 'grab': {
      if (!p.inCar && dist < step.radius) {
        commitCrime(state, 2);
        toast(state, 'Cash grabbed! Lose the heat, then reach the Hideout.');
        advanceStep(state);
      }
      break;
    }
    case 'escape': {
      if (dist < step.radius && p.wanted === 0) advanceStep(state);
      break;
    }
    default:
      break;
  }
}

// Taxi fares: the side job. When no mission is active, a fare appears
// every 30–45 seconds — drive to the waiting client, take them aboard,
// drive to their destination for cash.
export function updateTaxi(state, dt) {
  const taxi = state.taxi;
  if (state.missions.active) return;
  if (taxi.state === 'none') {
    taxi.timer -= dt;
    if (taxi.timer <= 0) {
      // Client and destination both on roads, so they are reachable.
      const a = state.rng() * Math.PI * 2;
      const cx = Math.max(400, Math.min(CONFIG.world.w - 200, state.player.x + Math.cos(a) * range(state.rng, 500, 900)));
      const cy = Math.max(200, Math.min(CONFIG.world.h - 200, state.player.y + Math.sin(a) * range(state.rng, 500, 900)));
      const cp = nearestRoadPoint(cx, cy);
      const client = makePed(cp.x, cp.y, 'client', state.rng);
      client.state = 'wait';
      client.fare = true;
      state.peds.push(client);
      taxi.client = client;
      const dp = randomRoadPoint(state.rng);
      taxi.dest = { x: dp.x, y: dp.y };
      taxi.pay = int(state.rng, CONFIG.taxi.minPay, CONFIG.taxi.maxPay);
      taxi.state = 'wait';
      toast(state, 'Taxi fare nearby — look for the gold $ sign.');
    }
    return;
  }
  const p = state.player;
  if (taxi.state === 'wait') {
    if (taxi.client && Math.hypot(p.x - taxi.client.x, p.y - taxi.client.y) < 60) {
      const i = state.peds.indexOf(taxi.client);
      if (i >= 0) state.peds.splice(i, 1);
      taxi.state = 'ride';
      toast(state, 'Passenger aboard — drive to the destination.');
    }
    return;
  }
  if (taxi.state === 'ride') {
    if (!p.inCar) {
      taxi.state = 'none';
      taxi.timer = range(state.rng, CONFIG.taxi.spawnMin, CONFIG.taxi.spawnMax);
      toast(state, 'Fare lost — the passenger walked away.');
      return;
    }
    if (Math.hypot(p.x - taxi.dest.x, p.y - taxi.dest.y) < 70) {
      p.money += taxi.pay;
      state.stats.moneyEarned += taxi.pay;
      state.stats.fares++;
      state.audio.cash();
      toast(state, `Fare paid: $${taxi.pay}`);
      taxi.state = 'none';
      taxi.timer = range(state.rng, CONFIG.taxi.spawnMin, CONFIG.taxi.spawnMax);
    }
  }
}

// The current objective for the HUD, minimap and edge arrow.
export function currentTarget(state) {
  if (state.missions.active && state.missions.target) return state.missions.target;
  if (state.taxi.state === 'wait' && state.taxi.client) {
    return { x: state.taxi.client.x, y: state.taxi.client.y, label: 'Taxi client', radius: 60 };
  }
  if (state.taxi.state === 'ride') {
    return { x: state.taxi.dest.x, y: state.taxi.dest.y, label: 'Fare destination', radius: 70 };
  }
  return null;
}
