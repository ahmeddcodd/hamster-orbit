import * as THREE from 'three';
import { MaterialLibrary, scaleBoxUVs } from '../rendering/MaterialLibrary';

/**
 * Shared visual factories for course pieces. Every mesh returned here uses
 * the level's shared MaterialLibrary materials; geometries are per-mesh and
 * are disposed with the level via the tracked group.
 */

/** Checker-topped platform box (top checker, striped sides). */
export function platformMesh(sx: number, sy: number, sz: number, mats: MaterialLibrary, checkerTop = true): THREE.Mesh {
  const geo = new THREE.BoxGeometry(sx, sy, sz);
  scaleBoxUVs(geo, sx, sy, sz, 3);
  const top = checkerTop ? mats.checkerTop : mats.side;
  const mesh = new THREE.Mesh(geo, [mats.side, mats.side, top, mats.side, mats.side, mats.side]);
  mesh.receiveShadow = true;
  mesh.castShadow = sy > 1.2;
  return mesh;
}

export function boxMesh(sx: number, sy: number, sz: number, mat: THREE.Material): THREE.Mesh {
  const geo = new THREE.BoxGeometry(sx, sy, sz);
  if ((mat as THREE.MeshStandardMaterial).map) scaleBoxUVs(geo, sx, sy, sz, 3);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Flat painted route arrow (bold, like the reference screens). */
export function arrowMesh(mats: MaterialLibrary, scale = 1): THREE.Mesh {
  const shape = new THREE.Shape();
  // chevron arrow pointing +Z (drawn in XY, rotated flat)
  shape.moveTo(0, 1.1);
  shape.lineTo(0.85, 0.1);
  shape.lineTo(0.38, 0.1);
  shape.lineTo(0.38, -1.0);
  shape.lineTo(-0.38, -1.0);
  shape.lineTo(-0.38, 0.1);
  shape.lineTo(-0.85, 0.1);
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  const mesh = new THREE.Mesh(geo, mats.accentEmissive);
  // shape +Y maps to world -Z: arrow points toward -Z at yaw 0 (matches camera forward)
  mesh.rotation.x = -Math.PI / 2;
  mesh.scale.setScalar(scale);
  mesh.receiveShadow = false;
  mesh.castShadow = false;
  return mesh;
}

/** Paired checkered flag on a pole (checkpoints, goal). */
export function flagMesh(mats: MaterialLibrary, height = 2.2): THREE.Group {
  const g = new THREE.Group();
  const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, height, 6);
  const pole = new THREE.Mesh(poleGeo, mats.rail);
  pole.position.y = height / 2;
  pole.castShadow = true;
  const flagGeo = new THREE.PlaneGeometry(0.9, 0.55, 4, 2);
  const flag = new THREE.Mesh(flagGeo, mats.checkerTop);
  (flag.material as THREE.Material).side = THREE.DoubleSide;
  flag.position.set(0.48, height - 0.35, 0);
  flag.name = 'flagCloth';
  g.add(pole, flag);
  return g;
}

/** Goal pad: cylinder base + glowing ring + flags. */
export function goalMesh(mats: MaterialLibrary, radius = 2.2): THREE.Group {
  const g = new THREE.Group();
  const baseGeo = new THREE.CylinderGeometry(radius, radius + 0.25, 0.3, 28);
  const base = new THREE.Mesh(baseGeo, mats.accent);
  base.position.y = 0.15;
  base.receiveShadow = true;
  const ringGeo = new THREE.TorusGeometry(radius * 0.82, 0.09, 8, 36);
  const ring = new THREE.Mesh(ringGeo, mats.accentEmissive);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.34;
  ring.name = 'goalRing';
  const f1 = flagMesh(mats, 2.4);
  f1.position.set(-radius - 0.4, 0, 0);
  const f2 = flagMesh(mats, 2.4);
  f2.position.set(radius + 0.4, 0, 0);
  g.add(base, ring, f1, f2);
  return g;
}

/** Golden sunflower seed collectible (teardrop-ish flattened sphere). */
export function seedMesh(mats: MaterialLibrary): THREE.Mesh {
  const geo = new THREE.SphereGeometry(0.3, 14, 12);
  geo.scale(0.72, 1, 0.34);
  // taper the top into a seed point
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y > 0) {
      const k = 1 - (y / 0.3) * 0.55;
      pos.setX(i, pos.getX(i) * k);
      pos.setZ(i, pos.getZ(i) * k);
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mats.gold);
  mesh.castShadow = true;
  return mesh;
}

/** Decorative tower / pillar / arch / ring landmark shapes. */
export function decoMesh(
  kind: 'tower' | 'arch' | 'pillar' | 'ring' | 'flag',
  s: [number, number, number],
  mats: MaterialLibrary
): THREE.Object3D {
  switch (kind) {
    case 'tower': {
      const g = new THREE.Group();
      const body = platformMesh(s[0], s[1], s[2], mats, true);
      body.position.y = -s[1] / 2;
      const cap = platformMesh(s[0] * 1.15, 0.5, s[2] * 1.15, mats, true);
      cap.position.y = 0.25;
      g.add(body, cap);
      return g;
    }
    case 'pillar': {
      const geo = new THREE.CylinderGeometry(s[0] / 2, s[0] / 2, s[1], 14);
      const m = new THREE.Mesh(geo, mats.side);
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    }
    case 'arch': {
      const g = new THREE.Group();
      const legGeo = new THREE.BoxGeometry(0.6, s[1], 0.6);
      const l1 = new THREE.Mesh(legGeo, mats.deco);
      l1.position.set(-s[0] / 2, s[1] / 2 - s[1], 0);
      const l2 = new THREE.Mesh(legGeo.clone(), mats.deco);
      l2.position.set(s[0] / 2, s[1] / 2 - s[1], 0);
      const topGeo = new THREE.BoxGeometry(s[0] + 0.6, 0.6, 0.8);
      const top = new THREE.Mesh(topGeo, mats.accent);
      top.position.y = 0.3;
      l1.position.y = -s[1] / 2;
      l2.position.y = -s[1] / 2;
      g.add(l1, l2, top);
      return g;
    }
    case 'ring': {
      const geo = new THREE.TorusGeometry(s[0], s[1] || 0.4, 10, 40);
      const m = new THREE.Mesh(geo, mats.accent);
      m.castShadow = true;
      return m;
    }
    case 'flag':
      return flagMesh(mats, s[1] || 2.2);
  }
}

/** Recursively dispose all geometries owned by a level group (materials are shared, disposed by the library). */
export function disposeGroupGeometries(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
  });
}
