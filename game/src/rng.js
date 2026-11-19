// Solmar Bay — seeded random generator (mulberry32).
// Same seed, same city: every random choice in the game flows through here,
// so the layout, traffic and pedestrians are fully deterministic per seed.

export function createRng(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    // Float in [min, max).
    range(min, max) { return min + next() * (max - min); },
    // Integer in [min, max] inclusive.
    int(min, max) { return min + Math.floor(next() * (max - min + 1)); },
    // Random element of an array.
    pick(arr) { return arr[Math.floor(next() * arr.length)]; },
    // True with probability p (0..1).
    chance(p) { return next() < p; },
  };
}
