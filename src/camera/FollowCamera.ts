import * as THREE from 'three';
import { CAMERA_CFG } from '../config/config';
import { angleLerp, clamp01, dampFactor, lerp } from '../utils/math';

const _desired = new THREE.Vector3();
const _look = new THREE.Vector3();
const _rayDir = new THREE.Vector3();

/**
 * Cinematic elevated three-quarter follow rig. Script-controlled, never
 * parented to the player. Yaw gently follows the direction of travel;
 * everything is damped frame-rate independently.
 */
export class FollowCamera {
  readonly camera: THREE.PerspectiveCamera;
  yaw = 0;
  shakeEnabled = true;
  occluders: THREE.Object3D[] = [];
  private smoothedPos = new THREE.Vector3();
  private smoothedLook = new THREE.Vector3();
  private trauma = 0;
  private fov: number = CAMERA_CFG.FOV_BASE;
  private raycaster = new THREE.Raycaster();
  private portrait = false;

  constructor() {
    // near=0.5 (not 0.1) gives ~5x better depth-buffer precision across the course,
    // which keeps large coplanar platform surfaces from z-fighting at distance.
    // The follow rig never gets closer than a few units to the ball, so nothing clips.
    this.camera = new THREE.PerspectiveCamera(CAMERA_CFG.FOV_BASE, 1, 0.5, 600);
  }

  setAspect(w: number, h: number): void {
    this.camera.aspect = w / h;
    this.portrait = h > w;
    this.camera.updateProjectionMatrix();
  }

  addTrauma(amount: number): void {
    if (!this.shakeEnabled) return;
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /** Instantly place the camera behind the given position facing yaw (spawn/respawn). */
  snap(pos: THREE.Vector3, yaw: number): void {
    this.yaw = yaw;
    const dist = this.portrait ? CAMERA_CFG.PORTRAIT_DISTANCE : CAMERA_CFG.DISTANCE;
    const height = this.portrait ? CAMERA_CFG.PORTRAIT_HEIGHT : CAMERA_CFG.HEIGHT;
    this.smoothedPos.set(pos.x + Math.sin(yaw) * dist, pos.y + height, pos.z + Math.cos(yaw) * dist);
    this.smoothedLook.copy(pos);
    this.camera.position.copy(this.smoothedPos);
    this.camera.lookAt(this.smoothedLook);
  }

  update(dt: number, pos: THREE.Vector3, vel: THREE.Vector3, speedCap: number, boosting: boolean, time: number): void {
    const speed = vel.length();
    const speedN = clamp01(speed / speedCap);

    // yaw eases behind the direction of travel
    const hx = vel.x;
    const hz = vel.z;
    const hSpeed = Math.hypot(hx, hz);
    if (hSpeed > 2.2) {
      const desiredYaw = Math.atan2(-hx, -hz);
      const rate = CAMERA_CFG.YAW_DAMP * clamp01(hSpeed / 8);
      this.yaw = angleLerp(this.yaw, desiredYaw, dampFactor(rate, dt));
    }

    const dist = (this.portrait ? CAMERA_CFG.PORTRAIT_DISTANCE : CAMERA_CFG.DISTANCE) + speedN * 2.0;
    const height = (this.portrait ? CAMERA_CFG.PORTRAIT_HEIGHT : CAMERA_CFG.HEIGHT) + speedN * 0.8;

    _desired.set(pos.x + Math.sin(this.yaw) * dist, pos.y + height, pos.z + Math.cos(this.yaw) * dist);
    this.smoothedPos.lerp(_desired, dampFactor(CAMERA_CFG.POS_DAMP, dt));

    // look-ahead along velocity keeps the route visible
    _look.copy(pos).addScaledVector(vel, (CAMERA_CFG.LOOK_AHEAD / Math.max(speedCap, 1)) * 0.6);
    _look.y = pos.y + (this.portrait ? -0.6 : 0.4);
    this.smoothedLook.lerp(_look, dampFactor(CAMERA_CFG.TARGET_DAMP, dt));

    // obstruction probe against flagged occluders only
    let camPos = this.smoothedPos;
    if (this.occluders.length > 0) {
      _rayDir.copy(this.smoothedPos).sub(this.smoothedLook);
      const len = _rayDir.length();
      if (len > 0.5) {
        this.raycaster.set(this.smoothedLook, _rayDir.normalize());
        this.raycaster.far = len;
        const hits = this.raycaster.intersectObjects(this.occluders, false);
        if (hits.length > 0 && hits[0].distance < len) {
          camPos = _rayDir.multiplyScalar(hits[0].distance * 0.88).add(this.smoothedLook);
        }
      }
    }
    this.camera.position.copy(camPos);
    this.camera.lookAt(this.smoothedLook);

    // trauma-based shake: additive after follow, squared falloff
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - CAMERA_CFG.SHAKE_DECAY * dt);
      const s = this.trauma * this.trauma;
      this.camera.position.x += Math.sin(time * 47.3) * s * CAMERA_CFG.SHAKE_MAX_OFFSET;
      this.camera.position.y += Math.sin(time * 39.7 + 1.7) * s * CAMERA_CFG.SHAKE_MAX_OFFSET;
      this.camera.rotation.z += Math.sin(time * 43.1 + 3.1) * s * 0.02;
    }

    // dynamic FOV widens with speed / boost
    const targetFov = CAMERA_CFG.FOV_BASE + speedN * CAMERA_CFG.FOV_SPEED_BOOST + (boosting ? 4 : 0);
    this.fov = lerp(this.fov, targetFov, dampFactor(4, dt));
    if (Math.abs(this.fov - this.camera.fov) > 0.05) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
