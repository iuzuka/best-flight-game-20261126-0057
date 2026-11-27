# Nusantara Sky Courier

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/iuzuka/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/iuzuka/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A flight game for the [best-flight-game-20261126-0057 bounty](https://make.fun/bounty/best-flight-game-20261126-0057) on make.fun.

You are the courier pilot of the twin-prop island hopper **Elang-7**, flying the
Nusantara Air route over an Indonesian archipelago at golden hour: sea and coastline,
patchwork rice fields, a winding river, villages, and a volcano on the horizon. Fly
through the golden rings (+100), grab the floating parcels (+50), climb over the
volcanic peaks, steer around the thunderheads — and land on the runway at the end of
every leg (+500). Three legs: Pulau Kencana, Teluk Zamrud, Gunung Berapi. Land all
three and the route is complete.

My make.fun referral: https://make.fun/r/9p6337rb

## Play

Open `game/index.html` in a desktop browser (or serve `game/` with any static
server, e.g. `node serve.ts`). No network request, no assets to download: every sound
is synthesised with WebAudio and every sprite is drawn on canvas.

- **← / → or A / D** — bank and turn
- **↑ / ↓ or W / S** — climb / descend
- **Shift** — boost
- **Mouse (hold)** — steer toward the pointer
- **Space / click** — start, continue to the next leg, fly again
- **P** — pause, **M** — mute

The HUD shows altitude, speed and heading (plus a compass tape), score, rings,
distance to the runway, fuel and hull. The lit instrument panel at the bottom shows
an artificial horizon, altimeter and airspeed dials. Watch the fuel: land to refuel,
and mind the terrain — scraping the ground or flying into a peak ends the run.

## How it is built

- `game/` — the game itself: `index.html` plus eight modules in `game/src/`, one job
  each (`config`, `random`, `input`, `audio`, `world`, `render`, `shots`, `main`)
- `screenshots/` — four real renders of the game's own code (title, flight, ring pass,
  leg complete), staged by `game/src/shots.js` with a seeded autopilot
- `main.ts` — hands the game in (copies `game/` and `screenshots/`, writes the dossier)
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged

Seeded routes: `?seed=N` flies the same rings, storms and peaks every time.
Screenshot scenes: `?shot=start|play|rings|end&seed=7`.
