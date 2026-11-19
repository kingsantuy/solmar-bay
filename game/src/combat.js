// Combat: the player's shooting, police shooting, the wanted level's
// decay, and the busted and wasted transitions.
import { CONFIG } from './config.js';
import { damagePlayer, toast, addSparks } from './vehicles.js';
import { commitCrime } from './people.js';
import { range } from './rng.js';
import { hitsSolid } from './city.js';

export function playerShoot(state, input, dt) {
  const p = state.player;
  p.shootCd = Math.max(0, p.shootCd - dt);
  if (p.inCar || p.weapon !== 'pistol' || !p.hasPistol) return;
  if (!input.mouse.down && !input.mouse.clicked) return;
  if (p.shootCd > 0) return;
  p.shootCd = CONFIG.player.pistolRate;
  const mw = state.mouseWorld || { x: p.x + 100, y: p.y };
  const ang = Math.atan2(mw.y - p.y, mw.x - p.x);
  state.bullets.push({
    x: p.x + Math.cos(ang) * 22,
    y: p.y + Math.sin(ang) * 22,
    vx: Math.cos(ang) * CONFIG.player.bulletSpeed,
    vy: Math.sin(ang) * CONFIG.player.bulletSpeed,
    from: 'player',
    dmg: CONFIG.player.pistolDamage,
    life: 1.2,
  });
  state.stats.shotsFired++;
  state.lastShotAt = state.time;
  state.audio.shot();
  addSparks(state, p.x + Math.cos(ang) * 26, p.y + Math.sin(ang) * 26, 3);
}

export function updateBullets(state, dt) {
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && hitsSolid(state.city, b.x, b.y, 2)) {
      addSparks(state, b.x, b.y, 3);
      dead = true;
    }
    if (!dead && b.from === 'player') {
      // Pedestrians and cops.
      for (const ped of state.peds) {
        if (ped.state === 'down') continue;
        if (Math.hypot(ped.x - b.x, ped.y - b.y) < 16) {
          ped.hp -= b.dmg;
          addSparks(state, b.x, b.y, 4);
          dead = true;
          if (ped.hp <= 0) {
            ped.state = 'down';
            ped.downT = 20;
            commitCrime(state, ped.kind === 'cop' ? 2 : 1);
            toast(state, ped.kind === 'cop' ? 'You shot a cop! +2 stars' : 'Pedestrian shot! +1 star');
          } else {
            ped.state = 'flee';
            ped.fleeT = 3;
          }
          break;
        }
      }
      // Cars: damage them; shooting at the police adds a star.
      if (!dead) {
        for (const car of state.cars) {
          if (Math.hypot(car.x - b.x, car.y - b.y) < 26) {
            car.hp -= b.dmg;
            addSparks(state, b.x, b.y, 4);
            dead = true;
            if (car.kind === 'police') commitCrime(state, 1);
            break;
          }
        }
      }
    }
    if (!dead && b.from === 'police') {
      const p = state.player;
      const r = p.inCar ? 26 : 14;
      if (Math.hypot(p.x - b.x, p.y - b.y) < r) {
        damagePlayer(state, b.dmg);
        if (p.inCar) p.inCar.hp -= b.dmg * 0.5;
        dead = true;
      }
    }
    if (dead) state.bullets.splice(i, 1);
  }
}

// From three stars the police shoot: from cars within 520 px and from
// foot cops within 320 px, about one shot per 1.1 seconds, deliberately
// inaccurate.
export function policeShoot(state, dt) {
  const p = state.player;
  if (p.wanted < 3) return;
  const shoot = (fromX, fromY, rangePx) => {
    const d = Math.hypot(p.x - fromX, p.y - fromY);
    if (d > rangePx) return;
    const ang = Math.atan2(p.y - fromY, p.x - fromX) + range(state.rng, -0.16, 0.16);
    state.bullets.push({
      x: fromX, y: fromY,
      vx: Math.cos(ang) * 500,
      vy: Math.sin(ang) * 500,
      from: 'police',
      dmg: CONFIG.wanted.policeBulletDamage,
      life: 1.4,
    });
    state.audio.enemyShot();
  };
  for (const car of state.cars) {
    if (car.kind !== 'police') continue;
    car.shootT = (car.shootT || 0) - dt;
    if (car.shootT <= 0) {
      car.shootT = CONFIG.wanted.policeShotRate;
      shoot(car.x, car.y, CONFIG.wanted.policeShotRangeCar);
    }
  }
  for (const ped of state.peds) {
    if (ped.kind !== 'cop' || ped.state === 'down') continue;
    ped.shootT = (ped.shootT || 0) - dt;
    if (ped.shootT <= 0) {
      ped.shootT = CONFIG.wanted.policeShotRate * 1.3;
      shoot(ped.x, ped.y, CONFIG.wanted.policeShotRangeFoot);
    }
  }
}

// Quiet time cools the heat: after 20 seconds without a crime and with no
// police nearby, one star fades every 14 seconds.
export function updateWanted(state, dt) {
  const p = state.player;
  if (p.wanted <= 0) return;
  if (state.time - p.lastCrimeAt < CONFIG.wanted.quietSeconds) return;
  const nearPolice = state.cars.some(
    (c) => c.kind === 'police' && Math.hypot(c.x - p.x, c.y - p.y) < 600,
  );
  if (nearPolice) return;
  state.wantedHeat.fadeT += dt;
  if (state.wantedHeat.fadeT >= CONFIG.wanted.fadeEvery) {
    state.wantedHeat.fadeT = 0;
    p.wanted--;
    if (p.wanted === 0) toast(state, 'You lost the heat.');
  }
}

// Wasted at zero health, busted when a foot cop holds the player for
// 1.6 seconds. Both wake the player at the hospital or the station with
// full health, no wanted level, and $100 lighter.
export function applyBusted(state) {
  const p = state.player;
  p.money = Math.max(0, p.money - CONFIG.wanted.bustedCost);
  p.hp = CONFIG.player.hp;
  p.wanted = 0;
  p.inCar = null;
  p.bustHold = 0;
  p.x = CONFIG.landmarks.policeHq.x;
  p.y = CONFIG.landmarks.policeHq.y + 120;
  clearPolice(state);
  state.screen = 'busted';
  state.screenT = 0;
  state.audio.fail();
}

export function applyWasted(state) {
  const p = state.player;
  p.money = Math.max(0, p.money - CONFIG.wanted.bustedCost);
  p.hp = CONFIG.player.hp;
  p.wanted = 0;
  p.inCar = null;
  p.bustHold = 0;
  p.x = CONFIG.landmarks.hospital.x;
  p.y = CONFIG.landmarks.hospital.y + 120;
  clearPolice(state);
  state.screen = 'wasted';
  state.screenT = 0;
  state.audio.fail();
}

function clearPolice(state) {
  for (let i = state.cars.length - 1; i >= 0; i--) {
    if (state.cars[i].kind === 'police') state.cars.splice(i, 1);
  }
  for (const ped of state.peds) {
    if (ped.kind === 'cop') {
      ped.kind = 'civilian';
      ped.state = 'walk';
    }
  }
}
