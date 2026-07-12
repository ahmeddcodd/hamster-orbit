import * as THREE from 'three';

export enum Surface {
  NORMAL = 'normal',
  GLASS = 'glass',
  TAR = 'tar',
  LETHAL = 'lethal',
}

export interface ContactInfo {
  collider: BoxCollider;
  normal: THREE.Vector3;
  depth: number;
  point: THREE.Vector3;
  /** approach speed along the contact normal before resolution (positive = impacting) */
  impactSpeed: number;
}

const _local = new THREE.Vector3();
const _closest = new THREE.Vector3();
const _invQuat = new THREE.Quaternion();
const _arm = new THREE.Vector3();

/**
 * Oriented box collider. Static platforms, ramps, rails, and every kinematic
 * hazard body use this one shape; the checkerboard visuals are rendered
 * separately (never hundreds of per-tile colliders).
 */
export class BoxCollider {
  center = new THREE.Vector3();
  halfExtents = new THREE.Vector3(1, 1, 1);
  quat = new THREE.Quaternion();
  surface: Surface = Surface.NORMAL;
  enabled = true;
  restitution: number | null = null;
  /** kinematic linear velocity (for moving platforms / hazards) */
  velocity = new THREE.Vector3();
  /** kinematic angular velocity about center (rad/s) */
  angularVel = new THREE.Vector3();
  /** hazard or system that owns this body */
  owner: unknown = null;
  onContact: ((info: ContactInfo) => void) | null = null;
  readonly aabbMin = new THREE.Vector3();
  readonly aabbMax = new THREE.Vector3();
  private rotated = false;

  constructor(public id: string) {}

  setBox(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number): this {
    this.center.set(cx, cy, cz);
    this.halfExtents.set(sx / 2, sy / 2, sz / 2);
    this.updateBounds();
    return this;
  }

  setQuat(q: THREE.Quaternion): this {
    this.quat.copy(q);
    this.rotated = Math.abs(q.x) + Math.abs(q.y) + Math.abs(q.z) > 1e-6;
    this.updateBounds();
    return this;
  }

  updateBounds(): void {
    const h = this.halfExtents;
    let ex = h.x,
      ey = h.y,
      ez = h.z;
    if (this.rotated) {
      // conservative rotated-extents via abs of rotation matrix columns
      const m = new THREE.Matrix4().makeRotationFromQuaternion(this.quat).elements;
      ex = Math.abs(m[0]) * h.x + Math.abs(m[4]) * h.y + Math.abs(m[8]) * h.z;
      ey = Math.abs(m[1]) * h.x + Math.abs(m[5]) * h.y + Math.abs(m[9]) * h.z;
      ez = Math.abs(m[2]) * h.x + Math.abs(m[6]) * h.y + Math.abs(m[10]) * h.z;
    }
    this.aabbMin.set(this.center.x - ex, this.center.y - ey, this.center.z - ez);
    this.aabbMax.set(this.center.x + ex, this.center.y + ey, this.center.z + ez);
  }

  aabbOverlapsSphere(pos: THREE.Vector3, radius: number): boolean {
    return (
      pos.x + radius >= this.aabbMin.x &&
      pos.x - radius <= this.aabbMax.x &&
      pos.y + radius >= this.aabbMin.y &&
      pos.y - radius <= this.aabbMax.y &&
      pos.z + radius >= this.aabbMin.z &&
      pos.z - radius <= this.aabbMax.z
    );
  }

  /**
   * Sphere-vs-OBB test. Writes world-space contact normal (pointing away from
   * the box toward the sphere), penetration depth, and contact point.
   * Returns true when penetrating.
   */
  sphereContact(pos: THREE.Vector3, radius: number, outNormal: THREE.Vector3, outPoint: THREE.Vector3): number {
    _local.copy(pos).sub(this.center);
    if (this.rotated) {
      _invQuat.copy(this.quat).invert();
      _local.applyQuaternion(_invQuat);
    }
    const h = this.halfExtents;
    _closest.set(
      Math.max(-h.x, Math.min(h.x, _local.x)),
      Math.max(-h.y, Math.min(h.y, _local.y)),
      Math.max(-h.z, Math.min(h.z, _local.z))
    );
    const dx = _local.x - _closest.x;
    const dy = _local.y - _closest.y;
    const dz = _local.z - _closest.z;
    const distSq = dx * dx + dy * dy + dz * dz;

    if (distSq > 1e-12) {
      // center outside the box
      const dist = Math.sqrt(distSq);
      if (dist >= radius) return -1;
      outNormal.set(dx / dist, dy / dist, dz / dist);
      if (this.rotated) outNormal.applyQuaternion(this.quat);
      outPoint.copy(_closest);
      if (this.rotated) outPoint.applyQuaternion(this.quat);
      outPoint.add(this.center);
      return radius - dist;
    }

    // center inside the box: push out along the axis of least penetration
    const px = h.x - Math.abs(_local.x);
    const py = h.y - Math.abs(_local.y);
    const pz = h.z - Math.abs(_local.z);
    let depth: number;
    if (px <= py && px <= pz) {
      outNormal.set(Math.sign(_local.x) || 1, 0, 0);
      depth = px + radius;
    } else if (py <= pz) {
      outNormal.set(0, Math.sign(_local.y) || 1, 0);
      depth = py + radius;
    } else {
      outNormal.set(0, 0, Math.sign(_local.z) || 1);
      depth = pz + radius;
    }
    if (this.rotated) outNormal.applyQuaternion(this.quat);
    outPoint.copy(pos);
    return depth;
  }

  /**
   * Velocity of a world-space point on this kinematic body (linear + angular).
   * Capped so oscillating hazards (seesaws, spring returns) can shove the ball
   * but never catapult it across the course.
   */
  pointVelocity(point: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    out.copy(this.velocity);
    if (this.angularVel.lengthSq() > 1e-10) {
      _arm.copy(point).sub(this.center);
      out.add(_arm.copy(_arm).crossVectors(this.angularVel, _arm));
    }
    const len = out.length();
    if (len > 10) out.multiplyScalar(10 / len);
    return out;
  }
}
