import { PALETTES, type LevelDefinition } from '../types';
import { arrow, cp, plat, rail, rampZ, seed, YAW_NEG_X, YAW_NEG_Z } from '../helpers';

/**
 * L2 — SKYBRIDGE SPRINT. Narrow bridges, momentum gaps, route choice,
 * controlled turning, a slow telegraphed gate.
 * Route: start -> descent -> curve -> narrow low-rail bridge -> CP1 ->
 * visible fork (wide outer vs narrow diagonal shortcut) -> island -> gap ->
 * CP2 -> curve around the tower (Seed 3 inside) -> sliding gate ->
 * rail-free final bridge -> finish.
 */
export const level02: LevelDefinition = {
  id: 'level02',
  number: 2,
  name: 'Skybridge Sprint',
  subtitle: 'Narrow paths, brave lines',
  difficulty: 2,
  palette: PALETTES.amber,
  timeLimitMs: 70_000,
  silverTimeMs: 45_000,
  goldTimeMs: 34_000,
  start: { p: [0, 0, 2], yaw: YAW_NEG_Z },
  goal: { p: [-76, -3, -54] },
  fallY: -16,
  musicProfile: 'breezy',
  checkpoints: [
    cp('cp1', -27, -20, YAW_NEG_X, -1.5, 4),
    cp('cp2', -46, -44, YAW_NEG_Z, -3, 5),
  ],
  seeds: [seed(-46, -28, -1.5), seed(-40, -27, -1.5), seed(-50.5, -49.5, -3)],
  geometry: [
    plat(0, 0, 9, 9, 0),
    rampZ(0, -4.4, -12, 7, 0, -1.5),
    { t: 'curve', c: [-8, -1.5, -12], r: 8, w: 6, a0: -Math.PI / 2, a1: 0, segs: 7 },
    // outer guard rails along the curve rim (fast entries get caught, not dropped)
    rail(2.9, -1.5, -13, 1.2, -1.5, -18.2),
    rail(1.2, -1.5, -18.2, -2.7, -1.5, -21.7, 0.8),
    rail(-2.7, -1.5, -21.7, -11.2, -1.5, -23.4, 0.8),
    // corner plaza smooths the curve-to-bridge transition
    plat(-8, -20, 6.5, 7, -1.5),
    // narrow low-rail bridge (reaches the curve exit at x=-8)
    plat(-17.2, -20, 18.5, 3, -1.5),
    rail(-12, -1.5, -18.6, -26, -1.5, -18.6, 0.35),
    rail(-12, -1.5, -21.4, -26, -1.5, -21.4, 0.35),
    // CP1 pad + fork pad
    plat(-30, -20, 10, 6, -1.5),
    // safe outer route (wide, longer)
    plat(-41, -20, 12, 5.5, -1.5),
    plat(-46, -29, 5.5, 14, -1.5),
    rail(-48.7, -1.5, -17.4, -48.7, -1.5, -30, 0.5),
    // narrow diagonal shortcut
    { t: 'box', p: [-40.5, -2, -28], s: [2.8, 1, 17.5], rotY: Math.atan2(-11, -15) },
    // central island (fork routes converge)
    plat(-46, -37.5, 8.5, 6, -1.5),
    // momentum gap down to CP2 pad
    plat(-46, -46, 8, 7, -3),
    // curve around the landmark tower
    { t: 'curve', c: [-54, -3, -46], r: 8, w: 6, a0: -Math.PI / 2, a1: 0, segs: 7 },
    { t: 'deco', kind: 'tower', p: [-54, -4.2, -46], s: [7, 22, 7] },
    // gate bridge (reaches the tower-curve exit at x=-54)
    plat(-59, -54, 10, 5.5, -3),
    // rail-free final bridge
    plat(-67.5, -54, 8, 3.2, -3),
    // finish pad
    plat(-76, -54, 11, 11, -3),
    { t: 'deco', kind: 'flag', p: [-3.5, 0, -3.5] },
    { t: 'deco', kind: 'flag', p: [3.5, 0, -3.5] },
  ],
  hazards: [
    // slow telegraphed sliding gate across the exit bridge
    { t: 'moving', id: 'gate', p: [-60.5, -1.6, -54], s: [4.6, 2.6, 1.2], axis: [0, 1, 0], dist: 3.4, period: 5, offset: 1.2 },
  ],
  arrows: [
    arrow(0, -3, YAW_NEG_Z, 0, 1.2),
    arrow(-14, -20, YAW_NEG_X, -1.5),
    arrow(-33.5, -20, YAW_NEG_X, -1.5),
    arrow(-46, -24, YAW_NEG_Z, -1.5),
    arrow(-46, -36, YAW_NEG_Z, -1.5),
    arrow(-46, -46, YAW_NEG_Z, -3),
    arrow(-63, -54, YAW_NEG_X, -3),
  ],
  tutorials: [
    { text: 'Stay steady on narrow bridges', p: [-14, -1.5, -20], radius: 5 },
    { text: 'Two routes — pick your line', p: [-32, -1.5, -20], radius: 4 },
    { text: 'Keep speed to clear the gap', p: [-46, -1.5, -39], radius: 4 },
    { text: 'Time your crossing', p: [-56, -3, -54], radius: 4 },
  ],
  shortcuts: [{ id: 'diagonal', p: [-40.5, -0.5, -28], s: [4, 4, 5] }],
};
