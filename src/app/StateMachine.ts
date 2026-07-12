import { DEBUG } from '../config/config';

export enum GameState {
  BOOT = 'BOOT',
  LOADING = 'LOADING',
  TITLE = 'TITLE',
  LEVEL_SELECT = 'LEVEL_SELECT',
  LEVEL_LOADING = 'LEVEL_LOADING',
  COUNTDOWN = 'COUNTDOWN',
  PLAYING = 'PLAYING',
  RESPAWNING = 'RESPAWNING',
  MANUAL_PAUSE = 'MANUAL_PAUSE',
  PLATFORM_PAUSE = 'PLATFORM_PAUSE',
  LEVEL_COMPLETE = 'LEVEL_COMPLETE',
  LEVEL_FAILED = 'LEVEL_FAILED',
  CAMPAIGN_COMPLETE = 'CAMPAIGN_COMPLETE',
  SETTINGS = 'SETTINGS',
  ERROR = 'ERROR',
}

const ANY_PAUSE_SOURCES = [
  GameState.TITLE,
  GameState.LEVEL_SELECT,
  GameState.LEVEL_LOADING,
  GameState.COUNTDOWN,
  GameState.PLAYING,
  GameState.RESPAWNING,
  GameState.MANUAL_PAUSE,
  GameState.LEVEL_COMPLETE,
  GameState.LEVEL_FAILED,
  GameState.CAMPAIGN_COMPLETE,
  GameState.SETTINGS,
  GameState.LOADING,
];

const TRANSITIONS: Record<GameState, GameState[]> = {
  [GameState.BOOT]: [GameState.LOADING, GameState.ERROR],
  [GameState.LOADING]: [GameState.TITLE, GameState.ERROR, GameState.PLATFORM_PAUSE],
  [GameState.TITLE]: [
    GameState.LEVEL_SELECT,
    GameState.LEVEL_LOADING,
    GameState.SETTINGS,
    GameState.PLATFORM_PAUSE,
  ],
  [GameState.LEVEL_SELECT]: [GameState.TITLE, GameState.LEVEL_LOADING, GameState.PLATFORM_PAUSE],
  [GameState.LEVEL_LOADING]: [GameState.COUNTDOWN, GameState.ERROR, GameState.PLATFORM_PAUSE],
  [GameState.COUNTDOWN]: [GameState.PLAYING, GameState.MANUAL_PAUSE, GameState.PLATFORM_PAUSE, GameState.LEVEL_LOADING],
  [GameState.PLAYING]: [
    GameState.RESPAWNING,
    GameState.MANUAL_PAUSE,
    GameState.PLATFORM_PAUSE,
    GameState.LEVEL_COMPLETE,
    GameState.LEVEL_FAILED,
    GameState.LEVEL_LOADING,
  ],
  [GameState.RESPAWNING]: [GameState.PLAYING, GameState.MANUAL_PAUSE, GameState.PLATFORM_PAUSE, GameState.LEVEL_FAILED, GameState.LEVEL_LOADING],
  [GameState.MANUAL_PAUSE]: [
    GameState.PLAYING,
    GameState.COUNTDOWN,
    GameState.RESPAWNING,
    GameState.LEVEL_LOADING,
    GameState.LEVEL_SELECT,
    GameState.TITLE,
    GameState.PLATFORM_PAUSE,
    GameState.SETTINGS,
  ],
  [GameState.PLATFORM_PAUSE]: ANY_PAUSE_SOURCES,
  [GameState.LEVEL_COMPLETE]: [
    GameState.LEVEL_LOADING,
    GameState.LEVEL_SELECT,
    GameState.CAMPAIGN_COMPLETE,
    GameState.PLATFORM_PAUSE,
  ],
  [GameState.LEVEL_FAILED]: [GameState.LEVEL_LOADING, GameState.LEVEL_SELECT, GameState.TITLE, GameState.PLATFORM_PAUSE],
  [GameState.CAMPAIGN_COMPLETE]: [
    GameState.LEVEL_SELECT,
    GameState.LEVEL_LOADING,
    GameState.TITLE,
    GameState.PLATFORM_PAUSE,
  ],
  [GameState.SETTINGS]: [GameState.TITLE, GameState.MANUAL_PAUSE, GameState.PLATFORM_PAUSE],
  [GameState.ERROR]: [],
};

export class StateMachine {
  private state: GameState = GameState.BOOT;
  private prePlatformPause: GameState = GameState.TITLE;
  private listeners: Array<(next: GameState, prev: GameState) => void> = [];

  get current(): GameState {
    return this.state;
  }

  get stateBeforePlatformPause(): GameState {
    return this.prePlatformPause;
  }

  onChange(fn: (next: GameState, prev: GameState) => void): void {
    this.listeners.push(fn);
  }

  canTransition(to: GameState): boolean {
    return TRANSITIONS[this.state]?.includes(to) ?? false;
  }

  transition(to: GameState): boolean {
    if (to === this.state) return false;
    // ERROR is reachable from every state (fatal failures can happen anywhere)
    if (to !== GameState.ERROR && !this.canTransition(to)) {
      if (DEBUG.logStateTransitions) {
        console.warn(`[StateMachine] illegal transition ${this.state} -> ${to}`);
      }
      return false;
    }
    const prev = this.state;
    if (to === GameState.PLATFORM_PAUSE) this.prePlatformPause = prev;
    this.state = to;
    if (DEBUG.logStateTransitions) console.info(`[State] ${prev} -> ${to}`);
    for (const fn of this.listeners) fn(to, prev);
    return true;
  }

  /** Whether gameplay simulation (physics, hazards, timer) advances. */
  get simulating(): boolean {
    return this.state === GameState.PLAYING || this.state === GameState.RESPAWNING;
  }

  /** Whether rendering should run at all (halted during platform pause). */
  get rendering(): boolean {
    return this.state !== GameState.PLATFORM_PAUSE && this.state !== GameState.BOOT;
  }

  get gameplayInputAllowed(): boolean {
    return this.state === GameState.PLAYING;
  }
}
