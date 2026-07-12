import * as THREE from 'three';
import { SPRINT_CFG } from '../config/config';
import { BoxCollider, Surface } from '../physics/collider';
import type { PhysicsWorld } from '../physics/world';
import { MaterialLibrary } from '../rendering/MaterialLibrary';
import { platformMesh, seedMesh, disposeGroupGeometries } from '../levels/meshes';
import { PALETTES } from '../levels/types';
import { mulberry32 } from '../utils/math';
import type { Particles } from '../effects/Particles';
import type { AudioManager } from '../audio/AudioManager';

interface Chunk {
  index: number;
  group: THREE.Group;
  colliders: BoxCollider[];
  seeds: Array<{ mesh: THREE.Mesh; pos: THREE.Vector3; taken: boolean }>;
  startZ: number;
  endZ: number;
  endX: number;
  endY: number;
}

/**
 * Endless "Sky Sprint" mode: deterministic per-seed procedural stitching of
 * course pieces. Difficulty ramps with segment index (narrower paths, more
 * gaps, denser obstacles). One fall ends the run.
 */
export class SprintRun {
  readonly startPos = new THREE.Vector3(0, 0, 0);
  score = 0;
  distance = 0;
  over = false;
  private chunks: Chunk[] = [];
  private rng: () => number;
  private nextIndex = 0;
  private headX = 0;
  private headY = 0;
  private headZ = 0;
  private mats: MaterialLibrary;
  private root = new THREE.Group();
  private seedsTaken = 0;
  private bestZ = 0;

  constructor(
    seed: number,
    private scene: THREE.Scene,
    private world: PhysicsWorld,
    renderer: THREE.WebGLRenderer,
    private particles: Particles,
    private audio: AudioManager
  ) {
    this.rng = mulberry32(seed);
    this.mats = new MaterialLibrary(renderer, PALETTES.royal);
    scene.add(this.root);
    // starting platform
    this.spawnPad();
    for (let i = 0; i < SPRINT_CFG.SEGMENTS_AHEAD; i++) this.generateChunk();
  }

  get palette(): typeof PALETTES.royal {
    return PALETTES.royal;
  }

  private spawnPad(): void {
    const g = new THREE.Group();
    const mesh = platformMesh(10, 1, 12, this.mats);
    mesh.position.set(0, -0.5, 0);
    g.add(mesh);
    const col = new BoxCollider('sprint-pad').setBox(0, -0.5, 0, 10, 1, 12);
    this.world.add(col);
    this.root.add(g);
    this.chunks.push({ index: -1, group: g, colliders: [col], seeds: [], startZ: 6, endZ: -6, endX: 0, endY: 0 });
    this.headZ = -6;
  }

  private addBox(
    chunk: Chunk,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    surface: Surface = Surface.NORMAL
  ): void {
    const mesh =
      surface === Surface.GLASS
        ? new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), this.mats.glass)
        : platformMesh(sx, sy, sz, this.mats);
    mesh.position.set(x, y, z);
    chunk.group.add(mesh);
    const col = new BoxCollider(`sprint-${chunk.index}-${chunk.colliders.length}`).setBox(x, y, z, sx, sy, sz);
    col.surface = surface;
    this.world.add(col);
    chunk.colliders.push(col);
  }

  private addSeed(chunk: Chunk, x: number, y: number, z: number): void {
    const mesh = seedMesh(this.mats);
    mesh.position.set(x, y, z);
    chunk.group.add(mesh);
    chunk.seeds.push({ mesh, pos: new THREE.Vector3(x, y, z), taken: false });
  }

  private generateChunk(): void {
    const i = this.nextIndex++;
    const difficulty = Math.min(1, i / 24); // 0..1 ramp
    const chunk: Chunk = {
      index: i,
      group: new THREE.Group(),
      colliders: [],
      seeds: [],
      startZ: this.headZ,
      endZ: 0,
      endX: this.headX,
      endY: this.headY,
    };
    const r = this.rng;
    const kinds = ['wide', 'narrow', 'weave', 'drop', 'split'] as const;
    // early chunks stay friendly
    const kind = i < 2 ? 'wide' : kinds[Math.floor(r() * kinds.length)];
    const len = 16 + r() * 10;
    const drift = (r() - 0.5) * (4 + difficulty * 6);
    const x0 = this.headX;
    const y0 = this.headY;
    const z0 = this.headZ;
    const zMid = z0 - len / 2;
    const zEnd = z0 - len;

    switch (kind) {
      case 'wide': {
        const w = 9 - difficulty * 3.5;
        this.addBox(chunk, x0 + drift / 2, y0 - 0.5, zMid, w, 1, len + 2);
        if (r() < 0.6) this.addSeed(chunk, x0 + drift / 2 + (r() - 0.5) * w * 0.5, y0 + 1, zMid);
        break;
      }
      case 'narrow': {
        const w = Math.max(2.2, 4.5 - difficulty * 2);
        this.addBox(chunk, x0, y0 - 0.5, z0 - 4, 6, 1, 8);
        this.addBox(chunk, x0 + drift, y0 - 0.5, zMid - 2, w, 1, len - 8);
        this.addSeed(chunk, x0 + drift, y0 + 1, zMid - 2);
        break;
      }
      case 'weave': {
        const w = 5 - difficulty * 1.5;
        const seg = len / 3;
        for (let k = 0; k < 3; k++) {
          const ox = x0 + (k % 2 === 0 ? -2.5 : 2.5) + drift * (k / 3);
          this.addBox(chunk, ox, y0 - 0.5, z0 - seg * (k + 0.5), w, 1, seg + 1.6);
          if (k === 1 && r() < 0.7) this.addSeed(chunk, ox, y0 + 1, z0 - seg * 1.5);
        }
        break;
      }
      case 'drop': {
        const dropY = 2.5 + difficulty * 2.5;
        this.addBox(chunk, x0, y0 - 0.5, z0 - 5, 7, 1, 10);
        // downhill ramp launches over a gap
        const gap = 3 + difficulty * 3.5;
        this.addBox(chunk, x0 + drift, y0 - dropY - 0.5, zEnd + (len - 14 - gap) / 2, 7, 1, len - 14 - gap);
        chunk.endY = y0 - dropY;
        this.addSeed(chunk, x0 + drift * 0.6, y0 - dropY / 2 + 1.2, z0 - 11 - gap / 2);
        break;
      }
      case 'split': {
        const w = 3.2 - difficulty * 0.8;
        this.addBox(chunk, x0, y0 - 0.5, z0 - 3.5, 7, 1, 7);
        this.addBox(chunk, x0 - 3.4, y0 - 0.5, zMid - 1, w, 1, len - 12);
        this.addBox(chunk, x0 + 3.4 + drift * 0.4, y0 - 0.5, zMid - 1, w, 1, len - 12);
        this.addBox(chunk, x0 + drift, y0 - 0.5, zEnd + 2.5, 7, 1, 6);
        this.addSeed(chunk, x0 - 3.4, y0 + 1, zMid - 1);
        break;
      }
    }
    // glass lane variety at higher difficulty
    if (difficulty > 0.45 && r() < 0.3) {
      this.addBox(chunk, x0 + drift, chunk.endY - 0.45, zEnd - 2, 5, 0.9, 5, Surface.GLASS);
    }

    chunk.endZ = zEnd;
    chunk.endX = x0 + drift;
    this.headX = chunk.endX;
    this.headY = chunk.endY;
    this.headZ = zEnd;
    this.root.add(chunk.group);
    this.chunks.push(chunk);
  }

  /** Returns points earned this frame; updates world streaming. */
  update(playerPos: THREE.Vector3, playerRadius: number): number {
    if (this.over) return 0;
    let gained = 0;
    // distance score: forward progress only
    if (-playerPos.z > this.bestZ) {
      const meters = -playerPos.z - this.bestZ;
      this.distance += meters;
      this.bestZ = -playerPos.z;
      gained += Math.floor(this.distance / SPRINT_CFG.DIST_PER_POINT) - Math.floor((this.distance - meters) / SPRINT_CFG.DIST_PER_POINT);
    }
    // seeds
    for (const c of this.chunks) {
      for (const s of c.seeds) {
        if (s.taken) continue;
        s.mesh.rotation.y += 0.05;
        if (s.pos.distanceToSquared(playerPos) < (1.1 + playerRadius) ** 2) {
          s.taken = true;
          s.mesh.visible = false;
          this.seedsTaken++;
          gained += SPRINT_CFG.SEED_SCORE;
          this.audio.seed();
          this.particles.spawn({ pos: s.pos.clone(), count: 10, color: 0xffd75e, color2: 0xfff2c4, speed: 3, life: 0.5 });
        }
      }
    }
    // stream: generate ahead, drop far behind
    let currentChunk: Chunk | undefined;
    for (let i = this.chunks.length - 1; i >= 0; i--) {
      if (playerPos.z <= this.chunks[i].startZ + 2) {
        currentChunk = this.chunks[i];
        break;
      }
    }
    if (currentChunk && this.nextIndex - currentChunk.index < SPRINT_CFG.SEGMENTS_AHEAD) {
      this.generateChunk();
      gained += 0; // segment bonus granted on entry below
    }
    while (this.chunks.length > 0 && this.chunks[0].endZ > playerPos.z + 40) {
      this.disposeChunk(this.chunks.shift()!);
      gained += SPRINT_CFG.SEGMENT_SCORE;
    }
    this.score += gained;
    return gained;
  }

  /** Fall plane relative to recent ground. */
  get fallY(): number {
    let minY = 0;
    for (const c of this.chunks) minY = Math.min(minY, c.endY);
    return minY - 14;
  }

  private disposeChunk(c: Chunk): void {
    for (const col of c.colliders) this.world.remove(col);
    this.root.remove(c.group);
    // materials are shared via the MaterialLibrary; only geometries are per-chunk
    disposeGroupGeometries(c.group);
  }

  dispose(): void {
    for (const c of this.chunks) this.disposeChunk(c);
    this.chunks.length = 0;
    this.scene.remove(this.root);
    this.world.clear();
    this.mats.dispose();
  }
}
