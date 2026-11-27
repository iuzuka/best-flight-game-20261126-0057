// The game's rules and state, with no drawing and no browser in it: the courier plane, the
// route it flies (rings, parcels, storms, volcanic peaks and a runway at each leg's end),
// spawning, collisions, score, fuel, hull and legs. step() advances one fixed step and
// returns what happened as bit flags, so the caller can react without the world knowing
// about screens or sound. Nothing here allocates after createWorld returns.
import {
  FIELD, FUEL, HULL, KNOT_MS, LAND_ALT_FT, LAND_POINTS, LAND_SPEED_KT, LEGS, PARCEL,
  PEAK, PLANE, POOL_SIZE, RING, RUNWAY_RECYCLE_M, STORM,
} from './config.js';
import { range } from './random.js';

export const KIND_RING = 0;
export const KIND_PARCEL = 1;
export const KIND_STORM = 2;
export const KIND_PEAK = 3;

export const EVENT_RING = 1;
export const EVENT_PARCEL = 2;
export const EVENT_HIT = 4;
export const EVENT_LAND = 8;
export const EVENT_LEG = 16;
export const EVENT_OVER = 32;
export const EVENT_WIN = 64;

/** How far ahead of the plane an item becomes active (and visible). */
const VIEW_M = 4600;
/** Seconds of grace after a storm hit before another can hurt the plane. */
const GRACE = 1.6;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function createWorld(random) {
  const plane = { x: 0, alt: 1500, speed: PLANE.cruiseSpeed, heading: 0, bank: 0, pitch: 0 };
  const items = [];
  for (let index = 0; index < POOL_SIZE; index += 1) {
    items.push({ active: false, kind: KIND_RING, dist: 0, x: 0, alt: 0, height: 0, resolved: false });
  }
  const state = {
    plane,
    items,
    distance: 0,
    legDistance: 0,
    legIndex: 0,
    score: 0,
    ringsHit: 0,
    ringsTotal: 0,
    parcels: 0,
    fuel: FUEL.start,
    hull: HULL,
    time: 0,
    message: '',
    messageUntil: 0,
    flash: 0,
    shake: 0,
    invulnerable: 0,
    overReason: '',
    legComplete: false,
    won: false,
    runway: { dist: 0, x: 0, missed: false },
  };

  function freeItem() {
    for (let index = 0; index < items.length; index += 1) if (!items[index].active) return items[index];
    return null;
  }

  function addItem(kind, dist, x, alt, height) {
    const item = freeItem();
    if (item === null) return;
    item.active = true;
    item.kind = kind;
    item.dist = dist;
    item.x = x;
    item.alt = alt;
    item.height = height;
    item.resolved = false;
  }

  /** Lay out one leg's route: rings to fly through, parcels to grab, storms and peaks to avoid. */
  function buildLeg(index) {
    for (const item of items) item.active = false;
    const leg = LEGS[index];
    state.ringsTotal = leg.rings;
    state.ringsHit = 0;
    state.legDistance = 0;
    state.runway.dist = leg.distance;
    state.runway.x = 0;
    state.runway.missed = false;
    const usable = leg.distance - 900;
    // Rings first, evenly spaced so the route always has a next target.
    for (let n = 0; n < leg.rings; n += 1) {
      const dist = 700 + (usable * (n + 0.5)) / leg.rings + range(random, -160, 160);
      addItem(KIND_RING, dist, range(random, -0.68, 0.68), range(random, 900, 6200), 0);
    }
    for (let n = 0; n < leg.parcels; n += 1) {
      addItem(KIND_PARCEL, range(random, 900, leg.distance - 500), range(random, -0.75, 0.75), range(random, 700, 5800), 0);
    }
    for (let n = 0; n < leg.storms; n += 1) {
      addItem(KIND_STORM, range(random, 1100, leg.distance - 400), range(random, -0.7, 0.7), range(random, 1600, 5200), 0);
    }
    for (let n = 0; n < leg.peaks; n += 1) {
      addItem(KIND_PEAK, range(random, 1300, leg.distance - 700), range(random, -0.8, 0.8), 0, range(random, PEAK.minHeightFt, PEAK.maxHeightFt));
    }
  }

  function reset() {
    plane.x = 0;
    plane.alt = 1500;
    plane.speed = PLANE.cruiseSpeed;
    plane.heading = 0;
    plane.bank = 0;
    plane.pitch = 0;
    state.distance = 0;
    state.legIndex = 0;
    state.score = 0;
    state.parcels = 0;
    state.fuel = FUEL.start;
    state.hull = HULL;
    state.time = 0;
    state.message = '';
    state.messageUntil = 0;
    state.flash = 0;
    state.shake = 0;
    state.invulnerable = 0;
    state.overReason = '';
    state.legComplete = false;
    state.won = false;
    buildLeg(0);
  }

  function say(text, seconds) {
    state.message = text;
    state.messageUntil = state.time + seconds;
  }

  function startLeg(index) {
    state.legIndex = index;
    state.fuel = FUEL.start;
    state.legComplete = false;
    buildLeg(index);
    say(`LEG ${index + 1} — ${LEGS[index].name}`, 3);
  }

  function land() {
    state.score += LAND_POINTS;
    state.legComplete = true;
    if (state.legIndex >= LEGS.length - 1) {
      state.won = true;
      return EVENT_LAND | EVENT_WIN;
    }
    return EVENT_LAND | EVENT_LEG;
  }

  function crash(reason) {
    state.hull = 0;
    state.overReason = reason;
    return EVENT_OVER;
  }

  /**
   * One fixed step. `control` is {bank, pitch, boost} in -1..1. With `harmless` set (the title
   * screen's backdrop) the plane wanders on its own and nothing scores or hurts it.
   */
  function step(dt, control, harmless) {
    let events = 0;
    state.time += dt;
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 1.4);
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 1.8);
    if (state.invulnerable > 0) state.invulnerable -= dt;

    if (harmless) {
      plane.bank = Math.sin(state.time * 0.35) * 0.45;
      plane.pitch = Math.sin(state.time * 0.21) * 0.3;
      plane.heading += plane.bank * PLANE.turnRate * 0.4 * dt;
      plane.x = clamp(plane.x + plane.bank * PLANE.lateralSpeed * 0.5 * dt, -0.5, 0.5);
      plane.alt = clamp(plane.alt + plane.pitch * 500 * dt, 1200, 3200);
      plane.speed = PLANE.cruiseSpeed;
      state.distance += plane.speed * KNOT_MS * dt;
      state.legDistance += plane.speed * KNOT_MS * dt;
      return 0;
    }

    // Banking turns the heading and slides the plane sideways; the heading itself drifts it too.
    const targetBank = clamp(control.bank, -1, 1);
    plane.bank += (targetBank - plane.bank) * Math.min(1, dt * 6);
    plane.heading = clamp(plane.heading + plane.bank * PLANE.turnRate * dt, -38, 38);
    plane.x = clamp(
      plane.x + (plane.bank * PLANE.lateralSpeed + Math.sin((plane.heading * Math.PI) / 180) * 0.55) * dt,
      PLANE.xMin,
      PLANE.xMax,
    );
    if ((plane.x === PLANE.xMin && plane.heading < 0) || (plane.x === PLANE.xMax && plane.heading > 0)) {
      plane.heading *= 1 - Math.min(1, dt * 2);
    }

    const targetPitch = clamp(control.pitch, -1, 1);
    plane.pitch += (targetPitch - plane.pitch) * Math.min(1, dt * 5);
    plane.alt = clamp(
      plane.alt + plane.pitch * (plane.pitch > 0 ? PLANE.climbRate : PLANE.descendRate) * dt,
      PLANE.altMin,
      PLANE.altMax,
    );

    // Auto-throttle toward cruise (boost adds speed); climbing bleeds speed, diving gains it.
    const targetSpeed = PLANE.cruiseSpeed + (control.boost ? PLANE.boostSpeed : 0);
    plane.speed += clamp(targetSpeed - plane.speed, -55 * dt, 55 * dt);
    plane.speed = clamp(plane.speed - plane.pitch * 14 * dt, PLANE.speedMin, PLANE.speedMax);

    state.distance += plane.speed * KNOT_MS * dt;
    state.legDistance += plane.speed * KNOT_MS * dt;

    // Fuel: cruise burn plus a little per knot, plus the boost's extra.
    state.fuel = Math.max(
      0,
      state.fuel - (FUEL.burn + plane.speed * FUEL.burnPerKnot + (control.boost ? FUEL.boostFuel : 0)) * dt,
    );
    if (state.fuel <= FUEL.lowWarn && state.fuel > 0 && Math.floor(state.time * 2) !== Math.floor((state.time - dt) * 2)) {
      say('LOW FUEL', 0.6);
    }
    if (state.fuel <= 0) {
      plane.speed = Math.max(95, plane.speed - 30 * dt);
      plane.alt = Math.max(PLANE.altMin, plane.alt - 260 * dt);
      if (plane.alt <= PLANE.altMin + 4) return crash('OUT OF FUEL');
    }

    // Scraping the terrain floor hurts and bounces the plane back up.
    if (plane.alt <= PLANE.altMin + 4 && plane.pitch < -0.2 && state.invulnerable <= 0) {
      state.hull -= 1;
      state.invulnerable = GRACE;
      state.flash = 0.8;
      state.shake = 0.7;
      plane.alt = 420;
      say('TERRAIN! PULL UP', 1.6);
      events |= EVENT_HIT;
      if (state.hull <= 0) return events | crash('TERRAIN STRIKE');
    }

    // The runway at the leg's end: cross it low and slow to land, or fly past and come around.
    const runwayRel = state.runway.dist - state.legDistance;
    if (runwayRel <= 0 && !state.legComplete) {
      if (plane.alt <= LAND_ALT_FT && plane.speed <= LAND_SPEED_KT) {
        return events | land();
      }
      state.runway.dist += RUNWAY_RECYCLE_M;
      state.runway.missed = true;
      say('MISSED THE RUNWAY — COMING AROUND', 2.4);
    }

    // Items: resolve each one as the plane passes its distance.
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      if (!item.active || item.resolved) continue;
      const rel = item.dist - state.legDistance;
      if (rel > VIEW_M) continue;
      if (rel > 0) continue;
      item.resolved = true;
      item.active = false;
      if (item.kind === KIND_RING) {
        if (Math.abs(plane.x - item.x) < RING.radiusX && Math.abs(plane.alt - item.alt) < RING.radiusFt) {
          state.score += RING.points;
          state.ringsHit += 1;
          say(`RING +${RING.points}`, 1.1);
          events |= EVENT_RING;
        }
      } else if (item.kind === KIND_PARCEL) {
        if (Math.abs(plane.x - item.x) < PARCEL.radiusX && Math.abs(plane.alt - item.alt) < PARCEL.radiusFt) {
          state.score += PARCEL.points;
          state.parcels += 1;
          say(`PARCEL +${PARCEL.points}`, 1.1);
          events |= EVENT_PARCEL;
        }
      } else if (item.kind === KIND_STORM) {
        if (
          state.invulnerable <= 0 &&
          Math.abs(plane.x - item.x) < STORM.radiusX &&
          Math.abs(plane.alt - item.alt) < STORM.radiusFt
        ) {
          state.hull -= 1;
          state.invulnerable = GRACE;
          state.flash = 1;
          state.shake = 0.9;
          say('LIGHTNING STRIKE!', 1.6);
          events |= EVENT_HIT;
          if (state.hull <= 0) return events | crash('CAUGHT IN THE STORM');
        }
      } else if (item.kind === KIND_PEAK) {
        if (Math.abs(plane.x - item.x) < PEAK.halfWidth && plane.alt < item.height) {
          return events | crash('FLEW INTO THE MOUNTAIN');
        }
      }
    }
    return events;
  }

  return { state, reset, step, startLeg, FIELD };
}
