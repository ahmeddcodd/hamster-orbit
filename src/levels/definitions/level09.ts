import { PALETTES, type LevelDefinition } from '../types';
import { arrow, cp, plat, rail, rampZ, seed, YAW_NEG_Z } from '../helpers';

/**
 * L9 — CLOCKWORK CORE. Crushers, saw blades, swinging hammers, mechanical
 * timing, combined hazard reading. All cycles deterministic; no intro deaths.
 * Route: overlook -> slow crusher tutorial (Seed 1 alcove) -> CP1 ->
 * alternating crusher corridor -> gear platform -> CP2 -> saw crossing
 * (waiting pocket + fast lane with Seed 2) -> hammer bridge -> conveyor
 * platform -> CP3 -> gear lane (Seed 3 between hazards) -> fan+crusher combo
 * -> clock-tower finish.
 */
export const level09: LevelDefinition = {
  id: 'level09',
  number: 9,
  name: 'Clockwork Core',
  subtitle: 'Read the machine',
  difficulty: 5,
  palette: PALETTES.clockwork,
  timeLimitMs: 105_000,
  silverTimeMs: 72_000,
  goldTimeMs: 55_000,
  start: { p: [0, 0, 2], yaw: YAW_NEG_Z },
  goal: { p: [0, 0, -110] },
  fallY: -15,
  musicProfile: 'mech',
  checkpoints: [
    cp('cp1', 0, -20, YAW_NEG_Z, 0, 5),
    cp('cp2', 0, -52.5, YAW_NEG_Z, 0, 4),
    cp('cp3', 0, -85, YAW_NEG_Z, 0, 4),
  ],
  seeds: [seed(5.8, -12, 0), seed(4.5, -64, 0), seed(0, -95, 0)],
  geometry: [
    plat(0, 0, 9, 9, 0),
    // crusher tutorial hall + safe alcove (flush with the start pad)
    plat(0, -11.5, 7, 14, 0),
    plat(5.8, -12, 4.5, 5, 0),
    // CP1 pad
    plat(0, -21, 8, 5, 0),
    // alternating crusher corridor
    plat(0, -31, 7, 17, 0),
    rail(-3.4, 0, -23.6, -3.4, 0, -38.4),
    rail(3.4, 0, -23.6, 3.4, 0, -38.4),
    // gear platform bridges the gap (rotor hazard)
    plat(0, -41, 6, 4, 0),
    plat(0, -52.5, 7, 5, 0),
    // saw crossing + waiting pocket + fast lane behind the saw
    plat(0, -58.5, 8, 13, 0),
    plat(6.5, -56.5, 4, 4.5, 0),
    plat(4.5, -64, 4, 11, 0),
    // hammer bridge (wide enough to catch the fast-lane rejoin)
    plat(0, -69.5, 6, 13, 0),
    // conveyor crossing (moving platform over the gap)
    plat(0, -77.5, 6, 4, 0),
    plat(0, -86, 7, 5, -0.6),
    // ramp up from the conveyor landing to the gear lane
    rampZ(0, -87.6, -90, 5, -0.6, 0),
    // gear lane with Seed 3
    plat(0, -94.5, 4.5, 11, 0, { h: 1.6 }),
    // fan + crusher combo hall
    plat(0, -101.5, 8, 9, 0),
    rail(4.1, 0, -97.4, 4.1, 0, -105.6),
    // clock-tower finish
    plat(0, -111, 12, 12, 0),
    { t: 'deco', kind: 'tower', p: [7.5, -1, -111], s: [5, 24, 5] },
    { t: 'deco', kind: 'ring', p: [7.5, 12.5, -110.9], s: [2.6, 0.4, 0] },
  ],
  hazards: [
    { t: 'crusher', id: 'tut', p: [0, 0, -12], s: [4, 2, 3], rise: 4, period: 4.6, offset: 0.8 },
    { t: 'crusher', id: 'c1', p: [0, 0, -26], s: [5.5, 2, 2.6], rise: 3.4, period: 3.4, offset: 0 },
    { t: 'crusher', id: 'c2', p: [0, 0, -31], s: [5.5, 2, 2.6], rise: 3.4, period: 3.4, offset: 1.15 },
    { t: 'crusher', id: 'c3', p: [0, 0, -36], s: [5.5, 2, 2.6], rise: 3.4, period: 3.4, offset: 2.3 },
    { t: 'rotor', id: 'gear', p: [0, -0.5, -46.5], s: [9.5, 1, 9.5], speed: 0.95 },
    { t: 'saw', id: 'saw1', p: [0, 0.6, -58.5], axis: [1, 0, 0], travel: 6, period: 3.0, r: 1.1 },
    { t: 'hammer', id: 'h1', p: [0, 5.1, -66.5], len: 4.4, yaw: YAW_NEG_Z, period: 2.6, offset: 0 },
    { t: 'hammer', id: 'h2', p: [0, 5.1, -72.5], len: 4.4, yaw: YAW_NEG_Z, period: 2.6, offset: 1.3 },
    { t: 'moving', id: 'conveyor', p: [0, -1.1, -81.8], s: [5, 1, 5.5], axis: [1, 0, 0], dist: 5.5, period: 3.8 },
    { t: 'saw', id: 'saw2', p: [0, 1.3, -91.5], axis: [1, 0, 0], travel: 3.2, period: 2.4, r: 0.95, offset: 0.7 },
    { t: 'fan', id: 'sidewind', p: [0, 1.2, -101.5], s: [7, 3, 8], dir: [1, 0, 0], strength: 6.5 },
    { t: 'crusher', id: 'cFinal', p: [0, 0, -104.5], s: [5, 2, 2.8], rise: 3.6, period: 3.2, offset: 0.5 },
  ],
  arrows: [
    arrow(0, -3, YAW_NEG_Z, 0, 1.2),
    arrow(0, -17.5, YAW_NEG_Z, 0),
    arrow(0, -23, YAW_NEG_Z, 0),
    arrow(0, -42.5, YAW_NEG_Z, 0),
    arrow(0, -55, YAW_NEG_Z, 0),
    arrow(0, -76.5, YAW_NEG_Z, 0),
    arrow(0, -88, YAW_NEG_Z, -0.6),
    arrow(0, -107, YAW_NEG_Z, 0.3),
  ],
  tutorials: [
    { text: 'Crushers telegraph before they slam', p: [0, 0, -7.5], radius: 4 },
    { text: 'Follow the rhythm: one gap at a time', p: [0, 0, -23.5], radius: 4 },
    { text: 'Wait in the pocket, dash behind the saw', p: [0, 0, -54.5], radius: 4 },
    { text: 'Hammers knock — never linger', p: [0, 0, -64], radius: 4 },
  ],
  shortcuts: [{ id: 'sawLane', p: [4.5, 1, -66.5], s: [3.5, 3, 4] }],
};
