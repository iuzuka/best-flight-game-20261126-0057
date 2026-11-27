// The screenshot scenes behind ?shot=start|play|rings|end. Each one plays the real rules
// forward from a fresh world for a fixed time, steered by an autopilot that flies toward the
// next ring, climbs over peaks and steers around storms, so every frame is what a real game
// looks like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { EVENT_LAND, EVENT_OVER, KIND_PARCEL, KIND_PEAK, KIND_RING, KIND_STORM } from './world.js';
import { SCREEN_LEG, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 30;
const RINGS_SECONDS = 45;
const END_LIMIT_SECONDS = 240;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** The next ring or parcel the plane has not passed yet. */
function nextTarget(state) {
  let best = null;
  for (const item of state.items) {
    if (!item.active || item.resolved) continue;
    if (item.kind !== KIND_RING && item.kind !== KIND_PARCEL) continue;
    const rel = item.dist - state.legDistance;
    if (rel < 0) continue;
    if (best === null || rel < best.rel) best = { item, rel };
  }
  return best;
}

/** The nearest peak or storm ahead that the plane would fly into. */
function nextThreat(state) {
  const plane = state.plane;
  let best = null;
  for (const item of state.items) {
    if (!item.active || item.resolved) continue;
    if (item.kind !== KIND_PEAK && item.kind !== KIND_STORM) continue;
    const rel = item.dist - state.legDistance;
    if (rel < 0 || rel > 1500) continue;
    const lateral = Math.abs(plane.x - item.x);
    const vertical = item.kind === KIND_PEAK ? plane.alt < item.height + 500 : Math.abs(plane.alt - item.alt) < 800;
    if (lateral < 0.34 && vertical && (best === null || rel < best.rel)) best = { item, rel };
  }
  return best;
}

/**
 * One frame of autopilot: fly at the next ring, climb over a peak in the way, steer around a
 * storm, and when the runway is close, come down low and slow to land on it.
 */
function autopilot(state) {
  const plane = state.plane;
  const runwayRel = state.runway.dist - state.legDistance;
  const landing = runwayRel > 0 && runwayRel < 1500;
  let wantX = plane.x;
  let wantAlt = clamp(plane.alt, 1200, 4200);
  let boost = false;

  if (landing) {
    wantX = 0;
    wantAlt = runwayRel < 500 ? 260 : 700;
  } else {
    const target = nextTarget(state);
    if (target !== null) {
      wantX = target.item.x;
      wantAlt = target.item.alt;
    }
    const threat = nextThreat(state);
    if (threat !== null) {
      if (threat.item.kind === KIND_PEAK) {
        // Climb over it, and slide away from its side at the same time.
        wantAlt = Math.max(wantAlt, threat.item.height + 900);
        wantX = plane.x + (plane.x < threat.item.x ? -0.5 : 0.5);
      } else {
        wantX = plane.x + (plane.x < threat.item.x ? -0.45 : 0.45);
      }
    }
    // Long straight stretches: keep the speed up.
    if (target !== null && target.rel > 1200) boost = true;
  }

  // Never scrape the terrain unless the runway is right there.
  if (!landing && plane.alt < 550) wantAlt = 1100;
  if (landing && plane.alt < 200) wantAlt = 280;

  const bank = clamp((wantX - plane.x) * 2.4, -1, 1);
  const pitch = clamp((wantAlt - plane.alt) / 1300, -1, 1);
  return { bank, pitch, throttle: 0, boost, pointerX: 0.5, pointerY: 0.5, pointerHeld: false };
}

/**
 * Set `world` to the named scene (start, play, rings or end; any other name is start) and
 * return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'rings' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) world.step(STEP, { bank: 0, pitch: 0, boost: false }, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'rings') {
    // Fly until a ring fills the frame, then freeze: the gate is right there.
    for (let index = 0; index < RINGS_SECONDS / STEP; index += 1) {
      const events = world.step(STEP, autopilot(world.state), false);
      if (events & EVENT_OVER) return { screen: SCREEN_OVER, best: world.state.score };
      const target = nextTarget(world.state);
      if (world.state.time > 10 && target !== null && target.rel < 520 && target.item.kind === KIND_RING) {
        return { screen: SCREEN_PLAY, best: world.state.score };
      }
    }
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'end') {
    // Fly the whole first leg and land it: the leg-complete screen over the runway.
    for (let index = 0; index < END_LIMIT_SECONDS / STEP; index += 1) {
      const events = world.step(STEP, autopilot(world.state), false);
      if (events & EVENT_LAND) return { screen: SCREEN_LEG, best: world.state.score };
      if (events & EVENT_OVER) return { screen: SCREEN_OVER, best: world.state.score };
    }
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  for (let index = 0; index < PLAY_SECONDS / STEP; index += 1) {
    const events = world.step(STEP, autopilot(world.state), false);
    if (events & EVENT_OVER) return { screen: SCREEN_OVER, best: world.state.score };
    if (events & EVENT_LAND) return { screen: SCREEN_LEG, best: world.state.score };
  }
  return { screen: SCREEN_PLAY, best: world.state.score };
}
