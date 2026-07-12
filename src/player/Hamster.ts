import * as THREE from 'three';
import { angleLerp, clamp, clamp01, dampFactor } from '../utils/math';
import type { PlayerController } from './PlayerController';

export type HamsterMood = 'normal' | 'victory' | 'tumble' | 'menu';

/**
 * Original procedural low-poly hamster built from articulated primitives.
 * Lives inside the ball on its own visual root: stays upright, faces motion,
 * leans into acceleration and turns, panics in the air, gets dizzy, celebrates.
 */
export class Hamster {
  readonly group = new THREE.Group();
  mood: HamsterMood = 'normal';
  private inner = new THREE.Group();
  private head: THREE.Group;
  private earL: THREE.Mesh;
  private earR: THREE.Mesh;
  private pawL: THREE.Mesh;
  private pawR: THREE.Mesh;
  private footL: THREE.Mesh;
  private footR: THREE.Mesh;
  private body: THREE.Mesh;
  private yaw = 0;
  private lastSpeed = 0;
  private lastYaw = 0;
  private lean = new THREE.Vector2();
  private geos: THREE.BufferGeometry[] = [];
  private mats: THREE.Material[] = [];

  constructor() {
    const fur = new THREE.MeshStandardMaterial({ color: 0xd98c4a, roughness: 0.85 });
    const cream = new THREE.MeshStandardMaterial({ color: 0xf7e7c8, roughness: 0.9 });
    const pink = new THREE.MeshStandardMaterial({ color: 0xf2a0b5, roughness: 0.8 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x302014, roughness: 0.4 });
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
    this.mats.push(fur, cream, pink, dark, white);

    const sphere = (r: number): THREE.SphereGeometry => {
      const g = new THREE.SphereGeometry(r, 12, 10);
      this.geos.push(g);
      return g;
    };

    this.body = new THREE.Mesh(sphere(0.2), fur);
    this.body.scale.set(1, 0.92, 1.22);
    const belly = new THREE.Mesh(sphere(0.13), cream);
    belly.position.set(0, -0.055, 0.1);
    belly.scale.set(1, 0.9, 1);

    this.head = new THREE.Group();
    const skull = new THREE.Mesh(sphere(0.148), fur);
    const muzzle = new THREE.Mesh(sphere(0.065), cream);
    muzzle.position.set(0, -0.035, 0.115);
    const nose = new THREE.Mesh(sphere(0.024), pink);
    nose.position.set(0, -0.02, 0.172);
    const eyeGeo = sphere(0.028);
    const eyeL = new THREE.Mesh(eyeGeo, dark);
    eyeL.position.set(-0.062, 0.03, 0.115);
    const eyeR = new THREE.Mesh(eyeGeo, dark);
    eyeR.position.set(0.062, 0.03, 0.115);
    const glintGeo = sphere(0.009);
    const glintL = new THREE.Mesh(glintGeo, white);
    glintL.position.set(-0.055, 0.042, 0.138);
    const glintR = new THREE.Mesh(glintGeo, white);
    glintR.position.set(0.069, 0.042, 0.138);
    this.earL = new THREE.Mesh(sphere(0.05), fur);
    this.earL.position.set(-0.085, 0.125, 0.02);
    this.earL.scale.set(1, 1.15, 0.6);
    this.earR = this.earL.clone();
    this.earR.position.x = 0.085;
    const earInGeo = sphere(0.028);
    const earInL = new THREE.Mesh(earInGeo, pink);
    earInL.position.set(-0.085, 0.122, 0.038);
    earInL.scale.set(1, 1, 0.5);
    const earInR = earInL.clone();
    earInR.position.x = 0.085;
    this.head.add(skull, muzzle, nose, eyeL, eyeR, glintL, glintR, this.earL, this.earR, earInL, earInR);
    this.head.position.set(0, 0.135, 0.155);

    const pawGeo = sphere(0.038);
    this.pawL = new THREE.Mesh(pawGeo, cream);
    this.pawL.position.set(-0.09, -0.01, 0.19);
    this.pawR = new THREE.Mesh(pawGeo, cream);
    this.pawR.position.set(0.09, -0.01, 0.19);

    const footGeo = sphere(0.05);
    this.footL = new THREE.Mesh(footGeo, cream);
    this.footL.position.set(-0.08, -0.165, 0.05);
    this.footL.scale.set(1, 0.55, 1.5);
    this.footR = this.footL.clone();
    this.footR.position.x = 0.08;

    const tail = new THREE.Mesh(sphere(0.03), cream);
    tail.position.set(0, -0.06, -0.24);

    this.inner.add(this.body, belly, this.head, this.pawL, this.pawR, this.footL, this.footR, tail);
    this.inner.position.y = -0.1;
    this.group.add(this.inner);
  }

  setMood(mood: HamsterMood): void {
    this.mood = mood;
  }

  update(dt: number, player: PlayerController, time: number): void {
    const speed = player.speed;
    const speedN = clamp01(speed / 15);

    // face motion direction
    const hx = player.vel.x;
    const hz = player.vel.z;
    if (hx * hx + hz * hz > 0.6) {
      const desired = Math.atan2(hx, hz);
      this.yaw = angleLerp(this.yaw, desired, dampFactor(8, dt));
    }
    this.group.rotation.y = this.yaw;

    // keep upright relative to local (possibly magnetic) up
    const up = player.magnetUp;
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
    this.group.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw));

    // lean from acceleration + turn rate
    const accel = clamp((speed - this.lastSpeed) / Math.max(dt, 0.001), -40, 40);
    const yawRate = clamp((this.yaw - this.lastYaw) / Math.max(dt, 0.001), -6, 6);
    this.lastSpeed = speed;
    this.lastYaw = this.yaw;
    const targetLeanX = clamp(speedN * 0.35 + accel * 0.008, -0.5, 0.6);
    const targetLeanZ = clamp(-yawRate * 0.09, -0.4, 0.4);
    this.lean.x += (targetLeanX - this.lean.x) * dampFactor(9, dt);
    this.lean.y += (targetLeanZ - this.lean.y) * dampFactor(9, dt);

    const airborne = player.airborneTime > 0.22 && this.mood === 'normal';
    const dizzy = player.dizzyTimer > 0;

    let pitch = this.lean.x;
    let roll = this.lean.y;
    let bounce = 0;

    if (this.mood === 'menu') {
      // relaxed idle: breathing + occasional ear twitch
      bounce = Math.sin(time * 2.2) * 0.01;
      this.body.scale.y = 0.92 + Math.sin(time * 2.2) * 0.02;
      this.earL.rotation.z = Math.sin(time * 1.3) > 0.96 ? 0.3 : 0;
      pitch = 0;
      roll = 0;
    } else if (this.mood === 'victory') {
      bounce = Math.abs(Math.sin(time * 6)) * 0.09;
      this.pawL.position.y = 0.12 + Math.sin(time * 6) * 0.03;
      this.pawR.position.y = 0.12 + Math.cos(time * 6) * 0.03;
      this.head.rotation.x = -0.25;
      pitch = -0.15;
    } else if (this.mood === 'tumble') {
      this.inner.rotation.x += dt * 9;
    } else if (airborne) {
      // panic: limbs spread, wiggle
      this.pawL.position.set(-0.13, 0.06, 0.16);
      this.pawR.position.set(0.13, 0.06, 0.16);
      this.footL.position.y = -0.13;
      this.footR.position.y = -0.13;
      roll += Math.sin(time * 19) * 0.12;
      this.head.rotation.x = -0.2;
    } else if (dizzy) {
      this.head.rotation.x = Math.sin(time * 10) * 0.2;
      this.head.rotation.z = Math.cos(time * 8) * 0.25;
      roll += Math.sin(time * 5) * 0.15;
    } else {
      // run cycle scaled by speed
      const freq = 5 + speedN * 13;
      const amp = 0.03 + speedN * 0.05;
      this.footL.position.z = 0.05 + Math.sin(time * freq) * amp * 1.6;
      this.footR.position.z = 0.05 - Math.sin(time * freq) * amp * 1.6;
      this.pawL.position.set(-0.09, -0.01 + Math.max(0, -Math.sin(time * freq)) * amp, 0.19);
      this.pawR.position.set(0.09, -0.01 + Math.max(0, Math.sin(time * freq)) * amp, 0.19);
      bounce = Math.abs(Math.sin(time * freq)) * amp * 0.5;
      this.head.rotation.x = speedN * 0.12;
      this.head.rotation.z = 0;
      this.body.scale.y = 0.92;
    }

    if (this.mood !== 'tumble') this.inner.rotation.set(pitch, 0, roll);
    this.inner.position.y = -0.1 + bounce;
  }

  dispose(): void {
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
  }
}
