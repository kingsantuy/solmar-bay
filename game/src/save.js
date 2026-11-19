const KEY = 'solmar-bay-save-v1';
let mem = null;
function store() {
  try {
    if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
  } catch (e) { /* fall through to memory */ }
  return null;
}
export function saveGame(game) {
  const p = game.player;
  const data = {
    money: p.money,
    completed: game.completedMissions.slice(),
    stats: { ...game.stats },
    respect: game.respect.pts,
    weapons: { owned: game.weapons.list.filter((w) => w.owned).map((w) => w.id), cur: game.weapons.cur },
    garage: { ...game.garage },
    pos: { x: Math.round(p.x), y: Math.round(p.y) },
    missionIndex: game.missionIndex,
  };
  try {
    const s = store();
    if (s) s.setItem(KEY, JSON.stringify(data));
    else mem = JSON.stringify(data);
  } catch (e) { /* a broken save never crashes the game */ }
  return data;
}
export function loadSave() {
  let raw = null;
  try {
    const s = store();
    raw = s ? s.getItem(KEY) : mem;
  } catch (e) { return null; }
  if (!raw) return null;
  try {
    const d = JSON.parse(raw);
    if (typeof d.money !== 'number' || !Array.isArray(d.completed)) return null;
    return d;
  } catch (e) { return null; }
}
export function clearSave() {
  try {
    const s = store();
    if (s) s.removeItem(KEY);
    else mem = null;
  } catch (e) { /* ignore */ }
}
