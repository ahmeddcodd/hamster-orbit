import * as THREE from 'three';
import { PHYSICS } from '../config/config';
import { Surface } from '../physics/collider';
import type { PhysicsWorld, StepResult } from '../physics/world';
import { dampFactor } from '../utils/math';

export interface PlayerEvents {
  onImpact?: (speed: number) => void;
  onHardLanding?: (speed: number) => void;
  onLethalImpact?: () => void;
  onLethalHazard?: () => void;
  onSurface?: (surface: Surface) => void;
}

const _gravity = new THREE.Vector3();
const _magnetDir = new THREE.Vector3();
const _inputWorld = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _accel = new THREE.Vector3();
const _horiz = new THREE.Vector3();
const _force = new THREE.Vector3();
const _spinAxis = new THREE.Vector3();
const _q = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

/**
 * The one dynamic body in the game. Semi-fixed timestep accumulator drives
 * deterministic, tunnel-free arcade ball physics.
 */
export class PlayerController {
  readonly pos = new THREE.Vector3();
  readonly vel = new THREE.Vector3();
  readonly radius = PHYSICS.BALL_RADIUS;
  /** accumulated rolling rotation for the shell visual */
  readonly spinQuat = new THREE.Quaternion();
  readonly groundNormal = new THREE.Vector3(0, 1, 0);
  readonly lastSupportVel = new THREE.Vector3();

  grounded = false;
  surface: Surface = Surface.NORMAL;
  controlEnabled = true;
  /** extra speed cap from boosters, decays back to normal */
  boostTimer = 0;
  dizzyTimer = 0;
  protectionTimer = 0;
  airborneTime = 0;
  /** captured by tubes: physics suspended, position driven externally */
  captured = false;
  magnetInfluence = 0;
  readonly magnetUp = new THREE.Vector3(0, 1, 0);
  events: PlayerEvents = {};

  private accumulator = 0;
  private groundGrace = 0;
  private lastSurface: Surface = Surface.NORMAL;
  private ballState = { pos: this.pos, vel: this.vel, radius: this.radius };

  constructor(private world: PhysicsWorld) {}

  get speed(): number {
    return this.vel.length();
  }

  get speedCap(): number {
    return this.boostTimer > 0 ? PHYSICS.BOOST_MAX_SPEED : PHYSICS.NORMAL_MAX_SPEED;
  }

  teleport(x: number, y: number, z: number): void {
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
    this.boostTimer = 0;
    this.dizzyTimer = 0;
    this.airborneTime = 0;
    this.accumulator = 0;
    this.captured = false;
    this.magnetInfluence = 0;
    this.magnetUp.set(0, 1, 0);
  }

  applyImpulse(x: number, y: number, z: number): void {
    this.vel.x += x;
    this.vel.y += y;
    this.vel.z += z;
  }

  /** Advance simulation. inputX/inputY are analog (screen right / forward), camYaw maps them to world. */
  update(dt: number, inputX: number, inputY: number, camYaw: number): void {
    if (this.captured) return;
    this.accumulator += Math.min(dt, PHYSICS.MAX_FRAME_DT);
    let steps = 0;
    while (this.accumulator >= PHYSICS.FIXED_DT && steps < PHYSICS.MAX_SUBSTEPS) {
      this.fixedStep(PHYSICS.FIXED_DT, inputX, inputY, camYaw);
      this.accumulator -= PHYSICS.FIXED_DT;
      steps++;
    }
    if (steps === PHYSICS.MAX_SUBSTEPS) this.accumulator = 0; // drop excess after hitches
    if (this.boostTimer > 0) this.boostTimer -= dt;
    if (this.dizzyTimer > 0) this.dizzyTimer -= dt;
    if (this.protectionTimer > 0) this.protectionTimer -= dt;
  }

  private fixedStep(dt: number, inputX: number, inputY: number, camYaw: number): void {
    // 1. effective gravity (magnet fields override direction)
    this.magnetInfluence = this.world.sampleMagnets(this.pos, _magnetDir);
    if (this.magnetInfluence > 0.01) {
      // blend real gravity with the magnetic pull so rims/edges stay survivable
      _gravity
        .set(0, PHYSICS.GRAVITY_Y * (1 - this.magnetInfluence * 0.8), 0)
        .addScaledVector(_magnetDir, -PHYSICS.GRAVITY_Y * this.magnetInfluence * 1.35);
      this.magnetUp.copy(_magnetDir).multiplyScalar(-1).normalize();
    } else {
      _gravity.set(0, PHYSICS.GRAVITY_Y, 0);
      this.magnetUp.lerp(UP, 0.15).normalize();
    }

    // 2. input acceleration in camera space, projected on the support plane
    let cap = this.speedCap;
    if (this.surface === Surface.TAR && this.grounded) cap = PHYSICS.TAR_MAX_SPEED;
    if (this.controlEnabled && (inputX !== 0 || inputY !== 0)) {
      _forward.set(-Math.sin(camYaw), 0, -Math.cos(camYaw));
      _right.set(Math.cos(camYaw), 0, -Math.sin(camYaw));
      _inputWorld.set(0, 0, 0).addScaledVector(_right, inputX).addScaledVector(_forward, inputY);
      const strength = Math.min(1, _inputWorld.length());
      if (strength > 0.001) {
        _inputWorld.normalize();
        // project onto ground plane when grounded so slopes feel natural
        if (this.grounded || this.groundGrace > 0) {
          const d = _inputWorld.dot(this.groundNormal);
          _inputWorld.addScaledVector(this.groundNormal, -d).normalize();
        }
        let accel = this.grounded || this.groundGrace > 0 ? PHYSICS.GROUND_ACCEL : PHYSICS.AIR_ACCEL;
        // countersteer braking: opposing current velocity decelerates harder
        _horiz.copy(this.vel);
        _horiz.y = 0;
        if (_horiz.lengthSq() > 1 && _inputWorld.dot(_horiz.normalize()) < -0.35) {
          accel *= PHYSICS.BRAKE_MULTIPLIER;
        }
        if (this.dizzyTimer > 0) accel *= PHYSICS.DIZZY_CONTROL;
        // above the speed cap, input can steer but not accelerate further forward
        if (this.vel.length() > cap) {
          const along = _inputWorld.dot(_horiz); // _horiz is normalized velocity dir here
          if (along > 0) _inputWorld.addScaledVector(_horiz, -along);
        }
        _accel.copy(_inputWorld).multiplyScalar(accel * strength);
        this.vel.addScaledVector(_accel, dt);
      }
    }

    // 3. force zones (fans)
    this.world.sampleForces(this.pos, _force);
    this.vel.addScaledVector(_force, dt);

    // 4. surface friction + drag when grounded with no strong input
    if (this.grounded) {
      const friction =
        this.surface === Surface.GLASS
          ? PHYSICS.FRICTION_GLASS
          : this.surface === Surface.TAR
            ? PHYSICS.FRICTION_TAR
            : PHYSICS.FRICTION_NORMAL;
      const inputMag = Math.hypot(inputX, inputY);
      const f = dampFactor(friction * (1 - inputMag * 0.75), dt);
      // ease horizontal velocity toward the support platform velocity (carrying)
      _horiz.copy(this.lastSupportVel);
      this.vel.x += (_horiz.x - this.vel.x) * f;
      this.vel.z += (_horiz.z - this.vel.z) * f;
    }

    // 5. soft speed cap (eased, never a hard clamp)
    const sp = this.vel.length();
    if (sp > cap) {
      const f = dampFactor(PHYSICS.SOFT_CAP_RATE, dt);
      this.vel.multiplyScalar(1 - f * ((sp - cap) / sp));
    }

    // 6. integrate + resolve
    const wasGrounded = this.grounded || this.groundGrace > 0;
    const prevAirTime = this.airborneTime;
    const result: StepResult = this.world.step(this.ballState, dt, _gravity);

    if (result.grounded) {
      this.grounded = true;
      this.groundGrace = PHYSICS.GROUND_GRACE;
      this.groundNormal.copy(result.groundNormal);
      this.lastSupportVel.copy(result.supportVelocity);
      this.airborneTime = 0;
      if (result.surface !== this.lastSurface) {
        this.lastSurface = result.surface;
        this.events.onSurface?.(result.surface);
      }
      this.surface = result.surface;
    } else {
      this.groundGrace -= dt;
      this.grounded = false;
      this.airborneTime += dt;
      if (this.groundGrace > 0) {
        // grace period: still treated as grounded for control purposes
      } else {
        this.lastSupportVel.set(0, 0, 0);
      }
    }

    // 7. impact classification
    if (result.maxImpact > 4.5) this.events.onImpact?.(result.maxImpact);
    if (result.lethal && this.protectionTimer <= 0) {
      this.events.onLethalHazard?.();
    } else if (!wasGrounded && result.grounded && prevAirTime > 0.18) {
      if (result.maxImpact >= PHYSICS.LETHAL_IMPACT_SPEED && this.protectionTimer <= 0) {
        this.events.onLethalImpact?.();
      } else if (result.maxImpact >= PHYSICS.HARD_LANDING_SPEED) {
        this.dizzyTimer = PHYSICS.DIZZY_DURATION;
        this.events.onHardLanding?.(result.maxImpact);
      }
    }

    // 8. rolling spin for the shell visual (axis = up × velocity)
    const speed = this.vel.length();
    if (speed > 0.05) {
      _spinAxis.crossVectors(this.magnetUp, this.vel).normalize();
      if (_spinAxis.lengthSq() > 0.5) {
        _q.setFromAxisAngle(_spinAxis, (speed / this.radius) * dt);
        this.spinQuat.premultiply(_q);
      }
    }

    // 9. triggers (checkpoints, seeds, goal, gates)
    this.world.updateTriggers(this.pos, this.radius);
  }
}
