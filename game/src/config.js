export const CONFIG = {
  world: { w: 4800, h: 3600 },
  roadsV: [420, 980, 1540, 2100, 2660, 3220, 3780, 4340],
  roadsH: [420, 980, 1540, 2100, 2660, 3220],
  roadW: 116, sidewalk: 26, roadMargin: 16,
  wallColors: ['#c96a4a', '#8a6d8b', '#4f8a8b', '#c9a24a', '#7a4a6e', '#a34a3a', '#7a7a4a', '#d8b48f', '#5a7a9e', '#9e6a4a', '#6a8a5a'],
  walkSpeed: 175, runSpeed: 265, playerRadius: 14,
  punchDmg: 12, punchRate: 0.38, punchReach: 40,
  playerHealth: 100, regenRate: 4, regenDelay: 8,
  bulletSpeed: 640, policeBulletSpeed: 500, policeBulletDmg: 9,
  maxStars: 5, quietTime: 20, decayEvery: 14, bustHold: 1.6, respawnCost: 100,
  trafficCount: 16, parkedCount: 9, pedCount: 26, maxPolice: 5,
  policeSpawnEvery: 2.5, policeSpawnMin: 650, policeSpawnMax: 850, policeDespawn: 1100,
  heliFromStars: 3, policeShootRange: 520, copShootRange: 320, policeShotEvery: 1.1,
  taxiMin: 30, taxiMax: 45, fareMin: 25, fareMax: 70,
  paintColors: ['#e5322d', '#4f7dc9', '#f2c200', '#2a7a5a', '#e67e22', '#8e44ad', '#e8e8e8', '#20242c'],
};
export const CAR_MODELS = {
  sedan: { topSpeed: 430, accel: 420, grip: 8, len: 96, wid: 48 },
  taxi: { topSpeed: 410, accel: 400, grip: 8, len: 96, wid: 48 },
  sport: { topSpeed: 560, accel: 560, grip: 9.5, len: 100, wid: 50 },
  truck: { topSpeed: 330, accel: 300, grip: 7, len: 130, wid: 54 },
  van: { topSpeed: 380, accel: 340, grip: 7, len: 110, wid: 52 },
  police: { topSpeed: 500, accel: 480, grip: 8.5, len: 100, wid: 50 },
  classic: { topSpeed: 400, accel: 380, grip: 7.5, len: 96, wid: 48 },
};
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
export const WEAPONS = [
  { id: 'fists', name: 'Fists', dmg: 12, rate: 0.38, price: 0, owned: true, reqRespect: 0 },
  { id: 'pistol', name: 'Pistol', dmg: 26, rate: 0.24, price: 0, owned: false, reqRespect: 0 },
  { id: 'smg', name: 'SMG', dmg: 18, rate: 0.09, price: 800, owned: false, reqRespect: 0 },
  { id: 'shotgun', name: 'Shotgun', dmg: 40, rate: 0.7, price: 1500, owned: false, reqRespect: 0 },
  { id: 'rifle', name: 'Rifle', dmg: 60, rate: 0.9, price: 3000, owned: false, reqRespect: 400 },
];
export const GARAGE = { repair: 100, paint: 250, engine: 800, armour: 1200, engineMax: 2, armourMax: 2, engineBonus: 40, armourBonus: 50 };
export const RADIO = [
  { name: 'Coastal Funk', track: 'Boardwalk Boogie · The Tides' },
  { name: 'Sunset Synth', track: 'Golden Hour · Solmar Nights' },
  { name: 'Night Drive', track: 'Empty Streets · Night Owl' },
];
export const CREW = {
  mara: { name: 'Mara', role: 'CREW BOSS', init: 'MA', color: '#c94f7c' },
  diz: { name: 'Diz', role: 'WHEELMAN', init: 'DZ', color: '#4f9dc9' },
  rook: { name: 'Rook', role: 'DRIVER', init: 'RK', color: '#e5322d' },
};
export const CALLSIGNS = ['GULL-11', 'CORAL-25', 'REEF-18', 'TAC-45', 'SURF-7', 'DUNE-33'];
export const MISSIONS = [
  { id: 'first-fare', title: 'First Fare', pay: 150, briefing: 'First job, Rook. Pick up the client at the pier, drop them at the Grand Solmar. Easy money.', speaker: 'mara', line: 'First job, Rook. Pier pickup, hotel drop. Don\'t keep the client waiting.', steps: [
    { kind: 'go', x: 2350, y: 3350, label: 'Pick up the client at Marina Pier' },
    { kind: 'go', x: 2400, y: 1500, label: 'Drop the client at the Grand Solmar Hotel' } ] },
  { id: 'hot-wheels', title: 'Hot Wheels', pay: 300, briefing: 'That red sportscar in the beach lot? It\'s ours now. Bring it to the Chop Shop.', speaker: 'diz', line: 'Red sportscar, beach lot, Chop Shop. Take this pistol — you\'ll need it.', steps: [
    { kind: 'steal', car: 'sport', x: 448, y: 2100, label: 'Steal the red sportscar in the beach lot' },
    { kind: 'go', x: 3900, y: 1500, label: 'Deliver the sportscar to the Chop Shop' } ] },
  { id: 'beach-run', title: 'Beach Run', pay: 400, timeLimit: 100, briefing: 'Package at the port, house in the Hills. Hundred seconds. Don\'t be late.', speaker: 'mara', line: 'Port pickup, Hills drop, a hundred seconds on the clock. Move.', steps: [
    { kind: 'go', x: 3900, y: 3350, label: 'Collect the package at Portside Docks' },
    { kind: 'go', x: 4200, y: 500, label: 'Deliver the package to the house in the Hills' } ] },
  { id: 'the-drop', title: 'The Drop', pay: 550, briefing: 'Grab the drop at the marina, then run it to the lighthouse. Coast road is crawling with patrols.', speaker: 'diz', line: 'Marina drop, lighthouse run. Two patrols work the coast road — stay sharp.', steps: [
    { kind: 'go', x: 2350, y: 3350, label: 'Pick up the drop at the marina' },
    { kind: 'go', x: 600, y: 350, label: 'Reach the Lighthouse on the north coast' } ] },
  { id: 'bay-heist', title: 'Bay Heist', pay: 900, briefing: 'The casino is ripe. Walk in, grab the cash, get to the hideout — and shake the heat first.', speaker: 'mara', line: 'Walk into the casino, grab the cash, then vanish. The hideout only counts when you\'re clean.', steps: [
    { kind: 'go', x: 2100, y: 3050, onFoot: true, label: 'Walk into the Marina Casino and grab the cash' },
    { kind: 'go', x: 4350, y: 300, needStars: 0, label: 'Escape to the Hideout — only counts once the heat is gone' } ] },
  { id: 'night-shift', title: 'Night Shift', pay: 650, briefing: 'Drive the casino boss from the Marina Casino to the Lighthouse, then the Hideout. We start at two stars.', speaker: 'mara', line: 'Boss needs a ride: casino, lighthouse, hideout. We\'re already at two stars, so drive clean.', steps: [
    { kind: 'go', x: 2100, y: 3050, label: 'Pick up the casino boss at the Marina Casino' },
    { kind: 'go', x: 600, y: 350, label: 'Drive the boss to the Lighthouse' },
    { kind: 'go', x: 4350, y: 300, label: 'Drop the boss at the Hideout' } ] },
  { id: 'the-big-one', title: 'The Big One', pay: 1500, briefing: 'Steal the gold truck at Portside Docks, lose a 4-star heat with the chopper on you, then deliver it.', speaker: 'diz', line: 'Gold truck at the docks. Jack it, lose the whole city, bring it home. Big payday.', steps: [
    { kind: 'steal', car: 'truck', x: 3900, y: 3260, label: 'Steal the gold truck at Portside Docks' },
    { kind: 'escape', stars: 4, label: 'Lose the 4-star heat — the helicopter is up' },
    { kind: 'go', x: 3900, y: 1500, label: 'Deliver the gold truck to the Chop Shop' } ] },
  { id: 'golden-hour', title: 'Golden Hour', pay: 2000, briefing: 'Meet the crew at the casino — then the whole city comes for us. Lose them, get to the hideout, and we\'re legends.', speaker: 'mara', line: 'Golden hour, Rook. Meet the crew, then survive the manhunt. Lose all five stars and get to the hideout.', steps: [
    { kind: 'go', x: 2100, y: 3050, label: 'Meet the crew at the Marina Casino' },
    { kind: 'escape', stars: 5, label: 'Survive the manhunt — lose all 5 stars' },
    { kind: 'go', x: 4350, y: 300, label: 'Deliver to the Hideout' } ] },
];
