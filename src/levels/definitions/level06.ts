import { PALETTES, type LevelDefinition } from '../types';
import { arrow, cp, plat, rail, rampZ, seed, YAW_NEG_Z } from '../helpers';

/**
 * L6 — NEON SWITCHWAY. Flicker timing, glowing route reading, speed tubes.
 * Route: bright start -> glowing rail path (Seed 1) -> CP1 -> flicker bridge
 * -> waiting platform -> transparent speed tube -> landing (Seed 2) ->
 * alternating neon platforms (faster flicker shortcut with Seed 3) -> CP2 ->
 * giant loop landmark -> final descent -> finish arch.
 */
export const level06: LevelDefinition = {
  id: 'level06',
  number: 6,
  name: 'Neon Switchway',
  subtitle: 'Blink and you fall',
  difficulty: 3,
  palette: PALETTES.neon,
  timeLimitMs: 85_000,
  silverTimeMs: 58_000,
  goldTimeMs: 44_000,
  start: { p: [0, 0, 2], yaw: YAW_NEG_Z },
  goal: { p: [0, -5, -105] },
  fallY: -20,
  musicProfile: 'neon',
  checkpoints: [
    cp('cp1', 0, -22.5, YAW_NEG_Z, 0, 5),
    cp('cp2', 0, -87, YAW_NEG_Z, -3, 5),
  ],
  seeds: [seed(1.5, -17, 0), seed(0, -66, -3), seed(9, -77, -3)],
  geometry: [
    plat(0, 0, 9, 9, 0),
    // glowing rail path
    plat(0, -13.5, 5, 17, 0),
    rail(-2.4, 0, -5.6, -2.4, 0, -21.6),
    rail(2.4, 0, -5.6, 2.4, 0, -21.6),
    // CP1 pad
    plat(0, -24.5, 7, 5, 0),
    // (flicker bridge fills z -27 .. -35)
    // safe waiting platform
    plat(0, -38.5, 7, 6, 0),
    // tube entry funnel
    plat(0, -42.5, 5, 3, 0),
    rail(-2.4, 0, -41.2, -2.4, 0, -43.8),
    rail(2.4, 0, -41.2, 2.4, 0, -43.8),
    // tube landing platform
    plat(0, -64, 9, 12, -3),
    // alternating neon zigzag
    plat(-2.6, -72.5, 5.5, 5.5, -3),
    plat(2.6, -77.5, 5.5, 5.5, -3),
    plat(-2.6, -82.5, 5.5, 5.5, -3),
    // faster flicker shortcut lane (east) + connector from the landing pad
    plat(6, -68, 5, 4, -3),
    plat(9, -70.8, 4, 4.5, -3),
    // (shortcut flicker fills z -73 .. -81)
    plat(9, -83.5, 4, 4, -3),
    // converge + CP2 (wide enough to catch both the zigzag and the shortcut)
    plat(1, -87.5, 18, 8, -3),
    // giant loop-shaped landmark over the final descent
    { t: 'deco', kind: 'ring', p: [0, 1.5, -96], s: [6.5, 0.8, 0] },
    rampZ(0, -92, -100, 6.5, -3, -5),
    plat(0, -106, 12, 12, -5),
    { t: 'deco', kind: 'arch', p: [0, -1.5, -101], s: [8, 4, 0] },
  ],
  hazards: [
    { t: 'flicker', id: 'main', p: [0, -0.5, -31], s: [4.5, 1, 8.5], period: 4.4, offset: 0 },
    { t: 'tube', id: 'speedtube', points: [[0, 0.6, -43.5], [0, 0.2, -48], [0, -1.4, -53], [0, -2.6, -58.5]], r: 1.05, speed: 17 },
    { t: 'flicker', id: 'short1', p: [9, -3.5, -77], s: [3.6, 1, 8.5], period: 3.0, offset: 1.1 },
  ],
  arrows: [
    arrow(0, -3, YAW_NEG_Z, 0, 1.2),
    arrow(0, -19, YAW_NEG_Z, 0),
    arrow(0, -26.5, YAW_NEG_Z, 0),
    arrow(0, -41, YAW_NEG_Z, 0),
    arrow(0, -68.5, YAW_NEG_Z, -3),
    arrow(0, -91, YAW_NEG_Z, -3),
  ],
  tutorials: [
    { text: 'Watch the pulse — cross when solid', p: [0, 0, -25.5], radius: 4 },
    { text: 'Hop in the tube!', p: [0, 0, -40], radius: 4 },
    { text: 'Fast lane: quicker flicker, bigger reward', p: [0, -3, -67], radius: 5 },
  ],
  shortcuts: [{ id: 'fastFlicker', p: [9, -2, -83.5], s: [4, 4, 4] }],
};
