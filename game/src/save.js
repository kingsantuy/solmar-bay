// Solmar Bay — save / load. localStorage key 'solmar-bay-save-v1'.
// A missing or broken save is a fresh start, never a crash. In a
// non-browser environment (headless logic tests) localStorage does not
// exist, so an in-memory fallback keeps the same API working there.

const KEY = 'solmar-bay-save-v1';
let memFallback = null;

function storage() {
  try {
    if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
  } catch (e) { /* private mode / unavailable */ }
  return null;
}

export function loadSave() {
  const s = storage();
  try {
    if (s) {
      const raw = s.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return null;
      return data;
    }
  } catch (e) {
    return null;
  }
  return memFallback ? JSON.parse(JSON.stringify(memFallback)) : null;
}

export function saveGame(game) {
  const data = {
    money: game.player.money,
    completed: [...(game.completedMissions || [])],
    stats: { ...game.stats },
    player: { x: Math.round(game.player.x), y: Math.round(game.player.y) },
  };
  const s = storage();
  try {
    if (s) {
      s.setItem(KEY, JSON.stringify(data));
      return true;
    }
  } catch (e) { /* quota / private mode — fall through to memory */ }
  memFallback = data;
  return true;
}

export function clearSave() {
  const s = storage();
  try { if (s) s.removeItem(KEY); } catch (e) { /* ignore */ }
  memFallback = null;
}
