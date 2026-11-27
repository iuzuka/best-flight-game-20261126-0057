// A small deterministic generator (mulberry32) so a seed always builds the same route:
// the same ?seed=N always flies the same rings, peaks and storms, which is what makes the
// screenshot scenes reproducible. Nothing here touches the DOM or the clock.
export function createRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** A value in [min, max) from the generator. */
export function range(random, min, max) {
  return min + random() * (max - min);
}

/** Pick one entry of an array. */
export function pick(random, array) {
  return array[Math.floor(random() * array.length)];
}
