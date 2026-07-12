import { Surface } from '../../physics/collider';
import { PALETTES, type LevelDefinition } from '../types';
import { arrow, cp, plat, rail, rampX, seed, YAW_NEG_X, YAW_NEG_Z } from '../helpers';

/**
 * L7 — CRYSTAL GLIDE. Low traction, early braking, sliding, breakable glass.
 * Route: normal start -> glass transition -> wide glass turn (Seed 1 outside)
 * -> CP1 -> long downhill glass slope -> banked curve -> railed safe lane vs
 * rail-free fast lane (breakable wall hides Seed 2) -> converge -> narrow
 * glass lanes with braking islands (Seed 3) -> CP2 -> recovery -> finish.
 */
export const level07: LevelDefinition = {
  id: 'level07',
  number: 7,
  name: 'Crystal Glide',
  subtitle: 'Brake before you need to',
  difficulty: 4,
  palette: PALETTES.ice,
  timeLimitMs: 90_000,
  silverTimeMs: 62_000,
  goldTimeMs: 46_000,
  start: { p: [0, 0, 2], yaw: YAW_NEG_Z },
  goal: { p: [-41, -4.5, -91] },
  fallY: -18,
  musicProfile: 'ice',
  checkpoints: [
    cp('cp0', 0, -15.5, YAW_NEG_Z, 0, 5),
    cp('cp1', -14.5, -26, YAW_NEG_X, 0, 5),
    cp('cp2', -41, -66, YAW_NEG_Z, -4, 5),
  ],
  seeds: [seed(-1.5, -24.5, 0), seed(-38.5, -52, -4), seed(-41, -74, -4)],
  geometry: [
    plat(0, 0, 9, 9, 0),
    // glass transition
    plat(0, -11.5, 7, 13, 0, { surface: Surface.GLASS }),
    // wide glass turn — outer rim guarded, inner edge open (brake or fall inside!)
    { t: 'curve', c: [-9, 0, -17], r: 9, w: 7, a0: -Math.PI / 2, a1: 0, segs: 8, surface: Surface.GLASS },
    rail(3.4, 0, -13.5, 1.8, 0, -23.2, 1.2),
    rail(1.8, 0, -23.2, -2.7, 0, -27.8, 1.2),
    rail(-2.7, 0, -27.8, -9, 0, -29.4, 1.2),
    // CP1 island (normal grip, meets the curve exit at x=-9)
    plat(-14, -26, 10, 6.5, 0),
    // long downhill glass slope (reaches past the banked-curve entry)
    rampX(-26, -18.8, -35.5, 7, 0, -4, 0.8, Surface.GLASS),
    // banked curve into the lanes — outer rim fenced against downhill overshoots
    { t: 'curve', c: [-34, -4, -33], r: 7, w: 6, a0: Math.PI / 2, a1: Math.PI, segs: 7, bank: 0.16, surface: Surface.GLASS },
    rail(-33.6, -4, -23.2, -40.8, -4, -26.1, 1.2),
    rail(-40.8, -4, -26.1, -43.8, -4, -32.8, 1.2),
    // safe railed lane (west) + fast rail-free glass lane (east) — both reach the curve exit
    plat(-43.5, -41, 4, 16, -4),
    rail(-45.6, -4, -34, -45.6, -4, -48.6),
    plat(-38.5, -41, 4, 16, -4, { surface: Surface.GLASS }),
    // convergence pad (glass wall blocks the fast lane just before it)
    plat(-41, -52.5, 10, 8, -4),
    // narrow glass lane 1
    plat(-41, -59.5, 3.2, 8, -4, { surface: Surface.GLASS }),
    // braking island (normal)
    plat(-41, -66, 6.5, 5.5, -4),
    // final glass lane with Seed 3
    plat(-41, -73.5, 3.6, 10, -4, { surface: Surface.GLASS }),
    // recovery platform
    plat(-41, -81.5, 7, 6, -4),
    // finish
    plat(-41, -91.5, 12, 12, -4.5),
    { t: 'deco', kind: 'pillar', p: [-49, -8, -60], s: [3, 16, 3] },
    { t: 'deco', kind: 'pillar', p: [-33, -8, -70], s: [2.4, 13, 2.4] },
  ],
  hazards: [
    { t: 'glass', id: 'wall', p: [-38.5, -2.4, -48.7], s: [4, 3.2, 0.6], breakSpeed: 9 },
  ],
  arrows: [
    arrow(0, -3, YAW_NEG_Z, 0, 1.2),
    arrow(0, -9, YAW_NEG_Z, 0),
    arrow(-13, -26, YAW_NEG_X, 0),
    arrow(-24, -26, YAW_NEG_X, -1.5),
    arrow(-41, -41, YAW_NEG_Z, -4),
    arrow(-41, -56.5, YAW_NEG_Z, -4),
    arrow(-41, -78.5, YAW_NEG_Z, -4),
  ],
  tutorials: [
    { text: 'Glass is slippery — brake early', p: [0, 0, -7], radius: 4 },
    { text: 'Grip returns on checkered floor', p: [-14.5, 0, -26], radius: 4 },
    { text: 'Smash the wall at full speed for a secret', p: [-40, -4, -44], radius: 5 },
  ],
  shortcuts: [{ id: 'fastLane', p: [-38.5, -3, -46], s: [4, 3, 4] }],
};
