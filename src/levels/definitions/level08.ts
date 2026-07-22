import { PALETTES, type LevelDefinition } from '../types';
import { arrow, cp, plat, rail, rampX, rampZ, seed, YAW_NEG_X, YAW_NEG_Z } from '../helpers';

/**
 * L8 — GRAVITY GARDEN. Magnetic tracks, local gravity, wall-riding, loops.
 * Route: garden start -> banked intro curve (Seed 1) -> CP1 -> magnetic
 * wall-run curve (Seed 2 floating on the arc) -> rest platform -> booster ->
 * full gravity loop (outer shortcut lane with Seed 3) -> CP2 -> curve ->
 * long descent -> finish. The world never rotates: local track frames only.
 */
export const level08: LevelDefinition = {
  id: 'level08',
  number: 8,
  name: 'Gravity Garden',
  subtitle: 'Up is a suggestion',
  difficulty: 4,
  palette: PALETTES.garden,
  timeLimitMs: 95_000,
  silverTimeMs: 65_000,
  goldTimeMs: 48_000,
  start: { p: [0, 0, 2], yaw: YAW_NEG_Z },
  goal: { p: [-62, -4.5, -72] },
  fallY: -20,
  musicProfile: 'garden',
  checkpoints: [
    cp('cp1', -13.5, -22, YAW_NEG_X, 0, 5),
    cp('cp2', -30, -64, YAW_NEG_Z, -1, 5),
  ],
  seeds: [seed(-2.6, -19.4, 0.2), seed(-27.7, -24.3, 1.4), seed(-37, -57, -1)],
  geometry: [
    plat(0, 0, 9, 9, 0),
    // connector runway from the start pad to the curve entry
    plat(0, -8.5, 7, 10, 0),
    // banked intro curve — outer rim guarded
    { t: 'curve', c: [-9, 0, -13], r: 9, w: 7, a0: -Math.PI / 2, a1: 0, segs: 8, bank: 0.15 },
    rail(3.2, 0, -17.2, -0.7, 0, -22.9, 1.0),
    rail(-0.7, 0, -22.9, -9, 0, -25.9, 1.0),
    // CP1 pad before the wall-run (meets the curve exit at x=-9 AND the wall-run floor at x=-22)
    plat(-15.5, -22, 14, 6, 0),
    // safety floor under the wall-run arc (wide: catches wall dropouts)
    { t: 'curve', c: [-22, -2.2, -30], r: 6.4, w: 10.5, a0: Math.PI / 2, a1: Math.PI, segs: 7 },
    // exit ramp: wall-run floor level up to the rest platform
    rampZ(-28.5, -28.5, -34.5, 7, -2.2, -1),
    // rest platform after the wall exit
    plat(-30, -39, 8.5, 12, -1),
    // loop approach with booster
    plat(-30, -49, 6.5, 10, -1),
    // floor under + after the loop
    plat(-30, -56.5, 6, 9, -1),
    // outer shortcut lane (west, skips the loop)
    plat(-37, -55.5, 3, 15, -1),
    rail(-38.4, -1, -48.2, -38.4, -1, -62.8),
    // converge + CP2
    plat(-30, -64.5, 12, 7, -1),
    // curve toward the descent (inner hole filled: corner plaza)
    { t: 'curve', c: [-38, -1, -64], r: 8, w: 6.5, a0: -Math.PI / 2, a1: 0, segs: 7 },
    plat(-38, -64, 10, 10, -1),
    // long final descent (meets the curve exit at x=-38 and the finish pad)
    rampX(-72, -38.5, -57, 6.5, -1, -4.5),
    plat(-62, -72, 12, 12, -4.5),
    { t: 'deco', kind: 'tower', p: [-22, -3.5, -30], s: [5, 16, 5] },
    { t: 'deco', kind: 'flag', p: [-34, -1, -49] },
  ],
  hazards: [
    { t: 'magnetwall', id: 'wallrun', c: [-22, -1.2, -30], r: 8, h: 8, a0: Math.PI / 2, a1: Math.PI - 0.16 },
    { t: 'boost', id: 'speedRun', p: [-30, -1, -48], yaw: YAW_NEG_Z, power: 13 },
  ],
  arrows: [
    arrow(0, -3, YAW_NEG_Z, 0, 1.2),
    arrow(-12, -22, YAW_NEG_X, 0),
    arrow(-19, -22.5, YAW_NEG_X, 0),
    arrow(-30, -42, YAW_NEG_Z, -1),
    arrow(-30, -47, YAW_NEG_Z, -1),
    arrow(-30, -62, YAW_NEG_Z, -1),
    arrow(-46, -72, YAW_NEG_X, -1.6),
  ],
  tutorials: [
    { text: 'Magnetic walls hold you — keep speed', p: [-14.5, 0, -21], radius: 5 },
    { text: 'Boost pads launch you forward', p: [-30, -1, -46], radius: 4 },
    { text: 'The west lane is the fast line', p: [-33, -1, -50], radius: 3 },
  ],
  shortcuts: [{ id: 'outerLane', p: [-37, 0, -55.5], s: [4, 4, 8] }],
};
