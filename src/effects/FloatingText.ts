import * as THREE from 'three';

const _v = new THREE.Vector3();

/**
 * Pooled HTML floating score labels ("SEED +500"). Position is projected once
 * at spawn; CSS animation handles the float — zero per-frame DOM work.
 */
export class FloatingText {
  private pool: HTMLDivElement[] = [];
  private cursor = 0;

  constructor(root: HTMLElement) {
    for (let i = 0; i < 8; i++) {
      const el = document.createElement('div');
      el.className = 'floating-text';
      root.appendChild(el);
      this.pool.push(el);
    }
  }

  show(worldPos: THREE.Vector3, camera: THREE.Camera, text: string, cssClass = ''): void {
    _v.copy(worldPos).project(camera);
    if (_v.z > 1) return; // behind camera
    const x = (_v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-_v.y * 0.5 + 0.5) * window.innerHeight;
    const el = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.pool.length;
    el.className = `floating-text ${cssClass}`;
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    // restart the CSS animation
    el.classList.remove('animate');
    void el.offsetWidth;
    el.classList.add('animate');
  }

  showCenter(text: string, cssClass = ''): void {
    const el = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.pool.length;
    el.className = `floating-text center ${cssClass}`;
    el.textContent = text;
    el.style.left = '50%';
    el.style.top = '38%';
    el.classList.remove('animate');
    void el.offsetWidth;
    el.classList.add('animate');
  }

  dispose(): void {
    for (const el of this.pool) el.remove();
  }
}
