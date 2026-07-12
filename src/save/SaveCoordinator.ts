import type { PlayablesBridge } from '../platform/PlayablesBridge';
import { parseSave, serializeSave, type SaveData } from './save';

/**
 * Owns the in-memory save state and coordinates writes:
 * - milestone saves flush immediately
 * - settings changes are debounced
 * - the bridge serializes actual writes and blocks save-before-load
 */
export class SaveCoordinator {
  data: SaveData;
  private loaded = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private bridge: PlayablesBridge) {
    this.data = parseSave('');
  }

  get isLoaded(): boolean {
    return this.loaded;
  }

  async load(): Promise<SaveData> {
    const raw = await this.bridge.loadSaveData();
    this.data = parseSave(raw);
    this.loaded = true;
    return this.data;
  }

  /** Immediate save for milestones (completion, unlock, new best, seed, campaign). */
  flush(): void {
    if (!this.loaded) return;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.data.updatedAt = Date.now();
    void this.bridge.saveData(serializeSave(this.data));
  }

  /** Debounced save for low-priority changes (settings sliders). */
  saveDebounced(delayMs = 900): void {
    if (!this.loaded) return;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.flush();
    }, delayMs);
  }

  resetProgress(): void {
    const settings = this.data.settings;
    this.data = parseSave('');
    this.data.settings = settings;
    this.flush();
  }
}
