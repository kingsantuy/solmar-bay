// Seeded random numbers (mulberry32). Same seed, same city: the whole
// layout of Solmar Bay is a pure function of one seed.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A uniform float in [min, max).
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

// A uniform integer in [min, max].
export function int(rng, min, max) {
  return Math.floor(range(rng, min, max + 1));
}

// One element of an array, uniformly.
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// True with probability p.
export function chance(rng, p) {
  return rng() < p;
}
