// Solmar Bay — every tuning number in one place.
// World, player, cars, wanted rules, taxi fares and the 7 story missions.
// DESIGN.md §2/§3/§5 is the source of these numbers.

export const CONFIG = {
  world: { w: 4800, h: 3600 },
  roadsV: [420, 980, 1540, 2100, 2660, 3220, 3780, 4340],
  roadsH: [420, 980, 1540, 2100, 2660, 3220],
  roadW: 116,
  sidewalk: 26,
  seaX: 110,
  beachX1: 300,

  player: {
    walk: 175, run: 265,
    health: 100, regen: 4, regenAfter: 8,
    punchDmg: 12, punchCd: 0.38, punchRange: 34,
    pistolDmg: 26, pistolCd: 0.24, bulletSpeed: 640,
    enterRange: 64,
  },

  trafficCount: 16,
  parkedCount: 9,
  pedCount: 26,

  wanted: {
    max: 5,
    quietAfter: 20,      // seconds without a crime before stars start fading
    decayEvery: 14,      // seconds per star faded
    policeSpawnEvery: 2.5,
    policeMinDist: 650, policeMaxDist: 850,
    policeDespawn: 1100,
    policeNear: 250,     // police closer than this pause the decay
    bustHold: 1.6,       // seconds a foot cop must hold the player
    respawnCost: 100,
    heliStars: 3,
    shootStars: 3,
    policeShootRange: 520,
    copShootRange: 320,
    policeShotCd: 1.1,
    policeBulletDmg: 9,
  },

  taxi: { minFare: 25, maxFare: 70, minWait: 30, maxWait: 45 },

  start: { x: 2350, y: 3180, carX: 2440, carY: 3240 },

  palette: {
    roofs: ['#b5674c', '#8f6b7a', '#4f8a8b', '#c09a4e', '#7d5a7a', '#a34d3d', '#8a8a5a'],
    grass: '#5d8a4a',
    containers: ['#c0392b', '#2980b9', '#27ae60', '#e67e22'],
  },
};

// Fixed story landmarks (design coordinates from DESIGN.md §2).
// Mission targets keep these coordinates; city.js nudges the actual
// building rects clear of every road band.
export const LANDMARKS = {
  hotel: { x: 2400, y: 1500 },
  casino: { x: 2100, y: 3050 },
  chopshop: { x: 3900, y: 1500 },
  hospital: { x: 2660, y: 980 },
  policehq: { x: 2100, y: 2100 },
  hideout: { x: 4350, y: 300 },
  lighthouse: { x: 600, y: 350 },
  pier: { x: 2350, y: 3350 },
  docks: { x: 3900, y: 3350 },
};

// Car models: topSpeed is the headline number (DESIGN.md §3), plus the
// arcade handling values the driving model uses.
export const CAR_MODELS = {
  sedan:   { topSpeed: 430, accel: 380, grip: 7.5, len: 46, wid: 24, colors: ['#c0392b', '#2e86c1', '#7d7d7d', '#e8e8e8', '#2c3e50'] },
  taxi:    { topSpeed: 410, accel: 360, grip: 7.0, len: 46, wid: 24, colors: ['#f1c40f'] },
  sport:   { topSpeed: 560, accel: 520, grip: 9.0, len: 44, wid: 24, colors: ['#d21f2b', '#111111', '#e67e22'] },
  truck:   { topSpeed: 330, accel: 260, grip: 6.0, len: 62, wid: 28, colors: ['#7f8c8d', '#5d6d7e', '#a04000'] },
  van:     { topSpeed: 380, accel: 320, grip: 6.5, len: 54, wid: 26, colors: ['#ecf0f1', '#5dade2', '#a569bd'] },
  police:  { topSpeed: 500, accel: 460, grip: 8.5, len: 48, wid: 24, colors: ['#1a1a2e'] },
  classic: { topSpeed: 400, accel: 340, grip: 7.0, len: 46, wid: 24, colors: ['#7fb069', '#d9a441', '#8e6cc8'] },
};

// The 7 story missions, in order. Step kinds: goto | pickup | dropoff |
// steal | grab | escape. needQuiet: the step only counts while wanted is 0.
export const MISSIONS = [
  {
    id: 'first-fare', title: 'First Fare', pay: 150,
    briefing: 'A client is waiting at Marina Pier. Pick them up and drive them to the Grand Solmar Hotel.',
    steps: [
      { kind: 'pickup', x: 2350, y: 3350, radius: 90, text: 'Pick up the client at Marina Pier' },
      { kind: 'dropoff', x: 2400, y: 1500, radius: 90, text: 'Drop the client at the Grand Solmar Hotel' },
    ],
  },
  {
    id: 'hot-wheels', title: 'Hot Wheels', pay: 300,
    briefing: 'A red sportscar is parked in the beach lot. Steal it and deliver it to the Chop Shop in Old Town. The crew will hand you a pistol for this one.',
    steps: [
      { kind: 'steal', x: 560, y: 1200, radius: 80, text: 'Steal the red sportscar in the beach lot' },
      { kind: 'dropoff', x: 3900, y: 1500, radius: 90, text: 'Deliver it to the Chop Shop' },
    ],
  },
  {
    id: 'beach-run', title: 'Beach Run', pay: 400,
    briefing: 'Collect a package at Portside Docks and deliver it to a house in the Hills. You have 100 seconds.',
    timeLimit: 100,
    steps: [
      { kind: 'grab', x: 3900, y: 3350, radius: 90, text: 'Collect the package at Portside Docks' },
      { kind: 'dropoff', x: 4450, y: 600, radius: 90, text: 'Deliver it to the Hills house — fast!' },
    ],
  },
  {
    id: 'the-drop', title: 'The Drop', pay: 550,
    briefing: 'Pick up the drop at the Marina and reach the Lighthouse on the north coast. Two patrol cars are circling the coast road — stay sharp.',
    steps: [
      { kind: 'pickup', x: 2100, y: 3050, radius: 90, text: 'Pick up the drop at the Marina' },
      { kind: 'goto', x: 600, y: 350, radius: 90, text: 'Reach the Lighthouse on the north coast' },
    ],
  },
  {
    id: 'bay-heist', title: 'Bay Heist', pay: 900,
    briefing: 'Walk into the Marina Casino, grab the cash, and escape to the Hideout in the Hills. The hideout only counts once the heat is off.',
    steps: [
      { kind: 'goto', x: 2100, y: 3050, radius: 100, text: 'Walk into the Marina Casino' },
      { kind: 'grab', x: 2100, y: 3050, radius: 100, text: 'Grab the cash' },
      { kind: 'dropoff', x: 4350, y: 300, radius: 90, needQuiet: true, text: 'Escape to the Hideout — only when the heat is off' },
    ],
  },
  {
    id: 'night-shift', title: 'Night Shift', pay: 650,
    briefing: 'Taxi the casino boss from the Marina Casino to the Lighthouse, then on to the Hideout. The heat is already on — you start at 2 stars.',
    steps: [
      { kind: 'pickup', x: 2100, y: 3050, radius: 90, text: 'Pick up the casino boss at the Marina Casino' },
      { kind: 'dropoff', x: 600, y: 350, radius: 90, text: 'Drive the boss to the Lighthouse' },
      { kind: 'dropoff', x: 4350, y: 300, radius: 90, text: 'Then to the Hideout' },
    ],
  },
  {
    id: 'the-big-one', title: 'The Big One', pay: 1500,
    briefing: 'Steal the gold truck at Portside Docks, lose a 4-star wanted level with the helicopter on you, then deliver the truck to the Chop Shop.',
    steps: [
      { kind: 'steal', x: 3900, y: 3350, radius: 80, text: 'Steal the gold truck at Portside Docks' },
      { kind: 'escape', x: 3900, y: 1500, radius: 90, text: 'Lose the cops — get the heat to zero' },
      { kind: 'dropoff', x: 3900, y: 1500, radius: 90, text: 'Deliver the gold truck to the Chop Shop' },
    ],
  },
];
