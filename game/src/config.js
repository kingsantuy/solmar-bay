// Every tuning number for Solmar Bay in one place: the world, the roads,
// the car models, the player, the wanted rules and the five story jobs.
// Nothing here names a real place, person or game.
export const CONFIG = {
  world: { w: 4800, h: 3600 },
  roadsV: [420, 980, 1540, 2100, 2660, 3220, 3780, 4340],
  roadsH: [420, 980, 1540, 2100, 2660, 3220],
  roadW: 116,
  sidewalk: 26,
  seaX: 110,
  sandX: 300,

  // Warm roof palette for a sun-soaked coastal city.
  roofColors: ['#c96f4a', '#a86a7e', '#4f9a94', '#d9a441', '#7d5a7a', '#b0523c', '#8a8f4f'],
  containerColors: ['#c9563c', '#3c7dc9', '#4fae5a', '#d9a441'],

  player: {
    walk: 175,
    run: 265,
    radius: 14,
    hp: 100,
    punchDamage: 12,
    punchRate: 0.38,
    punchReach: 34,
    pistolDamage: 26,
    pistolRate: 0.24,
    bulletSpeed: 640,
    regen: 4,
    regenDelay: 8,
    enterRange: 64,
  },

  // Arcade car models: top speed, acceleration, lateral grip, size.
  models: {
    sedan:   { top: 430, accel: 380, grip: 7.0, w: 48, h: 24, colors: ['#c94f4f', '#4f7dc9', '#d9d9d9', '#3a3a3a'] },
    taxi:    { top: 410, accel: 360, grip: 7.0, w: 48, h: 24, colors: ['#f2c230'] },
    sport:   { top: 560, accel: 520, grip: 9.0, w: 46, h: 22, colors: ['#e5322d', '#e5e5e5', '#2d6fe5'] },
    truck:   { top: 330, accel: 260, grip: 5.0, w: 64, h: 26, colors: ['#8a8f96', '#b0563c'] },
    van:     { top: 380, accel: 320, grip: 6.0, w: 56, h: 26, colors: ['#e5e0d0', '#6a8a6a'] },
    police:  { top: 500, accel: 460, grip: 8.0, w: 48, h: 24, colors: ['#20242c'] },
    classic: { top: 400, accel: 340, grip: 6.5, w: 48, h: 24, colors: ['#7db8a0', '#c98a4f', '#9a6a8a'] },
  },

  traffic: { count: 16, cruiseMin: 120, cruiseMax: 210 },
  parked: { count: 9 },
  peds: { count: 26 },

  wanted: {
    max: 5,
    quietSeconds: 20,
    fadeEvery: 14,
    bustHold: 1.6,
    bustedCost: 100,
    policeShotRangeCar: 520,
    policeShotRangeFoot: 320,
    policeShotRate: 1.1,
    policeBulletDamage: 9,
  },

  start: { player: { x: 2350, y: 3180 }, sedan: { x: 2440, y: 3240 } },

  landmarks: {
    hotel: { x: 2400, y: 1500, name: 'Grand Solmar Hotel' },
    casino: { x: 2100, y: 3050, name: 'Marina Casino' },
    chopshop: { x: 3900, y: 1500, name: 'Chop Shop' },
    hospital: { x: 2660, y: 980, name: 'Solmar General' },
    policeHq: { x: 2100, y: 2100, name: 'Police HQ' },
    hideout: { x: 4350, y: 300, name: 'Hideout' },
    lighthouse: { x: 600, y: 350, name: 'Lighthouse' },
    pier: { x: 2350, y: 3350, name: 'Marina Pier' },
    docks: { x: 3900, y: 3350, name: 'Portside Docks' },
  },

  // The red sportscar for the Hot Wheels job waits in the beach lot.
  hotWheelsCar: { x: 430, y: 2100 },

  missions: [
    {
      id: 'fare',
      title: 'First Fare',
      pay: 150,
      briefing: 'A client is waiting at the marina pier. Pick them up and drive them to the Grand Solmar Hotel.',
      steps: [
        { type: 'pickup', x: 2350, y: 3350, label: 'Pick up the client at Marina Pier', radius: 60 },
        { type: 'dropoff', x: 2400, y: 1500, label: 'Drive the client to the Grand Solmar Hotel', radius: 70 },
      ],
    },
    {
      id: 'hotwheels',
      title: 'Hot Wheels',
      pay: 300,
      briefing: 'Lift the red sportscar from the beach lot and deliver it to the Chop Shop in Old Town. A pistol comes with the job.',
      steps: [
        { type: 'steal', x: 430, y: 2100, label: 'Steal the red sportscar from the beach lot', radius: 70 },
        { type: 'deliver', x: 3900, y: 1500, label: 'Deliver the sportscar to the Chop Shop', radius: 70 },
      ],
    },
    {
      id: 'beachrun',
      title: 'Beach Run',
      pay: 400,
      briefing: 'Collect a package at the port, then get it to a house in the Hills within 100 seconds.',
      steps: [
        { type: 'collect', x: 3900, y: 3350, label: 'Collect the package at Portside Docks', radius: 60 },
        { type: 'timed', x: 4350, y: 300, label: 'Deliver to the Hills house', radius: 70, time: 100 },
      ],
    },
    {
      id: 'drop',
      title: 'The Drop',
      pay: 550,
      briefing: 'Pick up a drop at the marina and reach the lighthouse on the north coast. The coast road will be watched.',
      steps: [
        { type: 'collect', x: 2100, y: 3050, label: 'Pick up the drop at the Marina Casino', radius: 60 },
        { type: 'deliver', x: 600, y: 350, label: 'Reach the Lighthouse', radius: 70, police: 2 },
      ],
    },
    {
      id: 'heist',
      title: 'Bay Heist',
      pay: 900,
      briefing: 'Walk into the Marina Casino, grab the cash, then lose the heat and slip away to the hideout in the Hills.',
      steps: [
        { type: 'grab', x: 2100, y: 3050, label: 'Grab the cash inside the Marina Casino', radius: 60, onFoot: true },
        { type: 'escape', x: 4350, y: 300, label: 'Escape to the Hideout — only counts with no wanted level', radius: 70, needsClean: true },
      ],
    },
  ],

  taxi: { minPay: 25, maxPay: 70, spawnMin: 30, spawnMax: 45 },
};

// District names for the HUD banner, by position.
export function districtAt(x, y) {
  if (x < 300) return 'Solmar Beach';
  if (y > 3050 && x < 3400) return 'Marina';
  if (x > 3400 && y > 3050) return 'Portside';
  if (x > 4000 && y < 900) return 'The Hills';
  if (x > 3400) return 'Old Town';
  if (x > 1800 && x < 3400 && y > 1200 && y < 2400) return 'Downtown';
  return 'Solmar Bay';
}
