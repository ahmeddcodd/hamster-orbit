import type * as THREE from 'three';
import type { PhysicsWorld } from '../physics/world';
import type { MaterialLibrary } from '../rendering/MaterialLibrary';
import type { PlayerController } from '../player/PlayerController';
import type { Particles, RingPulses } from '../effects/Particles';
import type { AudioManager } from '../audio/AudioManager';
import type { FollowCamera } from '../camera/FollowCamera';

export interface HazardContext {
  group: THREE.Group;
  world: PhysicsWorld;
  mats: MaterialLibrary;
  player: PlayerController;
  particles: Particles;
  rings: RingPulses;
  audio: AudioManager;
  camera: FollowCamera;
  /** immediate lethal kill (crushers, saws) */
  killPlayer: () => void;
  /** one-time score events; RunManager enforces one-time-per-run IDs */
  scoreEvent: (kind: 'knockout' | 'glass', id: string, pos: THREE.Vector3) => void;
}

/**
 * Hazard base. All motion is a deterministic function of run-elapsed time so
 * restarting a level resets every hazard to an identical phase.
 */
export abstract class Hazard {
  constructor(
    readonly id: string,
    protected ctx: HazardContext
  ) {}

  abstract update(dt: number, elapsed: number): void;

  /** Restore initial state on level restart. */
  reset(): void {
    /* stateless hazards need nothing */
  }

  /** Remove colliders/listeners; meshes are disposed with the level group. */
  dispose(): void {
    /* default: nothing beyond level group disposal */
  }
}
