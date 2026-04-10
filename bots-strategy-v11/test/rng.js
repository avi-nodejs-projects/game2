// Seeded pseudo-random number generator for deterministic tests.
// mulberry32 — small, fast, good distribution for testing use cases.
// https://en.wikipedia.org/wiki/Linear_congruential_generator (related family)

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

module.exports = { mulberry32 };
