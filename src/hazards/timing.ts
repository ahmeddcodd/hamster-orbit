import * as THREE from 'three';
import { BoxCollider, Surface } from '../physics/collider';
import { platformMesh, boxMesh } from '../levels/meshes';
import { Hazard, type HazardContext } from './Hazard';

type FlickerState = 'solid' | 'warning' | 'inactive' | 'restoring';

/**
 * Flicker bridge: SOLID -> WARNING -> INACTIVE -> RESTORING on a deterministic
 * cycle. Communicated by opacity + edge glow + shake, never color alone.
 * Collision is disabled only while INACTIVE, and never restores inside the player.
 */
export class FlickerBridge extends Hazard {
  private mesh: THREE.Mesh;
  private frame: THREE.Group;
  private frameMat: THREE.MeshStandardMaterial;
  private collider: BoxCollider;
  private state: FlickerState = 'solid';
  private warned = false;

  constructor(
    id: string,
    ctx: HazardContext,
    private p: [number, number, number],
    s: [number, number, number],
    private period = 4,
    private offset = 0
  ) {
    super(id, ctx);
    this.mesh = platformMesh(s[0], s[1], s[2], ctx.mats);
    this.mesh.position.set(...p);
    const mats = this.mesh.material as THREE.Material[];
    this.mesh.material = mats.map((m) => {
      const c = m.clone();
      c.transparent = true;
      return c;
    });
    // Glowing rim frame (4 thin bars, NOT a solid cover) so the checkered deck
    // stays visible and the bridge's real state can always be read. A full-footprint
    // slab here would look like solid ground even while collision is disabled.
    this.frameMat = ctx.mats.accentEmissive.clone();
    this.frameMat.transparent = true;
    this.frame = new THREE.Group();
    const barH = 0.22;
    const barT = 0.16;
    const topY = p[1] + s[1] / 2;
    // side bars are inset so they butt against the end bars instead of overlapping at
    // the corners (overlapping coplanar corners would z-fight)
    const bars: Array<[number, number, number, number, number, number]> = [
      // [sx, sy, sz, x, y, z]
      [s[0] + barT, barH, barT, p[0], topY, p[2] + s[2] / 2],
      [s[0] + barT, barH, barT, p[0], topY, p[2] - s[2] / 2],
      [barT, barH, s[2] - barT, p[0] + s[0] / 2, topY, p[2]],
      [barT, barH, s[2] - barT, p[0] - s[0] / 2, topY, p[2]],
    ];
    for (const [sx, sy, sz, x, y, z] of bars) {
      const bar = boxMesh(sx, sy, sz, this.frameMat);
      bar.position.set(x, y, z);
      bar.castShadow = false;
      bar.receiveShadow = false;
      this.frame.add(bar);
    }
    ctx.group.add(this.mesh, this.frame);
    this.collider = new BoxCollider(`${id}-body`).setBox(p[0], p[1], p[2], s[0], s[1], s[2]);
    ctx.world.add(this.collider);
  }

  private phaseState(elapsed: number): { state: FlickerState; t: number } {
    const t = (((elapsed + this.offset) % this.period) + this.period) % this.period / this.period;
    if (t < 0.42) return { state: 'solid', t: t / 0.42 };
    if (t < 0.58) return { state: 'warning', t: (t - 0.42) / 0.16 };
    if (t < 0.88) return { state: 'inactive', t: (t - 0.58) / 0.3 };
    return { state: 'restoring', t: (t - 0.88) / 0.12 };
  }

  override update(_dt: number, elapsed: number): void {
    const { state, t } = this.phaseState(elapsed);
    const prev = this.state;
    this.state = state;
    const mats = this.mesh.material as THREE.Material[];

    let opacity = 1;
    let edgeIntensity = 0.5;
    switch (state) {
      case 'solid':
        opacity = 1;
        edgeIntensity = 0.5;
        this.collider.enabled = true;
        break;
      case 'warning': {
        // rapid pulsing shrink telegraph
        opacity = 0.55 + 0.4 * Math.abs(Math.sin(t * 22));
        edgeIntensity = 1.6;
        this.collider.enabled = true;
        if (!this.warned && prev !== 'warning') {
          this.warned = true;
          if (this.ctx.player.pos.distanceToSquared(this.mesh.position) < 240) this.ctx.audio.flickerWarn();
        }
        break;
      }
      case 'inactive':
        opacity = 0.06;
        edgeIntensity = 0.08;
        this.collider.enabled = false;
        this.warned = false;
        break;
      case 'restoring': {
        // never restore solid inside the player
        const playerOn = this.collider.aabbOverlapsSphere(this.ctx.player.pos, this.ctx.player.radius + 0.1);
        opacity = 0.15 + t * 0.7;
        edgeIntensity = 0.3 + t * 0.4;
        this.collider.enabled = !playerOn || this.ctx.player.pos.y > this.p[1] + 0.4;
        break;
      }
    }
    for (const m of mats) m.opacity = opacity;
    // The rim tracks the deck's own opacity: when the bridge is intangible the
    // frame must fade out too, otherwise it reads as solid ground and the player
    // rolls onto a disabled collider and falls through.
    this.frameMat.opacity = opacity;
    this.frameMat.emissiveIntensity = edgeIntensity;
    this.mesh.visible = opacity > 0.03;
    this.frame.visible = opacity > 0.03;
  }

  override reset(): void {
    this.collider.enabled = true;
    this.warned = false;
  }

  override dispose(): void {
    this.ctx.world.remove(this.collider);
    for (const m of this.mesh.material as THREE.Material[]) m.dispose();
    this.frameMat.dispose();
  }
}

/**
 * Crusher: warning -> raised pause -> telegraph shake -> slam -> bottom pause -> slow rise.
 * Lethal ONLY during the slam phase.
 */
export class Crusher extends Hazard {
  private head: THREE.Mesh;
  private frame: THREE.Mesh;
  private collider: BoxCollider;
  private slammed = false;

  constructor(
    id: string,
    ctx: HazardContext,
    private p: [number, number, number],
    private s: [number, number, number],
    private rise = 3.4,
    private period = 3.2,
    private offset = 0
  ) {
    super(id, ctx);
    this.head = boxMesh(s[0], s[1], s[2], ctx.mats.hazardDanger);
    // vertical guide frame
    this.frame = boxMesh(0.3, rise + s[1] + 0.6, 0.3, ctx.mats.hazardBody);
    this.frame.position.set(p[0] - s[0] / 2 - 0.25, p[1] + (rise + s[1]) / 2, p[2]);
    ctx.group.add(this.head, this.frame);
    this.collider = new BoxCollider(`${id}-head`).setBox(p[0], p[1] + rise, p[2], s[0], s[1], s[2]);
    ctx.world.add(this.collider);
    this.update(0.016, 0);
  }

  /** returns head height offset 0(bottom)..1(top) and whether slamming */
  private cycle(elapsed: number): { h: number; slamming: boolean; telegraph: boolean } {
    const t = (((elapsed + this.offset) % this.period) + this.period) % this.period / this.period;
    if (t < 0.38) return { h: 1, slamming: false, telegraph: false }; // raised hold
    if (t < 0.5) return { h: 1, slamming: false, telegraph: true }; // telegraph shake
    if (t < 0.58) {
      const k = (t - 0.5) / 0.08;
      return { h: 1 - k * k, slamming: true, telegraph: false }; // fast slam
    }
    if (t < 0.74) return { h: 0, slamming: false, telegraph: false }; // bottom pause
    return { h: (t - 0.74) / 0.26, slamming: false, telegraph: false }; // slow rise
  }

  override update(dt: number, elapsed: number): void {
    const { h, slamming, telegraph } = this.cycle(elapsed);
    const prevY = this.collider.center.y;
    let x = this.p[0];
    if (telegraph) x += Math.sin(elapsed * 55) * 0.05;
    const y = this.p[1] + this.s[1] / 2 + h * this.rise;
    this.collider.center.set(x, y, this.p[2]);
    this.collider.velocity.set(0, (y - prevY) / Math.max(dt, 1e-4), 0);
    this.collider.surface = slamming ? Surface.LETHAL : Surface.NORMAL;
    this.collider.updateBounds();
    this.head.position.copy(this.collider.center);
    if (slamming && !this.slammed) this.slammed = true;
    if (!slamming && this.slammed && h === 0) {
      this.slammed = false;
      if (this.ctx.player.pos.distanceToSquared(this.head.position) < 700) {
        this.ctx.audio.crusherSlam();
        this.ctx.camera.addTrauma(0.22);
        this.ctx.particles.spawn({
          pos: new THREE.Vector3(this.p[0], this.p[1] + 0.2, this.p[2]),
          count: 8,
          color: 0xd9c8b8,
          speed: 3,
          life: 0.4,
          dirY: 1.2,
        });
      }
    }
  }

  override reset(): void {
    this.slammed = false;
    this.update(0.016, 0);
  }

  override dispose(): void {
    this.ctx.world.remove(this.collider);
  }
}

/** Deterministic pendulum hammer: strong knockback impulse on contact. */
export class SwingingHammer extends Hazard {
  private arm: THREE.Mesh;
  private headMesh: THREE.Mesh;
  private pivotGroup: THREE.Group;
  private collider: BoxCollider;
  private pivot: THREE.Vector3;
  private planeDir: THREE.Vector3;
  private hitCooldown = 0;

  constructor(
    id: string,
    ctx: HazardContext,
    p: [number, number, number],
    private len = 4,
    yaw = 0,
    private period = 2.6,
    private offset = 0
  ) {
    super(id, ctx);
    this.pivot = new THREE.Vector3(...p);
    this.planeDir = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));

    this.pivotGroup = new THREE.Group();
    this.pivotGroup.position.copy(this.pivot);
    this.pivotGroup.rotation.y = yaw + Math.PI / 2; // swing across the path
    const armGeo = new THREE.BoxGeometry(0.28, this.len, 0.28);
    this.arm = new THREE.Mesh(armGeo, ctx.mats.hazardBody);
    this.arm.position.y = -this.len / 2;
    this.arm.castShadow = true;
    const headGeo = new THREE.BoxGeometry(1.5, 1.5, 1.1);
    this.headMesh = new THREE.Mesh(headGeo, ctx.mats.hazardDanger);
    this.headMesh.position.y = -this.len;
    this.headMesh.castShadow = true;
    this.pivotGroup.add(this.arm, this.headMesh);
    // support bar
    const barGeo = new THREE.BoxGeometry(0.35, 0.35, 3.2);
    const bar = new THREE.Mesh(barGeo, ctx.mats.hazardBody);
    bar.position.copy(this.pivot);
    bar.rotation.y = yaw;
    ctx.group.add(this.pivotGroup, bar);

    this.collider = new BoxCollider(`${id}-head`).setBox(p[0], p[1] - this.len, p[2], 1.5, 1.5, 1.1);
    this.collider.restitution = 0.6;
    this.collider.onContact = () => {
      if (this.hitCooldown > 0) return;
      this.hitCooldown = 0.5;
      const swingVel = this.collider.velocity.length();
      const player = this.ctx.player;
      const push = this.collider.velocity.clone().normalize().multiplyScalar(Math.min(16, 6 + swingVel * 1.2));
      player.applyImpulse(push.x, 4, push.z);
      this.ctx.audio.bump(1.4);
      this.ctx.camera.addTrauma(0.3);
      player.dizzyTimer = Math.max(player.dizzyTimer, 0.5);
    };
    ctx.world.add(this.collider);
  }

  override update(dt: number, elapsed: number): void {
    if (this.hitCooldown > 0) this.hitCooldown -= dt;
    const w = (Math.PI * 2) / this.period;
    const angle = Math.sin((elapsed + this.offset) * w) * 1.05;
    this.pivotGroup.rotation.z = angle;
    // head world position: pivot + swing in plane perpendicular to yaw
    const swing = new THREE.Vector3()
      .addScaledVector(this.planeDir.clone().cross(new THREE.Vector3(0, 1, 0)), Math.sin(angle) * this.len)
      .add(new THREE.Vector3(0, -Math.cos(angle) * this.len, 0));
    const prev = this.collider.center.clone();
    this.collider.center.copy(this.pivot).add(swing);
    this.collider.velocity.copy(this.collider.center).sub(prev).divideScalar(Math.max(dt, 1e-4));
    this.collider.setQuat(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, angle)));
    this.collider.updateBounds();
  }

  override reset(): void {
    this.hitCooldown = 0;
    this.update(0.016, 0);
  }

  override dispose(): void {
    this.ctx.world.remove(this.collider);
  }
}

/** Traveling saw blade: lethal on contact, simplified thin box collider. */
export class SawBlade extends Hazard {
  private disc: THREE.Group;
  private collider: BoxCollider;
  private origin: THREE.Vector3;
  private axis: THREE.Vector3;
  private warnTimer = 0;

  constructor(
    id: string,
    ctx: HazardContext,
    p: [number, number, number],
    axis: [number, number, number] = [1, 0, 0],
    private travel = 4,
    private period = 3,
    private r = 1.1,
    private offset = 0
  ) {
    super(id, ctx);
    this.origin = new THREE.Vector3(...p);
    this.axis = new THREE.Vector3(...axis).normalize();

    this.disc = new THREE.Group();
    const bladeGeo = new THREE.CylinderGeometry(this.r, this.r, 0.12, 20);
    const blade = new THREE.Mesh(bladeGeo, ctx.mats.hazardBody);
    blade.rotation.x = Math.PI / 2;
    blade.castShadow = true;
    // visible teeth
    const toothGeo = new THREE.BoxGeometry(0.28, 0.3, 0.14);
    for (let i = 0; i < 10; i++) {
      const tooth = new THREE.Mesh(toothGeo, ctx.mats.hazardDanger);
      const a = (i / 10) * Math.PI * 2;
      tooth.position.set(Math.cos(a) * this.r, Math.sin(a) * this.r, 0);
      tooth.rotation.z = a;
      this.disc.add(tooth);
    }
    this.disc.add(blade);
    ctx.group.add(this.disc);

    this.collider = new BoxCollider(`${id}-blade`).setBox(p[0], p[1], p[2], this.r * 1.8, this.r * 1.8, 0.5);
    this.collider.surface = Surface.LETHAL;
    ctx.world.add(this.collider);
  }

  override update(dt: number, elapsed: number): void {
    const t = 0.5 + 0.5 * Math.sin(((elapsed + this.offset) / this.period) * Math.PI * 2);
    const prev = this.collider.center.clone();
    this.collider.center.copy(this.origin).addScaledVector(this.axis, (t - 0.5) * this.travel);
    this.collider.velocity.copy(this.collider.center).sub(prev).divideScalar(Math.max(dt, 1e-4));
    this.collider.updateBounds();
    this.disc.position.copy(this.collider.center);
    this.disc.rotation.z = elapsed * 12;
    this.warnTimer -= dt;
    if (this.warnTimer <= 0 && this.ctx.player.pos.distanceToSquared(this.disc.position) < 90) {
      this.warnTimer = 1.4;
      this.ctx.audio.sawHiss();
    }
  }

  override reset(): void {
    this.update(0.016, 0);
  }

  override dispose(): void {
    this.ctx.world.remove(this.collider);
  }
}
