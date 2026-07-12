import * as THREE from 'three';
import { PHYSICS } from '../config/config';
import { clamp01 } from '../utils/math';
import type { PlayerController } from './PlayerController';
import { Hamster } from './Hamster';

const RIM_VERT = /* glsl */ `
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

const RIM_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
uniform float uTime;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  float f = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.6);
  float shimmer = 0.92 + 0.08 * sin(uTime * 3.1 + vNormal.y * 6.0);
  gl_FragColor = vec4(uColor, f * uIntensity * shimmer);
}
`;

/**
 * Transparent hamster-ball shell: physical material + Fresnel rim shader,
 * panel seam rings that visibly roll, a soft blob contact shadow, and the
 * hamster (kept upright separately) inside.
 */
export class BallVisual {
  readonly group = new THREE.Group();
  readonly hamster: Hamster;
  private shell: THREE.Mesh;
  private shellMat: THREE.MeshPhysicalMaterial;
  private rim: THREE.Mesh;
  private rimMat: THREE.ShaderMaterial;
  private seams: THREE.Group;
  private seamMat: THREE.MeshStandardMaterial;
  private blob: THREE.Mesh;
  private blobMat: THREE.MeshBasicMaterial;
  private blobTex: THREE.CanvasTexture;
  private lastGroundY = 0;
  private disposables: Array<{ dispose(): void }> = [];
  private flashTime = 0;

  constructor(scene: THREE.Scene) {
    const r = PHYSICS.BALL_RADIUS;

    this.shellMat = new THREE.MeshPhysicalMaterial({
      color: 0xbfe3ff,
      transparent: true,
      opacity: 0.28,
      roughness: 0.05,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      depthWrite: false,
    });
    const shellGeo = new THREE.SphereGeometry(r, 28, 20);
    this.shell = new THREE.Mesh(shellGeo, this.shellMat);
    this.shell.castShadow = true;
    this.shell.renderOrder = 5;

    this.rimMat = new THREE.ShaderMaterial({
      vertexShader: RIM_VERT,
      fragmentShader: RIM_FRAG,
      uniforms: {
        uColor: { value: new THREE.Color(0x9fd4ff) },
        uIntensity: { value: 0.55 },
        uTime: { value: 0 },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.FrontSide,
    });
    this.rim = new THREE.Mesh(shellGeo, this.rimMat);
    this.rim.renderOrder = 6;

    // panel seams make rolling visible
    this.seamMat = new THREE.MeshStandardMaterial({ color: 0x7fa8d9, roughness: 0.35, metalness: 0.5 });
    this.seams = new THREE.Group();
    const seamGeo = new THREE.TorusGeometry(r * 0.995, 0.014, 6, 40);
    const s1 = new THREE.Mesh(seamGeo, this.seamMat);
    const s2 = new THREE.Mesh(seamGeo, this.seamMat);
    s2.rotation.x = Math.PI / 2;
    const s3 = new THREE.Mesh(seamGeo, this.seamMat);
    s3.rotation.y = Math.PI / 2;
    // small vent detail
    const ventGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.02, 8);
    const vent = new THREE.Mesh(ventGeo, this.seamMat);
    vent.position.set(0, r * 0.98, 0);
    this.seams.add(s1, s2, s3, vent);
    this.disposables.push(seamGeo, ventGeo);

    // soft blob contact shadow
    const ctx = document.createElement('canvas').getContext('2d')!;
    ctx.canvas.width = 64;
    ctx.canvas.height = 64;
    const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
    grad.addColorStop(0, 'rgba(10,14,40,0.5)');
    grad.addColorStop(1, 'rgba(10,14,40,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    this.blobTex = new THREE.CanvasTexture(ctx.canvas);
    this.blobMat = new THREE.MeshBasicMaterial({
      map: this.blobTex,
      transparent: true,
      depthWrite: false,
    });
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), this.blobMat);
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.renderOrder = 2;

    this.hamster = new Hamster();

    this.group.add(this.shell, this.rim, this.seams, this.hamster.group);
    scene.add(this.group, this.blob);
    this.disposables.push(shellGeo, this.shellMat, this.rimMat, this.seamMat, this.blobMat, this.blobTex);
  }

  setRim(gold: boolean): void {
    this.seamMat.color.setHex(gold ? 0xffc23e : 0x7fa8d9);
    this.seamMat.metalness = gold ? 0.9 : 0.5;
  }

  setGlowColor(hexColor: number): void {
    (this.rimMat.uniforms.uColor.value as THREE.Color).setHex(hexColor);
  }

  flash(): void {
    this.flashTime = 0.4;
  }

  setVisible(v: boolean): void {
    this.group.visible = v;
    this.blob.visible = v;
  }

  update(dt: number, player: PlayerController, time: number): void {
    this.group.position.copy(player.pos);
    this.seams.quaternion.copy(player.spinQuat);

    // rim glow reacts to speed + boost
    const speedN = clamp01(player.speed / PHYSICS.BOOST_MAX_SPEED);
    const boost = player.boostTimer > 0 ? 0.5 : 0;
    this.rimMat.uniforms.uTime.value = time;
    this.rimMat.uniforms.uIntensity.value = 0.35 + speedN * 0.7 + boost;
    if (this.flashTime > 0) {
      this.flashTime -= dt;
      this.rimMat.uniforms.uIntensity.value = 2.2;
      this.shellMat.opacity = 0.6;
    } else {
      this.shellMat.opacity = player.protectionTimer > 0 ? 0.16 + 0.2 * Math.abs(Math.sin(time * 14)) : 0.28;
    }

    // blob shadow tracks the last ground height
    if (player.grounded) this.lastGroundY = player.pos.y - player.radius;
    const above = player.pos.y - this.lastGroundY;
    const show = above < 7 && above > -0.5;
    this.blob.visible = show && this.group.visible;
    if (show) {
      this.blob.position.set(player.pos.x, this.lastGroundY + 0.03, player.pos.z);
      const k = clamp01(1 - above / 7);
      this.blob.scale.setScalar(0.7 + k * 0.55);
      this.blobMat.opacity = k * 0.85;
    }

    this.hamster.update(dt, player, time);
  }

  /** Smoothly re-show after respawn reconstruction. */
  respawnEffect(dt: number, t01: number): void {
    void dt;
    const s = 0.2 + 0.8 * t01;
    this.group.scale.setScalar(s);
    if (t01 >= 1) this.group.scale.setScalar(1);
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.group, this.blob);
    (this.blob.geometry as THREE.BufferGeometry).dispose();
    for (const d of this.disposables) d.dispose();
    this.hamster.dispose();
  }
}
