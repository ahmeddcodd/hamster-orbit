import { formatTimeMs } from '../gameplay/timer';
import { t } from '../localization/strings';

/**
 * Gameplay HUD: top-center countdown timer, top-left score + level,
 * top-right seed icons + pause, banners, tutorial prompts, countdown overlay.
 * DOM writes are batched: only mutated when values actually change.
 */
export class Hud {
  private root: HTMLDivElement;
  private timerEl: HTMLDivElement;
  private timerValueEl: HTMLSpanElement;
  private scoreEl: HTMLDivElement;
  private levelEl: HTMLDivElement;
  private seedEls: HTMLDivElement[] = [];
  private bannerEl: HTMLDivElement;
  private tutorialEl: HTMLDivElement;
  private countdownEl: HTMLDivElement;
  private lastTimerText = '';
  private lastScore = -1;
  private timerState = '';
  private tutorialTimeout: ReturnType<typeof setTimeout> | null = null;
  onPause: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'hud';
    this.root.innerHTML = `
      <div class="hud-left">
        <div class="level-name"></div>
        <div class="score">0</div>
      </div>
      <div class="hud-timer"><span class="value">00.0</span><span class="target"></span></div>
      <div class="hud-right">
        <div class="hud-seeds">
          <div class="hud-seed"></div><div class="hud-seed"></div><div class="hud-seed"></div>
        </div>
        <button class="hud-pause" aria-label="Pause">&#10073;&#10073;</button>
      </div>
      <div class="hud-banner"></div>
      <div class="tutorial-prompt"></div>
      <div class="countdown-overlay"></div>
    `;
    parent.appendChild(this.root);
    this.timerEl = this.root.querySelector('.hud-timer')!;
    this.timerValueEl = this.root.querySelector('.hud-timer .value')!;
    this.scoreEl = this.root.querySelector('.score')!;
    this.levelEl = this.root.querySelector('.level-name')!;
    this.seedEls = Array.from(this.root.querySelectorAll('.hud-seed'));
    this.bannerEl = this.root.querySelector('.hud-banner')!;
    this.tutorialEl = this.root.querySelector('.tutorial-prompt')!;
    this.countdownEl = this.root.querySelector('.countdown-overlay')!;
    const pauseBtn = this.root.querySelector('.hud-pause')! as HTMLButtonElement;
    pauseBtn.addEventListener('click', () => this.onPause?.());
  }

  setVisible(v: boolean): void {
    this.root.classList.toggle('visible', v);
    if (!v) {
      this.hideTutorial();
      this.countdownEl.classList.remove('visible');
    }
  }

  setLevelName(text: string): void {
    this.levelEl.textContent = text;
  }

  setTargetTime(goldMs: number): void {
    this.root.querySelector('.hud-timer .target')!.textContent = `${t('goldTarget')}: ${formatTimeMs(goldMs)}`;
  }

  updateTimer(remainingMs: number): void {
    const text = formatTimeMs(remainingMs);
    if (text !== this.lastTimerText) {
      this.lastTimerText = text;
      this.timerValueEl.textContent = text;
    }
    const state = remainingMs <= 5000 ? 'urgent' : remainingMs <= 10000 ? 'warn' : '';
    if (state !== this.timerState) {
      this.timerState = state;
      this.timerEl.classList.toggle('warn', state === 'warn');
      this.timerEl.classList.toggle('urgent', state === 'urgent');
    }
  }

  /** Sprint mode: the timer slot shows distance instead of a countdown. */
  setCustomTimer(text: string): void {
    if (text !== this.lastTimerText) {
      this.lastTimerText = text;
      this.timerValueEl.textContent = text;
    }
  }

  setSeedsVisible(v: boolean): void {
    (this.root.querySelector('.hud-seeds') as HTMLElement).style.display = v ? 'flex' : 'none';
  }

  updateScore(score: number): void {
    if (score !== this.lastScore) {
      this.lastScore = score;
      this.scoreEl.textContent = String(score);
    }
  }

  updateSeeds(runMask: number, ownedMask: number): void {
    for (let i = 0; i < 3; i++) {
      const el = this.seedEls[i];
      const run = ((runMask >> i) & 1) === 1;
      const owned = ((ownedMask >> i) & 1) === 1;
      el.classList.toggle('collected', run);
      el.classList.toggle('owned', !run && owned);
    }
  }

  banner(text: string): void {
    this.bannerEl.textContent = text;
    this.bannerEl.classList.remove('show');
    void this.bannerEl.offsetWidth;
    this.bannerEl.classList.add('show');
  }

  tutorial(text: string, seconds = 3.2): void {
    this.tutorialEl.textContent = text;
    this.tutorialEl.classList.add('show');
    if (this.tutorialTimeout) clearTimeout(this.tutorialTimeout);
    this.tutorialTimeout = setTimeout(() => this.hideTutorial(), seconds * 1000);
  }

  hideTutorial(): void {
    this.tutorialEl.classList.remove('show');
  }

  countdown(text: string): void {
    this.countdownEl.classList.add('visible');
    this.countdownEl.innerHTML = `<div class="countdown-num">${text}</div>`;
  }

  hideCountdown(): void {
    this.countdownEl.classList.remove('visible');
    this.countdownEl.innerHTML = '';
  }
}
