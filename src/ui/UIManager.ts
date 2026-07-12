import { PRODUCT } from '../config/config';
import { formatRunTime } from '../gameplay/timer';
import { t } from '../localization/strings';
import type { SaveSettings } from '../save/save';

export type ScreenName =
  | 'none'
  | 'title'
  | 'levelSelect'
  | 'pause'
  | 'results'
  | 'failed'
  | 'settings'
  | 'campaign'
  | 'sprintResults'
  | 'error';

export interface UICallbacks {
  onPlay: () => void;
  onOpenLevelSelect: () => void;
  onOpenSettings: () => void;
  onOpenSprint: () => void;
  onSelectLevel: (n: number) => void;
  onBackToTitle: () => void;
  onCloseSettings: () => void;
  onResume: () => void;
  onRestart: () => void;
  onQuitToLevelSelect: () => void;
  onNextLevel: () => void;
  onReplay: () => void;
  onSettingsChanged: (s: SaveSettings) => void;
  onResetProgress: () => void;
  onErrorRetry: () => void;
  onUiSound: (kind: 'click' | 'focus' | 'back') => void;
}

export interface LevelCardData {
  number: number;
  name: string;
  difficulty: number;
  locked: boolean;
  completed: boolean;
  stars: number;
  bestTimeMs: number;
  bestScore: number;
  seedCount: number;
  chipColor: string;
  highlight: boolean;
}

export interface ResultsData {
  levelName: string;
  timeMs: number;
  prevBestMs: number;
  newBestTime: boolean;
  newBestScore: boolean;
  stars: number;
  starHint: string;
  runSeeds: number;
  score: number;
  failures: number;
  hasNext: boolean;
  breakdownRows: Array<[string, number]>;
}

export interface CampaignData {
  totalScore: number;
  totalStars: number;
  totalSeeds: number;
}

export interface SprintResultData {
  score: number;
  best: number;
  newBest: boolean;
  distance: number;
}

export interface FailedData {
  levelName: string;
}

export class UIManager {
  current: ScreenName = 'none';
  private screens = new Map<ScreenName, HTMLDivElement>();
  private dialog: HTMLDivElement;

  constructor(
    root: HTMLElement,
    private cb: UICallbacks
  ) {
    for (const name of [
      'title',
      'levelSelect',
      'pause',
      'results',
      'failed',
      'settings',
      'campaign',
      'sprintResults',
      'error',
    ] as ScreenName[]) {
      const el = document.createElement('div');
      el.className = 'screen';
      el.id = `screen-${name}`;
      root.appendChild(el);
      this.screens.set(name, el);
    }
    this.dialog = document.createElement('div');
    this.dialog.className = 'dialog-backdrop';
    root.appendChild(this.dialog);

    // UI focus sounds via delegation
    root.addEventListener('focusin', (e) => {
      if ((e.target as HTMLElement).tagName === 'BUTTON') this.cb.onUiSound('focus');
    });
  }

  show(name: ScreenName): void {
    this.current = name;
    for (const [n, el] of this.screens) el.classList.toggle('visible', n === name);
    if (name !== 'none') {
      const el = this.screens.get(name);
      // focus first button for keyboard nav
      requestAnimationFrame(() => el?.querySelector<HTMLButtonElement>('button')?.focus());
    }
  }

  hideAll(): void {
    this.show('none' as ScreenName);
  }

  private btn(label: string, cls: string, onClick: () => void, ariaLabel?: string): HTMLButtonElement {
    const b = document.createElement('button');
    b.className = `btn ${cls}`;
    b.textContent = label;
    if (ariaLabel) b.setAttribute('aria-label', ariaLabel);
    b.addEventListener('click', () => {
      this.cb.onUiSound('click');
      onClick();
    });
    return b;
  }

  // ------------------------------------------------------------------ title

  buildTitle(hasProgress: boolean, campaignComplete: boolean): void {
    const el = this.screens.get('title')!;
    el.innerHTML = `
      <h1 class="game-title">${PRODUCT.title}<span class="sub">${PRODUCT.subtitle}</span></h1>
      <div class="menu-buttons-row"></div>
      <div class="meta-line">${PRODUCT.developer} — ${t('version')}${PRODUCT.version}</div>
    `;
    const row = el.querySelector('.menu-buttons-row')!;
    row.appendChild(this.btn(t('play'), 'primary', this.cb.onPlay));
    if (hasProgress) row.appendChild(this.btn(t('levelSelect'), '', this.cb.onOpenLevelSelect));
    if (campaignComplete) row.appendChild(this.btn(t('sprintMode'), '', this.cb.onOpenSprint));
    row.appendChild(this.btn(t('settings'), 'subtle', this.cb.onOpenSettings));
  }

  // ------------------------------------------------------------ level select

  buildLevelSelect(cards: LevelCardData[], sprintUnlocked: boolean, bestSprint: number): void {
    const el = this.screens.get('levelSelect')!;
    el.innerHTML = `<h2 class="screen-heading">${t('levelSelect')}</h2><div class="level-grid"></div>`;
    const grid = el.querySelector('.level-grid')!;
    for (const c of cards) {
      const card = document.createElement('button');
      card.className = `level-card${c.locked ? ' locked' : ''}${c.highlight ? ' highlight' : ''}`;
      const stars = c.completed
        ? `<div class="stars">${'★'.repeat(c.stars)}${'☆'.repeat(3 - c.stars)}</div>`
        : '<div class="stars">&nbsp;</div>';
      const best = c.completed
        ? `<div class="best">${formatRunTime(c.bestTimeMs)} · ${c.bestScore}</div><div class="best">${t('seeds')}: ${c.seedCount}/3</div>`
        : c.locked
          ? `<div class="best">${t('lockedHint')}</div>`
          : `<div class="best">${'●'.repeat(c.difficulty)}${'○'.repeat(5 - c.difficulty)}</div>`;
      card.innerHTML = `
        <div class="num">${c.number}</div>
        <div class="name">${c.name}</div>
        ${stars}${best}
        <div class="chip" style="background:${c.chipColor}"></div>
      `;
      card.disabled = c.locked;
      card.setAttribute('aria-label', c.locked ? `Level ${c.number} locked` : `Play level ${c.number}: ${c.name}`);
      card.addEventListener('click', () => {
        this.cb.onUiSound('click');
        this.cb.onSelectLevel(c.number);
      });
      grid.appendChild(card);
    }
    if (sprintUnlocked) {
      const sprint = this.btn(`${t('sprintMode')}${bestSprint > 0 ? ` — ${t('best')} ${bestSprint}` : ''}`, 'primary', this.cb.onOpenSprint);
      el.appendChild(sprint);
    }
    el.appendChild(this.btn(t('back'), 'subtle', this.cb.onBackToTitle));
  }

  // ----------------------------------------------------------------- pause

  buildPause(): void {
    const el = this.screens.get('pause')!;
    el.className = 'screen dimmed';
    el.id = 'screen-pause';
    el.innerHTML = `<h2 class="screen-heading">${t('paused')}</h2><div class="menu-buttons-row"></div>`;
    const row = el.querySelector('.menu-buttons-row')!;
    row.appendChild(this.btn(t('resume'), 'primary', this.cb.onResume));
    row.appendChild(this.btn(t('restart'), '', this.cb.onRestart));
    row.appendChild(this.btn(t('settings'), '', this.cb.onOpenSettings));
    row.appendChild(this.btn(t('levelSelect'), 'subtle', this.cb.onQuitToLevelSelect));
  }

  // --------------------------------------------------------------- results

  showResults(d: ResultsData): void {
    const el = this.screens.get('results')!;
    el.className = 'screen dimmed';
    const starsHtml = Array.from({ length: 3 }, (_, i) => (i < d.stars ? '<span class="earned">★</span>' : '★')).join('');
    const rows = d.breakdownRows
      .filter(([, v]) => v !== 0)
      .map(([label, v]) => `<div class="results-row"><span>${label}</span><span class="value">+${v}</span></div>`)
      .join('');
    el.innerHTML = `
      <div class="results-panel">
        <h2 class="screen-heading">${d.levelName}</h2>
        ${d.newBestTime || d.newBestScore ? `<div class="new-best-tag">${t('newBest')}</div>` : ''}
        <div class="results-stars">${starsHtml}</div>
        <div class="results-hint">${d.starHint}</div>
        <div class="results-rows">
          <div class="results-row"><span>${t('time')}</span><span class="value">${formatRunTime(d.timeMs)}</span></div>
          ${d.prevBestMs > 0 ? `<div class="results-row"><span>${t('best')}</span><span class="value">${formatRunTime(Math.min(d.prevBestMs, d.timeMs))}</span></div>` : ''}
          <div class="results-row"><span>${t('seeds')}</span><span class="value">${d.runSeeds}/3</span></div>
          <div class="results-row"><span>${t('failures')}</span><span class="value">${d.failures}</span></div>
          ${rows}
          <div class="results-row total"><span>${t('score')}</span><span class="value">${d.score}</span></div>
        </div>
        <div class="menu-buttons-row"></div>
      </div>
    `;
    const row = el.querySelector('.menu-buttons-row')!;
    if (d.hasNext) row.appendChild(this.btn(t('nextLevel'), 'primary', this.cb.onNextLevel));
    row.appendChild(this.btn(t('replay'), d.hasNext ? '' : 'primary', this.cb.onReplay));
    row.appendChild(this.btn(t('levelSelect'), 'subtle', this.cb.onQuitToLevelSelect));
    this.show('results');
  }

  showFailed(d: FailedData): void {
    const el = this.screens.get('failed')!;
    el.className = 'screen dimmed';
    el.innerHTML = `
      <div class="results-panel">
        <h2 class="screen-heading">${t('timeUp')}</h2>
        <div class="results-hint">${d.levelName}</div>
        <div class="menu-buttons-row"></div>
      </div>
    `;
    const row = el.querySelector('.menu-buttons-row')!;
    row.appendChild(this.btn(t('tryAgain'), 'primary', this.cb.onReplay));
    row.appendChild(this.btn(t('levelSelect'), 'subtle', this.cb.onQuitToLevelSelect));
    this.show('failed');
  }

  // -------------------------------------------------------------- settings

  buildSettings(s: SaveSettings): void {
    const el = this.screens.get('settings')!;
    el.className = 'screen dimmed';
    el.innerHTML = `
      <div class="settings-panel">
        <h2 class="screen-heading">${t('settings')}</h2>
        <div class="setting-row">
          <label for="set-music">${t('musicVolume')}</label>
          <input id="set-music" type="range" min="0" max="100" value="${Math.round(s.musicVolume * 100)}" />
        </div>
        <div class="setting-row">
          <label for="set-fx">${t('effectsVolume')}</label>
          <input id="set-fx" type="range" min="0" max="100" value="${Math.round(s.effectsVolume * 100)}" />
        </div>
        <div class="setting-row">
          <label>${t('cameraShake')}</label>
          <button class="toggle-btn ${s.cameraShake ? 'on' : ''}" id="set-shake">${s.cameraShake ? 'ON' : 'OFF'}</button>
        </div>
        <div class="setting-row">
          <label>${t('reducedMotion')}</label>
          <button class="toggle-btn ${s.reducedMotion ? 'on' : ''}" id="set-motion">${s.reducedMotion ? 'ON' : 'OFF'}</button>
        </div>
        <div class="setting-row">
          <label>${t('quality')}</label>
          <button class="quality-btn" id="set-quality">${t('quality' + s.quality[0].toUpperCase() + s.quality.slice(1))}</button>
        </div>
        <button class="btn danger" id="set-reset">${t('resetProgress')}</button>
        <button class="btn subtle" id="set-back">${t('back')}</button>
      </div>
    `;
    const current: SaveSettings = { ...s };
    const emit = (): void => this.cb.onSettingsChanged({ ...current });
    el.querySelector<HTMLInputElement>('#set-music')!.addEventListener('input', (e) => {
      current.musicVolume = Number((e.target as HTMLInputElement).value) / 100;
      emit();
    });
    el.querySelector<HTMLInputElement>('#set-fx')!.addEventListener('input', (e) => {
      current.effectsVolume = Number((e.target as HTMLInputElement).value) / 100;
      emit();
    });
    const shakeBtn = el.querySelector<HTMLButtonElement>('#set-shake')!;
    shakeBtn.addEventListener('click', () => {
      current.cameraShake = !current.cameraShake;
      shakeBtn.classList.toggle('on', current.cameraShake);
      shakeBtn.textContent = current.cameraShake ? 'ON' : 'OFF';
      this.cb.onUiSound('click');
      emit();
    });
    const motionBtn = el.querySelector<HTMLButtonElement>('#set-motion')!;
    motionBtn.addEventListener('click', () => {
      current.reducedMotion = !current.reducedMotion;
      motionBtn.classList.toggle('on', current.reducedMotion);
      motionBtn.textContent = current.reducedMotion ? 'ON' : 'OFF';
      this.cb.onUiSound('click');
      emit();
    });
    const qualityBtn = el.querySelector<HTMLButtonElement>('#set-quality')!;
    qualityBtn.addEventListener('click', () => {
      const order: SaveSettings['quality'][] = ['auto', 'low', 'medium', 'high'];
      current.quality = order[(order.indexOf(current.quality) + 1) % order.length];
      qualityBtn.textContent = t('quality' + current.quality[0].toUpperCase() + current.quality.slice(1));
      this.cb.onUiSound('click');
      emit();
    });
    el.querySelector<HTMLButtonElement>('#set-reset')!.addEventListener('click', () => {
      this.cb.onUiSound('click');
      this.confirmDialog(t('resetConfirm'), t('confirm'), t('cancel'), () => this.cb.onResetProgress());
    });
    el.querySelector<HTMLButtonElement>('#set-back')!.addEventListener('click', () => {
      this.cb.onUiSound('back');
      this.cb.onCloseSettings();
    });
  }

  // ------------------------------------------------------ campaign complete

  showCampaignComplete(d: CampaignData): void {
    const el = this.screens.get('campaign')!;
    el.className = 'screen dimmed';
    el.innerHTML = `
      <h2 class="screen-heading">${t('campaignComplete')}</h2>
      <div class="results-hint">${t('congratulations')}</div>
      <div class="campaign-stats">
        <div class="stat-tile"><div class="value">${d.totalScore}</div><div class="label">${t('totalScore')}</div></div>
        <div class="stat-tile"><div class="value">${d.totalStars}/30</div><div class="label">${t('totalStars')}</div></div>
        <div class="stat-tile"><div class="value">${d.totalSeeds}/30</div><div class="label">${t('totalSeeds')}</div></div>
      </div>
      <div class="unlock-tag">🏅 ${t('goldRimUnlocked')}</div>
      <div class="unlock-tag">⚡ ${t('sprintUnlocked')}</div>
      <div class="menu-buttons-row"></div>
    `;
    const row = el.querySelector('.menu-buttons-row')!;
    row.appendChild(this.btn(t('playSprint'), 'primary', this.cb.onOpenSprint));
    row.appendChild(this.btn(t('replayFinal'), '', this.cb.onReplay));
    row.appendChild(this.btn(t('levelSelect'), 'subtle', this.cb.onQuitToLevelSelect));
    this.show('campaign');
  }

  // --------------------------------------------------------- sprint results

  showSprintResults(d: SprintResultData): void {
    const el = this.screens.get('sprintResults')!;
    el.className = 'screen dimmed';
    el.innerHTML = `
      <div class="results-panel">
        <h2 class="screen-heading">${t('sprintOver')}</h2>
        ${d.newBest ? `<div class="new-best-tag">${t('newBest')}</div>` : ''}
        <div class="results-rows">
          <div class="results-row"><span>${t('score')}</span><span class="value">${d.score}</span></div>
          <div class="results-row"><span>${t('distance')}</span><span class="value">${Math.round(d.distance)}m</span></div>
          <div class="results-row total"><span>${t('best')}</span><span class="value">${d.best}</span></div>
        </div>
        <div class="menu-buttons-row"></div>
      </div>
    `;
    const row = el.querySelector('.menu-buttons-row')!;
    row.appendChild(this.btn(t('tryAgain'), 'primary', this.cb.onOpenSprint));
    row.appendChild(this.btn(t('levelSelect'), 'subtle', this.cb.onQuitToLevelSelect));
    this.show('sprintResults');
  }

  // ------------------------------------------------------------------ error

  showError(message: string): void {
    const el = this.screens.get('error')!;
    el.innerHTML = `
      <h2 class="screen-heading">${t('errorTitle')}</h2>
      <div class="results-hint">${message}</div>
    `;
    el.appendChild(this.btn(t('errorRetry'), 'primary', this.cb.onErrorRetry));
    this.show('error');
  }

  // ----------------------------------------------------------------- dialog

  confirmDialog(message: string, yesLabel: string, noLabel: string, onYes: () => void): void {
    this.dialog.innerHTML = `<div class="dialog-box"><div>${message}</div><div class="menu-buttons-row"></div></div>`;
    const row = this.dialog.querySelector('.menu-buttons-row')!;
    row.appendChild(
      this.btn(yesLabel, 'danger', () => {
        this.dialog.classList.remove('visible');
        onYes();
      })
    );
    row.appendChild(this.btn(noLabel, 'subtle', () => this.dialog.classList.remove('visible')));
    this.dialog.classList.add('visible');
    requestAnimationFrame(() => this.dialog.querySelector<HTMLButtonElement>('button')?.focus());
  }

  get dialogOpen(): boolean {
    return this.dialog.classList.contains('visible');
  }

  closeDialog(): void {
    this.dialog.classList.remove('visible');
  }
}
