import { PALETTES, type LevelDefinition } from '../types';
import { arrow, cp, plat, rail, rampX, rampZ, seed, kicker, YAW_NEG_X, YAW_NEG_Z } from '../helpers';

/**
 * L1 — CLOUDTOP ACADEMY. Teaches directional control, analog strength,
 * momentum, braking, slopes, arrows, checkpoints, seeds, goal.
 * Route: start -> wide ramp -> guarded left curve -> runway (Seed 1) ->
 * uphill -> wide bridge -> CP1 -> broad S (optional kicker shortcut, Seed 2) ->
 * CP2 -> momentum gap -> raised side platform (Seed 3) -> downhill -> finish.
 */
export const level01: LevelDefinition = {
  id: 'level01',
  number: 1,
  name: 'Cloudtop Academy',
  subtitle: 'Learn to roll',
  difficulty: 1,
  palette: PALETTES.skyBlue,
  timeLimitMs: 65_000,
  silverTimeMs: 40_000,
  goldTimeMs: 30_000,
  start: { p: [0, 0, 2], yaw: YAW_NEG_Z },
  goal: { p: [-104, -5, -36] },
  fallY: -18,
  musicProfile: 'sunny',
  checkpoints: [
    cp('cp1', -45, -24, YAW_NEG_X, -0.5, 5),
    cp('cp2', -70, -36, YAW_NEG_X, -0.5, 5),
  ],
  seeds: [seed(-20, -24, -2), seed(-62, -36, -0.5), seed(-79, -45, -0.8)],
  geometry: [
    // start pad
    plat(0, 0, 10, 10, 0),
    rail(-5, 0, 5, -5, 0, -4),
    rail(5, 0, 5, 5, 0, -4),
    // wide descending ramp
    rampZ(0, -4.6, -15.4, 8, 0, -2),
    // guarded left curve (-Z to -X)
    { t: 'curve', c: [-9, -2, -15], r: 9, w: 7, a0: -Math.PI / 2, a1: 0, segs: 7 },
    rail(0.5, -2, -19, -3, -2, -23.4),
    // runway with Seed 1 (reaches x=-9 to meet the curve exit seamlessly)
    plat(-20.5, -24, 23, 7, -2),
    // small uphill
    rampX(-24, -32, -39.5, 6, -2, -0.5),
    // wide bridge to CP1
    plat(-45, -24, 12, 5, -0.5),
    rail(-40, -0.5, -21.6, -50, -0.5, -21.6),
    rail(-40, -0.5, -26.4, -50, -0.5, -26.4),
    // broad S: A (turn to -Z), B (turn back to -X), C
    plat(-54.5, -28, 10, 13, -0.5),
    plat(-62, -36, 11, 8, -0.5),
    plat(-70.5, -36, 8, 7, -0.5),
    rail(-59.4, -0.5, -22, -59.4, -0.5, -30),
    rail(-50.6, -0.5, -30, -50.6, -0.5, -34.5),
    // optional kicker shortcut across the S inner corner
    kicker(-55, -33.5, Math.PI / 4, -0.5, 2.6),
    // momentum gap: C -> D (landing lower)
    plat(-80, -36, 9, 8, -2),
    // raised side platform with Seed 3 (detour toward -Z)
    rampZ(-79, -39.8, -42.2, 4, -2, -0.9),
    plat(-79, -45.5, 6.5, 6.5, -0.9),
    rail(-82.2, -0.9, -42.4, -82.2, -0.9, -48.6),
    rail(-75.8, -0.9, -42.4, -75.8, -0.9, -48.6),
    // final downhill
    rampX(-36, -84.4, -96, 7, -2, -5),
    // finish pad (overlaps the ramp end)
    plat(-103, -36, 15, 13, -5),
  ],
  hazards: [],
  arrows: [
    arrow(0, -2.5, YAW_NEG_Z, 0, 1.3),
    arrow(0, -10, YAW_NEG_Z, -1),
    arrow(-14, -24, YAW_NEG_X, -2),
    arrow(-35, -24, YAW_NEG_X, -1.2),
    arrow(-55, -25, YAW_NEG_Z, -0.5),
    arrow(-56, -34, YAW_NEG_X * 0.5, -0.5),
    arrow(-74, -36, YAW_NEG_X, -0.5),
    arrow(-88, -36, YAW_NEG_X, -2.6),
  ],
  tutorials: [
    { text: 'Drag to roll', p: [0, 0, 1], radius: 5 },
    { text: 'Push farther for more speed', p: [0, -2, -10], radius: 5 },
    { text: 'Pull backward to brake', p: [-1, -2, -16], radius: 5 },
    { text: 'Follow the arrows', p: [-20, -2, -24], radius: 5 },
    { text: 'Reach the goal before time runs out', p: [-45, -0.5, -24], radius: 5 },
  ],
  shortcuts: [{ id: 'sCorner', p: [-59, 1, -33], s: [5, 4, 5] }],
};
