import * as THREE from 'three';
import { QUALITY_PRESETS, type QualityPreset, type QualityTier } from '../config/config';

/**
 * Owns the WebGLRenderer, sizing, pixel ratio, and quality tier switching.
 * Changing quality never recreates the renderer or resets game state.
 */
export class RendererManager {
  readonly renderer: THREE.WebGLRenderer;
  tier: QualityTier = 'medium';
  preset: QualityPreset = QUALITY_PRESETS.medium;
  onResize: ((w: number, h: number) => void) | null = null;
  private autoMode = true;
  private frameTimes: number[] = [];
  private frameCursor = 0;
  private badWindows = 0;
  private lastW = 0;
  private lastH = 0;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.9;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const initial = this.detectInitialTier();
    this.applyTier(initial, true);

    window.addEventListener('resize', this.handleResize);
    if ('ResizeObserver' in window) {
      new ResizeObserver(this.handleResize).observe(document.body);
    }
    this.handleResize();
  }

  private detectInitialTier(): QualityTier {
    const isMobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
    const cores = navigator.hardwareConcurrency ?? 4;
    if (isMobile && cores <= 4) return 'low';
    if (isMobile) return 'medium';
    return 'high';
  }

  setQualitySetting(setting: 'auto' | QualityTier): void {
    if (setting === 'auto') {
      this.autoMode = true;
      this.applyTier(this.detectInitialTier(), false);
    } else {
      this.autoMode = false;
      this.applyTier(setting, false);
    }
  }

  applyTier(tier: QualityTier, initial: boolean): void {
    if (!initial && tier === this.tier) return;
    this.tier = tier;
    this.preset = QUALITY_PRESETS[tier];
    this.renderer.shadowMap.enabled = this.preset.shadows;
    this.handleResize();
    // force shadow material recompile when toggling shadow maps
    this.renderer.shadowMap.needsUpdate = true;
  }

  private handleResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w === 0 || h === 0) return; // never resize to zero
    this.lastW = w;
    this.lastH = h;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.preset.dprCap));
    this.renderer.setSize(w, h);
    this.onResize?.(w, h);
  };

  get width(): number {
    return this.lastW;
  }

  get height(): number {
    return this.lastH;
  }

  get isPortrait(): boolean {
    return this.lastH > this.lastW;
  }

  /**
   * AUTO quality: monitor sustained frame time; step down after repeated poor
   * windows. Never oscillates upward automatically.
   */
  recordFrame(dtMs: number): void {
    if (!this.autoMode || this.tier === 'low') return;
    this.frameTimes[this.frameCursor++] = dtMs;
    if (this.frameCursor >= 90) {
      const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
      this.frameCursor = 0;
      if (avg > 22) {
        this.badWindows++;
        if (this.badWindows >= 2) {
          this.badWindows = 0;
          this.applyTier(this.tier === 'high' ? 'medium' : 'low', false);
        }
      } else {
        this.badWindows = 0;
      }
    }
  }
}
