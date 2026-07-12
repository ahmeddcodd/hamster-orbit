import * as THREE from 'three';
import { BoxCollider } from '../physics/collider';
import { platformMesh } from '../levels/meshes';
import { clamp, pingPongPause } from '../utils/math';
import { Hazard, type HazardContext } from './Hazard';

const _prev = new THREE.Vector3();
const _euler = new THREE.Euler();

/** Kinematic waypoint platform: eases A->B->A with end pauses, carries the ball. */
export class MovingPlatform extends Hazard {
  private mesh: THREE.Mesh;
  private collider: BoxCollider;
  private origin: THREE.Vector3;
  private axis: THREE.Vector3;

  constructor(
    id: string,
    ctx: HazardContext,
    p: [number, number, number],
    s: [number, number, number],
    axis: [number, number, number],
    private dist: number,
    private period: number,
    private offset = 0
  ) {
    super(id, ctx);
    this.origin = new THREE.Vector3(...p);
    this.axis = new THREE.Vector3(...axis).normalize();
    this.mesh = platformMesh(s[0], s[1], s[2], ctx.mats);
    this.mesh.position.copy(this.origin);
    ctx.group.add(this.mesh);
    this.collider = new BoxCollider(`${id}-body`).setBox(p[0], p[1], p[2], s[0], s[1], s[2]);
    this.collider.owner = this;
    ctx.world.add(this.collider);
  }

  override update(dt: number, elapsed: number): void {
    _prev.copy(this.collider.center);
    const t = pingPongPause(elapsed + this.offset, this.period);
    this.collider.center.copy(this.origin).addScaledVector(this.axis, t * this.dist);
    this.collider.velocity.copy(this.collider.center).sub(_prev).divideScalar(Math.max(dt, 1e-4));
    this.collider.updateBounds();
    this.mesh.position.copy(this.collider.center);
  }

  override reset(): void {
    this.collider.center.copy(this.origin);
    this.collider.velocity.set(0, 0, 0);
    this.collider.updateBounds();
    this.mesh.position.copy(this.origin);
  }

  override dispose(): void {
    this.ctx.world.remove(this.collider);
  }
}

/** Kinematic rotating bridge/platform about the Y axis; transfers tangential motion. */
export class RotatingPlatform extends Hazard {
  private mesh: THREE.Mesh;
  private collider: BoxCollider;

  constructor(
    id: string,
    ctx: HazardContext,
    p: [number, number, number],
    s: [number, number, number],
    private speed: number
  ) {
    super(id, ctx);
    this.mesh = platformMesh(s[0], s[1], s[2], ctx.mats);
    this.mesh.position.set(...p);
    ctx.group.add(this.mesh);
    this.collider = new BoxCollider(`${id}-body`).setBox(p[0], p[1], p[2], s[0], s[1], s[2]);
    this.collider.owner = this;
    this.collider.angularVel.set(0, this.speed, 0);
    ctx.world.add(this.collider);
  }

  override update(_dt: number, elapsed: number): void {
    const angle = elapsed * this.speed;
    this.mesh.rotation.y = angle;
    this.collider.setQuat(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle));
  }

  override reset(): void {
    this.update(0, 0);
  }

  override dispose(): void {
    this.ctx.world.remove(this.collider);
  }
}

/** Platform that tilts under the player's weight with a spring return. */
export class TiltingPlatform extends Hazard {
  private mesh: THREE.Mesh;
  private collider: BoxCollider;
  private tilt = new THREE.Vector2();
  private tiltVel = new THREE.Vector2();
  private half: THREE.Vector2;
  private center: THREE.Vector3;

  constructor(
    id: string,
    ctx: HazardContext,
    p: [number, number, number],
    s: [number, number, number],
    private maxTilt = 0.22
  ) {
    super(id, ctx);
    this.center = new THREE.Vector3(...p);
    this.half = new THREE.Vector2(s[0] / 2, s[2] / 2);
    this.mesh = platformMesh(s[0], s[1], s[2], ctx.mats);
    this.mesh.position.copy(this.center);
    ctx.group.add(this.mesh);
    this.collider = new BoxCollider(`${id}-body`).setBox(p[0], p[1], p[2], s[0], s[1], s[2]);
    this.collider.owner = this;
    ctx.world.add(this.collider);
  }

  override update(dt: number, _elapsed: number): void {
    const p = this.ctx.player.pos;
    let targetX = 0;
    let targetZ = 0;
    const dx = p.x - this.center.x;
    const dz = p.z - this.center.z;
    const above =
      Math.abs(dx) < this.half.x + 0.5 &&
      Math.abs(dz) < this.half.y + 0.5 &&
      p.y > this.center.y &&
      p.y < this.center.y + 3;
    if (above) {
      // tilt down toward the player's position
      targetX = clamp(dz / this.half.y, -1, 1) * this.maxTilt;
      targetZ = clamp(-dx / this.half.x, -1, 1) * this.maxTilt;
    }
    const k = 10;
    const d = 7;
    this.tiltVel.x += ((targetX - this.tilt.x) * k - this.tiltVel.x * d) * dt;
    this.tiltVel.y += ((targetZ - this.tilt.y) * k - this.tiltVel.y * d) * dt;
    this.tiltVel.x = clamp(this.tiltVel.x, -1.0, 1.0);
    this.tiltVel.y = clamp(this.tiltVel.y, -1.0, 1.0);
    this.tilt.x += this.tiltVel.x * dt;
    this.tilt.y += this.tiltVel.y * dt;
    this.tilt.x = clamp(this.tilt.x, -this.maxTilt, this.maxTilt);
    this.tilt.y = clamp(this.tilt.y, -this.maxTilt, this.maxTilt);

    _euler.set(this.tilt.x, 0, this.tilt.y);
    const q = new THREE.Quaternion().setFromEuler(_euler);
    this.mesh.quaternion.copy(q);
    this.collider.setQuat(q);
    // angular velocity so the ball feels the tilt motion
    this.collider.angularVel.set(this.tiltVel.x, 0, this.tiltVel.y);
  }

  override reset(): void {
    this.tilt.set(0, 0);
    this.tiltVel.set(0, 0);
    this.update(0.001, 0);
  }

  override dispose(): void {
    this.ctx.world.remove(this.collider);
  }
}
