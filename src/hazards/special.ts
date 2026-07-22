import * as THREE from 'three';
import { BoxCollider, Surface } from '../physics/collider';
import type { MagnetField } from '../physics/world';
import { Hazard, type HazardContext } from './Hazard';
import { clamp01, TAU } from '../utils/math';

const _v = new THREE.Vector3();
const _g = new THREE.Vector3(0, -21, 0);

/**
 * Enemy ball: seeks the player inside its detection radius and tries to shove
 * it off the course. Normal contact is a push, never an instant kill. Knock it
 * into the void for a one-time score.
 */
export class EnemyBall extends Hazard {
  private mesh: THREE.Group;
  private body: THREE.Mesh;
  private pos: THREE.Vector3;
  private vel = new THREE.Vector3();
  private home: THREE.Vector3;
  private radius = 0.55;
  private out = false;
  private state: { pos: THREE.Vector3; vel: THREE.Vector3; radius: number };
  private spin = 0;

  constructor(
    id: string,
    ctx: HazardContext,
    p: [number, number, number],
    private range = 8,
    private speed = 9
  ) {
    super(id, ctx);
    this.home = new THREE.Vector3(...p);
    this.pos = this.home.clone();
    this.state = { pos: this.pos, vel: this.vel, radius: this.radius };

    this.mesh = new THREE.Group();
    const geo = new THREE.SphereGeometry(this.radius, 18, 14);
    this.body = new THREE.Mesh(geo, ctx.mats.hazardDanger.clone());
    this.body.castShadow = true;
    // angry eyes
    const eyeGeo = new THREE.SphereGeometry(0.09, 8, 6);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xfff2c4 });
    const e1 = new THREE.Mesh(eyeGeo, eyeMat);
    e1.position.set(-0.18, 0.18, 0.45);
    const e2 = new THREE.Mesh(eyeGeo, eyeMat);
    e2.position.set(0.18, 0.18, 0.45);
    this.mesh.add(this.body, e1, e2);
    ctx.group.add(this.mesh);
  }

  override update(dt: number, _elapsed: number): void {
    if (this.out) return;
    const player = this.ctx.player;
    const toPlayer = _v.copy(player.pos).sub(this.pos);
    toPlayer.y = 0;
    const dist = toPlayer.length();

    // steer: chase in range, otherwise drift home
    const target = dist < this.range ? toPlayer.normalize() : _v.copy(this.home).sub(this.pos).setY(0).normalize();
    this.vel.x += target.x * 14 * dt;
    this.vel.z += target.z * 14 * dt;
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (hs > this.speed) {
      this.vel.x *= this.speed / hs;
      this.vel.z *= this.speed / hs;
    }
    const clampedDt = Math.min(dt, 1 / 30);
    this.ctx.world.step(this.state, clampedDt, _g, false);

    // face motion
    this.mesh.position.copy(this.pos);
    if (hs > 0.5) this.mesh.rotation.y = Math.atan2(this.vel.x, this.vel.z);
    this.spin += hs * dt * 1.6;
    this.body.rotation.x = this.spin;

    // sphere-vs-player push
    const rSum = this.radius + player.radius;
    const d = _v.copy(player.pos).sub(this.pos);
    const dl = d.length();
    if (dl < rSum && dl > 1e-4) {
      d.divideScalar(dl);
      const overlap = rSum - dl;
      player.pos.addScaledVector(d, overlap * 0.6);
      this.pos.addScaledVector(d, -overlap * 0.4);
      const relSpeed = Math.max(2.5, this.vel.dot(d) - player.vel.dot(d) + 4);
      player.applyImpulse(d.x * relSpeed, 1.6, d.z * relSpeed);
      this.vel.addScaledVector(d, -relSpeed * 0.7);
      this.ctx.audio.bump(0.9);
      this.ctx.camera.addTrauma(0.14);
      this.ctx.particles.spawn({ pos: player.pos.clone(), count: 6, color: 0xff8866, speed: 3, life: 0.35 });
    }

    // fell off the arena: knocked out
    if (this.pos.y < this.home.y - 9) {
      this.out = true;
      this.mesh.visible = false;
      this.ctx.audio.knockout();
      this.ctx.scoreEvent('knockout', this.id, this.pos.clone());
    }
  }

  override reset(): void {
    this.out = false;
    this.mesh.visible = true;
    this.pos.copy(this.home);
    this.vel.set(0, 0, 0);
    this.mesh.position.copy(this.pos);
  }

  override dispose(): void {
    const eyeMat = (this.mesh.children[1] as THREE.Mesh).material as THREE.Material;
    eyeMat.dispose();
    (this.body.material as THREE.Material).dispose();
  }
}

/** Breakable glass wall: shatters above an impact-speed threshold, scores once per run. */
export class BreakableGlass extends Hazard {
  private mesh: THREE.Mesh;
  private collider: BoxCollider;
  private broken = false;

  constructor(
    id: string,
    ctx: HazardContext,
    p: [number, number, number],
    s: [number, number, number],
    private breakSpeed = 10
  ) {
    super(id, ctx);
    const geo = new THREE.BoxGeometry(s[0], s[1], s[2]);
    this.mesh = new THREE.Mesh(geo, ctx.mats.glass);
    this.mesh.position.set(...p);
    ctx.group.add(this.mesh);
    this.collider = new BoxCollider(`${id}-pane`).setBox(p[0], p[1], p[2], s[0], s[1], s[2]);
    this.collider.surface = Surface.GLASS;
    this.collider.restitution = 0.3;
    this.collider.onContact = (info) => {
      if (this.broken) return;
      if (info.impactSpeed >= this.breakSpeed) {
        this.broken = true;
        this.collider.enabled = false;
        this.mesh.visible = false;
        this.ctx.audio.glassBreak();
        this.ctx.camera.addTrauma(0.2);
        this.ctx.particles.spawn({
          pos: this.mesh.position.clone(),
          count: 22,
          color: 0xd8f2ff,
          color2: 0xffffff,
          speed: 5,
          life: 0.7,
          spread: 0.8,
          gravity: 9,
        });
        this.ctx.scoreEvent('glass', this.id, this.mesh.position.clone());
      }
    };
    ctx.world.add(this.collider);
  }

  override update(): void {
    /* passive */
  }

  override reset(): void {
    this.broken = false;
    this.collider.enabled = true;
    this.mesh.visible = true;
  }

  override dispose(): void {
    this.ctx.world.remove(this.collider);
  }
}

/** Transport tube: captures the ball, guides it along a curve, ejects with velocity. */
export class TransportTube extends Hazard {
  private curve: THREE.CatmullRomCurve3;
  private tubeMesh: THREE.Mesh;
  private entry: BoxCollider;
  private traveling = false;
  private t = 0;
  private cooldown = 0;
  private curveLen: number;

  constructor(
    id: string,
    ctx: HazardContext,
    points: [number, number, number][],
    r = 1.0,
    private speed = 16
  ) {
    super(id, ctx);
    this.curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    this.curveLen = this.curve.getLength();
    const geo = new THREE.TubeGeometry(this.curve, Math.max(12, points.length * 6), r, 10, false);
    this.tubeMesh = new THREE.Mesh(geo, ctx.mats.glass);
    ctx.group.add(this.tubeMesh);
    const start = this.curve.getPoint(0);
    this.entry = new BoxCollider(`${id}-entry`).setBox(start.x, start.y, start.z, r * 2, r * 2, r * 2);
  }

  override update(dt: number, _elapsed: number): void {
    const player = this.ctx.player;
    if (this.cooldown > 0) this.cooldown -= dt;
    if (!this.traveling) {
      if (
        this.cooldown <= 0 &&
        this.entry.aabbOverlapsSphere(player.pos, player.radius) &&
        this.entry.sphereContact(player.pos, player.radius, _v, _v) >= 0
      ) {
        this.traveling = true;
        this.t = 0;
        player.captured = true;
        this.ctx.audio.tubeTravel();
      }
      return;
    }
    this.t += (this.speed / Math.max(1, this.curveLen)) * dt;
    if (this.t >= 1) {
      this.traveling = false;
      this.cooldown = 1.0;
      player.captured = false;
      const tangent = this.curve.getTangent(1);
      const exit = this.curve.getPoint(1);
      player.pos.copy(exit).addScaledVector(tangent, player.radius * 2);
      player.vel.copy(tangent).multiplyScalar(this.speed);
      this.ctx.particles.spawn({ pos: exit.clone(), count: 10, color: 0xd8f2ff, speed: 3, life: 0.4, gravity: 0 });
      return;
    }
    const p = this.curve.getPoint(this.t);
    player.pos.copy(p);
    player.vel.copy(this.curve.getTangent(this.t)).multiplyScalar(this.speed);
  }

  override reset(): void {
    if (this.traveling) this.ctx.player.captured = false;
    this.traveling = false;
    this.cooldown = 0;
  }

  override dispose(): void {
    if (this.traveling) this.ctx.player.captured = false;
  }
}

/**
 * Magnetic wall-ride: a banked cylinder arc the ball can ride like a
 * wall-of-death. Gravity is redirected toward the wall while inside the band.
 */
export class MagnetWall extends Hazard {
  private field: MagnetField;
  private colliders: BoxCollider[] = [];

  constructor(
    id: string,
    ctx: HazardContext,
    c: [number, number, number],
    r: number,
    h: number,
    a0: number,
    a1: number
  ) {
    super(id, ctx);
    const center = new THREE.Vector3(...c);
    const segs = Math.max(6, Math.ceil((Math.abs(a1 - a0) / TAU) * 26));
    for (let i = 0; i < segs; i++) {
      const a = a0 + ((i + 0.5) / segs) * (a1 - a0);
      const segLen = ((Math.abs(a1 - a0) * r) / segs) * 1.12;
      const px = center.x + Math.cos(a) * r;
      const pz = center.z + Math.sin(a) * r;
      const col = new BoxCollider(`${id}-seg${i}`).setBox(px, center.y + h / 2, pz, segLen, h, 0.5);
      const inward = new THREE.Vector3(center.x - px, 0, center.z - pz).normalize();
      const tangent = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
      const m = new THREE.Matrix4().makeBasis(tangent, new THREE.Vector3(0, 1, 0), inward.clone().multiplyScalar(-1));
      col.setQuat(new THREE.Quaternion().setFromRotationMatrix(m));
      ctx.world.add(col);
      this.colliders.push(col);
      const segGeo = new THREE.BoxGeometry(segLen, h, 0.5);
      const segMesh = new THREE.Mesh(segGeo, ctx.mats.checkerTop);
      segMesh.position.set(px, center.y + h / 2, pz);
      segMesh.quaternion.copy(col.quat);
      segMesh.receiveShadow = true;
      ctx.group.add(segMesh);
    }

    this.field = {
      id,
      enabled: true,
      sample: (pos: THREE.Vector3, out: THREE.Vector3): number => {
        const dx = pos.x - center.x;
        const dz = pos.z - center.z;
        const radial = Math.hypot(dx, dz);
        if (radial < r - 3.2 || radial > r - 0.2) return 0;
        if (pos.y < center.y + 0.3 || pos.y > center.y + h + 1) return 0;
        let a = Math.atan2(dz, dx);
        const lo = Math.min(a0, a1);
        const hi = Math.max(a0, a1);
        while (a < lo) a += TAU;
        while (a > hi + TAU) a -= TAU;
        if (a < lo || a > hi) return 0;
        out.set(dx / radial, 0, dz / radial); // gravity outward, onto the wall
        return clamp01((radial - (r - 3.2)) / 1.6) * 0.85;
      },
    };
    ctx.world.magnets.push(this.field);
  }

  override update(): void {
    /* static */
  }

  override dispose(): void {
    for (const c of this.colliders) this.ctx.world.remove(c);
    const i = this.ctx.world.magnets.indexOf(this.field);
    if (i >= 0) this.ctx.world.magnets.splice(i, 1);
  }
}
