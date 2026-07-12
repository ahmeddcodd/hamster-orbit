import { PALETTES, type LevelDefinition } from '../types';
import { arrow, cp, plat, rail, rampZ, seed, YAW_NEG_Z } from '../helpers';

/**
 * L4 — WINDMILL HEIGHTS. Fan force, rotating structures, moving bridges, timing.
 * Route: start -> gentle fan tutorial (Seed 1 upwind) -> rotating bridge ->
 * CP1 -> opposing fan corridors (Seed 2 exposed) -> windmill platform with
 * sweeping arms (Seed 3 near edge) -> synchronized moving bridge -> final
 * uphill -> finish.
 */
export const level04: LevelDefinition = {
  id: 'level04',
  number: 4,
  name: 'Windmill Heights',
  subtitle: 'Lean into the wind',
  difficulty: 3,
  palette: PALETTES.lime,
  timeLimitMs: 80_000,
  silverTimeMs: 52_000,
  goldTimeMs: 40_000,
  start: { p: [0, 0, 2], yaw: YAW_NEG_Z },
  goal: { p: [0, 1.5, -92] },
  fallY: -15,
  musicProfile: 'garden',
  checkpoints: [
    cp('cp1', 0, -36, YAW_NEG_Z, 0, 5),
    cp('cp2', 0, -55.5, YAW_NEG_Z, 0, 5),
  ],
  seeds: [seed(-3, -16, 0), seed(0, -47, 0), seed(4, -62, 0)],
  geometry: [
    plat(0, 0, 9, 9, 0),
    // fan tutorial corridor (wind pushes +X, rail catches you)
    plat(0, -12, 9, 14, 0),
    rail(4.4, 0, -5.4, 4.4, 0, -18.6),
    // rotating bridge gap
    plat(0, -20.5, 8, 4, 0),
    plat(0, -34, 8, 5, 0),
    // CP1 pad
    plat(0, -38.5, 8, 5, 0),
    // opposing fan corridors: safe recessed east lane behind a rail, exposed middle
    plat(0, -47, 13, 13, 0),
    rail(4.6, 0, -41, 4.6, 0, -53),
    rail(6.4, 0, -41, 6.4, 0, -53),
    // windmill platform (extended to meet the fan corridor)
    plat(0, -59.5, 11, 14, 0),
    { t: 'deco', kind: 'tower', p: [8.5, -1.5, -60.5], s: [4, 18, 4] },
    { t: 'deco', kind: 'ring', p: [8.5, 6, -60.5], s: [2.2, 0.35, 0] },
    // moving-bridge crossing (slight step-downs make landings forgiving)
    plat(0, -67.5, 7, 4, 0),
    plat(0, -78.5, 7, 5, -0.8),
    // final uphill to the finish tower
    rampZ(0, -80.8, -87, 7, -0.8, 1.5),
    plat(0, -93, 12, 12, 1.5),
  ],
  hazards: [
    { t: 'fan', id: 'tut', p: [0, 1.2, -12], s: [8, 3, 12], dir: [1, 0, 0], strength: 4.5 },
    { t: 'rotor', id: 'bridge1', p: [0, -0.5, -27.2], s: [11.5, 1, 4], speed: 0.85 },
    { t: 'fan', id: 'f1', p: [0, 1, -44], s: [12, 3, 5], dir: [1, 0, 0], strength: 7 },
    { t: 'fan', id: 'f2', p: [0, 1, -50], s: [12, 3, 5], dir: [-1, 0, 0], strength: 7 },
    { t: 'rotor', id: 'windmillArm', p: [0, 0.55, -60.5], s: [15, 0.9, 1.1], speed: 0.75 },
    { t: 'moving', id: 'syncBridge', p: [0, -1.2, -73], s: [5, 1, 6.5], axis: [1, 0, 0], dist: 6, period: 4.2 },
  ],
  arrows: [
    arrow(0, -3, YAW_NEG_Z, 0, 1.2),
    arrow(0, -17, YAW_NEG_Z, 0),
    arrow(0, -33.5, YAW_NEG_Z, 0),
    arrow(0, -42, YAW_NEG_Z, 0),
    arrow(0, -57, YAW_NEG_Z, 0),
    arrow(0, -67, YAW_NEG_Z, 0),
    arrow(0, -84, YAW_NEG_Z, 0.4),
  ],
  tutorials: [
    { text: 'Fans push the ball — countersteer!', p: [0, 0, -7], radius: 4 },
    { text: 'Ride the spinning bridge', p: [0, 0, -21], radius: 4 },
    { text: 'Dodge the windmill arms', p: [0, 0, -56.5], radius: 4 },
    { text: 'Wait for the bridge to line up', p: [0, 0, -68], radius: 4 },
  ],
  shortcuts: [{ id: 'windLane', p: [0, 1, -47], s: [3, 3, 4] }],
};
