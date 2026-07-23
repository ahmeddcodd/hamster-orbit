import * as THREE from 'three';
import { GOAL_CFG, PHYSICS, PRODUCT, RESPAWN_CFG, SCORE_CFG, TIMING } from '../config/config';
import { GameState, StateMachine } from '../app/StateMachine';
import { PlayablesBridge } from '../platform/PlayablesBridge';
import { SaveCoordinator } from '../save/SaveCoordinator';
import { levelKey, LEVEL_COUNT, type SaveSettings } from '../save/save';
import { applyRunResult, totalSeeds, totalStars } from '../gameplay/progression';
import { computeLevelScore, countSeeds, selectScoreSubmission, type RunStats } from '../gameplay/score';
import { computeStars, starHint } from '../gameplay/stars';
import { RendererManager } from '../rendering/RendererManager';
import { Environment } from '../rendering/Environment';
import { PostFX } from '../rendering/PostFX';
import { MaterialLibrary } from '../rendering/MaterialLibrary';
import { PhysicsWorld } from '../physics/world';
import { Surface, BoxCollider } from '../physics/collider';
import { PlayerController } from '../player/PlayerController';
import { BallVisual } from '../player/BallVisual';
import { FollowCamera } from '../camera/FollowCamera';
import { InputManager } from '../input/InputManager';
import { AudioManager } from '../audio/AudioManager';
import { Particles, RingPulses } from '../effects/Particles';
import { FloatingText } from '../effects/FloatingText';
import { Hud } from '../ui/hud';
import { UIManager, type LevelCardData } from '../ui/UIManager';
import { buildLevel, type LevelRuntime } from '../levels/builder';
import { getLevel, LEVELS } from '../levels/registry';
import { PALETTES } from '../levels/types';
import { platformMesh, disposeGroupGeometries } from '../levels/meshes';
import { setLanguage, t } from '../localization/strings';
import { SprintRun } from './Sprint';
import { clamp01 } from '../utils/math';

type KillReason = 'void' | 'lethal';

interface RunState {
  elapsedMs: number;
  eventScore: number;
  runSeedMask: number;
  failures: number;
  shortcuts: Set<string>;
  knockouts: Set<string>;
  glass: Set<string>;
  checkpointIndex: number;
  countdown: number;
  countdownShown: number;
  respawnTimer: number;
  respawnTeleported: boolean;
  finishTimer: number;
  resultsShown: boolean;
  failTimer: number;
  warned10: boolean;
  warned5: boolean;
  lastUrgentTick: number;
  shownTutorials: Set<string>;
}

function freshRun(): RunState {
  return {
    elapsedMs: 0,
    eventScore: 0,
    runSeedMask: 0,
    failures: 0,
    shortcuts: new Set(),
    knockouts: new Set(),
    glass: new Set(),
    checkpointIndex: -1,
    countdown: 0,
    countdownShown: -1,
    respawnTimer: 0,
    respawnTeleported: false,
    finishTimer: 0,
    resultsShown: false,
    failTimer: 0,
    warned10: false,
    warned5: false,
    lastUrgentTick: 0,
    shownTutorials: new Set(),
  };
}

export class Game {
  readonly states = new StateMachine();
  readonly bridge = new PlayablesBridge();
  readonly save: SaveCoordinator;
  private rendererMgr: RendererManager;
  private scene = new THREE.Scene();
  private env: Environment;
  private postfx: PostFX;
  private world = new PhysicsWorld();
  private player: PlayerController;
  private ballVisual: BallVisual;
  private followCam: FollowCamera;
  private input: InputManager;
  private audio = new AudioManager();
  private particles: Particles;
  private rings: RingPulses;
  private floatText: FloatingText;
  private hud: Hud;
  private ui: UIManager;
  private clock = new THREE.Clock();
  private elapsedTime = 0;

  private mode: 'campaign' | 'sprint' = 'campaign';
  private level: LevelRuntime | null = null;
  private levelNumber = 1;
  private sprint: SprintRun | null = null;
  private run: RunState = freshRun();
  private menuBackdrop: { group: THREE.Group; mats: MaterialLibrary } | null = null;
  private settingsReturnState: GameState = GameState.TITLE;
  private levelSelectHighlight = 0;
  private booted = false;

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    this.save = new SaveCoordinator(this.bridge);
    this.rendererMgr = new RendererManager(canvas);
    this.followCam = new FollowCamera();
    this.env = new Environment(this.scene, this.rendererMgr.renderer, this.rendererMgr.preset.shadowMapSize);
    this.postfx = new PostFX(this.rendererMgr.renderer, this.scene, this.followCam.camera);
    this.player = new PlayerController(this.world);
    this.ballVisual = new BallVisual(this.scene);
    this.particles = new Particles(this.scene);
    this.rings = new RingPulses(this.scene);
    this.floatText = new FloatingText(uiRoot);
    this.hud = new Hud(uiRoot);
    this.input = new InputManager(canvas, uiRoot);

    this.ui = new UIManager(uiRoot, {
      onPlay: () => this.startLevel(Math.min(this.save.data.highestUnlockedLevel, LEVEL_COUNT)),
      onOpenLevelSelect: () => this.openLevelSelect(),
      onOpenSettings: () => this.openSettings(),
      onCloseSettings: () => this.closeSettings(),
      onOpenSprint: () => this.startSprint(),
      onSelectLevel: (n) => this.startLevel(n),
      onBackToTitle: () => this.goToTitle(),
      onResume: () => this.resumeFromPause(),
      onRestart: () => this.restartCurrent(),
      onQuitToLevelSelect: () => this.quitToLevelSelect(),
      onNextLevel: () => this.startLevel(Math.min(this.levelNumber + 1, LEVEL_COUNT)),
      onReplay: () => this.restartCurrent(),
      onSettingsChanged: (s) => {
        if (this.platformPaused) return;
        this.applySettings(s, true);
      },
      onResetProgress: () => {
        if (this.platformPaused) return;
        this.save.resetProgress();
        this.applySettings(this.save.data.settings, false);
        this.goToTitle();
      },
      onErrorRetry: () => window.location.reload(),
      onUiSound: (kind) => {
        if (this.platformPaused) return;
        this.audio.unlock();
        if (kind === 'click') this.audio.uiClick();
        else if (kind === 'back') this.audio.uiBack();
        else this.audio.uiFocus();
      },
    });

    this.wireInput();
    this.wirePlayerEvents();
    this.wirePlatform();
    this.installPlatformPauseGuard(uiRoot);
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__game = this; // dev QA handle
    }
    this.rendererMgr.onResize = (w, h) => {
      this.followCam.setAspect(w, h);
      this.postfx.setSize(w, h, this.rendererMgr.renderer.getPixelRatio());
    };
    this.rendererMgr.onResize(window.innerWidth, window.innerHeight);
  }

  // ------------------------------------------------------------------- boot

  async boot(): Promise<void> {
    const bootLabel = document.getElementById('boot-label');
    try {
      this.bridge.initialize();
      // wait one painted frame of the HTML loading UI, then report first frame
      // (setTimeout fallback covers environments that throttle rAF for hidden tabs)
      await new Promise<void>((resolve) => {
        let done = false;
        const finish = (): void => {
          if (!done) {
            done = true;
            resolve();
          }
        };
        requestAnimationFrame(finish);
        setTimeout(finish, 150);
      });
      this.bridge.notifyFirstFrameReady();
      this.states.transition(GameState.LOADING);

      if (bootLabel) bootLabel.textContent = 'Loading save';
      await this.save.load();
      setLanguage(await this.bridge.getLanguage());
      this.applySettings(this.save.data.settings, false);
      this.audio.setPlatformEnabled(this.bridge.isAudioEnabled());

      if (bootLabel) bootLabel.textContent = 'Preparing course';
      this.buildMenuBackdrop();
      this.ui.buildTitle(this.save.data.highestUnlockedLevel > 1, this.save.data.campaignCompleted);
      this.ui.buildPause();
      this.ui.show('title');
      this.states.transition(GameState.TITLE);

      document.getElementById('boot-loading')?.classList.add('hidden');
      this.startLoop();
      // title is now interactive
      this.bridge.notifyGameReady();
      this.booted = true;
    } catch (e) {
      this.bridge.logError('boot failed', e);
      document.getElementById('boot-loading')?.classList.add('hidden');
      this.states.transition(GameState.ERROR);
      this.ui.showError('The game failed to start.');
      if (!this.booted) this.startLoop();
    }
  }

  private startLoop(): void {
    this.clock.getDelta();
    const tick = (): void => {
      requestAnimationFrame(tick);
      const rawDt = this.clock.getDelta();
      const dt = Math.min(rawDt, PHYSICS.MAX_FRAME_DT);
      if (!this.states.rendering) return; // platform pause: halt entirely
      this.elapsedTime += dt;
      this.rendererMgr.recordFrame(rawDt * 1000);
      this.update(dt);
      this.postfx.enabled = this.rendererMgr.preset.bloom;
      this.postfx.render();
    };
    requestAnimationFrame(tick);
  }

  // ------------------------------------------------------------------ wiring

  private wireInput(): void {
    // Every keyboard entry point below listens on window, so the UI-root capture
    // guard cannot see it — each must refuse to act while the platform is paused.
    this.input.onAnyKey = () => {
      if (this.platformPaused) return; // never wake audio while YouTube has it paused
      if (this.bridge.isAudioEnabled()) this.audio.unlock();
    };
    this.input.onPauseRequest = () => {
      if (this.platformPaused) return;
      if (this.ui.dialogOpen) {
        this.ui.closeDialog();
        return;
      }
      const s = this.states.current;
      if (s === GameState.PLAYING || s === GameState.COUNTDOWN || s === GameState.RESPAWNING) this.pauseGame();
      else if (s === GameState.MANUAL_PAUSE) this.resumeFromPause();
      else if (s === GameState.SETTINGS) this.closeSettings();
      else if (s === GameState.LEVEL_SELECT) this.goToTitle();
    };
    this.input.onRestartRequest = () => {
      if (this.platformPaused) return;
      const s = this.states.current;
      if (s === GameState.PLAYING || s === GameState.RESPAWNING || s === GameState.MANUAL_PAUSE) this.restartCurrent();
    };
    this.hud.onPause = () => {
      if (this.platformPaused) return;
      const s = this.states.current;
      if (s === GameState.PLAYING || s === GameState.COUNTDOWN || s === GameState.RESPAWNING) this.pauseGame();
    };
  }

  private wirePlayerEvents(): void {
    this.player.events = {
      onImpact: (speed) => {
        if (!this.states.simulating) return;
        const k = clamp01((speed - 4.5) / 16);
        if (k > 0.15) {
          this.audio.bump(k);
          this.followCam.addTrauma(k * 0.25);
        }
      },
      onHardLanding: () => {
        this.audio.hardLand();
        this.followCam.addTrauma(0.3);
        this.particles.spawn({ pos: this.player.pos.clone(), count: 10, color: 0xd9d9e8, speed: 3, life: 0.4, dirY: 1 });
      },
      onLethalImpact: () => this.killPlayer('lethal'),
      onLethalHazard: () => this.killPlayer('lethal'),
      onSurface: (surface) => {
        if (surface === Surface.GLASS) this.audio.squeak();
      },
    };
  }

  private wirePlatform(): void {
    this.bridge.subscribeAudioEnabledChange((enabled) => {
      this.audio.setPlatformEnabled(enabled);
      // unmuting must not restart the context while the platform also has us paused
      if (enabled && !this.platformPaused) this.audio.unlock();
    });
    this.bridge.subscribePause(() => this.onPlatformPause());
    this.bridge.subscribeResume(() => this.onPlatformResume());
  }

  private onPlatformPause(): void {
    if (this.states.current === GameState.PLATFORM_PAUSE) return;
    this.states.transition(GameState.PLATFORM_PAUSE);
    this.input.setEnabled(false);
    this.input.clearActive();
    this.audio.suspend();
    this.save.flush();
    // Freeze the whole UI: while YouTube holds the pause the player must not be
    // able to click ANYTHING — not the HUD pause button, and not a results,
    // settings, pause or try-again overlay that happened to be open.
    this.setUiFrozen(true);
  }

  private onPlatformResume(): void {
    if (this.states.current !== GameState.PLATFORM_PAUSE) return;
    this.clock.getDelta(); // swallow the paused delta so physics never sees it
    this.audio.resume();
    const prior = this.states.stateBeforePlatformPause;
    if (prior === GameState.PLAYING || prior === GameState.COUNTDOWN || prior === GameState.RESPAWNING) {
      // never auto-resume gameplay: land on the manual pause menu
      this.states.resumePlatformPause(GameState.MANUAL_PAUSE);
      this.ui.show('pause');
    } else {
      this.states.resumePlatformPause(prior);
    }
    this.setUiFrozen(false);
    if (this.states.gameplayInputAllowed) this.input.setEnabled(true);
  }

  /** Platform pause owns all interaction: kill pointer events across the whole UI. */
  private setUiFrozen(frozen: boolean): void {
    document.body.classList.toggle('platform-paused', frozen);
  }

  /**
   * Capture-phase net over the whole UI. `pointer-events: none` stops mouse and
   * touch, but a button that already has focus can still be fired with Enter or
   * Space — so swallow those too, before any handler on the button can run.
   */
  private installPlatformPauseGuard(uiRoot: HTMLElement): void {
    const swallow = (e: Event): void => {
      if (!this.platformPaused) return;
      e.stopImmediatePropagation();
      e.preventDefault();
    };
    // `input`/`change` are included so focused range sliders and toggles cannot be
    // nudged either — pointer-events alone does not cover keyboard-driven changes.
    for (const type of ['click', 'pointerdown', 'pointerup', 'keydown', 'keyup', 'input', 'change'] as const) {
      uiRoot.addEventListener(type, swallow, true);
    }
  }

  /** True while YouTube holds the pause — every user entry point must bail out. */
  private get platformPaused(): boolean {
    return this.states.current === GameState.PLATFORM_PAUSE;
  }

  // -------------------------------------------------------------- settings

  private applySettings(s: SaveSettings, persist: boolean): void {
    this.save.data.settings = { ...s };
    this.audio.setVolumes(s.musicVolume, s.effectsVolume);
    this.followCam.shakeEnabled = s.cameraShake;
    this.rendererMgr.setQualitySetting(s.quality);
    this.env.setShadowMapSize(this.rendererMgr.preset.shadowMapSize);
    this.particles.cap = this.rendererMgr.preset.particleCap;
    if (persist) this.save.saveDebounced();
  }

  private openSettings(): void {
    const from = this.states.current;
    if (from !== GameState.TITLE && from !== GameState.MANUAL_PAUSE) return;
    this.settingsReturnState = from;
    if (this.states.transition(GameState.SETTINGS)) {
      this.ui.buildSettings(this.save.data.settings);
      this.ui.show('settings');
    }
  }

  private closeSettings(): void {
    if (this.states.current !== GameState.SETTINGS) return;
    this.save.flush();
    if (this.settingsReturnState === GameState.MANUAL_PAUSE) {
      this.states.transition(GameState.MANUAL_PAUSE);
      this.ui.show('pause');
    } else {
      this.states.transition(GameState.TITLE);
      this.ui.buildTitle(this.save.data.highestUnlockedLevel > 1, this.save.data.campaignCompleted);
      this.ui.show('title');
    }
  }

  // ------------------------------------------------------------- navigation

  private goToTitle(): void {
    this.states.transition(GameState.TITLE);
    if (this.states.current !== GameState.TITLE) return;
    this.unloadLevel();
    this.buildMenuBackdrop();
    this.ui.buildTitle(this.save.data.highestUnlockedLevel > 1, this.save.data.campaignCompleted);
    this.ui.show('title');
    this.hud.setVisible(false);
    this.audio.playMusic('title');
  }

  private openLevelSelect(): void {
    if (!this.states.transition(GameState.LEVEL_SELECT)) return;
    const cards: LevelCardData[] = LEVELS.map((def) => {
      const lp = this.save.data.levels[levelKey(def.number)];
      return {
        number: def.number,
        name: def.name,
        difficulty: def.difficulty,
        locked: !lp.unlocked,
        completed: lp.completed,
        stars: lp.stars,
        bestTimeMs: lp.bestTimeMs,
        bestScore: lp.bestScore,
        seedCount: countSeeds(lp.seedMask),
        chipColor: `#${def.palette.sky.toString(16).padStart(6, '0')}`,
        highlight: def.number === this.levelSelectHighlight,
      };
    });
    this.levelSelectHighlight = 0;
    this.ui.buildLevelSelect(cards, this.save.data.campaignCompleted, this.save.data.bestEndlessScore);
    this.ui.show('levelSelect');
    this.hud.setVisible(false);
  }

  private quitToLevelSelect(): void {
    this.unloadLevel();
    this.buildMenuBackdrop();
    this.openLevelSelect();
    this.audio.playMusic('title');
  }

  // ---------------------------------------------------------- level control

  private startLevel(n: number): void {
    const lp = this.save.data.levels[levelKey(n)];
    if (!lp || !lp.unlocked) return;
    if (!this.states.transition(GameState.LEVEL_LOADING)) return;
    this.mode = 'campaign';
    this.levelNumber = n;
    this.unloadLevel();
    const def = getLevel(n);

    this.level = buildLevel(
      def,
      this.scene,
      this.world,
      this.rendererMgr.renderer,
      {
        player: this.player,
        particles: this.particles,
        rings: this.rings,
        audio: this.audio,
        camera: this.followCam,
        killPlayer: () => this.killPlayer('lethal'),
        scoreEvent: (kind, id, pos) => this.onScoreEvent(kind, id, pos),
      },
      {
        onCheckpoint: (i) => this.onCheckpoint(i),
        onSeed: (i) => this.onSeed(i),
        onShortcut: (id) => this.onShortcut(id),
        onTutorial: (text) => this.onTutorial(text),
      }
    );
    this.level.resetRun(lp.seedMask);
    this.env.applyPalette(def.palette);
    this.followCam.occluders = this.level.occluders;
    this.ballVisual.setGlowColor(def.palette.glow);
    this.ballVisual.setRim(this.save.data.cosmetics.selectedRim === 'gold' || this.save.data.cosmetics.goldRimUnlocked);
    this.ballVisual.setVisible(true);
    this.ballVisual.hamster.setMood('normal');

    this.beginRun(def.start.p, def.start.yaw);
    this.hud.setLevelName(`${t('level')} ${def.number} — ${def.name}`);
    this.hud.setTargetTime(def.goldTimeMs);
    this.hud.setSeedsVisible(true);
    this.hud.updateSeeds(0, lp.seedMask);
    this.audio.playMusic(def.musicProfile);
    this.states.transition(GameState.COUNTDOWN);
  }

  private beginRun(startP: [number, number, number], startYaw: number): void {
    this.run = freshRun();
    this.run.countdown = TIMING.COUNTDOWN_STEP * 3;
    this.player.teleport(startP[0], startP[1] + PHYSICS.BALL_RADIUS + 0.3, startP[2]);
    this.player.controlEnabled = false;
    this.followCam.snap(this.player.pos, startYaw);
    this.input.clearActive();
    this.input.setEnabled(true);
    this.ui.hideAll();
    this.hud.setVisible(true);
    this.hud.updateScore(0);
  }

  private restartCurrent(): void {
    if (this.mode === 'sprint') {
      this.startSprint();
      return;
    }
    if (this.level) {
      const lp = this.save.data.levels[levelKey(this.levelNumber)];
      if (!this.states.transition(GameState.LEVEL_LOADING)) return;
      this.level.resetRun(lp.seedMask);
      this.hud.updateSeeds(0, lp.seedMask);
      this.beginRun(this.level.def.start.p, this.level.def.start.yaw);
      this.states.transition(GameState.COUNTDOWN);
    }
  }

  private unloadLevel(): void {
    if (this.level) {
      this.level.dispose();
      this.level = null;
    }
    if (this.sprint) {
      this.sprint.dispose();
      this.sprint = null;
    }
    if (this.menuBackdrop) {
      this.scene.remove(this.menuBackdrop.group);
      disposeGroupGeometries(this.menuBackdrop.group);
      this.menuBackdrop.mats.dispose();
      this.menuBackdrop = null;
    }
    this.world.clear();
    this.particles.clearAll();
    this.followCam.occluders = [];
  }

  private buildMenuBackdrop(): void {
    if (this.menuBackdrop) return;
    this.unloadLevel();
    const mats = new MaterialLibrary(this.rendererMgr.renderer, PALETTES.skyBlue);
    const group = new THREE.Group();
    const pad = platformMesh(9, 1.2, 9, mats);
    pad.position.set(0, -0.6, 0);
    group.add(pad);
    const tower = platformMesh(5, 14, 5, mats);
    tower.position.set(-9, -8, -7);
    group.add(tower);
    this.scene.add(group);
    const col = new BoxCollider('menu-pad').setBox(0, -0.6, 0, 9, 1.2, 9);
    this.world.add(col);
    this.env.applyPalette(PALETTES.skyBlue);
    this.player.teleport(0, 1.2, 0);
    this.ballVisual.setVisible(true);
    this.ballVisual.setGlowColor(PALETTES.skyBlue.glow);
    this.ballVisual.setRim(this.save.data.cosmetics.goldRimUnlocked);
    this.ballVisual.hamster.setMood('menu');
    this.menuBackdrop = { group, mats };
  }

  // -------------------------------------------------------------- sprint

  private startSprint(): void {
    if (!this.save.data.campaignCompleted) return;
    if (!this.states.transition(GameState.LEVEL_LOADING)) return;
    this.mode = 'sprint';
    this.unloadLevel();
    this.sprint = new SprintRun(
      (Math.random() * 0x7fffffff) | 0,
      this.scene,
      this.world,
      this.rendererMgr.renderer,
      this.particles,
      this.audio
    );
    this.env.applyPalette(this.sprint.palette);
    this.ballVisual.setGlowColor(this.sprint.palette.glow);
    this.ballVisual.setRim(true);
    this.ballVisual.hamster.setMood('normal');
    this.ballVisual.setVisible(true);
    this.beginRun([0, 0.6, 0], 0);
    this.hud.setLevelName(t('sprintMode'));
    this.hud.setSeedsVisible(false);
    this.hud.setCustomTimer('0m');
    this.audio.playMusic('final');
    this.states.transition(GameState.COUNTDOWN);
  }

  private endSprint(): void {
    if (!this.sprint) return;
    const score = this.sprint.score;
    const prevBest = this.save.data.bestEndlessScore;
    const newBest = score > prevBest;
    if (newBest) {
      this.save.data.bestEndlessScore = score;
      this.save.flush();
      this.audio.newBest();
    }
    this.audio.timeUp();
    this.states.transition(GameState.LEVEL_FAILED);
    this.hud.setVisible(false);
    this.input.setEnabled(false);
    this.ui.showSprintResults({
      score,
      best: Math.max(score, prevBest),
      newBest,
      distance: this.sprint.distance,
    });
  }

  // -------------------------------------------------------------- run events

  private onCheckpoint(index: number): void {
    if (this.states.current !== GameState.PLAYING || !this.level) return;
    const cp = this.level.checkpoints[index];
    if (!cp || cp.activated) return;
    // activate strictly in sequence
    if (index !== this.run.checkpointIndex + 1) return;
    cp.activated = true;
    this.run.checkpointIndex = index;
    this.audio.checkpoint();
    this.hud.banner(t('checkpoint'));
    this.rings.pulse(new THREE.Vector3(cp.spawn.x, cp.spawn.y + 0.3, cp.spawn.z), this.level.def.palette.accent);
  }

  private onSeed(index: number): void {
    if (this.states.current !== GameState.PLAYING || !this.level) return;
    const seed = this.level.seeds[index];
    if (!seed || seed.collectedThisRun) return;
    this.level.collectSeed(index);
    this.run.runSeedMask |= 1 << index;
    this.run.eventScore += SCORE_CFG.SEED;
    this.audio.seed();
    this.particles.spawn({ pos: seed.basePos.clone(), count: 12, color: 0xffd75e, color2: 0xfff2c4, speed: 3.4, life: 0.55 });
    this.floatText.show(seed.basePos, this.followCam.camera, `+${SCORE_CFG.SEED}`, '');
    const lp = this.save.data.levels[levelKey(this.levelNumber)];
    this.hud.updateSeeds(this.run.runSeedMask, lp.seedMask);
    this.hud.updateScore(this.run.eventScore);
  }

  private onShortcut(id: string): void {
    if (this.states.current !== GameState.PLAYING || this.run.shortcuts.has(id)) return;
    this.run.shortcuts.add(id);
    this.run.eventScore += SCORE_CFG.SHORTCUT;
    this.floatText.show(this.player.pos, this.followCam.camera, `SHORTCUT +${SCORE_CFG.SHORTCUT}`, 'big');
    this.audio.newBest();
    this.hud.updateScore(this.run.eventScore);
  }

  private onScoreEvent(kind: 'knockout' | 'glass', id: string, pos: THREE.Vector3): void {
    if (this.states.current !== GameState.PLAYING) return;
    const set = kind === 'knockout' ? this.run.knockouts : this.run.glass;
    if (set.has(id)) return;
    set.add(id);
    const points = kind === 'knockout' ? SCORE_CFG.KNOCKOUT : SCORE_CFG.GLASS;
    this.run.eventScore += points;
    this.floatText.show(pos, this.followCam.camera, `${kind === 'knockout' ? 'KNOCKOUT' : 'GLASS SMASH'} +${points}`, 'big');
    this.hud.updateScore(this.run.eventScore);
  }

  private onTutorial(text: string): void {
    if (this.states.current !== GameState.PLAYING) return;
    if (this.run.shownTutorials.has(text)) return;
    this.run.shownTutorials.add(text);
    this.hud.tutorial(text);
  }

  /**
   * The level is only complete when the ball actually lands on the flag circle:
   * its centre must be inside the pad radius AND it must be at pad height. Flying
   * over the pad is therefore a miss — the ball carries on, falls, and respawns at
   * the last checkpoint like any other fall.
   */
  private checkGoalReached(): void {
    if (!this.level || this.states.current !== GameState.PLAYING) return;
    const goal = this.level.def.goal;
    const radius = (goal.r ?? 2.2) + GOAL_CFG.RADIUS_SLACK;
    const dx = this.player.pos.x - goal.p[0];
    const dz = this.player.pos.z - goal.p[2];
    if (dx * dx + dz * dz > radius * radius) return;
    // resting height of a ball sitting on the finish pad
    const restY = goal.p[1] + this.player.radius;
    if (Math.abs(this.player.pos.y - restY) > GOAL_CFG.CONTACT_HEIGHT) return;
    this.onGoal();
  }

  private onGoal(): void {
    if (this.states.current !== GameState.PLAYING || !this.level) return;
    this.player.controlEnabled = false;
    this.input.setEnabled(false);
    this.run.finishTimer = TIMING.RESULT_DELAY + 0.6;
    this.states.transition(GameState.LEVEL_COMPLETE);
    this.audio.goalFanfare();
    this.audio.duckMusic(2.2);
    this.ballVisual.hamster.setMood('victory');
    this.followCam.addTrauma(0.15);
    const gp = this.level.def.goal.p;
    for (let i = 0; i < 3; i++) {
      this.particles.spawn({
        pos: new THREE.Vector3(gp[0], gp[1] + 0.6 + i * 0.5, gp[2]),
        count: 16,
        color: this.level.def.palette.accent,
        color2: 0xffd75e,
        speed: 4.5,
        life: 0.9,
        dirY: 1.6,
        gravity: 3,
      });
    }
    this.rings.pulse(new THREE.Vector3(gp[0], gp[1] + 0.4, gp[2]), 0xffd75e, 5, 0.9);
  }

  // ----------------------------------------------------------- kill/respawn

  private killPlayer(reason: KillReason): void {
    if (this.states.current !== GameState.PLAYING) return;
    if (this.mode === 'sprint') {
      this.endSprint();
      return;
    }
    if (!this.states.transition(GameState.RESPAWNING)) return;
    this.run.failures++;
    this.player.controlEnabled = false;
    this.input.clearActive();
    this.followCam.addTrauma(0.4);
    if (reason === 'lethal') {
      this.audio.shatter();
      this.ballVisual.flash();
      this.particles.spawn({
        pos: this.player.pos.clone(),
        count: 26,
        color: 0xbfe3ff,
        color2: 0xffffff,
        speed: 6,
        life: 0.8,
        spread: 0.4,
        gravity: 10,
      });
      this.ballVisual.setVisible(false);
      this.player.captured = true; // freeze physics while shattered
      this.run.respawnTimer = RESPAWN_CFG.TOTAL_TIME;
    } else {
      this.audio.squeakPanic();
      this.ballVisual.hamster.setMood('tumble');
      this.run.respawnTimer = RESPAWN_CFG.TOTAL_TIME + RESPAWN_CFG.FALL_FOLLOW_TIME;
    }
    this.run.respawnTeleported = false;
  }

  private respawnTarget(): { pos: THREE.Vector3; yaw: number } {
    const def = this.level!.def;
    let idx = this.run.checkpointIndex;
    while (idx >= 0) {
      const cp = this.level!.checkpoints[idx];
      if (this.spawnIsSafe(cp.spawn)) return { pos: cp.spawn.clone(), yaw: cp.yaw };
      idx--; // fallback to earlier checkpoint if the spot is somehow blocked
    }
    return { pos: new THREE.Vector3(...def.start.p), yaw: def.start.yaw };
  }

  /** Validate spawn: solid ground within a few units below, no overlapping lethal collider. */
  private spawnIsSafe(p: THREE.Vector3): boolean {
    let hasGround = false;
    for (const c of this.world.colliders) {
      if (!c.enabled) continue;
      const withinXZ =
        p.x > c.aabbMin.x - 0.3 && p.x < c.aabbMax.x + 0.3 && p.z > c.aabbMin.z - 0.3 && p.z < c.aabbMax.z + 0.3;
      if (!withinXZ) continue;
      if (c.surface === Surface.LETHAL && p.y > c.aabbMin.y - 1 && p.y < c.aabbMax.y + 1.5) return false;
      if (c.aabbMax.y <= p.y + 0.5 && c.aabbMax.y > p.y - 4) hasGround = true;
    }
    return hasGround;
  }

  private updateRespawn(dt: number): void {
    this.run.respawnTimer -= dt;
    const remaining = this.run.respawnTimer;
    if (!this.run.respawnTeleported && remaining <= RESPAWN_CFG.TOTAL_TIME - RESPAWN_CFG.FALL_FOLLOW_TIME) {
      this.run.respawnTeleported = true;
      const target = this.respawnTarget();
      this.player.captured = false;
      this.player.teleport(target.pos.x, target.pos.y + PHYSICS.BALL_RADIUS + 0.4, target.pos.z);
      this.player.protectionTimer = RESPAWN_CFG.PROTECTION_TIME;
      this.followCam.snap(this.player.pos, target.yaw);
      this.ballVisual.setVisible(true);
      this.ballVisual.hamster.setMood('normal');
      this.audio.respawn();
      this.particles.spawn({ pos: this.player.pos.clone(), count: 10, color: 0x9fd4ff, speed: 2.5, life: 0.5, gravity: -2 });
    }
    if (this.run.respawnTeleported && remaining > 0) {
      this.ballVisual.respawnEffect(dt, 1 - remaining / (RESPAWN_CFG.TOTAL_TIME - RESPAWN_CFG.FALL_FOLLOW_TIME));
    }
    if (remaining <= 0) {
      this.ballVisual.respawnEffect(dt, 1);
      this.player.controlEnabled = true;
      this.states.transition(GameState.PLAYING);
      this.hud.banner(t('backOnTrack'));
    }
  }

  // --------------------------------------------------------------- results

  private finishLevel(): void {
    // guard: updateFinish keeps ticking in LEVEL_COMPLETE, so results must be
    // computed and shown exactly once (never rebuilt per frame)
    if (this.run.resultsShown) return;
    this.run.resultsShown = true;
    const def = this.level!.def;
    const runStats: RunStats = {
      timeMs: Math.round(this.run.elapsedMs),
      timeLimitMs: def.timeLimitMs,
      goldTimeMs: def.goldTimeMs,
      seedMask: this.run.runSeedMask,
      failures: this.run.failures,
      shortcutsTaken: this.run.shortcuts.size,
      knockouts: this.run.knockouts.size,
      glassBroken: this.run.glass.size,
    };
    const breakdown = computeLevelScore(runStats);
    const stars = computeStars(runStats.timeMs, runStats.seedMask, def.silverTimeMs, def.goldTimeMs);
    const prev = { ...this.save.data.levels[levelKey(def.number)] };
    const outcome = applyRunResult(this.save.data, {
      levelNumber: def.number,
      timeMs: runStats.timeMs,
      score: breakdown.total,
      stars,
      seedMask: runStats.seedMask,
      failures: runStats.failures,
    });
    this.save.flush();
    void this.submitScore();

    if (outcome.newBestScore || outcome.newBestTime) this.audio.newBest();
    if (outcome.unlockedNext) this.levelSelectHighlight = outcome.unlockedNext;
    this.hud.setVisible(false);
    this.input.setEnabled(false);

    if (outcome.campaignJustCompleted) {
      this.states.transition(GameState.CAMPAIGN_COMPLETE);
      this.audio.stopMusic();
      this.audio.victorySting();
      this.ui.showCampaignComplete({
        totalScore: outcome.campaignScore,
        totalStars: totalStars(this.save.data),
        totalSeeds: totalSeeds(this.save.data),
      });
      return;
    }

    this.ui.showResults({
      levelName: def.name,
      timeMs: runStats.timeMs,
      prevBestMs: prev.bestTimeMs,
      newBestTime: outcome.newBestTime,
      newBestScore: outcome.newBestScore,
      stars,
      starHint: starHint(stars, runStats.timeMs, runStats.seedMask, def.silverTimeMs, def.goldTimeMs),
      runSeeds: countSeeds(runStats.seedMask),
      score: breakdown.total,
      failures: runStats.failures,
      hasNext: def.number < LEVEL_COUNT,
      breakdownRows: [
        ['Completion', breakdown.completion],
        ['Time bonus', breakdown.timeBonus],
        ['Seeds', breakdown.seedBonus],
        ['Shortcuts', breakdown.shortcutBonus],
        ['Knockouts', breakdown.knockoutBonus],
        ['Glass', breakdown.glassBonus],
        ['Clean run', breakdown.noFailureBonus],
        ['Gold time', breakdown.goldTimeBonus],
      ],
    });
  }

  private async submitScore(): Promise<void> {
    const value = selectScoreSubmission(this.save.data);
    if (value === null) return;
    const ok = await this.bridge.sendScore(value);
    if (ok) {
      this.save.data.submittedScore = value;
      this.save.flush();
    }
  }

  private failLevel(): void {
    this.states.transition(GameState.LEVEL_FAILED);
    this.player.controlEnabled = false;
    this.input.setEnabled(false);
    this.audio.timeUp();
    this.hud.setVisible(false);
    this.ui.showFailed({ levelName: this.level?.def.name ?? '' });
  }

  // ----------------------------------------------------------------- pause

  private pauseGame(): void {
    if (!this.states.transition(GameState.MANUAL_PAUSE)) return;
    this.input.clearActive();
    this.ui.show('pause');
  }

  private resumeFromPause(): void {
    if (this.states.current !== GameState.MANUAL_PAUSE) return;
    this.input.clearActive();
    this.clock.getDelta();
    const target = this.run.countdown > 0 ? GameState.COUNTDOWN : this.run.respawnTimer > 0 ? GameState.RESPAWNING : GameState.PLAYING;
    if (this.states.transition(target)) {
      this.ui.hideAll();
      this.hud.setVisible(true);
    }
  }

  // ---------------------------------------------------------------- update

  private update(dt: number): void {
    const state = this.states.current;

    switch (state) {
      case GameState.TITLE:
      case GameState.LEVEL_SELECT:
      case GameState.SETTINGS:
      case GameState.CAMPAIGN_COMPLETE:
        this.updateMenuBackdrop(dt);
        break;
      case GameState.COUNTDOWN:
        this.updateCountdown(dt);
        break;
      case GameState.PLAYING:
        this.updateGameplay(dt);
        break;
      case GameState.RESPAWNING:
        this.updateGameplay(dt);
        this.updateRespawn(dt);
        break;
      case GameState.LEVEL_COMPLETE:
        this.updateFinish(dt);
        break;
      default:
        break;
    }

    this.particles.update(dt);
    this.rings.update(dt);
  }

  private updateMenuBackdrop(dt: number): void {
    if (!this.menuBackdrop) return;
    // slow cinematic orbit around the idle hamster ball
    const t0 = this.elapsedTime * 0.18;
    const cam = this.followCam.camera;
    cam.position.set(Math.sin(t0) * 8.5, 3.6 + Math.sin(this.elapsedTime * 0.4) * 0.4, Math.cos(t0) * 8.5);
    cam.lookAt(0, 0.8, 0);
    this.player.update(dt, 0, 0, 0);
    this.ballVisual.update(dt, this.player, this.elapsedTime);
    this.env.follow(this.player.pos);
  }

  private updateCountdown(dt: number): void {
    this.run.countdown -= dt;
    const step = Math.ceil(this.run.countdown / TIMING.COUNTDOWN_STEP);
    if (step !== this.run.countdownShown) {
      this.run.countdownShown = step;
      if (step > 0) {
        this.hud.countdown(String(step));
        this.audio.countdown(false);
      }
    }
    // ball settles onto the pad; hazards frozen at phase zero
    this.player.update(dt, 0, 0, this.followCam.yaw);
    this.level?.update(dt, 0);
    this.level?.hazards.forEach((h) => h.update(dt, 0));
    this.sprint?.update(this.player.pos, this.player.radius);
    this.syncVisuals(dt);
    if (this.run.countdown <= 0) {
      this.hud.countdown(t('go'));
      setTimeout(() => this.hud.hideCountdown(), 700);
      this.audio.countdown(true);
      this.player.controlEnabled = true;
      this.states.transition(GameState.PLAYING);
    }
  }

  private updateGameplay(dt: number): void {
    const playing = this.states.current === GameState.PLAYING;
    // failure costs time: the run timer also advances during respawn
    if (playing || this.states.current === GameState.RESPAWNING) {
      this.run.elapsedMs += dt * 1000;
    }
    const elapsedSec = this.run.elapsedMs / 1000;

    // input mapped through camera yaw
    const ix = playing && this.player.controlEnabled ? this.input.moveX : 0;
    const iy = playing && this.player.controlEnabled ? this.input.moveY : 0;
    this.player.update(dt, ix, iy, this.followCam.yaw);

    if (this.level) {
      this.level.update(dt, elapsedSec);
      for (const h of this.level.hazards) h.update(dt, elapsedSec);

      const def = this.level.def;
      const remaining = def.timeLimitMs - this.run.elapsedMs;
      this.hud.updateTimer(Math.max(0, remaining));
      // low-time warnings
      if (playing) {
        if (!this.run.warned10 && remaining <= TIMING.LOW_TIME_WARNING_1 * 1000) {
          this.run.warned10 = true;
          this.audio.warnTick();
        }
        if (!this.run.warned5 && remaining <= TIMING.LOW_TIME_WARNING_2 * 1000) {
          this.run.warned5 = true;
        }
        if (remaining <= TIMING.LOW_TIME_WARNING_2 * 1000 && elapsedSec - this.run.lastUrgentTick >= 1) {
          this.run.lastUrgentTick = elapsedSec;
          this.audio.urgentTick();
        }
        if (remaining <= 0) {
          this.failLevel();
          return;
        }
        // finish: only counts as a landing on the flag circle
        this.checkGoalReached();
        // void fall (includes overshooting the finish circle)
        if (this.player.pos.y < def.fallY) this.killPlayer('void');
      }
    }

    if (this.sprint && playing) {
      const gained = this.sprint.update(this.player.pos, this.player.radius);
      if (gained > 0) this.hud.updateScore(this.sprint.score);
      this.hud.setCustomTimer(`${Math.round(this.sprint.distance)}m`);
      if (this.player.pos.y < this.sprint.fallY) {
        this.endSprint();
        return;
      }
    }

    this.syncVisuals(dt);

    // rolling audio follows the ball
    const surface = this.player.surface === Surface.GLASS ? 'glass' : this.player.surface === Surface.TAR ? 'tar' : 'normal';
    this.audio.updateRolling(clamp01(this.player.speed / PHYSICS.NORMAL_MAX_SPEED), this.player.grounded, surface);

    // speed trail at high velocity
    if (this.player.speed > 11 && this.player.grounded) {
      this.particles.spawn({
        pos: this.player.pos.clone(),
        count: 1,
        color: 0xffffff,
        color2: this.level?.def.palette.glow ?? 0x9fd4ff,
        size: 0.4,
        life: 0.4,
        speed: 0.4,
        gravity: 0,
        drag: 2,
      });
    }
  }

  private updateFinish(dt: number): void {
    this.run.finishTimer -= dt;
    // if the ball crossed the goal airborne and slid off, freeze it rather than fall forever
    if (this.level && this.player.pos.y < this.level.def.fallY) this.player.captured = true;
    this.player.update(dt, 0, 0, this.followCam.yaw);
    this.level?.update(dt, this.run.elapsedMs / 1000);
    this.syncVisuals(dt);
    if (this.run.finishTimer <= 0 && !this.run.resultsShown) {
      this.finishLevel();
    }
  }

  private syncVisuals(dt: number): void {
    this.ballVisual.update(dt, this.player, this.elapsedTime);
    this.followCam.update(
      dt,
      this.player.pos,
      this.player.vel,
      this.player.speedCap,
      this.player.boostTimer > 0,
      this.elapsedTime
    );
    this.env.follow(this.player.pos);
  }
}

export function launch(): void {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const uiRoot = document.getElementById('ui-root') as HTMLElement;
  if (!canvas || !uiRoot) {
    console.error(`${PRODUCT.fullTitle}: missing root elements`);
    return;
  }
  const game = new Game(canvas, uiRoot);
  void game.boot();
}
