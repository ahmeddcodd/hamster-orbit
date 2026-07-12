import { PALETTES, type LevelDefinition } from '../types';
import { arrow, cp, kicker, plat, rail, rampZ, seed, YAW_NEG_Z } from '../helpers';

/**
 * L5 — WOBBLE WORKSHOP. Seesaws, tilting platforms, balance, patience.
 * Route: start -> wide seesaw tutorial (Seed 1 centered) -> CP1 -> three
 * tilting squares (recovery deck below) -> junction -> long tilting plank
 * (risky raised beam shortcut with Seed 2) -> CP2 -> pivoting platform
 * (Seed 3 side pocket) -> spring ramps -> finish.
 */
export const level05: LevelDefinition = {
  id: 'level05',
  number: 5,
  name: 'Wobble Workshop',
  subtitle: 'Balance is everything',
  difficulty: 3,
  palette: PALETTES.emerald,
  timeLimitMs: 85_000,
  silverTimeMs: 58_000,
  goldTimeMs: 44_000,
  start: { p: [0, 0, 2], yaw: YAW_NEG_Z },
  goal: { p: [0, -1, -103] },
  fallY: -16,
  musicProfile: 'wobble',
  checkpoints: [
    cp('cp1', 0, -24.5, YAW_NEG_Z, 0, 5),
    cp('cp2', 0, -74.5, YAW_NEG_Z, 0, 4),
  ],
  seeds: [seed(0, -14, 0.1), seed(6, -67, 0.9), seed(-6, -79.5, 0.1)],
  geometry: [
    plat(0, 0, 9, 9, 0),
    plat(0, -6.5, 7, 4, 0),
    // (seesaw hazard fills z -8.5 .. -19.5)
    plat(0, -21.5, 7, 4, 0),
    plat(0, -25.5, 8, 5, 0),
    // recovery deck below the tilting squares
    plat(0, -41, 13, 23, -4.2),
    rampZ(7, -50.8, -57.2, 3.5, -4.2, -0.2),
    plat(7, -58.8, 4, 3.5, -0.2),
    // pad after the squares + junction
    plat(0, -53.5, 5, 4, 0),
    plat(0, -59.5, 14, 5, -0.2),
    // raised risky beam beside the plank (Seed 2 route)
    kicker(4.5, -61.3, YAW_NEG_Z, -0.2, 2.4),
    plat(6, -68, 2.4, 13, 0.9),
    // plank exit pad
    plat(0, -74.8, 7, 4, 0),
    // pivot platform pocket with Seed 3
    plat(-6.5, -79.5, 4.5, 4.5, 0.1),
    // exit pad after pivot
    plat(0, -86.5, 6.5, 4, 0),
    // spring ramps: kicker -> lower pad -> kicker -> finish
    kicker(0, -88.2, YAW_NEG_Z, 0, 3),
    plat(0, -93.5, 7, 5.5, -0.5),
    kicker(0, -95.9, YAW_NEG_Z, -0.5, 3),
    plat(0, -104, 12, 12, -1),
    rail(-3.4, 0, -84.6, -3.4, 0, -88.4),
  ],
  hazards: [
    { t: 'tilting', id: 'seesaw', p: [0, -0.5, -14], s: [10, 1, 11.5], maxTilt: 0.17 },
    { t: 'tilting', id: 'sq1', p: [0, -0.5, -31], s: [7, 1, 7], maxTilt: 0.24 },
    { t: 'tilting', id: 'sq2', p: [0, -0.5, -39], s: [7, 1, 7], maxTilt: 0.24 },
    { t: 'tilting', id: 'sq3', p: [0, -0.5, -47], s: [7, 1, 7], maxTilt: 0.24 },
    { t: 'tilting', id: 'plank', p: [0, -0.5, -67.5], s: [4.5, 1, 12.5], maxTilt: 0.28 },
    { t: 'rotor', id: 'pivot', p: [0, -0.4, -79.8], s: [9, 1, 9], speed: 1.05 },
    { t: 'moving', id: 'weight', p: [6, 2.2, -79.8], s: [2, 3, 2], axis: [0, 1, 0], dist: 3, period: 3.4 },
  ],
  arrows: [
    arrow(0, -3, YAW_NEG_Z, 0, 1.2),
    arrow(0, -8, YAW_NEG_Z, 0),
    arrow(0, -27.5, YAW_NEG_Z, 0),
    arrow(0, -55, YAW_NEG_Z, 0),
    arrow(0, -61.5, YAW_NEG_Z, -0.2),
    arrow(0, -76.3, YAW_NEG_Z, 0),
    arrow(0, -88, YAW_NEG_Z, 0),
  ],
  tutorials: [
    { text: 'Your weight tilts the floor', p: [0, 0, -7.5], radius: 4 },
    { text: 'Slow and centered wins', p: [0, 0, -27], radius: 4 },
    { text: 'Brave? Take the high beam', p: [0, -0.2, -60], radius: 4 },
  ],
  shortcuts: [{ id: 'highBeam', p: [6, 2.2, -68], s: [3, 3, 5] }],
};
