/**
 * Unified input: pointer-drag analog joystick (touch + mouse) plus WASD/arrows.
 * Produces a single analog move vector in screen space (x = right, y = forward).
 */
export class InputManager {
  /** analog move vector, magnitude 0..1 */
  moveX = 0;
  moveY = 0;
  onPauseRequest: (() => void) | null = null;
  onRestartRequest: (() => void) | null = null;
  onAnyKey: (() => void) | null = null;

  private pointerId: number | null = null;
  private originX = 0;
  private originY = 0;
  private dragX = 0;
  private dragY = 0;
  private keys = new Set<string>();
  private enabled = false;
  private joyBase: HTMLDivElement;
  private joyKnob: HTMLDivElement;
  private joyRadius = 64;
  private surface: HTMLElement;

  constructor(surface: HTMLElement, uiRoot: HTMLElement) {
    this.surface = surface;
    this.joyBase = document.createElement('div');
    this.joyBase.className = 'joystick-base';
    this.joyKnob = document.createElement('div');
    this.joyKnob.className = 'joystick-knob';
    this.joyBase.appendChild(this.joyKnob);
    uiRoot.appendChild(this.joyBase);

    surface.style.touchAction = 'none';
    surface.addEventListener('pointerdown', this.onPointerDown);
    surface.addEventListener('pointermove', this.onPointerMove);
    surface.addEventListener('pointerup', this.onPointerEnd);
    surface.addEventListener('pointercancel', this.onPointerEnd);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.clearActive();
  }

  /** Drop any held pointer/keys (used on pause, respawn, resume). */
  clearActive(): void {
    this.pointerId = null;
    this.dragX = 0;
    this.dragY = 0;
    this.keys.clear();
    this.moveX = 0;
    this.moveY = 0;
    this.joyBase.classList.remove('active');
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.onAnyKey?.();
    if (!this.enabled || this.pointerId !== null) return;
    this.pointerId = e.pointerId;
    this.originX = e.clientX;
    this.originY = e.clientY;
    this.dragX = 0;
    this.dragY = 0;
    try {
      this.surface.setPointerCapture(e.pointerId);
    } catch {
      /* capture unsupported is fine */
    }
    this.joyBase.classList.add('active');
    this.joyBase.style.left = `${this.originX}px`;
    this.joyBase.style.top = `${this.originY}px`;
    this.joyKnob.style.transform = 'translate(-50%, -50%)';
    this.updateVector();
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    this.dragX = e.clientX - this.originX;
    this.dragY = e.clientY - this.originY;
    const len = Math.hypot(this.dragX, this.dragY);
    if (len > this.joyRadius) {
      const s = this.joyRadius / len;
      // walk the origin toward the pointer so direction reversals feel immediate
      this.originX += this.dragX * (1 - s) * 0.35;
      this.originY += this.dragY * (1 - s) * 0.35;
      this.dragX = e.clientX - this.originX;
      this.dragY = e.clientY - this.originY;
      const l2 = Math.hypot(this.dragX, this.dragY);
      if (l2 > this.joyRadius) {
        this.dragX *= this.joyRadius / l2;
        this.dragY *= this.joyRadius / l2;
      }
      this.joyBase.style.left = `${this.originX}px`;
      this.joyBase.style.top = `${this.originY}px`;
    }
    this.joyKnob.style.transform = `translate(calc(-50% + ${this.dragX}px), calc(-50% + ${this.dragY}px))`;
    this.updateVector();
  };

  private onPointerEnd = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.dragX = 0;
    this.dragY = 0;
    this.joyBase.classList.remove('active');
    this.updateVector();
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    // Never preventDefault on Escape (platform requirement)
    const k = e.key.toLowerCase();
    if (k === 'escape') {
      this.onPauseRequest?.();
      return;
    }
    this.onAnyKey?.();
    if (k === 'p') {
      this.onPauseRequest?.();
      return;
    }
    if (k === 'r') {
      this.onRestartRequest?.();
      return;
    }
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
      if (k.startsWith('arrow')) e.preventDefault();
      this.keys.add(k);
      this.updateVector();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.key.toLowerCase());
    this.updateVector();
  };

  private onBlur = (): void => {
    this.clearActive();
  };

  private updateVector(): void {
    if (!this.enabled) {
      this.moveX = 0;
      this.moveY = 0;
      return;
    }
    let x = 0;
    let y = 0;
    if (this.pointerId !== null) {
      x = this.dragX / this.joyRadius;
      y = -this.dragY / this.joyRadius; // screen up = forward
    }
    if (this.keys.has('w') || this.keys.has('arrowup')) y += 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) y -= 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    // dead zone
    if (Math.hypot(x, y) < 0.1) {
      x = 0;
      y = 0;
    }
    this.moveX = x;
    this.moveY = y;
  }

  dispose(): void {
    this.surface.removeEventListener('pointerdown', this.onPointerDown);
    this.surface.removeEventListener('pointermove', this.onPointerMove);
    this.surface.removeEventListener('pointerup', this.onPointerEnd);
    this.surface.removeEventListener('pointercancel', this.onPointerEnd);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }
}
