import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Palette } from '../levels/types';
import { mulberry32 } from '../utils/math';

const SKY_VERT = /* glsl */ `
varying vec3 vWorldPos;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const SKY_FRAG = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uVoid;
varying vec3 vWorldPos;
void main() {
  float h = normalize(vWorldPos).y;
  vec3 col = h > 0.0
    ? mix(uHorizon, uTop, smoothstep(0.0, 0.55, h))
    : mix(uHorizon, uVoid, smoothstep(0.0, -0.65, h));
  gl_FragColor = vec4(col, 1.0);
}
`;

/**
 * Per-level environment: gradient sky dome, fog, the AAA three-light rig
 * (sun + hemisphere + low ambient), PMREM reflections, and a floating
 * background skyline for depth.
 */
export class Environment {
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly ambient: THREE.AmbientLight;
  private skyDome: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private skyline: THREE.InstancedMesh | null = null;
  private skylineGeo: THREE.BoxGeometry | null = null;
  private skylineMat: THREE.MeshLambertMaterial | null = null;
  private static pmremTexture: THREE.Texture | null = null;
  private readonly sunTargetOffset = new THREE.Vector3(14, 26, 10);

  constructor(
    private scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    shadowMapSize: number
  ) {
    // PMREM environment for PBR reflections — generated once, shared for the app lifetime
    if (!Environment.pmremTexture) {
      const pmrem = new THREE.PMREMGenerator(renderer);
      Environment.pmremTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
    }
    scene.environment = Environment.pmremTexture;
    scene.environmentIntensity = 0.22;

    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: {
        uTop: { value: new THREE.Color(0x7ec8f7) },
        uHorizon: { value: new THREE.Color(0xdff2ff) },
        uVoid: { value: new THREE.Color(0x1a2b6d) },
      },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.skyDome = new THREE.Mesh(new THREE.SphereGeometry(420, 24, 16), this.skyMat);
    this.skyDome.frustumCulled = false;
    scene.add(this.skyDome);

    this.sun = new THREE.DirectionalLight(0xfff4e0, 1.55);
    this.sun.position.copy(this.sunTargetOffset);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
    this.sun.shadow.camera.near = 4;
    this.sun.shadow.camera.far = 90;
    this.sun.shadow.camera.left = -24;
    this.sun.shadow.camera.right = 24;
    this.sun.shadow.camera.top = 24;
    this.sun.shadow.camera.bottom = -24;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.02;
    scene.add(this.sun, this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8a6a4a, 0.5);
    scene.add(this.hemi);

    this.ambient = new THREE.AmbientLight(0xffffff, 0.18);
    scene.add(this.ambient);
  }

  applyPalette(palette: Palette): void {
    (this.skyMat.uniforms.uTop.value as THREE.Color).setHex(palette.sky);
    (this.skyMat.uniforms.uHorizon.value as THREE.Color).setHex(palette.skyLow);
    (this.skyMat.uniforms.uVoid.value as THREE.Color).setHex(palette.rail);
    this.scene.fog = new THREE.Fog(palette.fog, 55, 240);
    this.hemi.color.setHex(palette.skyLow);
    this.hemi.groundColor.setHex(palette.side);
    this.buildSkyline(palette);
  }

  /** Distant floating low-poly towers — one instanced draw call. */
  private buildSkyline(palette: Palette): void {
    this.disposeSkyline();
    const count = 34;
    this.skylineGeo = new THREE.BoxGeometry(1, 1, 1);
    this.skylineMat = new THREE.MeshLambertMaterial({ color: palette.side });
    this.skyline = new THREE.InstancedMesh(this.skylineGeo, this.skylineMat, count);
    const rng = mulberry32(palette.sky);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = 90 + rng() * 130;
      p.set(Math.cos(angle) * dist, -35 + rng() * 55, Math.sin(angle) * dist);
      s.set(6 + rng() * 14, 20 + rng() * 60, 6 + rng() * 14);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * Math.PI);
      m.compose(p, q, s);
      this.skyline.setMatrixAt(i, m);
    }
    this.skyline.instanceMatrix.needsUpdate = true;
    this.skyline.castShadow = false;
    this.skyline.receiveShadow = false;
    this.scene.add(this.skyline);
  }

  /** Keep the shadow frustum + sky dome centred on the action. */
  follow(target: THREE.Vector3): void {
    this.sun.position.copy(target).add(this.sunTargetOffset);
    this.sun.target.position.copy(target);
    this.skyDome.position.copy(target);
  }

  setShadowMapSize(size: number): void {
    this.sun.shadow.mapSize.set(size, size);
    if (this.sun.shadow.map) {
      this.sun.shadow.map.dispose();
      this.sun.shadow.map = null;
    }
  }

  private disposeSkyline(): void {
    if (this.skyline) {
      this.scene.remove(this.skyline);
      this.skyline.dispose();
      this.skylineGeo?.dispose();
      this.skylineMat?.dispose();
      this.skyline = null;
    }
  }

  dispose(): void {
    this.disposeSkyline();
    this.scene.remove(this.skyDome, this.sun, this.sun.target, this.hemi, this.ambient);
    (this.skyDome.geometry as THREE.BufferGeometry).dispose();
    this.skyMat.dispose();
  }
}
