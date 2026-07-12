import * as THREE from 'three';
import { BoxCollider, Surface } from '../physics/collider';
import type { PhysicsWorld, TriggerVolume } from '../physics/world';
import { MaterialLibrary } from '../rendering/MaterialLibrary';
import type { HazardContext } from '../hazards/Hazard';
import { Hazard } from '../hazards/Hazard';
import { buildHazard } from '../hazards/factory';
import { arrowMesh, decoMesh, disposeGroupGeometries, flagMesh, goalMesh, platformMesh, seedMesh } from './meshes';
import type { GeoPiece, LevelDefinition } from './types';

export interface BuilderCallbacks {
  onCheckpoint: (index: number) => void;
  onSeed: (index: number) => void;
  onGoal: () => void;
  onShortcut: (id: string) => void;
  onTutorial: (text: string) => void;
}

export interface SeedRuntime {
  mesh: THREE.Mesh;
  basePos: THREE.Vector3;
  index: number;
  collectedThisRun: boolean;
  ownedBefore: boolean;
  trigger: TriggerVolume;
}

export interface CheckpointRuntime {
  index: number;
  spawn: THREE.Vector3;
  yaw: number;
  activated: boolean;
  trigger: TriggerVolume;
  visual: THREE.Group;
}

export class LevelRuntime {
  group = new THREE.Group();
  hazards: Hazard[] = [];
  seeds: SeedRuntime[] = [];
  checkpoints: CheckpointRuntime[] = [];
  goalGroup: THREE.Group | null = null;
  occluders: THREE.Object3D[] = [];
  flagCloths: THREE.Mesh[] = [];

  constructor(
    readonly def: LevelDefinition,
    readonly mats: MaterialLibrary,
    private scene: THREE.Scene,
    private world: PhysicsWorld
  ) {}

  /** Per-frame cosmetic animation: seeds spin/bob, goal ring pulses, flags wave. */
  update(_dt: number, elapsed: number): void {
    for (const s of this.seeds) {
      if (s.collectedThisRun) continue;
      s.mesh.rotation.y = elapsed * 2.2 + s.index;
      s.mesh.position.y = s.basePos.y + Math.sin(elapsed * 2.6 + s.index * 2) * 0.14;
    }
    if (this.goalGroup) {
      const ring = this.goalGroup.getObjectByName('goalRing');
      if (ring) {
        ring.scale.setScalar(1 + Math.sin(elapsed * 3.2) * 0.06);
        ring.position.y = 0.34 + Math.sin(elapsed * 3.2) * 0.05;
      }
    }
    for (let i = 0; i < this.flagCloths.length; i++) {
      const cloth = this.flagCloths[i];
      cloth.rotation.y = Math.sin(elapsed * 3 + i * 1.7) * 0.22;
    }
  }

  /** Restore run state: hazards to phase zero, seeds visible, checkpoints inactive. */
  resetRun(ownedSeedMask: number): void {
    for (const h of this.hazards) h.reset();
    for (const s of this.seeds) {
      s.collectedThisRun = false;
      s.ownedBefore = ((ownedSeedMask >> s.index) & 1) === 1;
      s.mesh.visible = true;
      s.trigger.enabled = true;
      s.trigger.inside = false;
      const mat = s.mesh.material as THREE.MeshPhysicalMaterial;
      // previously collected seeds appear silver + translucent, never falsely missing
      if (s.ownedBefore) {
        mat.color.setHex(0xcdd6e0);
        mat.emissive.setHex(0x444c58);
        mat.transparent = true;
        mat.opacity = 0.55;
      } else {
        mat.color.setHex(0xffc23e);
        mat.emissive.setHex(0xa06a00);
        mat.transparent = false;
        mat.opacity = 1;
      }
    }
    for (const c of this.checkpoints) {
      c.activated = false;
      c.trigger.enabled = true;
      c.trigger.inside = false;
    }
  }

  collectSeed(index: number): void {
    const s = this.seeds[index];
    if (!s) return;
    s.collectedThisRun = true;
    s.mesh.visible = false;
    s.trigger.enabled = false;
  }

  dispose(): void {
    for (const h of this.hazards) h.dispose();
    this.hazards.length = 0;
    this.world.clear();
    this.scene.remove(this.group);
    disposeGroupGeometries(this.group);
    this.mats.dispose();
  }
}

function applyRot(collider: BoxCollider, mesh: THREE.Object3D, rotY = 0, tilt = 0, tiltAxis: 'x' | 'z' = 'x'): void {
  if (rotY === 0 && tilt === 0) return;
  const e = new THREE.Euler(tiltAxis === 'x' ? tilt : 0, rotY, tiltAxis === 'z' ? tilt : 0, 'YXZ');
  const q = new THREE.Quaternion().setFromEuler(e);
  collider.setQuat(q);
  mesh.quaternion.copy(q);
}

/** Build a complete level: visuals, colliders, triggers, hazards. */
export function buildLevel(
  def: LevelDefinition,
  scene: THREE.Scene,
  world: PhysicsWorld,
  renderer: THREE.WebGLRenderer,
  hazardCtxBase: Omit<HazardContext, 'group' | 'mats' | 'world'>,
  cb: BuilderCallbacks
): LevelRuntime {
  const mats = new MaterialLibrary(renderer, def.palette);
  const rt = new LevelRuntime(def, mats, scene, world);
  const g = rt.group;

  // ---- static geometry
  for (const piece of def.geometry) {
    buildGeoPiece(piece, rt, world, mats);
  }

  // ---- route arrows
  for (const a of def.arrows) {
    const holder = new THREE.Group();
    const mesh = arrowMesh(mats, a.scale ?? 1);
    mesh.position.y = 0.03;
    holder.add(mesh);
    holder.rotation.y = a.yaw;
    holder.position.set(a.p[0], a.p[1], a.p[2]);
    g.add(holder);
  }

  // ---- checkpoints: paired flags + gate line + trigger
  def.checkpoints.forEach((c, index) => {
    const span = c.span ?? 3;
    const visual = new THREE.Group();
    const dir = new THREE.Vector3(Math.cos(c.yaw), 0, -Math.sin(c.yaw)); // across the gate
    const f1 = flagMesh(mats);
    f1.position.copy(dir).multiplyScalar(span / 2);
    const f2 = flagMesh(mats);
    f2.position.copy(dir).multiplyScalar(-span / 2);
    rt.flagCloths.push(
      f1.getObjectByName('flagCloth') as THREE.Mesh,
      f2.getObjectByName('flagCloth') as THREE.Mesh
    );
    const lineGeo = new THREE.BoxGeometry(span, 0.06, 0.3);
    const line = new THREE.Mesh(lineGeo, mats.accentEmissive);
    line.position.y = 0.05;
    line.rotation.y = c.yaw;
    visual.add(f1, f2, line);
    visual.position.set(c.p[0], c.p[1], c.p[2]);
    g.add(visual);

    // tall + deep gate so fast or airborne crossings always register
    const vol = new BoxCollider(`cp-${index}`).setBox(c.p[0], c.p[1] + 2, c.p[2], span, 5.6, 3.4);
    vol.setQuat(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), c.yaw));
    const trigger: TriggerVolume = {
      id: `cp-${index}`,
      enabled: true,
      volume: vol,
      inside: false,
      onEnter: () => cb.onCheckpoint(index),
    };
    world.addTrigger(trigger);
    rt.checkpoints.push({
      index,
      spawn: new THREE.Vector3(...(c.spawn ?? c.p)),
      yaw: c.yaw,
      activated: false,
      trigger,
      visual,
    });
  });

  // ---- seeds
  def.seeds.forEach((p, index) => {
    const mesh = seedMesh(mats);
    // per-seed material instance so owned seeds can render silver
    mesh.material = (mesh.material as THREE.MeshPhysicalMaterial).clone();
    mesh.position.set(p[0], p[1], p[2]);
    g.add(mesh);
    const vol = new BoxCollider(`seed-${index}`).setBox(p[0], p[1], p[2], 1.6, 1.8, 1.6);
    const trigger: TriggerVolume = {
      id: `seed-${index}`,
      enabled: true,
      volume: vol,
      inside: false,
      onEnter: () => cb.onSeed(index),
    };
    world.addTrigger(trigger);
    rt.seeds.push({
      mesh,
      basePos: new THREE.Vector3(p[0], p[1], p[2]),
      index,
      collectedThisRun: false,
      ownedBefore: false,
      trigger,
    });
  });

  // ---- goal
  const goal = goalMesh(mats, def.goal.r ?? 2.2);
  goal.position.set(...def.goal.p);
  rt.flagCloths.push(
    ...goal.children.filter((c) => c.getObjectByName('flagCloth')).map((c) => c.getObjectByName('flagCloth') as THREE.Mesh)
  );
  g.add(goal);
  rt.goalGroup = goal;
  // tall trigger so fast or airborne finishes still count — no perfect centering required
  const goalVol = new BoxCollider('goal').setBox(
    def.goal.p[0],
    def.goal.p[1] + 2.2,
    def.goal.p[2],
    (def.goal.r ?? 2.2) * 1.9,
    5.6,
    (def.goal.r ?? 2.2) * 1.9
  );
  world.addTrigger({ id: 'goal', enabled: true, volume: goalVol, inside: false, onEnter: () => cb.onGoal() });

  // ---- shortcut score gates
  for (const s of def.shortcuts ?? []) {
    const vol = new BoxCollider(`shortcut-${s.id}`).setBox(s.p[0], s.p[1], s.p[2], s.s[0], s.s[1], s.s[2]);
    world.addTrigger({
      id: `shortcut-${s.id}`,
      enabled: true,
      volume: vol,
      inside: false,
      onEnter: () => cb.onShortcut(s.id),
    });
  }

  // ---- tutorial prompts
  for (const t of def.tutorials ?? []) {
    const r = t.radius ?? 4;
    const vol = new BoxCollider(`tut`).setBox(t.p[0], t.p[1] + 1, t.p[2], r * 2, 4, r * 2);
    world.addTrigger({ id: `tut-${t.text}`, enabled: true, volume: vol, inside: false, onEnter: () => cb.onTutorial(t.text) });
  }

  // ---- hazards
  const ctx: HazardContext = { ...hazardCtxBase, group: g, mats, world };
  for (const hd of def.hazards) {
    rt.hazards.push(buildHazard(hd, ctx));
  }

  scene.add(g);
  return rt;
}

function buildGeoPiece(piece: GeoPiece, rt: LevelRuntime, world: PhysicsWorld, mats: MaterialLibrary): void {
  const g = rt.group;
  switch (piece.t) {
    case 'box': {
      const surface = piece.surface ?? Surface.NORMAL;
      let mesh: THREE.Mesh;
      if (surface === Surface.GLASS) {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(...piece.s), mats.glass);
      } else if (surface === Surface.TAR) {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(...piece.s), mats.tar);
        mesh.receiveShadow = true;
      } else {
        mesh = platformMesh(piece.s[0], piece.s[1], piece.s[2], mats, piece.checker ?? true);
      }
      mesh.position.set(...piece.p);
      const col = new BoxCollider('geo').setBox(...piece.p, ...piece.s);
      col.surface = surface;
      applyRot(col, mesh, piece.rotY ?? 0, piece.tilt ?? 0, piece.tiltAxis ?? 'x');
      world.add(col);
      g.add(mesh);
      break;
    }
    case 'curve': {
      const segs = piece.segs ?? Math.max(5, Math.ceil((Math.abs(piece.a1 - piece.a0) / (Math.PI * 2)) * 26));
      const thick = piece.thick ?? 0.6;
      const surface = piece.surface ?? Surface.NORMAL;
      for (let i = 0; i < segs; i++) {
        const a = piece.a0 + ((i + 0.5) / segs) * (piece.a1 - piece.a0);
        const segLen = ((Math.abs(piece.a1 - piece.a0) * piece.r) / segs) * 1.14;
        const px = piece.c[0] + Math.cos(a) * piece.r;
        const pz = piece.c[2] + Math.sin(a) * piece.r;
        // c[1] is the walkable surface height (matches the plat() convention)
        const cy = piece.c[1] - thick / 2;
        // after the yaw below, local X = tangent and local Z = radial:
        // segment length runs along the tangent, track width w spans radially
        const mesh =
          surface === Surface.GLASS
            ? new THREE.Mesh(new THREE.BoxGeometry(segLen, thick, piece.w), mats.glass)
            : platformMesh(segLen, thick, piece.w, mats);
        const col = new BoxCollider('geo-curve').setBox(px, cy, pz, segLen, thick, piece.w);
        col.surface = surface;
        const e = new THREE.Euler(0, -a + Math.PI / 2, piece.bank ?? 0, 'YXZ');
        // bank tilts around the travel direction (local Z after yaw)
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a + Math.PI / 2, 0));
        if (piece.bank) {
          // positive bank raises the OUTER edge (a proper banked turn)
          const radial = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
          const bankQ = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3().crossVectors(radial, new THREE.Vector3(0, 1, 0)).normalize(),
            piece.bank
          );
          q.premultiply(bankQ);
        }
        void e;
        col.setQuat(q);
        mesh.position.set(px, cy, pz);
        mesh.quaternion.copy(q);
        world.add(col);
        g.add(mesh);
      }
      break;
    }
    case 'rail': {
      const from = new THREE.Vector3(...piece.from);
      const to = new THREE.Vector3(...piece.to);
      const mid = from.clone().add(to).multiplyScalar(0.5);
      const len = from.distanceTo(to);
      const yaw = Math.atan2(to.x - from.x, to.z - from.z);
      const h = piece.h ?? 0.55;
      const geo = new THREE.BoxGeometry(0.22, h, len);
      const mesh = new THREE.Mesh(geo, mats.rail);
      mesh.position.copy(mid);
      mesh.position.y += h / 2;
      mesh.rotation.y = yaw;
      mesh.castShadow = true;
      const col = new BoxCollider('rail').setBox(mid.x, mid.y + h / 2, mid.z, 0.22, h, len);
      col.setQuat(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
      col.restitution = 0.35;
      world.add(col);
      g.add(mesh);
      // rounded cap posts
      const postGeo = new THREE.SphereGeometry(0.16, 8, 6);
      const p1 = new THREE.Mesh(postGeo, mats.rail);
      p1.position.copy(from).y += h;
      const p2 = new THREE.Mesh(postGeo.clone(), mats.rail);
      p2.position.copy(to).y += h;
      g.add(p1, p2);
      break;
    }
    case 'deco': {
      const obj = decoMesh(piece.kind, piece.s ?? [4, 10, 4], mats);
      obj.position.set(...piece.p);
      if (piece.rotY) obj.rotation.y = piece.rotY;
      rt.group.add(obj);
      if (piece.kind === 'tower' || piece.kind === 'pillar') rt.occluders.push(obj);
      break;
    }
  }
}
