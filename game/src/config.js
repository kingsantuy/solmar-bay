// Solmar Bay — every tuning number in one place.
// The logic layer (state.js), the city generator (city.js), the renderer
// (render3d.js) and the screenshot staging (shots.js) all read from here,
// so a balance change is one edit, never a hunt through the code.
// World coords: x east 0..4800, y south 0..3600; angle 0 = east,
// increasing clockwise in the plane. One game unit = 0.05 metres.

export const CONFIG = {
  world: { w: 4800, h: 3600 },

  // Road grid. Roads are 116 wide with a 26-wide sidewalk on each side;
  // the extra margin keeps buildings (and the hotel canopy) clear of the
  // road band: band = roadW/2 + sidewalk + roadMargin = 100 from centre.
  roadW: 116,
  sidewalk: 26,
  roadMargin: 16,
  roadsV: [420, 980, 1540, 2100, 2660, 3220, 3780, 4340],
  roadsH: [420, 980, 1540, 2100, 2660, 3220],

  // Eleven warm wall colours for the instanced buildings (seed 1 palette).
  wallColors: [
    '#c96f4a', // terracotta
    '#b56a7a', // mauve
    '#4f8f8a', // teal
    '#c9a24a', // ochre
    '#8a5f7d', // plum
    '#a44a3a', // brick
    '#8a8a4a', // olive
    '#d08a5a', // sand
    '#7a6a9a', // lavender
    '#5a7a5a', // sage
    '#b0785a', // clay
  ],
  roofColor: '#5a4a3a',

  // The player starts on foot near the marina; the starter sedan waits
  // nearby so driving starts in the first minute.
  start: { x: 2350, y: 3180, carX: 2440, carY: 3240 },

  player: {
    health: 100,
    walk: 175,
    run: 265,
    punchDmg: 12,
    punchCd: 0.38,
    punchRange: 34,
    pistolDmg: 26,
    pistolCd: 0.24,
    bulletSpeed: 640,
    enterRange: 64,
    regen: 4, // health per second...
    regenAfter: 8, // ...after 8 quiet seconds without a crime
  },

  trafficCount: 16,
  parkedCount: 9,
  pedCount: 26,

  taxi: { minWait: 30, maxWait: 45, minFare: 25, maxFare: 70 },

  wanted: {
    max: 5,
    quietAfter: 20, // seconds without a crime before stars start fading
    decayEvery: 14, // seconds per star once quiet
    policeMinDist: 650, // patrols spawn 650-850 from the player
    policeMaxDist: 850,
    policeSpawnEvery: 2.5,
    policeDespawn: 1100,
    policeNear: 250, // police inside this radius pause wanted decay
    shootStars: 3, // police shoot from 3 stars
    policeShootRange: 520,
    copShootRange: 320,
    policeShotCd: 1.1, // about one shot per 1.1 seconds
    heliStars: 3, // helicopter joins at 3 stars
    bustHold: 1.6, // seconds a foot cop must hold the player to bust him
    respawnCost: 100, // busted or wasted costs $100
    policeBulletDmg: 9,
  },
};

// The seven car models. Top speeds are the design numbers; acceleration
// and grip were tuned in the polish pass (sedan 380->420 accel, 7.5->8
// grip; sport 520->560 accel, 9->9.5 grip) so the timed Beach Run stays
// fair while the cars feel livelier. len is the collision length.
export const CAR_MODELS = {
  sedan: {
    topSpeed: 430, accel: 420, grip: 8, len: 92, wid: 44,
    colors: ['#4f7dc9', '#c94f4f', '#e8e8e8', '#3a3a3a', '#7a9a5a'],
  },
  taxi: {
    topSpeed: 410, accel: 400, grip: 8, len: 92, wid: 44,
    colors: ['#f2c200', '#f2c200', '#e8b400'],
  },
  sport: {
    topSpeed: 560, accel: 560, grip: 9.5, len: 96, wid: 46,
    colors: ['#d21f2b', '#e5322d', '#c0392b', '#f2c200'],
  },
  truck: {
    topSpeed: 330, accel: 300, grip: 7, len: 124, wid: 52,
    colors: ['#8a8a8a', '#5a6a7a', '#d4af37', '#7a5a3a'],
  },
  van: {
    topSpeed: 380, accel: 360, grip: 7.5, len: 104, wid: 48,
    colors: ['#e8e8e8', '#7a9a5a', '#4f7dc9'],
  },
  police: {
    topSpeed: 500, accel: 480, grip: 8.5, len: 94, wid: 46,
    colors: ['#20242c', '#1c2b4a'],
  },
  classic: {
    topSpeed: 400, accel: 380, grip: 7.5, len: 88, wid: 44,
    colors: ['#7a4a8a', '#2a7a5a', '#c9a24a', '#a44a3a'],
  },
};

// Fixed landmarks, design coordinates. The city generator nudges the
// building rectangles clear of every road band; mission targets and
// respawns keep these design coordinates, which sit on open road beside
// the nudged building.
export const LANDMARKS = {
  hotel: { x: 2400, y: 1500, name: 'Grand Solmar Hotel' },
  casino: { x: 2100, y: 3050, name: 'Marina Casino' },
  chopshop: { x: 3900, y: 1500, name: 'Chop Shop' },
  hospital: { x: 2660, y: 980, name: 'Solmar General' },
  policehq: { x: 2100, y: 2100, name: 'Police HQ' },
  hideout: { x: 4350, y: 300, name: 'Hideout' },
  lighthouse: { x: 600, y: 350, name: 'Lighthouse' },
  pier: { x: 2350, y: 3350, name: 'Marina Pier' },
  docks: { x: 3900, y: 3350, name: 'Portside Docks' },
};

// The seven story jobs, in order. Step kinds: 'pickup' (walk/drive to a
// client or package), 'steal' (enter the mission car), 'grab' (take the
// cash), 'deliver' (drive to a point), 'escape' (complete once the wanted
// level is back to zero). A step completes by distance to its point, or
// to the edge of the building the point sits inside. needQuiet holds a
// step until the heat is gone.
export const MISSIONS = [
  {
    id: 'first-fare',
    title: 'First Fare',
    pay: 150,
    briefing: 'A client is waiting at the marina pier. Pick them up and drive them to the Grand Solmar Hotel.',
    steps: [
      { kind: 'pickup', x: 2350, y: 3350, radius: 70, text: 'Pick up the client at the Marina Pier' },
      { kind: 'deliver', x: 2400, y: 1500, radius: 90, text: 'Drive the client to the Grand Solmar Hotel' },
    ],
  },
  {
    id: 'hot-wheels',
    title: 'Hot Wheels',
    pay: 300,
    briefing: 'A red sportscar is parked in the beach lot. Steal it and deliver it to the Chop Shop in Old Town. The crew will give you a pistol for this one.',
    steps: [
      { kind: 'steal', x: 560, y: 1200, radius: 80, text: 'Steal the red sportscar in the beach lot' },
      { kind: 'deliver', x: 3900, y: 1500, radius: 90, text: 'Deliver the sportscar to the Chop Shop' },
    ],
  },
  {
    id: 'beach-run',
    title: 'Beach Run',
    pay: 400,
    timeLimit: 100,
    briefing: 'Collect a package at the port, then deliver it to a house in the Hills. One hundred seconds — do not dawdle.',
    steps: [
      { kind: 'pickup', x: 3900, y: 3350, radius: 80, text: 'Collect the package at Portside Docks' },
      { kind: 'deliver', x: 4200, y: 600, radius: 90, text: 'Deliver the package to the Hills — 100 seconds!' },
    ],
  },
  {
    id: 'the-drop',
    title: 'The Drop',
    pay: 550,
    briefing: 'Pick up a drop at the marina and reach the lighthouse on the north coast. Two patrol cars are circling the coast road — stay sharp.',
    steps: [
      { kind: 'pickup', x: 2100, y: 3050, radius: 80, text: 'Pick up the drop at the Marina Casino' },
      { kind: 'deliver', x: 600, y: 350, radius: 90, text: 'Reach the Lighthouse on the north coast' },
    ],
  },
  {
    id: 'bay-heist',
    title: 'Bay Heist',
    pay: 900,
    briefing: 'Walk into the Marina Casino, grab the cash, then escape to the hideout in the Hills. The hideout only counts once the heat is gone.',
    steps: [
      { kind: 'grab', x: 2100, y: 3050, radius: 80, text: 'Walk into the Marina Casino and grab the cash' },
      { kind: 'escape', x: 4350, y: 300, radius: 90, needQuiet: true, text: 'Lose the heat, then reach the Hideout' },
    ],
  },
  {
    id: 'night-shift',
    title: 'Night Shift',
    pay: 650,
    briefing: 'Drive the casino boss from the Marina Casino to the Lighthouse, then to the Hideout. You start this one at 2 wanted stars.',
    steps: [
      { kind: 'pickup', x: 2100, y: 3050, radius: 80, text: 'Pick up the casino boss at the Marina Casino' },
      { kind: 'deliver', x: 600, y: 350, radius: 90, text: 'Drive the boss to the Lighthouse' },
      { kind: 'deliver', x: 4350, y: 300, radius: 90, text: 'Drive the boss to the Hideout' },
    ],
  },
  {
    id: 'the-big-one',
    title: 'The Big One',
    pay: 1500,
    briefing: 'Steal the gold truck at Portside Docks, lose a 4-star wanted level with the helicopter on you, then deliver it to the Chop Shop.',
    steps: [
      { kind: 'steal', x: 3900, y: 3350, radius: 80, text: 'Steal the gold truck at Portside Docks' },
      { kind: 'escape', x: 3900, y: 3350, radius: 120, text: 'Lose the 4-star wanted level' },
      { kind: 'deliver', x: 3900, y: 1500, radius: 90, text: 'Deliver the gold truck to the Chop Shop' },
    ],
  },
];
