import * as THREE from 'three';
import { BoxCollider } from '../physics/collider';
import type { ForceZone } from '../physics/world';
import { arrowMesh } from '../levels/meshes';
import { Hazard, type HazardContext } from './Hazard';

const _dir = new THREE.Vector3();

/** Pinball-style bumper: capped radial impulse, compression animation, cooldown. */
export class Bumper extends Hazard {
  private body: THREE.Mesh;
  private ringMesh: THREE.Mesh;
  private collider: BoxCollider;
  private cooldown = 0;
  private squash = 0;
  private pos: THREE.Vector3;

  constructor(
    id: string,
    ctx: HazardContext,
    p: [number, number, number],
    private r = 0.9,
    private power = 13
  ) {
    super(id, ctx);
    this.pos = new THREE.Vector3(...p);
    const geo = new THREE.CylinderGeometry(r, r * 1.12, 0.75, 20);
    this.body = new THREE.Mesh(geo, ctx.mats.hazardDanger);
    this.body.position.copy(this.pos).y += 0.38;
    this.body.castShadow = true;
    const ringGeo = new THREE.TorusGeometry(r, 0.11, 8, 22);
    this.ringMesh = new THREE.Mesh(ringGeo, ctx.mats.hazardBody);
    this.ringMesh.rotation.x = Math.PI / 2;
    this.ringMesh.position.copy(this.pos).y += 0.62;
    ctx.group.add(this.body, this.ringMesh);
    this.collider = new BoxCollider(`${id}-body`).setBox(p[0], p[1] + 0.4, p[2], r * 1.5, 0.8, r * 1.5);
    this.collider.restitution = 0.05;
    ctx.world.add(this.collider);
  }

  override update(dt: number, _elapsed: number): void {
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.squash > 0) {
      this.squash -= dt * 4;
      const s = 1 - Math.max(0, this.squash) * 0.3;
      this.body.scale.set(2 - s, s, 2 - s);
    } else {
      this.body.scale.set(1, 1, 1);
    }
    const player = this.ctx.player;
    const dx = player.pos.x - this.pos.x;
    const dz = player.pos.z - this.pos.z;
    const dy = player.pos.y - this.pos.y;
    const distSq = dx * dx + dz * dz;
    const reach = this.r + player.radius + 0.25;
    if (this.cooldown <= 0 && distSq < reach * reach && dy > -0.5 && dy < 2) {
      this.cooldown = 0.35;
      this.squash = 1;
      const inv = 1 / Math.max(0.05, Math.sqrt(distSq));
      player.applyImpulse(dx * inv * this.power, 3.2, dz * inv * this.power);
      this.ctx.audio.bumper();
      this.ctx.particles.spawn({ pos: player.pos.clone(), count: 10, color: 0xffd35c, color2: 0xff7038, speed: 4, life: 0.4 });
      this.ctx.rings.pulse(new THREE.Vector3(this.pos.x, this.pos.y + 0.7, this.pos.z), 0xffd35c, 2.4, 0.35);
    }
  }

  override dispose(): void {
    this.ctx.world.remove(this.collider);
  }
}

/** Directional speed booster pad with animated arrows and stacking cap. */
export class SpeedBooster extends Hazard {
  private arrows: THREE.Mesh[] = [];
  private trigger: BoxCollider;
  private cooldown = 0;
  private dir: THREE.Vector3;
  private padPos: THREE.Vector3;

  constructor(
    id: string,
    ctx: HazardContext,
    p: [number, number, number],
    yaw: number,
    s: [number, number, number] = [3, 0.5, 4.5],
    private power = 12
  ) {
    super(id, ctx);
    this.padPos = new THREE.Vector3(...p);
    this.dir = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    for (let i = 0; i < 2; i++) {
      const holder = new THREE.Group();
      const a = arrowMesh(ctx.mats, 0.8);
      a.position.y = 0.02;
      holder.add(a);
      holder.rotation.y = yaw;
      holder.position.copy(this.padPos).addScaledVector(this.dir, (i - 0.5) * 1.7);
      holder.position.y = p[1] + 0.04;
      ctx.group.add(holder);
      this.arrows.push(a);
    }
    this.trigger = new BoxCollider(`${id}-zone`).setBox(p[0], p[1] + 0.6, p[2], s[0], 1.4, s[2]);
    this.trigger.setQuat(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
  }

  override update(dt: number, elapsed: number): void {
    if (this.cooldown > 0) this.cooldown -= dt;
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 6);
    for (const a of this.arrows) {
      (a.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.4 + pulse * 0.6;
    }
    const player = this.ctx.player;
    if (
      this.cooldown <= 0 &&
      this.trigger.aabbOverlapsSphere(player.pos, player.radius) &&
      this.trigger.sphereContact(player.pos, player.radius, _dir, _dir) >= 0
    ) {
      this.cooldown = 0.8;
      player.applyImpulse(this.dir.x * this.power, 0.6, this.dir.z * this.power);
      player.boostTimer = Math.min(1.6, Math.max(player.boostTimer, 1.2));
      this.ctx.audio.boost();
      this.ctx.particles.spawn({
        pos: player.pos.clone(),
        count: 14,
        color: 0x7dffa0,
        color2: 0xffffff,
        speed: 5,
        life: 0.5,
        gravity: 0,
      });
    }
  }

  override reset(): void {
    this.cooldown = 0;
  }
}

/** Launch ramp assist: angled kicker at a ramp lip with a reliable fixed impulse. */
export class LaunchRamp extends Hazard {
  private trigger: BoxCollider;
  private cooldown = 0;
  private dir: THREE.Vector3;

  constructor(
    id: string,
    ctx: HazardContext,
    p: [number, number, number],
    yaw: number,
    s: [number, number, number] = [3.4, 1.6, 2.2],
    private power = 10,
    private upPower = 9
  ) {
    super(id, ctx);
    this.dir = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    // glowing lip marker so the launch reads clearly
    const lipGeo = new THREE.BoxGeometry(s[0], 0.14, 0.4);
    const lip = new THREE.Mesh(lipGeo, ctx.mats.accentEmissive);
    lip.position.set(p[0], p[1] + 0.15, p[2]);
    lip.rotation.y = yaw;
    ctx.group.add(lip);
    this.trigger = new BoxCollider(`${id}-zone`).setBox(p[0], p[1] + 0.8, p[2], s[0], s[1], s[2]);
    this.trigger.setQuat(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
  }

  override update(dt: number, _elapsed: number): void {
    if (this.cooldown > 0) this.cooldown -= dt;
    const player = this.ctx.player;
    if (
      this.cooldown <= 0 &&
      this.trigger.aabbOverlapsSphere(player.pos, player.radius) &&
      this.trigger.sphereContact(player.pos, player.radius, _dir, _dir) >= 0
    ) {
      // momentum matters: assist scales mildly with entry speed toward the ramp
      const along = Math.max(0.45, Math.min(1.25, player.vel.dot(this.dir) / 10));
      this.cooldown = 1.2;
      player.applyImpulse(this.dir.x * this.power * along, this.upPower, this.dir.z * this.power * along);
      this.ctx.audio.launch();
      this.ctx.camera.addTrauma(0.18);
      this.ctx.particles.spawn({
        pos: player.pos.clone(),
        count: 12,
        color: 0xffffff,
        color2: 0xffe9a8,
        speed: 4,
        life: 0.5,
        gravity: 2,
      });
    }
  }

  override reset(): void {
    this.cooldown = 0;
  }
}

/** Fan force field with visible wind streaks and clear boundaries. */
export class FanField extends Hazard {
  private zone: ForceZone;
  private blades: THREE.Mesh;
  private emitTimer = 0;
  private dir: THREE.Vector3;
  private volume: BoxCollider;
  private origin: THREE.Vector3;
  private size: [number, number, number];
  private wasInside = false;

  constructor(
    id: string,
    ctx: HazardContext,
    p: [number, number, number],
    s: [number, number, number],
    dir: [number, number, number],
    strength: number
  ) {
    super(id, ctx);
    this.origin = new THREE.Vector3(...p);
    this.size = s;
    this.dir = new THREE.Vector3(...dir).normalize();

    // fan body sits at the upwind face of the zone
    const body = new THREE.Group();
    const housingGeo = new THREE.CylinderGeometry(1.1, 1.3, 0.8, 16);
    const housing = new THREE.Mesh(housingGeo, ctx.mats.hazardBody);
    housing.rotation.x = Math.PI / 2;
    const bladeGeo = new THREE.BoxGeometry(1.7, 0.28, 0.06);
    this.blades = new THREE.Mesh(bladeGeo, ctx.mats.accent);
    const blade2 = new THREE.Mesh(bladeGeo, ctx.mats.accent);
    blade2.rotation.z = Math.PI / 2;
    this.blades.add(blade2);
    this.blades.position.z = 0.2;
    body.add(housing, this.blades);
    const back = this.origin.clone().addScaledVector(this.dir, -Math.max(s[0], s[2]) / 2);
    body.position.copy(back);
    body.lookAt(back.clone().add(this.dir));
    ctx.group.add(body);

    this.volume = new BoxCollider(`${id}-zone`).setBox(p[0], p[1], p[2], s[0], s[1], s[2]);
    this.zone = { id, enabled: true, volume: this.volume, force: this.dir.clone().multiplyScalar(strength) };
    ctx.world.forceZones.push(this.zone);
  }

  override update(dt: number, elapsed: number): void {
    this.blades.rotation.z = elapsed * 9;
    // wind streak particles show direction + extent
    this.emitTimer -= dt;
    if (this.emitTimer <= 0) {
      this.emitTimer = 0.12;
      const spawn = this.origin
        .clone()
        .addScaledVector(this.dir, -Math.max(this.size[0], this.size[2]) * 0.4)
        .add(
          new THREE.Vector3(
            (Math.random() - 0.5) * this.size[0] * 0.7,
            (Math.random() - 0.5) * this.size[1] * 0.6,
            (Math.random() - 0.5) * this.size[2] * 0.7
          )
        );
      this.ctx.particles.spawn({
        pos: spawn,
        count: 1,
        color: 0xffffff,
        size: 0.28,
        life: 0.8,
        speed: 0.01,
        gravity: 0,
        drag: 0,
        baseVel: this.zone.force.clone().multiplyScalar(0.55),
      });
    }
    const inside =
      this.volume.aabbOverlapsSphere(this.ctx.player.pos, 0.1) &&
      this.volume.sphereContact(this.ctx.player.pos, 0.1, _dir, _dir) >= 0;
    if (inside && !this.wasInside) this.ctx.audio.fanWhoosh();
    this.wasInside = inside;
  }

  override dispose(): void {
    const i = this.ctx.world.forceZones.indexOf(this.zone);
    if (i >= 0) this.ctx.world.forceZones.splice(i, 1);
  }
}
