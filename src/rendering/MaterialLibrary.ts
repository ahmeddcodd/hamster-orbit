import * as THREE from 'three';
import type { Palette } from '../levels/types';

function hex(c: number): string {
  return `#${c.toString(16).padStart(6, '0')}`;
}

function makeCanvas(size: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas.getContext('2d')!;
}

function configure(tex: THREE.Texture, renderer: THREE.WebGLRenderer, srgb = true): THREE.Texture {
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

/** Procedural 2x2 checker tile (power-of-two, mipmapped, anisotropic). */
function checkerTexture(renderer: THREE.WebGLRenderer, a: number, b: number): THREE.CanvasTexture {
  const ctx = makeCanvas(128);
  ctx.fillStyle = hex(a);
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = hex(b);
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillRect(64, 64, 64, 64);
  const tex = new THREE.CanvasTexture(ctx.canvas);
  configure(tex, renderer);
  return tex;
}

/** Vertical candy-stripe texture for platform sides (echoes the reference towers). */
function stripeTexture(renderer: THREE.WebGLRenderer, base: number, stripe: number): THREE.CanvasTexture {
  const ctx = makeCanvas(128);
  ctx.fillStyle = hex(base);
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = hex(stripe);
  for (let x = 0; x < 128; x += 32) ctx.fillRect(x, 0, 16, 128);
  const tex = new THREE.CanvasTexture(ctx.canvas);
  configure(tex, renderer);
  return tex;
}

/**
 * Per-level material set built from the level palette. Shared aggressively
 * across every mesh in the level; disposed once on level unload.
 */
export class MaterialLibrary {
  readonly checkerTop: THREE.MeshStandardMaterial;
  readonly side: THREE.MeshStandardMaterial;
  readonly rail: THREE.MeshStandardMaterial;
  readonly accent: THREE.MeshStandardMaterial;
  readonly accentEmissive: THREE.MeshStandardMaterial;
  readonly glass: THREE.MeshPhysicalMaterial;
  readonly tar: THREE.MeshStandardMaterial;
  readonly gold: THREE.MeshPhysicalMaterial;
  readonly deco: THREE.MeshLambertMaterial;
  readonly hazardBody: THREE.MeshStandardMaterial;
  readonly hazardDanger: THREE.MeshStandardMaterial;
  private textures: THREE.Texture[] = [];
  private materials: THREE.Material[] = [];

  constructor(renderer: THREE.WebGLRenderer, readonly palette: Palette) {
    const checker = checkerTexture(renderer, palette.checkerA, palette.checkerB);
    const stripes = stripeTexture(renderer, palette.side, palette.sideStripe);
    this.textures.push(checker, stripes);

    this.checkerTop = new THREE.MeshStandardMaterial({ map: checker, roughness: 0.82, metalness: 0.02 });
    this.side = new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.85, metalness: 0.0 });
    this.rail = new THREE.MeshStandardMaterial({ color: palette.rail, roughness: 0.4, metalness: 0.35 });
    this.accent = new THREE.MeshStandardMaterial({ color: palette.accent, roughness: 0.5, metalness: 0.05 });
    this.accentEmissive = new THREE.MeshStandardMaterial({
      color: palette.accent,
      emissive: palette.accent,
      emissiveIntensity: 0.55,
      roughness: 0.4,
    });
    this.glass = new THREE.MeshPhysicalMaterial({
      color: 0xcfeaff,
      roughness: 0.08,
      metalness: 0,
      transparent: true,
      opacity: 0.42,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      side: THREE.DoubleSide,
    });
    this.tar = new THREE.MeshStandardMaterial({ color: 0x1d1a24, roughness: 0.95, metalness: 0.1 });
    this.gold = new THREE.MeshPhysicalMaterial({
      color: 0xffc23e,
      roughness: 0.22,
      metalness: 0.9,
      clearcoat: 0.6,
      emissive: 0xa06a00,
      emissiveIntensity: 0.35,
    });
    this.deco = new THREE.MeshLambertMaterial({ color: palette.side });
    this.hazardBody = new THREE.MeshStandardMaterial({ color: 0x8f9bb5, roughness: 0.45, metalness: 0.65 });
    this.hazardDanger = new THREE.MeshStandardMaterial({
      color: 0xe23d28,
      roughness: 0.5,
      metalness: 0.2,
      emissive: 0x611007,
      emissiveIntensity: 0.4,
    });
    this.materials.push(
      this.checkerTop,
      this.side,
      this.rail,
      this.accent,
      this.accentEmissive,
      this.glass,
      this.tar,
      this.gold,
      this.deco,
      this.hazardBody,
      this.hazardDanger
    );
  }

  dispose(): void {
    for (const m of this.materials) m.dispose();
    for (const t of this.textures) t.dispose();
    this.materials.length = 0;
    this.textures.length = 0;
  }
}

/**
 * Scale a BoxGeometry's UVs so the checker pattern tiles in consistent world
 * units on every face (no stretching regardless of platform size).
 */
export function scaleBoxUVs(geo: THREE.BoxGeometry, sx: number, sy: number, sz: number, tile = 3): void {
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z — 4 verts each
  const faceDims: Array<[number, number]> = [
    [sz, sy],
    [sz, sy],
    [sx, sz],
    [sx, sz],
    [sx, sy],
    [sx, sy],
  ];
  for (let face = 0; face < 6; face++) {
    const [du, dv] = faceDims[face];
    for (let v = 0; v < 4; v++) {
      const i = face * 4 + v;
      uv.setXY(i, uv.getX(i) * (du / tile), uv.getY(i) * (dv / tile));
    }
  }
  uv.needsUpdate = true;
}
