// Everything the eye sees: a golden-hour chase view from behind the courier plane over an
// island archipelago — sea and coastline, patchwork rice fields, a winding river, villages,
// a distant volcano — plus the plane itself, the rings and hazards ahead, the runway, and a
// lit instrument panel with altitude, speed and heading on the HUD. All drawing is canvas 2D
// with no loaded assets, so the game runs from plain files with no network request.
import { FIELD, FONT, LEGS, PALETTE } from './config.js';
import { KIND_PARCEL, KIND_PEAK, KIND_RING, KIND_STORM } from './world.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_LEG = 3;
export const SCREEN_OVER = 4;
export const SCREEN_WIN = 5;

const W = FIELD.width;
const H = FIELD.height;
const HORIZON = FIELD.horizonY;
const PLANE_Y = 478;
const ZMAX = 4600;
const STRIP_M = 140;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** Deterministic hash of an integer: the same strip always grows the same fields. */
function hash(n) {
  let value = (n * 2654435761) >>> 0;
  value ^= value >>> 15;
  value = Math.imul(value, 2246822519) >>> 0;
  value ^= value >>> 13;
  // The last XOR yields a signed 32-bit int, so force it unsigned again: without this,
  // a set top bit makes the result negative and a radius below goes negative with it.
  return (value >>> 0) / 4294967296;
}

function pickColor(n, colors) {
  return colors[Math.floor(hash(n) * colors.length) % colors.length];
}

export function createRenderer(canvas) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // --- projection: world (lateral x, distance z ahead, altitude) to screen ---
  function pOf(z) {
    return clamp(1 - z / ZMAX, 0, 1);
  }
  function groundY(z) {
    const p = pOf(z);
    return HORIZON + (H - HORIZON) * (1 - Math.pow(p, 1.6));
  }
  function yAt(z, altDiffFt) {
    const p = pOf(z);
    return HORIZON + (PLANE_Y - HORIZON) * p - (altDiffFt / 8000) * 300 * p;
  }
  function xAt(x, z, plane) {
    const p = pOf(z);
    return W / 2 + (x - plane.x) * 720 * p - plane.heading * 7 * p;
  }
  function scaleAt(z) {
    return 0.12 + 0.88 * pOf(z);
  }

  function coastX(dist) {
    return 0.55 + 0.16 * Math.sin(dist * 0.00012 + 1.1) + 0.05 * Math.sin(dist * 0.000043);
  }
  function riverX(dist) {
    return -0.15 + 0.35 * Math.sin(dist * 0.00021) + 0.12 * Math.sin(dist * 0.000071 + 2.0);
  }
  function roadX(dist) {
    return -0.55 + 0.1 * Math.sin(dist * 0.00009);
  }

  function drawSky(state) {
    const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
    sky.addColorStop(0, PALETTE.skyTop);
    sky.addColorStop(0.55, PALETTE.skyMid);
    sky.addColorStop(1, PALETTE.skyLow);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, HORIZON + 1);
    // The low sun, with a wide glow.
    const sunX = 985 - state.plane.heading * 2.2;
    const sunY = 148;
    const glow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 190);
    glow.addColorStop(0, 'rgba(255, 246, 216, 0.95)');
    glow.addColorStop(0.25, 'rgba(255, 214, 130, 0.55)');
    glow.addColorStop(1, 'rgba(255, 178, 90, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 200, sunY - 200, 400, 400);
    ctx.fillStyle = PALETTE.sunCore;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 34, 0, Math.PI * 2);
    ctx.fill();
    // Far mountain ridges, parallaxed by heading.
    for (let layer = 0; layer < 2; layer += 1) {
      const base = HORIZON - 6 - layer * 16;
      const amp = 34 - layer * 12;
      const shift = -state.plane.heading * (3 + layer * 3);
      ctx.fillStyle = layer === 0 ? PALETTE.mountainFar : PALETTE.mountainNear;
      ctx.beginPath();
      ctx.moveTo(0, HORIZON + 1);
      for (let x = 0; x <= W; x += 16) {
        const y = base - Math.abs(Math.sin((x + shift * 8 + layer * 260) * 0.008)) * amp - Math.abs(Math.sin((x + layer * 90) * 0.021)) * amp * 0.4;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, HORIZON + 1);
      ctx.closePath();
      ctx.fill();
    }
    // The distant volcano, always on the horizon: the route's landmark. Small and far —
    // a silhouette on the skyline, not a wall in front of the plane.
    const vx = W / 2 + (-0.72 - state.plane.x) * 720 * 0.1 - state.plane.heading * 0.8;
    const vBase = HORIZON + 1;
    const vHeight = 78;
    const vHalf = 118;
    ctx.fillStyle = PALETTE.volcano;
    ctx.beginPath();
    ctx.moveTo(vx - vHalf, vBase);
    ctx.lineTo(vx - 26, vBase - vHeight);
    ctx.lineTo(vx + 26, vBase - vHeight);
    ctx.lineTo(vx + vHalf, vBase);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(244, 241, 232, 0.9)';
    ctx.beginPath();
    ctx.moveTo(vx - 26, vBase - vHeight);
    ctx.lineTo(vx + 26, vBase - vHeight);
    ctx.lineTo(vx + 12, vBase - vHeight + 22);
    ctx.lineTo(vx - 12, vBase - vHeight + 22);
    ctx.closePath();
    ctx.fill();
    // Its smoke, drifting with the wind.
    ctx.fillStyle = 'rgba(207, 196, 187, 0.75)';
    for (let i = 0; i < 3; i += 1) {
      const sy = vBase - vHeight - 14 - i * 16 - ((state.time * 6 + i * 30) % 26);
      ctx.beginPath();
      ctx.ellipse(vx + 18 + i * 16, sy, 16 + i * 5, 8 + i * 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Clouds: two layers of soft clusters, parallaxed by heading and depth.
    for (let i = 0; i < 16; i += 1) {
      const depth = 0.25 + hash(i * 7 + 3) * 0.65;
      const cx = W / 2 + (hash(i * 13 + 1) * 2.6 - 1.3 - state.plane.x * 0.4) * 900 * depth - state.plane.heading * 10 * depth;
      const cy = 46 + hash(i * 5 + 9) * 190;
      const size = (26 + hash(i * 11 + 4) * 44) * depth;
      ctx.fillStyle = 'rgba(255, 244, 224, 0.88)';
      for (let puff = 0; puff < 4; puff += 1) {
        ctx.beginPath();
        ctx.ellipse(cx + (puff - 1.5) * size * 0.75, cy + (puff % 2) * size * 0.18, size * 0.72, size * 0.34, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(232, 201, 168, 0.5)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + size * 0.22, size * 1.5, size * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawGround(state) {
    // Land base.
    const land = ctx.createLinearGradient(0, HORIZON, 0, H);
    land.addColorStop(0, PALETTE.groundFar);
    land.addColorStop(1, PALETTE.groundNear);
    ctx.fillStyle = land;
    ctx.fillRect(0, HORIZON, W, H - HORIZON);
    // Sea polygon along the coastline, far to near.
    ctx.beginPath();
    ctx.moveTo(0, HORIZON);
    const coastPoints = [];
    for (let z = ZMAX; z >= 0; z -= STRIP_M) {
      const dist = state.distance + z;
      const cx = xAt(coastX(dist), z, state.plane);
      const cy = groundY(z);
      coastPoints.push([cx, cy, z]);
      ctx.lineTo(cx, cy);
    }
    ctx.lineTo(W, H);
    ctx.lineTo(W, HORIZON);
    ctx.closePath();
    const sea = ctx.createLinearGradient(0, HORIZON, 0, H);
    sea.addColorStop(0, '#2a7d9e');
    sea.addColorStop(1, PALETTE.sea);
    ctx.fillStyle = sea;
    ctx.fill();
    // Sun glint on the water.
    ctx.fillStyle = 'rgba(127, 212, 232, 0.35)';
    for (let i = 0; i < 12; i += 1) {
      const gy = HORIZON + 30 + hash(i * 3 + 21) * 300;
      const gw = 30 + hash(i * 7 + 2) * 90;
      ctx.fillRect(860 + hash(i * 11 + 5) * 260 - gw / 2, gy, gw, 3);
    }
    // Sand edge along the coast.
    ctx.strokeStyle = PALETTE.sand;
    ctx.lineWidth = 5;
    ctx.beginPath();
    coastPoints.forEach(([cx, cy], i) => (i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy)));
    ctx.stroke();
    // Land features, clipped to the land side of the coast.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, HORIZON);
    coastPoints.forEach(([cx, cy], i) => (i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy)));
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.clip();
    const firstStrip = Math.floor(state.distance / STRIP_M);
    const stripCount = Math.ceil(ZMAX / STRIP_M) + 1;
    const fieldColors = [PALETTE.fieldGreen, PALETTE.fieldGold, PALETTE.fieldDark, '#6fae62', '#c9a94e'];
    for (let s = stripCount; s >= 0; s -= 1) {
      const n = firstStrip + s;
      const zFar = n * STRIP_M - state.distance;
      const zNear = zFar - STRIP_M;
      if (zFar < -STRIP_M || zNear > ZMAX) continue;
      const yFar = groundY(Math.max(0, zFar));
      const yNear = groundY(Math.max(0, zNear));
      // Patchwork: three lateral cells per strip, each its own field colour, so the ground
      // reads as rice paddies instead of one flat green wall.
      const coastAtStrip = xAt(coastX(n * STRIP_M), Math.max(0, zFar), state.plane);
      for (let cell = 0; cell < 3; cell += 1) {
        const color = pickColor(n * 3 + cell, fieldColors);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.55;
        const x0 = (coastAtStrip * cell) / 3;
        const x1 = (coastAtStrip * (cell + 1)) / 3;
        ctx.fillRect(x0, yFar, Math.max(1, x1 - x0), Math.max(1, yNear - yFar + 1));
      }
      ctx.globalAlpha = 1;
      // Trees in this strip.
      const trees = Math.floor(hash(n * 3 + 1) * 6);
      for (let t = 0; t < trees; t += 1) {
        const tx = -0.9 + hash(n * 17 + t * 5) * 1.3;
        const tz = Math.max(0, zFar - STRIP_M * hash(n * 23 + t));
        const px = xAt(tx, tz, state.plane);
        const py = groundY(tz);
        const size = (10 + hash(n * 29 + t) * 10) * scaleAt(tz);
        ctx.fillStyle = '#2c5e33';
        ctx.beginPath();
        ctx.moveTo(px, py - size * 1.6);
        ctx.lineTo(px - size * 0.6, py);
        ctx.lineTo(px + size * 0.6, py);
        ctx.closePath();
        ctx.fill();
      }
      // A village house now and then.
      if (hash(n * 7 + 2) < 0.09) {
        const hx = -0.85 + hash(n * 31 + 4) * 1.2;
        const hz = Math.max(0, zFar - STRIP_M * 0.5);
        const px = xAt(hx, hz, state.plane);
        const py = groundY(hz);
        const size = (16 + hash(n) * 10) * scaleAt(hz);
        ctx.fillStyle = PALETTE.house;
        ctx.fillRect(px - size / 2, py - size * 0.7, size, size * 0.7);
        ctx.fillStyle = PALETTE.roof;
        ctx.beginPath();
        ctx.moveTo(px - size * 0.62, py - size * 0.7);
        ctx.lineTo(px, py - size * 1.25);
        ctx.lineTo(px + size * 0.62, py - size * 0.7);
        ctx.closePath();
        ctx.fill();
      }
    }
    // The river, winding down the island: quads between strips, with a bright centre.
    ctx.fillStyle = PALETTE.river;
    for (let z = ZMAX; z > 0; z -= STRIP_M) {
      const d0 = state.distance + z;
      const d1 = d0 - STRIP_M;
      const w0 = (44 * pOf(z) + 10) / 2;
      const w1 = (44 * pOf(Math.max(0, z - STRIP_M)) + 10) / 2;
      const c0 = xAt(riverX(d0), z, state.plane);
      const c1 = xAt(riverX(d1), Math.max(0, z - STRIP_M), state.plane);
      ctx.beginPath();
      ctx.moveTo(c0 - w0, groundY(z));
      ctx.lineTo(c0 + w0, groundY(z));
      ctx.lineTo(c1 + w1, groundY(Math.max(0, z - STRIP_M)));
      ctx.lineTo(c1 - w1, groundY(Math.max(0, z - STRIP_M)));
      ctx.closePath();
      ctx.fill();
    }
    // The coast road, running along the route with a dashed centre line.
    ctx.fillStyle = PALETTE.road;
    for (let z = ZMAX; z > 0; z -= STRIP_M) {
      const d0 = state.distance + z;
      const d1 = d0 - STRIP_M;
      const w0 = (22 * pOf(z) + 6) / 2;
      const w1 = (22 * pOf(Math.max(0, z - STRIP_M)) + 6) / 2;
      const c0 = xAt(roadX(d0), z, state.plane);
      const c1 = xAt(roadX(d1), Math.max(0, z - STRIP_M), state.plane);
      ctx.beginPath();
      ctx.moveTo(c0 - w0, groundY(z));
      ctx.lineTo(c0 + w0, groundY(z));
      ctx.lineTo(c1 + w1, groundY(Math.max(0, z - STRIP_M)));
      ctx.lineTo(c1 - w1, groundY(Math.max(0, z - STRIP_M)));
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawRunway(state) {
    const rel = state.runway.dist - state.legDistance;
    if (rel <= -200 || rel > ZMAX) return;
    const z0 = Math.max(0, rel);
    const z1 = Math.min(ZMAX, rel + 900);
    const half = 0.085;
    const left0 = xAt(-half, z0, state.plane);
    const right0 = xAt(half, z0, state.plane);
    const left1 = xAt(-half, z1, state.plane);
    const right1 = xAt(half, z1, state.plane);
    ctx.fillStyle = '#4a5058';
    ctx.beginPath();
    ctx.moveTo(left0, groundY(z0));
    ctx.lineTo(right0, groundY(z0));
    ctx.lineTo(right1, groundY(z1));
    ctx.lineTo(left1, groundY(z1));
    ctx.closePath();
    ctx.fill();
    // Centre dashes.
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 6; i += 1) {
      const z = z0 + ((z1 - z0) * (i + 0.5)) / 6;
      const cx = xAt(0, z, state.plane);
      const cy = groundY(z);
      const w = 3 + 7 * pOf(z);
      const h = 6 + 16 * pOf(z);
      ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
    }
    // Threshold bars and approach lights at the near end.
    ctx.fillStyle = '#ffffff';
    const ty = groundY(z0);
    ctx.fillRect(left0 + 4, ty - 3, (right0 - left0) * 0.22, 6);
    ctx.fillRect(right0 - (right0 - left0) * 0.22 - 4, ty - 3, (right0 - left0) * 0.22, 6);
    const blink = Math.sin(state.time * 5) > 0;
    ctx.fillStyle = blink ? '#7de3a8' : '#2f7d4f';
    for (let i = -2; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.arc(xAt(i * 0.045, z0, state.plane), ty - 8, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Windsock beside the threshold.
    const wx = xAt(0.16, z0, state.plane);
    const wy = groundY(z0);
    const sockScale = scaleAt(z0);
    ctx.strokeStyle = '#8d8578';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.lineTo(wx, wy - 34 * sockScale);
    ctx.stroke();
    ctx.fillStyle = PALETTE.planeOrange;
    ctx.beginPath();
    ctx.moveTo(wx, wy - 34 * sockScale);
    ctx.lineTo(wx + 22 * sockScale, wy - 28 * sockScale);
    ctx.lineTo(wx + 22 * sockScale, wy - 20 * sockScale);
    ctx.lineTo(wx, wy - 24 * sockScale);
    ctx.closePath();
    ctx.fill();
    // Control tower.
    const tx = xAt(0.24, z0 + 120, state.plane);
    const ty2 = groundY(z0 + 120);
    const ts = scaleAt(z0 + 120);
    ctx.fillStyle = '#5c6672';
    ctx.fillRect(tx - 8 * ts, ty2 - 52 * ts, 16 * ts, 52 * ts);
    ctx.fillStyle = '#2b3540';
    ctx.fillRect(tx - 14 * ts, ty2 - 66 * ts, 28 * ts, 16 * ts);
    ctx.fillStyle = blink ? '#ffd34d' : '#8a6d2f';
    ctx.beginPath();
    ctx.arc(tx, ty2 - 70 * ts, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawItems(state) {
    const plane = state.plane;
    const visible = [];
    for (const item of state.items) {
      if (!item.active) continue;
      const rel = item.dist - state.legDistance;
      if (rel < -100 || rel > ZMAX) continue;
      visible.push({ item, rel });
    }
    visible.sort((a, b) => b.rel - a.rel);
    for (const { item, rel } of visible) {
      const p = pOf(rel);
      const cx = xAt(item.x, rel, plane);
      const cy = yAt(rel, item.alt - plane.alt);
      if (item.kind === KIND_RING) {
        const radius = 26 + 150 * p;
        // Tether down to the ground so the ring reads in depth.
        ctx.strokeStyle = 'rgba(255, 211, 77, 0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy + radius);
        ctx.lineTo(cx, groundY(rel));
        ctx.stroke();
        ctx.save();
        ctx.shadowColor = PALETTE.ringGlow;
        ctx.shadowBlur = 22 * p + 6;
        ctx.strokeStyle = PALETTE.ring;
        ctx.lineWidth = 9 * p + 3;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        ctx.strokeStyle = 'rgba(120, 66, 0, 0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, radius - (9 * p + 3) / 2 - 1, 0, Math.PI * 2);
        ctx.stroke();
        // Tick marks so the ring reads as a gate, not a halo.
        ctx.fillStyle = PALETTE.ring;
        for (let k = 0; k < 4; k += 1) {
          const a = (k * Math.PI) / 2 + Math.PI / 4;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, 3.5 * p + 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (item.kind === KIND_PARCEL) {
        const size = 14 + 34 * p;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(Math.sin(state.time * 2 + item.dist) * 0.12);
        ctx.fillStyle = PALETTE.parcelDark;
        ctx.fillRect(-size / 2, -size / 2, size, size);
        ctx.fillStyle = PALETTE.parcel;
        ctx.fillRect(-size / 2, -size / 2, size, size * 0.45);
        ctx.strokeStyle = '#5c3a10';
        ctx.lineWidth = 2;
        ctx.strokeRect(-size / 2, -size / 2, size, size);
        ctx.beginPath();
        ctx.moveTo(0, -size / 2);
        ctx.lineTo(0, size / 2);
        ctx.stroke();
        ctx.restore();
        // Little parachute canopy above it.
        ctx.fillStyle = 'rgba(244, 241, 232, 0.9)';
        ctx.beginPath();
        ctx.ellipse(cx, cy - size * 0.95, size * 0.75, size * 0.34, 0, Math.PI, 0);
        ctx.fill();
      } else if (item.kind === KIND_STORM) {
        const size = 48 + 120 * p;
        ctx.fillStyle = PALETTE.storm;
        for (let k = 0; k < 5; k += 1) {
          const ox = (hash(item.dist + k * 13) - 0.5) * size * 1.5;
          const oy = (hash(item.dist + k * 29) - 0.5) * size * 0.5;
          const r = size * (0.32 + hash(item.dist + k * 7) * 0.22);
          ctx.beginPath();
          ctx.ellipse(cx + ox, cy + oy, r, r * 0.55, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = PALETTE.stormDark;
        ctx.beginPath();
        ctx.ellipse(cx, cy + size * 0.22, size * 0.9, size * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        // Lightning now and then.
        if ((state.time * 1.7 + item.dist * 0.01) % 1 < 0.14) {
          ctx.strokeStyle = '#ffe66d';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          let lx = cx;
          let ly = cy + size * 0.3;
          ctx.moveTo(lx, ly);
          for (let s = 0; s < 4; s += 1) {
            lx += (hash(item.dist + s * 3 + Math.floor(state.time * 1.7)) - 0.5) * 26;
            ly += 16;
            ctx.lineTo(lx, ly);
          }
          ctx.stroke();
        }
      } else if (item.kind === KIND_PEAK) {
        const baseY = groundY(rel);
        const heightPx = (item.height / 8000) * 260 * p + 34 * p + 10;
        const halfW = (110 * p + 26) * (0.8 + (item.height / 8000) * 0.5);
        const peakGrad = ctx.createLinearGradient(cx, baseY - heightPx, cx, baseY);
        peakGrad.addColorStop(0, '#5d4c52');
        peakGrad.addColorStop(1, '#332a30');
        ctx.fillStyle = peakGrad;
        ctx.beginPath();
        ctx.moveTo(cx - halfW, baseY);
        ctx.lineTo(cx - halfW * 0.18, baseY - heightPx);
        ctx.lineTo(cx + halfW * 0.18, baseY - heightPx);
        ctx.lineTo(cx + halfW, baseY);
        ctx.closePath();
        ctx.fill();
        // A ridge line down the shaded face, so the cone reads as a mountain, not a triangle.
        ctx.strokeStyle = 'rgba(244, 241, 232, 0.28)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - halfW * 0.05, baseY - heightPx + 6);
        ctx.lineTo(cx - halfW * 0.3, baseY - heightPx * 0.45);
        ctx.lineTo(cx - halfW * 0.16, baseY - 4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + halfW * 0.08, baseY - heightPx + 8);
        ctx.lineTo(cx + halfW * 0.34, baseY - heightPx * 0.5);
        ctx.stroke();
        // Snow cap.
        ctx.fillStyle = 'rgba(244, 241, 232, 0.92)';
        ctx.beginPath();
        ctx.moveTo(cx - halfW * 0.18, baseY - heightPx);
        ctx.lineTo(cx + halfW * 0.18, baseY - heightPx);
        ctx.lineTo(cx + halfW * 0.1, baseY - heightPx + heightPx * 0.22);
        ctx.lineTo(cx - halfW * 0.1, baseY - heightPx + heightPx * 0.22);
        ctx.closePath();
        ctx.fill();
        // Height tag so the pilot knows how high to climb.
        if (p > 0.35) {
          ctx.fillStyle = 'rgba(244, 241, 232, 0.9)';
          ctx.font = `700 ${Math.max(11, Math.floor(13 * p + 6))}px ${FONT}`;
          ctx.textAlign = 'center';
          ctx.fillText(`${Math.round(item.height / 100) * 100} FT`, cx, baseY - heightPx - 10);
        }
      }
    }
  }

  function drawPlane(state) {
    const plane = state.plane;
    const bob = Math.sin(state.time * 2.1) * 2.5;
    ctx.save();
    ctx.translate(W / 2, PLANE_Y + bob);
    ctx.rotate(plane.bank * 0.42);
    const blink = Math.sin(state.time * 6) > 0;
    const strobe = Math.sin(state.time * 9) > 0.7;
    // Wings: broad, with a slight dihedral and a dark edge so they read against the sky.
    ctx.fillStyle = PALETTE.planeTeal;
    ctx.strokeStyle = 'rgba(20, 30, 40, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-14, -10);
    ctx.lineTo(-212, 4);
    ctx.lineTo(-202, 26);
    ctx.lineTo(-14, 26);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(14, -10);
    ctx.lineTo(212, 4);
    ctx.lineTo(202, 26);
    ctx.lineTo(14, 26);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Orange wingtips.
    ctx.fillStyle = PALETTE.planeOrange;
    ctx.beginPath();
    ctx.moveTo(-212, 4);
    ctx.lineTo(-186, 1);
    ctx.lineTo(-178, 24);
    ctx.lineTo(-202, 26);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(212, 4);
    ctx.lineTo(186, 1);
    ctx.lineTo(178, 24);
    ctx.lineTo(202, 26);
    ctx.closePath();
    ctx.fill();
    // Engines and spinning props, mounted on the wings.
    for (const side of [-1, 1]) {
      const ex = side * 112;
      ctx.fillStyle = PALETTE.planeDark;
      ctx.beginPath();
      ctx.roundRect(ex - 13, 0, 26, 42, 10);
      ctx.fill();
      ctx.save();
      ctx.translate(ex, 20);
      ctx.fillStyle = 'rgba(180, 200, 210, 0.22)';
      ctx.beginPath();
      ctx.arc(0, 0, 40, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(40, 52, 64, 0.55)';
      ctx.lineWidth = 5;
      const angle = state.time * 22 + (side < 0 ? 1.2 : 0);
      for (let b = 0; b < 3; b += 1) {
        const a = angle + (b * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * 37, Math.sin(a) * 37);
        ctx.stroke();
      }
      ctx.fillStyle = '#c8b98a';
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Fuselage, seen from behind: short and rounded, with a dark edge.
    ctx.fillStyle = PALETTE.planeBody;
    ctx.beginPath();
    ctx.roundRect(-27, -58, 54, 112, 24);
    ctx.fill();
    ctx.strokeStyle = 'rgba(20, 30, 40, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = PALETTE.planeTeal;
    ctx.fillRect(-27, 42, 54, 10);
    ctx.fillStyle = PALETTE.planeOrange;
    ctx.fillRect(-27, 10, 54, 6);
    // Tail fin with the sun mark.
    ctx.fillStyle = PALETTE.planeTeal;
    ctx.beginPath();
    ctx.moveTo(-20, -52);
    ctx.lineTo(-12, -132);
    ctx.lineTo(12, -132);
    ctx.lineTo(20, -52);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.planeOrange;
    ctx.beginPath();
    ctx.arc(0, -104, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.sunCore;
    ctx.beginPath();
    ctx.arc(0, -104, 6, 0, Math.PI * 2);
    ctx.fill();
    // Horizontal stabilisers.
    ctx.fillStyle = PALETTE.planeTeal;
    ctx.beginPath();
    ctx.moveTo(-18, -46);
    ctx.lineTo(-92, -32);
    ctx.lineTo(-86, -20);
    ctx.lineTo(-18, -30);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(18, -46);
    ctx.lineTo(92, -32);
    ctx.lineTo(86, -20);
    ctx.lineTo(18, -30);
    ctx.closePath();
    ctx.fill();
    // Exhaust glow and nav lights.
    ctx.fillStyle = 'rgba(255, 140, 60, 0.85)';
    ctx.beginPath();
    ctx.ellipse(0, 56, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    if (blink) {
      ctx.fillStyle = '#ff4d4d';
      ctx.beginPath();
      ctx.arc(-212, 14, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#39d353';
      ctx.beginPath();
      ctx.arc(212, 14, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (strobe) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, -134, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawDial(x, y, radius, label, value, min, max, unit) {
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = PALETTE.gaugeGlow;
    ctx.shadowBlur = 14;
    ctx.fillStyle = PALETTE.panel;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(244, 241, 232, 0.75)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 8; i += 1) {
      const a = (-Math.PI * 0.75) + (i / 8) * Math.PI * 1.5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (radius - 6), Math.sin(a) * (radius - 6));
      ctx.lineTo(Math.cos(a) * (radius - 13), Math.sin(a) * (radius - 13));
      ctx.stroke();
    }
    const frac = clamp((value - min) / (max - min), 0, 1);
    const angle = -Math.PI * 0.75 + frac * Math.PI * 1.5;
    ctx.strokeStyle = PALETTE.gaugeGlow;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(angle) * (radius - 10), Math.sin(angle) * (radius - 10));
    ctx.stroke();
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 13px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(label, 0, radius * 0.52);
    ctx.font = `700 11px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(unit, 0, radius * 0.52 + 14);
    ctx.restore();
  }

  function drawInstruments(state) {
    const plane = state.plane;
    // Artificial horizon: a ball that tilts with the bank and slides with the pitch.
    const hx = W / 2;
    const hy = H - 56;
    const hr = 40;
    ctx.save();
    ctx.translate(hx, hy);
    ctx.shadowColor = PALETTE.gaugeGlow;
    ctx.shadowBlur = 14;
    ctx.fillStyle = PALETTE.panel;
    ctx.beginPath();
    ctx.arc(0, 0, hr, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(0, 0, hr - 4, 0, Math.PI * 2);
    ctx.clip();
    ctx.rotate(-plane.bank * 0.42);
    ctx.translate(0, plane.pitch * 14);
    ctx.fillStyle = '#4d8fd1';
    ctx.fillRect(-hr, -hr, hr * 2, hr);
    ctx.fillStyle = '#8a5a34';
    ctx.fillRect(-hr, 0, hr * 2, hr);
    ctx.strokeStyle = 'rgba(244, 241, 232, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-hr, 0);
    ctx.lineTo(hr, 0);
    ctx.stroke();
    ctx.restore();
    // Fixed wings over the ball.
    ctx.save();
    ctx.translate(hx, hy);
    ctx.strokeStyle = PALETTE.text;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-hr + 8, 0);
    ctx.lineTo(-8, 0);
    ctx.moveTo(8, 0);
    ctx.lineTo(hr - 8, 0);
    ctx.stroke();
    ctx.fillStyle = PALETTE.text;
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, hr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    drawDial(hx - 104, hy, 40, 'ALT', plane.alt, 0, 8000, 'FT');
    drawDial(hx + 104, hy, 40, 'SPD', plane.speed, 100, 320, 'KT');
    // Fuel bar and hull, bottom left.
    const fx = 24;
    const fy = H - 78;
    ctx.fillStyle = 'rgba(27, 36, 48, 0.85)';
    ctx.beginPath();
    ctx.roundRect(fx - 8, fy - 8, 250, 46, 8);
    ctx.fill();
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 12px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText('FUEL', fx, fy + 8);
    const fuelFrac = clamp(state.fuel / 100, 0, 1);
    ctx.fillStyle = '#2b3540';
    ctx.beginPath();
    ctx.roundRect(fx + 52, fy - 2, 150, 14, 7);
    ctx.fill();
    ctx.fillStyle = fuelFrac < 0.25 ? PALETTE.danger : PALETTE.gaugeGreen;
    if (fuelFrac > 0) {
      ctx.beginPath();
      ctx.roundRect(fx + 52, fy - 2, 150 * fuelFrac, 14, 7);
      ctx.fill();
    }
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 12px ${FONT}`;
    ctx.fillText(`${Math.ceil(state.fuel)}%`, fx + 210, fy + 8);
    ctx.fillStyle = PALETTE.text;
    ctx.fillText('HULL', fx, fy + 30);
    for (let i = 0; i < 3; i += 1) {
      ctx.fillStyle = i < state.hull ? PALETTE.gaugeGreen : '#3a4552';
      ctx.beginPath();
      ctx.arc(fx + 62 + i * 22, fy + 25, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    // Best score, bottom right.
    ctx.fillStyle = 'rgba(27, 36, 48, 0.85)';
    ctx.beginPath();
    ctx.roundRect(W - 168, fy - 8, 152, 46, 8);
    ctx.fill();
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `700 12px ${FONT}`;
    ctx.fillText(`PARCELS  ${state.parcels}`, W - 156, fy + 8);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 12px ${FONT}`;
    ctx.fillText('BOOST: SHIFT', W - 156, fy + 30);
  }

  function drawHud(state) {
    const plane = state.plane;
    ctx.fillStyle = 'rgba(16, 22, 30, 0.82)';
    ctx.fillRect(0, 0, W, 64);
    ctx.fillStyle = PALETTE.panelEdge;
    ctx.fillRect(0, 64, W, 2);
    // Altitude and speed, left.
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `700 11px ${FONT}`;
    ctx.fillText('ALTITUDE', 20, 20);
    ctx.fillText('SPEED', 170, 20);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 26px ${FONT}`;
    ctx.fillText(`${Math.round(plane.alt).toLocaleString('en-US')} FT`, 20, 50);
    ctx.fillText(`${Math.round(plane.speed)} KT`, 170, 50);
    // Compass tape, centre.
    const cx = W / 2;
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `700 11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('HEADING', cx, 20);
    const headings = [['N', 0], ['E', 90], ['S', 180], ['W', 270]];
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - 180, 24, 360, 34);
    ctx.clip();
    for (let offset = -75; offset <= 75; offset += 15) {
      const h = (Math.round(plane.heading) + offset + 360) % 360;
      const x = cx + offset * 2.4;
      const cardinal = headings.find(([label, deg]) => deg === h);
      ctx.strokeStyle = 'rgba(244, 241, 232, 0.6)';
      ctx.lineWidth = offset % 45 === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, 30);
      ctx.lineTo(x, offset % 45 === 0 ? 44 : 38);
      ctx.stroke();
      if (h % 45 === 0) {
        ctx.fillStyle = PALETTE.text;
        ctx.font = `700 ${cardinal ? 13 : 10}px ${FONT}`;
        ctx.fillText(cardinal ? cardinal[0] : String(h).padStart(3, '0'), x, 56);
      }
    }
    ctx.restore();
    ctx.fillStyle = PALETTE.gaugeGlow;
    ctx.beginPath();
    ctx.moveTo(cx - 6, 24);
    ctx.lineTo(cx + 6, 24);
    ctx.lineTo(cx, 34);
    ctx.closePath();
    ctx.fill();
    // The numeric heading sits left of the tape, clear of its labels and the rings readout.
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 14px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(`${String((Math.round(plane.heading) + 360) % 360).padStart(3, '0')}°`, cx - 192, 50);
    // Score, rings, leg, right.
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `700 11px ${FONT}`;
    ctx.fillText('SCORE', W - 20, 20);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 26px ${FONT}`;
    ctx.fillText(`${state.score.toLocaleString('en-US')}`, W - 20, 50);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `700 11px ${FONT}`;
    const leg = LEGS[state.legIndex];
    const runwayRel = state.runway.dist - state.legDistance;
    const runwayText = runwayRel > 0 && runwayRel < 4600 ? `RWY ${(runwayRel / 1000).toFixed(1)} KM` : `LEG ${state.legIndex + 1}/3 — ${leg.name}`;
    ctx.fillText(`RINGS ${state.ringsHit}/${state.ringsTotal}   •   ${runwayText}`, W - 330, 20);
    // Side tapes: altitude left, speed right.
    ctx.textAlign = 'left';
    ctx.font = `700 10px ${FONT}`;
    for (let i = -2; i <= 2; i += 1) {
      const alt = Math.round((plane.alt + i * 500) / 500) * 500;
      const y = 330 + i * 46 - ((plane.alt % 500) / 500) * 46;
      if (y < 90 || y > 600) continue;
      ctx.fillStyle = i === 0 ? PALETTE.gaugeGlow : 'rgba(244, 241, 232, 0.65)';
      ctx.fillText(`${alt}`, 10, y);
      ctx.strokeStyle = 'rgba(244, 241, 232, 0.5)';
      ctx.beginPath();
      ctx.moveTo(44, y - 3);
      ctx.lineTo(52, y - 3);
      ctx.stroke();
    }
    ctx.textAlign = 'right';
    for (let i = -2; i <= 2; i += 1) {
      const spd = Math.round((plane.speed + i * 20) / 20) * 20;
      const y = 330 + i * 46 - ((plane.speed % 20) / 20) * 46;
      if (y < 90 || y > 600) continue;
      ctx.fillStyle = i === 0 ? PALETTE.gaugeGlow : 'rgba(244, 241, 232, 0.65)';
      ctx.fillText(`${spd}`, W - 10, y);
      ctx.strokeStyle = 'rgba(244, 241, 232, 0.5)';
      ctx.beginPath();
      ctx.moveTo(W - 52, y - 3);
      ctx.lineTo(W - 44, y - 3);
      ctx.stroke();
    }
    // Message line.
    if (state.message && state.time < state.messageUntil) {
      const remain = state.messageUntil - state.time;
      ctx.globalAlpha = clamp(remain, 0, 1);
      ctx.font = `800 26px ${FONT}`;
      const tw = ctx.measureText(state.message).width;
      ctx.fillStyle = 'rgba(16, 22, 30, 0.85)';
      ctx.beginPath();
      ctx.roundRect(W / 2 - tw / 2 - 18, 84, tw + 36, 44, 10);
      ctx.fill();
      ctx.fillStyle = state.message.includes('LOW FUEL') || state.message.includes('TERRAIN') || state.message.includes('LIGHTNING') ? PALETTE.danger : PALETTE.gaugeGlow;
      ctx.textAlign = 'center';
      ctx.fillText(state.message, W / 2, 115);
      ctx.globalAlpha = 1;
    }
  }

  function overlayPanel(title, lines, accent, yOffset = 0) {
    ctx.fillStyle = 'rgba(10, 14, 20, 0.62)';
    ctx.fillRect(0, 0, W, H);
    const panelW = 640;
    const panelH = 150 + lines.length * 30;
    const px = (W - panelW) / 2;
    const py = (H - panelH) / 2 - 20 + yOffset;
    ctx.fillStyle = 'rgba(16, 22, 30, 0.92)';
    ctx.beginPath();
    ctx.roundRect(px, py, panelW, panelH, 14);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = accent;
    ctx.font = `800 40px ${FONT}`;
    ctx.fillText(title, W / 2, py + 62);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `400 17px ${FONT}`;
    lines.forEach((line, i) => {
      ctx.fillText(line, W / 2, py + 104 + i * 30);
    });
  }

  function drawScene(state) {
    drawSky(state);
    drawGround(state);
    drawRunway(state);
    drawItems(state);
    drawPlane(state);
  }

  function draw(state, screen, best) {
    ctx.save();
    if (state.shake > 0) {
      ctx.translate((Math.random() - 0.5) * state.shake * 16, (Math.random() - 0.5) * state.shake * 12);
    }
    drawScene(state);
    ctx.restore();
    if (screen === SCREEN_TITLE) {
      // Soft bands, fading in, so the plane and the scenery show through behind the text.
      const topBand = ctx.createLinearGradient(0, 0, 0, 240);
      topBand.addColorStop(0, 'rgba(10, 14, 20, 0.62)');
      topBand.addColorStop(1, 'rgba(10, 14, 20, 0)');
      ctx.fillStyle = topBand;
      ctx.fillRect(0, 0, W, 240);
      const bottomBand = ctx.createLinearGradient(0, H - 230, 0, H);
      bottomBand.addColorStop(0, 'rgba(10, 14, 20, 0)');
      bottomBand.addColorStop(1, 'rgba(10, 14, 20, 0.6)');
      ctx.fillStyle = bottomBand;
      ctx.fillRect(0, H - 230, W, 230);
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.gaugeGlow;
      ctx.font = `800 54px ${FONT}`;
      ctx.fillText('NUSANTARA SKY COURIER', W / 2, 96);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `400 20px ${FONT}`;
      ctx.fillText('Island-hopper courier run — fly the golden rings, dodge the storms,', W / 2, 132);
      ctx.fillText('and land on the runway at the end of every leg.', W / 2, 160);
      ctx.font = `700 17px ${FONT}`;
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText('← →  bank      ↑ ↓  climb / descend      SHIFT  boost      MOUSE  steer      P  pause      M  mute', W / 2, 566);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `800 24px ${FONT}`;
      ctx.fillText('PRESS SPACE OR CLICK TO FLY', W / 2, 612);
      if (best > 0) {
        ctx.fillStyle = PALETTE.gaugeGlow;
        ctx.font = `700 17px ${FONT}`;
        ctx.fillText(`BEST SCORE  ${best.toLocaleString('en-US')}`, W / 2, 646);
      }
      return;
    }
    drawHud(state);
    drawInstruments(state);
    // Vignette.
    const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95);
    vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vig.addColorStop(1, 'rgba(0, 0, 0, 0.28)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
    if (state.flash > 0) {
      ctx.fillStyle = `rgba(255, 60, 40, ${state.flash * 0.3})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (screen === SCREEN_PAUSED) {
      overlayPanel('PAUSED', ['Space or P to keep flying.'], PALETTE.gaugeGlow);
    } else if (screen === SCREEN_LEG) {
      // The leg index still names the leg just landed; the next one is legIndex + 1.
      const next = LEGS[state.legIndex + 1];
      // Raised, so the runway the plane just touched down on shows below the panel.
      overlayPanel('LEG COMPLETE', [`Landing bonus  +${500}`, `Next: LEG ${state.legIndex + 2} — ${next.name}`, 'Press Space to fly the next leg.'], PALETTE.gaugeGreen, -150);
    } else if (screen === SCREEN_OVER) {
      overlayPanel('GAME OVER', [
        state.overReason,
        `Score  ${state.score.toLocaleString('en-US')}    •    Best  ${Math.max(best, state.score).toLocaleString('en-US')}`,
        'Press Space to fly again.',
      ], PALETTE.danger);
    } else if (screen === SCREEN_WIN) {
      overlayPanel('ROUTE COMPLETE!', [
        'All three legs landed — the parcels are delivered.',
        `Score  ${state.score.toLocaleString('en-US')}    •    Best  ${Math.max(best, state.score).toLocaleString('en-US')}`,
        'Press Space to fly the route again.',
      ], PALETTE.gaugeGlow);
    }
  }

  return { draw };
}
