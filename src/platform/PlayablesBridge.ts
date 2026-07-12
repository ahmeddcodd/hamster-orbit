import { PRODUCT, DEBUG } from '../config/config';

/**
 * All YouTube Playables SDK usage lives behind this bridge. The rest of the
 * game depends only on this interface, and a local-development fallback keeps
 * everything working outside the Playables environment.
 */
export class PlayablesBridge {
  private firstFrameReadyCalled = false;
  private gameReadyCalled = false;
  private loadSettled = false;
  private saveInFlight = false;
  private pendingSave: string | null = null;
  private audioListeners: Array<(enabled: boolean) => void> = [];
  private pauseListeners: Array<() => void> = [];
  private resumeListeners: Array<() => void> = [];
  private devAudioEnabled = true;

  get isAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.ytgame;
  }

  get isInPlayablesEnvironment(): boolean {
    return this.isAvailable && window.ytgame!.IN_PLAYABLES_ENV === true;
  }

  initialize(): void {
    if (!this.isAvailable) {
      if (DEBUG.enabled) console.info('[Bridge] ytgame SDK not present — using local dev fallback');
      return;
    }
    const yt = window.ytgame!;
    try {
      yt.system.onAudioEnabledChange((enabled) => {
        for (const fn of this.audioListeners) fn(enabled);
      });
      yt.system.onPause(() => {
        for (const fn of this.pauseListeners) fn();
      });
      yt.system.onResume(() => {
        for (const fn of this.resumeListeners) fn();
      });
    } catch (e) {
      this.logWarning('SDK subscription failed', e);
    }
  }

  notifyFirstFrameReady(): void {
    if (this.firstFrameReadyCalled) {
      if (DEBUG.enabled) console.warn('[Bridge] duplicate firstFrameReady call blocked');
      return;
    }
    this.firstFrameReadyCalled = true;
    try {
      window.ytgame?.game.firstFrameReady();
    } catch (e) {
      this.logWarning('firstFrameReady failed', e);
    }
  }

  notifyGameReady(): void {
    if (!this.firstFrameReadyCalled) {
      const msg = '[Bridge] gameReady called before firstFrameReady';
      if (DEBUG.enabled) throw new Error(msg);
      console.warn(msg);
      this.notifyFirstFrameReady();
    }
    if (this.gameReadyCalled) {
      if (DEBUG.enabled) console.warn('[Bridge] duplicate gameReady call blocked');
      return;
    }
    this.gameReadyCalled = true;
    try {
      window.ytgame?.game.gameReady();
    } catch (e) {
      this.logWarning('gameReady failed', e);
    }
  }

  async loadSaveData(): Promise<string> {
    try {
      let data = '';
      if (this.isInPlayablesEnvironment) {
        data = await window.ytgame!.game.loadData();
      } else {
        data = localStorage.getItem(PRODUCT.saveKey) ?? '';
      }
      this.loadSettled = true;
      return data;
    } catch (e) {
      this.logWarning('loadData failed', e);
      this.loadSettled = true;
      return '';
    }
  }

  /** Serialized save queue: never saves before load settles, never overlaps writes. */
  async saveData(data: string): Promise<void> {
    if (!this.loadSettled) {
      if (DEBUG.enabled) console.warn('[Bridge] save rejected: load not settled yet');
      return;
    }
    if (this.saveInFlight) {
      this.pendingSave = data;
      return;
    }
    this.saveInFlight = true;
    try {
      if (this.isInPlayablesEnvironment) {
        await window.ytgame!.game.saveData(data);
      } else {
        localStorage.setItem(PRODUCT.saveKey, data);
      }
    } catch (e) {
      this.logWarning('saveData failed', e);
    } finally {
      this.saveInFlight = false;
      if (this.pendingSave !== null) {
        const next = this.pendingSave;
        this.pendingSave = null;
        void this.saveData(next);
      }
    }
  }

  async sendScore(value: number): Promise<boolean> {
    if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0 || value >= Number.MAX_SAFE_INTEGER) {
      this.logWarning('sendScore rejected invalid value', value);
      return false;
    }
    if (!this.isInPlayablesEnvironment) {
      if (DEBUG.enabled) console.info(`[Bridge] (dev) sendScore ${value}`);
      return true;
    }
    try {
      await window.ytgame!.engagement.sendScore({ value });
      return true;
    } catch (e) {
      this.logWarning('sendScore failed', e);
      return false;
    }
  }

  async getLanguage(): Promise<string> {
    try {
      if (this.isInPlayablesEnvironment) return await window.ytgame!.system.getLanguage();
    } catch {
      /* fall through to default */
    }
    return 'en';
  }

  isAudioEnabled(): boolean {
    if (this.isInPlayablesEnvironment) {
      try {
        return window.ytgame!.system.isAudioEnabled();
      } catch {
        return true;
      }
    }
    return this.devAudioEnabled;
  }

  subscribeAudioEnabledChange(fn: (enabled: boolean) => void): void {
    this.audioListeners.push(fn);
  }

  subscribePause(fn: () => void): void {
    this.pauseListeners.push(fn);
  }

  subscribeResume(fn: () => void): void {
    this.resumeListeners.push(fn);
  }

  logWarning(msg: string, detail?: unknown): void {
    if (DEBUG.enabled) console.warn(`[Bridge] ${msg}`, detail ?? '');
    try {
      window.ytgame?.health?.logWarning?.();
    } catch {
      /* health logging is best-effort */
    }
  }

  logError(msg: string, detail?: unknown): void {
    console.error(`[Bridge] ${msg}`, detail ?? '');
    try {
      window.ytgame?.health?.logError?.();
    } catch {
      /* health logging is best-effort */
    }
  }
}
