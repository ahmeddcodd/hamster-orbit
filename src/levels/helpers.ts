import { Surface } from '../physics/collider';
import type { ArrowMarker, CheckpointDef, GeoPiece, V3 } from './types';

/**
 * Level-authoring helpers. Convention: courses mostly flow toward -Z.
 * yaw 0 faces -Z; yaw +PI/2 faces -X; yaw -PI/2 faces +X; PI faces +Z.
 * `yTop` is always the walkable surface height (helpers convert to box centers).
 */

export const YAW_NEG_Z = 0;
export const YAW_NEG_X = Math.PI / 2;
export const YAW_POS_X = -Math.PI / 2;
export const YAW_POS_Z = Math.PI;

export interface PlatOpts {
  rotY?: number;
  surface?: Surface;
  checker?: boolean;
  h?: number;
}

/** Platform: x/z center, w = X size, d = Z size, walkable surface at yTop. */
export function plat(x: number, z: number, w: number, d: number, yTop = 0, opts: PlatOpts = {}): GeoPiece {
  const h = opts.h ?? 1;
  return { t: 'box', p: [x, yTop - h / 2, z], s: [w, h, d], rotY: opts.rotY, surface: opts.surface, checker: opts.checker };
}

/** Ramp running along Z between zA/zB with surface heights yA/yB at those ends. */
export function rampZ(x: number, zA: number, zB: number, w: number, yA: number, yB: number, h = 0.8, surface?: Surface): GeoPiece {
  const zMin = Math.min(zA, zB);
  const zMax = Math.max(zA, zB);
  const yAtMin = zA < zB ? yA : yB;
  const yAtMax = zA < zB ? yB : yA;
  const len = zMax - zMin;
  const tilt = Math.asin((yAtMin - yAtMax) / Math.hypot(len, yAtMin - yAtMax));
  return {
    t: 'box',
    p: [x, (yA + yB) / 2 - h / 2, (zA + zB) / 2],
    s: [w, h, Math.hypot(len, yAtMin - yAtMax)],
    tilt,
    tiltAxis: 'x',
    surface,
  };
}

/** Ramp running along X between xA/xB with surface heights yA/yB at those ends. */
export function rampX(z: number, xA: number, xB: number, d: number, yA: number, yB: number, h = 0.8, surface?: Surface): GeoPiece {
  const xMin = Math.min(xA, xB);
  const xMax = Math.max(xA, xB);
  const yAtMin = xA < xB ? yA : yB;
  const yAtMax = xA < xB ? yB : yA;
  const len = xMax - xMin;
  const tilt = Math.asin((yAtMax - yAtMin) / Math.hypot(len, yAtMax - yAtMin));
  return {
    t: 'box',
    p: [(xA + xB) / 2, (yA + yB) / 2 - h / 2, z],
    s: [Math.hypot(len, yAtMax - yAtMin), h, d],
    tilt,
    tiltAxis: 'z',
    surface,
  };
}

/** Guard rail between two surface points (auto-raised on top of the surface). */
export function rail(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, h = 0.6): GeoPiece {
  return { t: 'rail', from: [x0, y0, z0], to: [x1, y1, z1], h };
}

export function arrow(x: number, z: number, yaw: number, yTop = 0, scale = 1): ArrowMarker {
  return { p: [x, yTop + 0.06, z], yaw, scale };
}

export function cp(id: string, x: number, z: number, yaw: number, yTop = 0, span = 4): CheckpointDef {
  return { id, p: [x, yTop, z], yaw, span };
}

export function seed(x: number, z: number, yTop = 0): V3 {
  return [x, yTop + 0.95, z];
}

/** Kicker: a small angled box that pops the ball upward when rolled over with speed. */
export function kicker(x: number, z: number, yaw: number, yTop = 0, w = 3): GeoPiece {
  return { t: 'box', p: [x, yTop + 0.12, z], s: [w, 0.5, 1.6], rotY: yaw, tilt: 0.42, tiltAxis: 'x' };
}
