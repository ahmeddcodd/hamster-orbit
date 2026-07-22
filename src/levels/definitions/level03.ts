import { PALETTES, type LevelDefinition } from '../types';
import { arrow, cp, plat, rail, rampZ, seed, YAW_NEG_Z } from '../helpers';

/**
 * L3 — BUMPER BOULEVARD. Bumpers, launch angles, enemy-ball interaction,
 * using hazards as tools.
 * Route: safe bumper tutorial -> bumper arena (Seed 1) -> CP1 -> narrow
 * descent -> enemy arena (Seed 2, knockout chance) -> launch pad to upper
 * route (Seed 3, recovery platform below) -> CP2 -> alternating bumper lane
 * -> finish.
 */
export const level03: LevelDefinition = {
  id: 'level03',
  number: 3,
  name: 'Bumper Boulevard',
  subtitle: 'Bounce with a plan',
  difficulty: 2,
  palette: PALETTES.bumper,
  timeLimitMs: 75_000,
  silverTimeMs: 50_000,
  goldTimeMs: 38_000,
  start: { p: [0, 0, 2], yaw: YAW_NEG_Z },
  goal: { p: [0, -1, -98] },
  fallY: -16,
  musicProfile: 'bouncy',
  checkpoints: [
    cp('cp1', 0, -29.5, YAW_NEG_Z, 0, 5),
    cp('cp2', 0, -80, YAW_NEG_Z, -1, 5),
  ],
  seeds: [seed(0, -21.5, 0), seed(-4.5, -52, -3), seed(0, -71, 0.2)],
  geometry: [
    // start + bumper tutorial pad (bumper safely beside the route)
    plat(0, 0, 9, 9, 0),
    plat(0, -9, 9, 9, 0),
    // wide bumper arena
    plat(0, -21, 17, 15, 0),
    rail(-8.4, 0, -13.8, -8.4, 0, -28.4),
    rail(8.4, 0, -13.8, 8.4, 0, -28.4),
    // CP1 pad
    plat(0, -30.5, 8, 6, 0),
    // narrow descent
    rampZ(0, -33.4, -42.5, 4, 0, -3),
    // enemy arena — open west edge (knock the enemy into the void!)
    plat(0, -52, 18, 17, -3),
    rail(8.9, -3, -43.8, 8.9, -3, -60.4),
    // upper route landing platform (launch pad flies you here)
    plat(0, -71, 9, 8, 0.2),
    // recovery platform below + ramp back up to the lane
    // (covers the full launch flight path so short launches are never lethal)
    plat(0, -70.5, 13, 17, -3.2),
    // recovery ramp: offset east so it never runs under the upper-route ramp, and it
    // must top out at the lane's height (-1) exactly where the lane begins (z -80.5),
    // otherwise the ball drives into the lane's side face instead of rolling onto it
    rampZ(5, -76, -80.6, 4, -3.2, -1),
    // ramp side guards, stopping short of the lane so they never pinch the merge
    rail(7.1, -3.2, -76, 7.1, -1.2, -80.4, 0.8),
    rail(2.9, -3.2, -76, 2.9, -1.2, -80.4, 0.8),
    // guard the recovery platform's far edge: the ramp is the only way out
    rail(-6.5, -3.2, -78.9, 2.9, -3.2, -78.9, 1.0),
    rail(-6.5, -3.2, -62.2, -6.5, -3.2, -78.9, 0.8),
    rail(6.5, -3.2, -62.2, 6.5, -3.2, -77.5, 0.8),
    // upper route descends to the bumper lane
    rampZ(0, -74.8, -80.2, 6, 0.2, -1),
    // alternating bumper lane — wide enough to catch the recovery ramp's exit (x up to 6.75)
    plat(0.5, -87, 15, 13, -1),
    rail(-6.9, -1, -80.8, -6.9, -1, -93.4),
    rail(7.9, -1, -80.8, 7.9, -1, -93.4),
    // finish pad (deep, so hot bumper-lane exits still land on it)
    plat(0, -100, 12, 16, -1),
  ],
  hazards: [
    { t: 'bumper', id: 'tut', p: [3.2, 0, -9], r: 0.85, power: 10 },
    { t: 'bumper', id: 'a1', p: [-4.5, 0, -17.5], r: 0.95, power: 13 },
    { t: 'bumper', id: 'a2', p: [4.5, 0, -20.5], r: 0.95, power: 13 },
    { t: 'bumper', id: 'a3', p: [-3, 0, -25], r: 0.95, power: 13 },
    { t: 'enemy', id: 'brute', p: [0, -2.2, -52], range: 9, speed: 8.5 },
    { t: 'launch', id: 'sky', p: [0, -3, -61.5], yaw: YAW_NEG_Z, power: 5, upPower: 12.5 },
    { t: 'bumper', id: 'l1', p: [-3.6, -1, -84], r: 0.9, power: 9 },
    { t: 'bumper', id: 'l2', p: [3.6, -1, -88.5], r: 0.9, power: 9 },
  ],
  arrows: [
    arrow(0, -3, YAW_NEG_Z, 0, 1.2),
    arrow(0, -14.5, YAW_NEG_Z, 0),
    arrow(0, -27, YAW_NEG_Z, 0),
    arrow(0, -45, YAW_NEG_Z, -3),
    arrow(0, -58, YAW_NEG_Z, -3),
    arrow(0, -76, YAW_NEG_Z, 0.2),
    arrow(0, -93, YAW_NEG_Z, -1),
  ],
  tutorials: [
    { text: 'Bumpers bounce you — use them!', p: [0, 0, -8], radius: 5 },
    { text: 'Knock the red ball off for a bonus', p: [0, -3, -45], radius: 5 },
    { text: 'Roll fast into the launcher!', p: [0, -3, -58], radius: 4 },
  ],
  shortcuts: [{ id: 'upperRoute', p: [0, 1.4, -71], s: [8, 4, 6] }],
};
