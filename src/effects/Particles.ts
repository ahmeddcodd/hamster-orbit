import * as THREE from 'three';

interface Particle {
  alive: boolean;
  life: number;
  maxLife: number;
  gravity: number;
  drag: number;
  size: number;
  vel: THREE.Vector3;
  pos: THREE.Vector3;
  color: THREE.Color;
}

export interface SpawnOpts {
  pos: THREE.Vector3;
  count: number;
  color: number;
  color2?: number;
  size?: number;
  life?: number;
  speed?: number;
  spread?: number;
  dirY?: number;
  gravity?: number;
  drag?: number;
  /** additional base velocity added to every particle (wind, trails) */
  baseVel?: THREE.Vector3;
}

const MAX_PARTICLES = 512;
const _v = new THREE.Vector3();

/**
 * Single pooled GPU point cloud for every burst effect in the game.
 * No allocation during gameplay; one draw call.
 */
export class Particles {
  private points: THREE.Points;
  private geo: THREE.BufferGeometry;
  private mat: THREE.ShaderMaterial;
  private pool: Particle[] = [];
  private positions: Float32Array;
  private colors: Float32Array;
  private sizesLife: Float32Array;
  private tex: THREE.CanvasTexture;
  private cursor = 0;
  cap = MAX_PARTICLES;

  constructor(scene: THREE.Scene) {
    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.colors = new Float32Array(MAX_PARTICLES * 3);
    this.sizesLife = new Float32Array(MAX_PARTICLES * 2);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.pool.push({
        alive: false,
        life: 0,
        maxLife: 1,
        gravity: 0,
        drag: 0,
        size: 1,
        vel: new THREE.Vector3(),
        pos: new THREE.Vector3(),
        color: new THREE.Color(),
      });
    }

    // 4-point star sprite (echoes the reference star-trail)
    const ctx = document.createElement('canvas').getContext('2d')!;
    ctx.canvas.width = 64;
    ctx.canvas.height = 64;
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(32, 6);
    ctx.lineTo(32, 58);
    ctx.moveTo(6, 32);
    ctx.lineTo(58, 32);
    ctx.stroke();
    this.tex = new THREE.CanvasTexture(ctx.canvas);

    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3));
    this.geo.setAttribute('aSizeLife', new THREE.BufferAttribute(this.sizesLife, 2));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: this.tex } },
      vertexShader: /* glsl */ `
        attribute vec3 aColor;
        attribute vec2 aSizeLife;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = aColor;
          vAlpha = aSizeLife.y;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSizeLife.x * (140.0 / max(1.0, -mv.z));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uTex;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec4 t = texture2D(uTex, gl_PointCoord);
          gl_FragColor = vec4(vColor, t.a * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    scene.add(this.points);
  }

  spawn(opts: SpawnOpts): void {
    const c1 = new THREE.Color(opts.color);
    const c2 = opts.color2 !== undefined ? new THREE.Color(opts.color2) : c1;
    const n = Math.min(opts.count, this.cap);
    for (let i = 0; i < n; i++) {
      const p = this.pool[this.cursor];
      this.cursor = (this.cursor + 1) % this.cap;
      p.alive = true;
      p.maxLife = (opts.life ?? 0.7) * (0.7 + Math.random() * 0.6);
      p.life = p.maxLife;
      p.gravity = opts.gravity ?? 6;
      p.drag = opts.drag ?? 1.5;
      p.size = (opts.size ?? 0.5) * (0.7 + Math.random() * 0.6);
      p.pos.copy(opts.pos);
      const spread = opts.spread ?? 0.15;
      p.pos.x += (Math.random() - 0.5) * spread * 2;
      p.pos.y += (Math.random() - 0.5) * spread * 2;
      p.pos.z += (Math.random() - 0.5) * spread * 2;
      const speed = (opts.speed ?? 3) * (0.5 + Math.random() * 0.8);
      _v.set(Math.random() - 0.5, (Math.random() - 0.5) + (opts.dirY ?? 0.5), Math.random() - 0.5).normalize();
      p.vel.copy(_v).multiplyScalar(speed);
      if (opts.baseVel) p.vel.add(opts.baseVel);
      p.color.lerpColors(c1, c2, Math.random());
    }
  }

  update(dt: number): void {
    for (let i = 0; i < this.cap; i++) {
      const p = this.pool[i];
      const i3 = i * 3;
      const i2 = i * 2;
      if (!p.alive) {
        this.sizesLife[i2 + 1] = 0;
        continue;
      }
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        this.sizesLife[i2 + 1] = 0;
        continue;
      }
      p.vel.y -= p.gravity * dt;
      p.vel.multiplyScalar(Math.max(0, 1 - p.drag * dt));
      p.pos.addScaledVector(p.vel, dt);
      this.positions[i3] = p.pos.x;
      this.positions[i3 + 1] = p.pos.y;
      this.positions[i3 + 2] = p.pos.z;
      this.colors[i3] = p.color.r;
      this.colors[i3 + 1] = p.color.g;
      this.colors[i3 + 2] = p.color.b;
      this.sizesLife[i2] = p.size;
      this.sizesLife[i2 + 1] = p.life / p.maxLife;
    }
    (this.geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute('aColor') as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute('aSizeLife') as THREE.BufferAttribute).needsUpdate = true;
  }

  clearAll(): void {
    for (const p of this.pool) p.alive = false;
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.points);
    this.geo.dispose();
    this.mat.dispose();
    this.tex.dispose();
  }
}

/** Pooled expanding ring pulses (checkpoints, goal, seeds). */
export class RingPulses {
  private rings: Array<{ mesh: THREE.Mesh; life: number; maxLife: number; startScale: number; endScale: number }> = [];
  private geo: THREE.TorusGeometry;

  constructor(private scene: THREE.Scene) {
    this.geo = new THREE.TorusGeometry(1, 0.05, 6, 40);
    for (let i = 0; i < 6; i++) {
      const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
      const mesh = new THREE.Mesh(this.geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      scene.add(mesh);
      this.rings.push({ mesh, life: 0, maxLife: 1, startScale: 1, endScale: 3 });
    }
  }

  pulse(pos: THREE.Vector3, color: number, endScale = 3.2, life = 0.55): void {
    const r = this.rings.find((x) => x.life <= 0) ?? this.rings[0];
    r.life = life;
    r.maxLife = life;
    r.startScale = 0.5;
    r.endScale = endScale;
    r.mesh.position.copy(pos);
    r.mesh.visible = true;
    (r.mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
  }

  update(dt: number): void {
    for (const r of this.rings) {
      if (r.life <= 0) continue;
      r.life -= dt;
      const t = 1 - Math.max(0, r.life) / r.maxLife;
      const s = r.startScale + (r.endScale - r.startScale) * t;
      r.mesh.scale.setScalar(s);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.85;
      if (r.life <= 0) r.mesh.visible = false;
    }
  }

  dispose(): void {
    for (const r of this.rings) {
      this.scene.remove(r.mesh);
      (r.mesh.material as THREE.Material).dispose();
    }
    this.geo.dispose();
  }
}
