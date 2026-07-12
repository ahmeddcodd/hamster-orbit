/**
 * Type declarations for the subset of the YouTube Playables SDK this game uses.
 * The SDK is loaded via <script src="https://www.youtube.com/game_api/v1"> in index.html.
 */

interface YTGameSdk {
  readonly IN_PLAYABLES_ENV: boolean;
  readonly SDK_VERSION?: string;
  game: {
    firstFrameReady(): void;
    gameReady(): void;
    loadData(): Promise<string>;
    saveData(data: string): Promise<void>;
  };
  system: {
    isAudioEnabled(): boolean;
    onAudioEnabledChange(callback: (isAudioEnabled: boolean) => void): void;
    onPause(callback: () => void): void;
    onResume(callback: () => void): void;
    getLanguage(): Promise<string>;
  };
  engagement: {
    sendScore(score: { value: number }): Promise<void>;
  };
  health?: {
    logError?(): void;
    logWarning?(): void;
  };
}

declare global {
  interface Window {
    ytgame?: YTGameSdk;
  }
}

export {};
