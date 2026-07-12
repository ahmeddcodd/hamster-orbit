import { Surface } from '../../physics/collider';
import { PALETTES, type LevelDefinition } from '../types';
import { arrow, cp, kicker, plat, rail, rampZ, seed, YAW_NEG_X, YAW_NEG_Z } from '../helpers';

/**
 * L10 — ORBIT MASTERY. The final exam: every mechanic combined across five
 * acts, ending in a spectacular (and mechanically reliable) final launch.
 * A: speed + bridges. B: bumper + crosswind + rotating bridge + expert split.
 * C: wobble + neon flicker + speed tube. D: glass bend + magnetic wall + loop.
 * E: hammer, crusher gate, shuttle platform, massive final launch -> finish.
 */
export const level10: LevelDefinition = {
  id: 'level10',
  number: 10,
  name: 'Orbit Mastery',
  subtitle: 'Everything, everywhere, downhill',
  difficulty: 5,
  palette: PALETTES.royal,
  timeLimitMs: 120_000,
  silverTimeMs: 85_000,
  goldTimeMs: 65_000,
  start: { p: [0, 4, 2], yaw: YAW_NEG_Z },
  goal: { p: [-24, -8.5, -204] },
  fallY: -24,
  musicProfile: 'final',
  checkpoints: [
    cp('cp1', 0, -34, YAW_NEG_Z, -0.5, 8),
    cp('cp2', 0, -78.5, YAW_NEG_Z, -0.5, 10),
    cp('cp3', 0, -120, YAW_NEG_Z, -5.5, 9),
    cp('cp4', -24, -148, YAW_NEG_Z, -5.5, 7),
    cp('cp5', -24, -162.5, YAW_NEG_Z, -5.5, 8),
  ],
  seeds: [seed(0, -30, 0.4), seed(3.5, -72, -0.5), seed(-24, -159.5, -5.5)],
  geometry: [
    // ---- ACT A: tower start, accel ramp, narrow bridge, kicker gap
    plat(0, 0, 10, 10, 4),
    rampZ(0, -4.6, -16, 7, 4, 0),
    plat(0, -22, 3.2, 13, 0),
    kicker(0, -27.6, YAW_NEG_Z, 0, 3),
    plat(0, -35.5, 8, 9, -0.5),
    // ---- ACT B: flanking bumpers, crosswind, rotating bridge, safe/expert split
    plat(0, -45.5, 12, 12, -0.5),
    rail(5.9, -0.5, -40, 5.9, -0.5, -51, 1.1),
    rail(-5.9, -0.5, -40, -5.9, -0.5, -51, 1.1),
    plat(0, -53.5, 6, 3.5, -0.5),
    plat(0, -63.5, 6, 4.5, -0.5),
    plat(-3.5, -70.5, 4.2, 13, -0.5),
    rail(-5.5, -0.5, -64.4, -5.5, -0.5, -76.6),
    plat(3.5, -70.5, 2.6, 13, -0.5, { surface: Surface.GLASS }),
    plat(0, -79, 10, 7.5, -0.5),
    // ---- ACT C: tilting square + flicker + neon speed tube
    plat(0, -98.5, 5, 4.5, -0.5),
    plat(0, -122, 9, 11, -5.5),
    // ---- ACT D: glass bend (outer rim fenced) -> magnetic wall-run -> gravity loop
    { t: 'curve', c: [-9, -5.5, -127], r: 9, w: 6, a0: -Math.PI / 2, a1: 0, segs: 7, surface: Surface.GLASS },
    rail(3, -5.5, -124, 1.5, -5.5, -131.8, 1.2),
    rail(1.5, -5.5, -131.8, -3, -5.5, -136.3, 1.2),
    rail(-3, -5.5, -136.3, -8.9, -5.5, -138.9, 1.2),
    plat(-12.5, -136, 7.5, 6, -5.5),
    { t: 'curve', c: [-16, -7.7, -144], r: 6.4, w: 10.5, a0: Math.PI / 2, a1: Math.PI + 0.4, segs: 8 },
    // exit ramp: wall-run floor level back up to the route
    rampZ(-22.5, -142.8, -148.5, 7, -7.7, -5.5),
    // west catch fence: wall dropouts funnel onto the ramp instead of the void
    rail(-27.6, -7.7, -138.5, -27.6, -6, -149, 1.4),
    plat(-24.5, -148, 9, 9, -5.5),
    plat(-24, -156.5, 6, 9, -5.5),
    plat(-24, -162, 8, 6, -5.5),
    // ---- ACT E: hammer, crusher gate, shuttle, mega launch, finish island
    plat(-24, -167, 7, 8, -5.5),
    plat(-24, -171.5, 6.5, 5, -5.5),
    plat(-24, -184, 7, 5, -5.7),
    kicker(-24, -185.6, YAW_NEG_Z, -5.7, 3.2),
    { t: 'deco', kind: 'ring', p: [-24, -3.2, -191], s: [4.5, 0.6, 0] },
    plat(-24, -203, 18, 22, -8.5),
    { t: 'deco', kind: 'tower', p: [-14, -13, -210], s: [6, 20, 6] },
    { t: 'deco', kind: 'tower', p: [-34, -15, -208], s: [5, 16, 5] },
  ],
  hazards: [
    { t: 'bumper', id: 'kickL', p: [-3.4, -0.5, -41.5], r: 0.9, power: 11 },
    { t: 'bumper', id: 'kickR', p: [3.4, -0.5, -43.5], r: 0.9, power: 11 },
    { t: 'fan', id: 'crosswind', p: [0, 0.7, -45.5], s: [11, 3, 10], dir: [1, 0, 0], strength: 7.5 },
    { t: 'rotor', id: 'rotbridge', p: [0, -1, -58.5], s: [11, 1, 3.5], speed: 1.0 },
    { t: 'tilting', id: 'wobble', p: [0, -1, -85.5], s: [6, 1, 6], maxTilt: 0.24 },
    { t: 'flicker', id: 'flick', p: [0, -1, -92.5], s: [4.5, 1, 7], period: 3.6, offset: 0.4 },
    { t: 'tube', id: 'neontube', points: [[0, 0.1, -100], [0, -0.5, -105], [0, -2.5, -111], [0, -4.5, -117]], r: 1.05, speed: 17 },
    { t: 'magnetwall', id: 'wall', c: [-16, -6.7, -144], r: 8, h: 8, a0: Math.PI / 2, a1: Math.PI - 0.16 },
    { t: 'boost', id: 'preloop', p: [-24, -5.5, -150], yaw: YAW_NEG_Z, power: 13 },
    { t: 'loop', id: 'finalLoop', c: [-24, -1.1, -156.5], r: 4.4, w: 3.4, yaw: YAW_NEG_Z },
    { t: 'hammer', id: 'ham', p: [-24, 0.1, -165], len: 4.4, yaw: YAW_NEG_Z, period: 2.5, offset: 0.3 },
    { t: 'crusher', id: 'gate', p: [-24, -5.5, -171.5], s: [4.5, 2, 2.8], rise: 3.4, period: 3.0, offset: 0 },
    { t: 'moving', id: 'shuttle', p: [-24, -6.1, -177.5], s: [5, 1, 6], axis: [1, 0, 0], dist: 5, period: 3.6 },
    { t: 'launch', id: 'megalaunch', p: [-24, -5.7, -186.5], yaw: YAW_NEG_Z, power: 10, upPower: 13.5 },
  ],
  arrows: [
    arrow(0, -3, YAW_NEG_Z, 4, 1.3),
    arrow(0, -12, YAW_NEG_Z, 1.2),
    arrow(0, -24, YAW_NEG_Z, 0),
    arrow(0, -42, YAW_NEG_Z, -0.5),
    arrow(0, -66, YAW_NEG_Z, -0.5),
    arrow(0, -81.5, YAW_NEG_Z, -0.5),
    arrow(0, -98, YAW_NEG_Z, -0.5),
    arrow(-6, -130, YAW_NEG_Z * 0.5, -5.5),
    arrow(-13, -136, YAW_NEG_X, -5.5),
    arrow(-24, -150.5, YAW_NEG_Z, -5.5),
    arrow(-24, -168.5, YAW_NEG_Z, -5.5),
    arrow(-24, -184.5, YAW_NEG_Z, -5.7, 1.3),
  ],
  tutorials: [
    { text: 'Final exam: use everything you know', p: [0, 4, 0], radius: 5 },
    { text: 'Expert lane: glass and glory', p: [0, -0.5, -66], radius: 4 },
    { text: 'Full speed for the mega launch!', p: [-24, -5.5, -181], radius: 5 },
  ],
  shortcuts: [{ id: 'expertLane', p: [3.5, 0.8, -74], s: [3, 3, 4] }],
};
