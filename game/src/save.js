// Save and continue, in localStorage. A missing or broken save is a fresh
// start, never a crash.
export const SAVE_KEY = 'solmar-bay-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.money !== 'number' || !Array.isArray(data.done)) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveGame(data) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage may be unavailable; the game still plays.
  }
}
