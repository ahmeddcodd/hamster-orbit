import * as THREE from 'three';
import { PHYSICS } from '../config/config';
import { BoxCollider, Surface, type ContactInfo } from './collider';

export interface BallState {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  radius: number;
}

export interface StepResult {
  grounded: boolean;
  groundNormal: THREE.Vector3;
  support: BoxCollider | null;
  supportVelocity: THREE.Vector3;
  contacts: ContactInfo[];
  maxImpact: number;
  lethal: BoxCollider | null;
  surface: Surface;
}

/** A magnetic attraction field (gravity override) — used by loops and wall-ride tracks. */
export interface MagnetField {
  id: string;
  enabled: boolean;
  /** Writes gravity direction into out and returns influence 0..1 (0 = no influence). */
  sample(pos: THREE.Vector3, out: THREE.Vector3): number;
}

/** A constant force zone (fans). Applies while the ball center is inside the volume. */
export interface ForceZone {
  id: string;
  enabled: boolean;
  volume: BoxCollider;
  force: THREE.Vector3;
}

export interface TriggerVolume {
  id: string;
  enabled: boolean;
  volume: BoxCollider;
  onEnter: () => void;
  inside: boolean;
}

const _normal = new THREE.Vector3();
const _point = new THREE.Vector3();
const _pointVel = new THREE.Vector3();
const _relVel = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

export class PhysicsWorld {
  colliders: BoxCollider[] = [];
  magnets: MagnetField[] = [];
  forceZones: ForceZone[] = [];
  triggers: TriggerVolume[] = [];
  /** current local up (usually world up; tilted by magnet fields) */
  readonly result: StepResult = {
    grounded: false,
    groundNormal: new THREE.Vector3(0, 1, 0),
    support: null,
    supportVelocity: new THREE.Vector3(),
    contacts: [],
    maxImpact: 0,
    lethal: null,
    surface: Surface.NORMAL,
  };

  add(c: BoxCollider): BoxCollider {
    this.colliders.push(c);
    return c;
  }

  remove(c: BoxCollider): void {
    const i = this.colliders.indexOf(c);
    if (i >= 0) this.colliders.splice(i, 1);
  }

  addTrigger(t: TriggerVolume): TriggerVolume {
    this.triggers.push(t);
    return t;
  }

  clear(): void {
    this.colliders.length = 0;
    this.magnets.length = 0;
    this.forceZones.length = 0;
    this.triggers.length = 0;
  }

  /** Sum of active force-zone forces at a position (written to out). */
  sampleForces(pos: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    out.set(0, 0, 0);
    for (const z of this.forceZones) {
      if (!z.enabled || !z.volume.enabled) continue;
      if (z.volume.aabbOverlapsSphere(pos, 0) && z.volume.sphereContact(pos, 0.01, _normal, _point) >= 0) {
        out.add(z.force);
      }
    }
    return out;
  }

  /** Strongest magnet influence at pos; writes gravity dir, returns influence (0 = none). */
  sampleMagnets(pos: THREE.Vector3, outDir: THREE.Vector3): number {
    let best = 0;
    for (const m of this.magnets) {
      if (!m.enabled) continue;
      const inf = m.sample(pos, _normal);
      if (inf > best) {
        best = inf;
        outDir.copy(_normal);
      }
    }
    return best;
  }

  updateTriggers(pos: THREE.Vector3, radius: number): void {
    for (const t of this.triggers) {
      if (!t.enabled) {
        t.inside = false;
        continue;
      }
      const hit =
        t.volume.enabled &&
        t.volume.aabbOverlapsSphere(pos, radius) &&
        t.volume.sphereContact(pos, radius, _normal, _point) >= 0;
      if (hit && !t.inside) {
        t.inside = true;
        t.onEnter();
      } else if (!hit) {
        t.inside = false;
      }
    }
  }

  /**
   * Integrate one fixed substep and resolve collisions.
   * gravity: effective gravity acceleration vector for this substep.
   * upDir: current local up (opposite of gravity normalized).
   */
  step(ball: BallState, dt: number, gravity: THREE.Vector3, fireCallbacks = true): StepResult {
    const r = this.result;
    ball.vel.addScaledVector(gravity, dt);
    ball.pos.addScaledVector(ball.vel, dt);

    r.grounded = false;
    r.support = null;
    r.supportVelocity.set(0, 0, 0);
    r.contacts.length = 0;
    r.maxImpact = 0;
    r.lethal = null;
    r.surface = Surface.NORMAL;
    _up.copy(gravity).multiplyScalar(-1);
    if (_up.lengthSq() > 1e-8) _up.normalize();
    else _up.set(0, 1, 0);

    let bestSupportDot: number = PHYSICS.MAX_GROUND_DOT;

    // few iterations to settle multi-contact cases (corners, seams)
    for (let iter = 0; iter < 3; iter++) {
      let any = false;
      for (const c of this.colliders) {
        if (!c.enabled) continue;
        if (!c.aabbOverlapsSphere(ball.pos, ball.radius)) continue;
        const depth = c.sphereContact(ball.pos, ball.radius, _normal, _point);
        if (depth < 0) continue;
        any = true;

        // push out of penetration
        ball.pos.addScaledVector(_normal, depth);

        // resolve velocity relative to the (possibly moving) contact point
        c.pointVelocity(_point, _pointVel);
        _relVel.copy(ball.vel).sub(_pointVel);
        const vn = _relVel.dot(_normal);
        const impact = -vn;
        if (vn < 0) {
          const restitution = c.restitution ?? PHYSICS.RESTITUTION;
          const bounce = impact > 2.2 ? restitution : 0; // tiny contacts don't bounce (kills jitter)
          ball.vel.addScaledVector(_normal, -vn * (1 + bounce));
        }

        if (iter === 0) {
          const info: ContactInfo = {
            collider: c,
            normal: _normal.clone(),
            depth,
            point: _point.clone(),
            impactSpeed: Math.max(0, impact),
          };
          r.contacts.push(info);
          if (impact > r.maxImpact) r.maxImpact = impact;
          if (c.surface === Surface.LETHAL && !r.lethal) r.lethal = c;
          if (c.onContact && fireCallbacks) c.onContact(info);
        }

        // ground classification against local up
        const upDot = _normal.dot(_up);
        if (upDot > bestSupportDot) {
          bestSupportDot = upDot;
          r.grounded = true;
          r.groundNormal.copy(_normal);
          r.support = c;
          c.pointVelocity(_point, r.supportVelocity);
          r.surface = c.surface;
        }
      }
      if (!any) break;
    }
    return r;
  }
}
