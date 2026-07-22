import { Surface } from '../physics/collider';

export type V3 = [number, number, number];

export interface Palette {
  id: string;
  sky: number;
  skyLow: number;
  fog: number;
  checkerA: number;
  checkerB: number;
  side: number;
  sideStripe: number;
  accent: number;
  rail: number;
  glow: number;
}

export type MusicProfile = 'sunny' | 'breezy' | 'bouncy' | 'wobble' | 'neon' | 'ice' | 'garden' | 'mech' | 'final' | 'title';

export type GeoPiece =
  | {
      t: 'box';
      p: V3;
      s: V3;
      rotY?: number;
      tilt?: number;
      tiltAxis?: 'x' | 'z';
      surface?: Surface;
      /** render checker top (default true for walkable, false for walls) */
      checker?: boolean;
    }
  | {
      t: 'curve';
      c: V3;
      r: number;
      w: number;
      a0: number;
      a1: number;
      segs?: number;
      bank?: number;
      thick?: number;
      surface?: Surface;
    }
  | { t: 'rail'; from: V3; to: V3; h?: number }
  | { t: 'deco'; kind: 'tower' | 'arch' | 'pillar' | 'flag'; p: V3; s?: V3; rotY?: number };

export interface ArrowMarker {
  p: V3;
  yaw: number;
  scale?: number;
}

export interface CheckpointDef {
  id: string;
  p: V3;
  yaw: number;
  /** trigger half width (gate span), default 3 */
  span?: number;
  /** respawn position override (defaults to p) */
  spawn?: V3;
}

export interface TutorialDef {
  text: string;
  p: V3;
  radius?: number;
}

export interface ShortcutGate {
  id: string;
  p: V3;
  s: V3;
}

export type HazardDef =
  | { t: 'moving'; id: string; p: V3; s: V3; axis: V3; dist: number; period: number; offset?: number }
  | { t: 'rotor'; id: string; p: V3; s: V3; speed: number }
  | { t: 'tilting'; id: string; p: V3; s: V3; maxTilt?: number }
  | { t: 'bumper'; id: string; p: V3; r?: number; power?: number }
  | { t: 'enemy'; id: string; p: V3; range?: number; speed?: number }
  | { t: 'fan'; id: string; p: V3; s: V3; dir: V3; strength: number }
  | { t: 'flicker'; id: string; p: V3; s: V3; period?: number; offset?: number }
  | { t: 'boost'; id: string; p: V3; yaw: number; s?: V3; power?: number }
  | { t: 'launch'; id: string; p: V3; yaw: number; s?: V3; power?: number; upPower?: number }
  | { t: 'tube'; id: string; points: V3[]; r?: number; speed?: number }
  | { t: 'glass'; id: string; p: V3; s: V3; breakSpeed?: number }
  | { t: 'magnetwall'; id: string; c: V3; r: number; h: number; a0: number; a1: number }
  | { t: 'crusher'; id: string; p: V3; s: V3; rise?: number; period?: number; offset?: number }
  | { t: 'hammer'; id: string; p: V3; len?: number; yaw: number; period?: number; offset?: number }
  | { t: 'saw'; id: string; p: V3; axis?: V3; travel?: number; period?: number; r?: number; offset?: number };

export interface LevelDefinition {
  id: string;
  number: number;
  name: string;
  subtitle: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  palette: Palette;
  timeLimitMs: number;
  silverTimeMs: number;
  goldTimeMs: number;
  start: { p: V3; yaw: number };
  goal: { p: V3; r?: number };
  fallY: number;
  checkpoints: CheckpointDef[];
  seeds: [V3, V3, V3];
  geometry: GeoPiece[];
  hazards: HazardDef[];
  arrows: ArrowMarker[];
  tutorials?: TutorialDef[];
  shortcuts?: ShortcutGate[];
  musicProfile: MusicProfile;
  cameraYaw?: number;
}

export const PALETTES: Record<string, Palette> = {
  skyBlue: {
    id: 'skyBlue',
    sky: 0x7ec8f7,
    skyLow: 0xdff2ff,
    fog: 0xa8d8f8,
    checkerA: 0xffffff,
    checkerB: 0xbcd9f5,
    side: 0x3d6fd6,
    sideStripe: 0x77a8f0,
    accent: 0xf05a4f,
    rail: 0x2b4fae,
    glow: 0x9fd4ff,
  },
  amber: {
    id: 'amber',
    sky: 0xffb45e,
    skyLow: 0xffe8c8,
    fog: 0xffcf94,
    checkerA: 0xfff6e8,
    checkerB: 0xffc477,
    side: 0xe07818,
    sideStripe: 0xffab4a,
    accent: 0xef4136,
    rail: 0xa14d05,
    glow: 0xffd9a0,
  },
  bumper: {
    id: 'bumper',
    sky: 0xffd94e,
    skyLow: 0xfff3c4,
    fog: 0xffe388,
    checkerA: 0xfffbef,
    checkerB: 0xffd35c,
    side: 0xe8940f,
    sideStripe: 0xffc23e,
    accent: 0xe23d28,
    rail: 0x9c5c00,
    glow: 0xffe9a8,
  },
  lime: {
    id: 'lime',
    sky: 0x8fd14f,
    skyLow: 0xe4f7c8,
    fog: 0xb8e388,
    checkerA: 0xf7fdec,
    checkerB: 0xa8d962,
    side: 0x4c9427,
    sideStripe: 0x83c74c,
    accent: 0xff7038,
    rail: 0x2f6b12,
    glow: 0xd4f2a0,
  },
  emerald: {
    id: 'emerald',
    sky: 0x39b980,
    skyLow: 0xc8f2dd,
    fog: 0x7fd6ac,
    checkerA: 0xf0fcf5,
    checkerB: 0x7fd6a4,
    side: 0x1e7a52,
    sideStripe: 0x46b57e,
    accent: 0xffb52e,
    rail: 0x115239,
    glow: 0xa8ecc9,
  },
  neon: {
    id: 'neon',
    sky: 0x8b1fa8,
    skyLow: 0xd583ea,
    fog: 0xa346c2,
    checkerA: 0xf6e3fc,
    checkerB: 0xc554e6,
    side: 0x6c0f8e,
    sideStripe: 0xa937d1,
    accent: 0x52fa6e,
    rail: 0x430a5e,
    glow: 0xff8df5,
  },
  ice: {
    id: 'ice',
    sky: 0x9fd4f2,
    skyLow: 0xeef9ff,
    fog: 0xc4e6f7,
    checkerA: 0xffffff,
    checkerB: 0xb8e0f2,
    side: 0x4585c2,
    sideStripe: 0x8dc0e8,
    accent: 0x2e6bd6,
    rail: 0x2c5f94,
    glow: 0xd8f2ff,
  },
  garden: {
    id: 'garden',
    sky: 0xa4d94a,
    skyLow: 0xeafad0,
    fog: 0xc6e88a,
    checkerA: 0xfbffee,
    checkerB: 0xbfe36a,
    side: 0x5c9e1d,
    sideStripe: 0x92c94a,
    accent: 0xff5db1,
    rail: 0x3d7010,
    glow: 0xe0f7ae,
  },
  clockwork: {
    id: 'clockwork',
    sky: 0xc23a35,
    skyLow: 0xf7d9c4,
    fog: 0xd97a62,
    checkerA: 0xfaf0e0,
    checkerB: 0xd9564a,
    side: 0x8e2620,
    sideStripe: 0xc4463c,
    accent: 0xf2b23a,
    rail: 0x5e1512,
    glow: 0xffc98a,
  },
  royal: {
    id: 'royal',
    sky: 0x3c4fd9,
    skyLow: 0xb4c4ff,
    fog: 0x6b7ce8,
    checkerA: 0xf2f5ff,
    checkerB: 0x8494ec,
    side: 0x2a2f9e,
    sideStripe: 0x5560d4,
    accent: 0xffd042,
    rail: 0x1b1f70,
    glow: 0xa8b8ff,
  },
};
