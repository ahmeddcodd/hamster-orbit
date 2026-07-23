import type { MusicProfile } from '../levels/types';
import { clamp01 } from '../utils/math';

/**
 * All audio is synthesized with the Web Audio API — no audio files in the
 * bundle. Effective gain = platformEnabled x channelVolume x duck.
 * The platform (YouTube) audio state has absolute priority; there is no
 * separate master mute.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private platformEnabled = true;
  private musicVolume = 0.8;
  private effectsVolume = 0.9;
  private rollSource: AudioBufferSourceNode | null = null;
  private rollGain: GainNode | null = null;
  private rollFilter: BiquadFilterNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private music: MusicPlayer | null = null;
  /** what the music *should* be playing, so a platform pause can restore it */
  private currentProfile: MusicProfile | null = null;
  private unlocked = false;

  /** Call from a user-gesture handler; safe to call repeatedly. */
  unlock(): void {
    if (this.unlocked && this.ctx?.state === 'running') return;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return;
      }
      this.master = this.ctx.createGain();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 6;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.connect(this.master);
      const len = this.ctx.sampleRate;
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.music = new MusicPlayer(this.ctx, this.musicGain);
      this.applyGains();
      this.startRollLoop();
      // a track requested before the first gesture unlocked audio still starts
      if (this.currentProfile) this.music.play(this.currentProfile);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => undefined);
    }
    this.unlocked = true;
  }

  setPlatformEnabled(enabled: boolean): void {
    this.platformEnabled = enabled;
    this.applyGains();
  }

  setVolumes(music: number, effects: number): void {
    this.musicVolume = clamp01(music);
    this.effectsVolume = clamp01(effects);
    this.applyGains();
  }

  private applyGains(): void {
    if (!this.ctx || !this.master || !this.musicGain || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.platformEnabled ? 1 : 0, t, 0.05);
    this.musicGain.gain.setTargetAtTime(this.musicVolume * 0.5, t, 0.1);
    this.sfxGain.gain.setTargetAtTime(this.effectsVolume, t, 0.05);
  }

  /** Platform pause: hard-suspend the context (silence + zero CPU). */
  /**
   * Platform pause. The music generator is a scheduler, so stopping it clears the
   * track — `currentProfile` is deliberately kept so resume() can rebuild it.
   */
  suspend(): void {
    this.music?.stop();
    void this.ctx?.suspend().catch(() => undefined);
  }

  resume(): void {
    if (!this.unlocked || !this.ctx) return;
    // Restart the music generator: suspend() tore its scheduler down, and resuming
    // the AudioContext alone only brings back one-shot SFX, leaving the game silent.
    const restartMusic = (): void => {
      if (this.currentProfile) this.music?.play(this.currentProfile);
    };
    if (this.ctx.state === 'suspended') {
      void this.ctx
        .resume()
        .then(restartMusic)
        .catch(() => undefined);
    } else {
      restartMusic();
    }
  }

  playMusic(profile: MusicProfile): void {
    this.currentProfile = profile;
    this.music?.play(profile);
  }

  stopMusic(): void {
    this.currentProfile = null;
    this.music?.stop();
  }

  duckMusic(seconds: number): void {
    if (!this.ctx || !this.musicGain) return;
    const t = this.ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(t);
    this.musicGain.gain.setValueAtTime(this.musicVolume * 0.12, t);
    this.musicGain.gain.linearRampToValueAtTime(this.musicVolume * 0.5, t + seconds);
  }

  // ---------------------------------------------------------------- synthesis

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType = 'sine',
    vol = 0.2,
    glideTo?: number,
    delay = 0
  ): void {
    if (!this.ctx || !this.sfxGain) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, filterFreq: number, vol = 0.25, type: BiquadFilterType = 'lowpass', delay = 0): void {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxGain);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.02);
  }

  // ------------------------------------------------------------------- loops

  private startRollLoop(): void {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer) return;
    this.rollSource = this.ctx.createBufferSource();
    this.rollSource.buffer = this.noiseBuffer;
    this.rollSource.loop = true;
    this.rollFilter = this.ctx.createBiquadFilter();
    this.rollFilter.type = 'lowpass';
    this.rollFilter.frequency.value = 200;
    this.rollGain = this.ctx.createGain();
    this.rollGain.gain.value = 0;
    this.rollSource.connect(this.rollFilter);
    this.rollFilter.connect(this.rollGain);
    this.rollGain.connect(this.sfxGain);
    this.rollSource.start();
  }

  /** Called every frame: rolling audio follows speed + surface. */
  updateRolling(speedN: number, grounded: boolean, surface: 'normal' | 'glass' | 'tar'): void {
    if (!this.ctx || !this.rollGain || !this.rollFilter) return;
    const t = this.ctx.currentTime;
    const target = grounded ? speedN * 0.14 : 0;
    this.rollGain.gain.setTargetAtTime(target, t, 0.08);
    const base = surface === 'glass' ? 1400 : surface === 'tar' ? 120 : 260;
    this.rollFilter.frequency.setTargetAtTime(base + speedN * 900, t, 0.1);
  }

  // -------------------------------------------------------------------- SFX

  uiClick(): void {
    this.tone(660, 0.07, 'triangle', 0.18);
    this.tone(990, 0.05, 'triangle', 0.1, undefined, 0.03);
  }

  uiFocus(): void {
    this.tone(520, 0.04, 'triangle', 0.08);
  }

  uiBack(): void {
    this.tone(440, 0.07, 'triangle', 0.14, 330);
  }

  seed(): void {
    this.tone(880, 0.09, 'sine', 0.22);
    this.tone(1320, 0.14, 'sine', 0.2, undefined, 0.06);
  }

  checkpoint(): void {
    this.tone(523, 0.1, 'triangle', 0.2);
    this.tone(784, 0.12, 'triangle', 0.2, undefined, 0.08);
    this.tone(1047, 0.18, 'triangle', 0.18, undefined, 0.16);
  }

  goalFanfare(): void {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => this.tone(f, 0.28, 'square', 0.09, undefined, i * 0.11));
    notes.forEach((f, i) => this.tone(f / 2, 0.3, 'triangle', 0.12, undefined, i * 0.11));
    this.noise(0.5, 4000, 0.06, 'highpass', 0.4);
  }

  victorySting(): void {
    const notes = [392, 523, 659, 784, 1047, 1319];
    notes.forEach((f, i) => this.tone(f, 0.4, 'square', 0.08, undefined, i * 0.13));
    notes.forEach((f, i) => this.tone(f * 0.5, 0.5, 'triangle', 0.1, undefined, i * 0.13));
  }

  starReveal(index: number): void {
    this.tone(700 + index * 200, 0.16, 'sine', 0.22);
    this.tone(1400 + index * 400, 0.2, 'sine', 0.12, undefined, 0.04);
  }

  newBest(): void {
    this.tone(880, 0.1, 'square', 0.08);
    this.tone(1109, 0.1, 'square', 0.08, undefined, 0.09);
    this.tone(1319, 0.22, 'square', 0.1, undefined, 0.18);
  }

  bump(strength = 1): void {
    this.tone(160, 0.12, 'sine', 0.25 * strength, 60);
    this.noise(0.08, 800, 0.12 * strength);
  }

  bumper(): void {
    this.tone(220, 0.14, 'square', 0.16, 440);
    this.tone(110, 0.12, 'sine', 0.22, 220);
  }

  boost(): void {
    this.noise(0.35, 2400, 0.14, 'bandpass');
    this.tone(330, 0.3, 'sawtooth', 0.07, 660);
  }

  launch(): void {
    this.tone(180, 0.4, 'sawtooth', 0.12, 720);
    this.noise(0.4, 3000, 0.1, 'bandpass');
  }

  shatter(): void {
    this.noise(0.45, 5200, 0.3, 'highpass');
    this.tone(2200, 0.1, 'square', 0.06, 800);
    this.squeakPanic();
  }

  glassBreak(): void {
    this.noise(0.35, 6000, 0.28, 'highpass');
    this.tone(3100, 0.08, 'sine', 0.1, 1600);
  }

  respawn(): void {
    this.tone(330, 0.12, 'sine', 0.14, 660);
    this.tone(660, 0.18, 'sine', 0.14, 990, 0.1);
  }

  land(intensity: number): void {
    this.tone(90, 0.1, 'sine', 0.2 * intensity, 50);
    this.noise(0.09, 500, 0.15 * intensity);
  }

  hardLand(): void {
    this.tone(70, 0.2, 'sine', 0.35, 40);
    this.noise(0.18, 600, 0.25);
    this.squeakPanic();
  }

  squeak(): void {
    this.tone(1800, 0.08, 'sine', 0.08, 2400);
  }

  squeakPanic(): void {
    this.tone(2000, 0.1, 'sine', 0.1, 2800);
    this.tone(2400, 0.12, 'sine', 0.08, 1800, 0.09);
  }

  knockout(): void {
    this.tone(440, 0.12, 'square', 0.14, 110);
    this.noise(0.15, 1200, 0.16);
    this.tone(880, 0.2, 'sine', 0.12, undefined, 0.12);
  }

  warnTick(): void {
    this.tone(1100, 0.05, 'square', 0.07);
  }

  urgentTick(): void {
    this.tone(1400, 0.06, 'square', 0.11);
    this.tone(700, 0.06, 'square', 0.08);
  }

  timeUp(): void {
    this.tone(392, 0.3, 'square', 0.12, 196);
    this.tone(196, 0.5, 'sawtooth', 0.12, 98, 0.25);
  }

  countdown(final: boolean): void {
    if (final) {
      this.tone(880, 0.25, 'square', 0.14);
    } else {
      this.tone(440, 0.12, 'square', 0.1);
    }
  }

  crusherSlam(): void {
    this.tone(60, 0.25, 'sine', 0.3, 35);
    this.noise(0.2, 400, 0.22);
  }

  sawHiss(): void {
    this.noise(0.25, 4500, 0.1, 'bandpass');
  }

  fanWhoosh(): void {
    this.noise(0.6, 900, 0.08, 'bandpass');
  }

  flickerWarn(): void {
    this.tone(980, 0.06, 'triangle', 0.07);
  }

  tubeTravel(): void {
    this.noise(0.5, 1800, 0.12, 'bandpass');
    this.tone(220, 0.5, 'sine', 0.08, 440);
  }
}

// ---------------------------------------------------------------------------

interface ProfileDef {
  bpm: number;
  root: number; // midi
  chords: number[][]; // semitone offsets per chord (progression loops)
  arp: number[]; // chord-tone indices per 16th, -1 = rest
  bass: number[]; // semitone offset per beat, -99 = rest
  pad: boolean;
  hats: boolean;
  arpWave: OscillatorType;
  bassWave: OscillatorType;
}

const PROFILES: Record<MusicProfile, ProfileDef> = {
  title: {
    bpm: 100, root: 57,
    chords: [[0, 4, 7, 11], [5, 9, 12, 16], [7, 11, 14, 17], [0, 4, 7, 11]],
    arp: [0, -1, 1, -1, 2, -1, 3, -1, 2, -1, 1, -1, 2, -1, 3, -1],
    bass: [0, -99, 0, -99], pad: true, hats: false, arpWave: 'triangle', bassWave: 'sine',
  },
  sunny: {
    bpm: 112, root: 60,
    chords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [5, 9, 12]],
    arp: [0, -1, 1, 2, -1, 1, 0, -1, 1, -1, 2, 1, -1, 2, 1, -1],
    bass: [0, -99, 7, -99], pad: true, hats: false, arpWave: 'triangle', bassWave: 'sine',
  },
  breezy: {
    bpm: 118, root: 62,
    chords: [[0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14]],
    arp: [0, 1, -1, 2, -1, 0, 1, -1, 2, -1, 1, -1, 0, 1, 2, -1],
    bass: [0, 0, -99, 7], pad: true, hats: true, arpWave: 'triangle', bassWave: 'triangle',
  },
  bouncy: {
    bpm: 126, root: 60,
    chords: [[0, 4, 7], [0, 4, 7], [5, 9, 12], [7, 11, 14]],
    arp: [0, -1, 0, 1, -1, 1, 2, -1, 0, -1, 0, 1, -1, 2, 1, 0],
    bass: [0, 7, 0, 7], pad: false, hats: true, arpWave: 'square', bassWave: 'triangle',
  },
  wobble: {
    bpm: 108, root: 58,
    chords: [[0, 3, 7], [8, 12, 15], [5, 8, 12], [7, 10, 14]],
    arp: [0, -1, -1, 1, -1, -1, 2, -1, -1, 1, -1, -1, 0, -1, 2, -1],
    bass: [0, -99, -99, 0], pad: true, hats: false, arpWave: 'triangle', bassWave: 'sine',
  },
  neon: {
    bpm: 130, root: 57,
    chords: [[0, 3, 7, 10], [5, 8, 12], [3, 7, 10], [7, 10, 14]],
    arp: [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 2, 1, 0, 1],
    bass: [0, 0, 7, 0], pad: false, hats: true, arpWave: 'square', bassWave: 'sawtooth',
  },
  ice: {
    bpm: 100, root: 64,
    chords: [[0, 4, 7, 11], [5, 9, 12], [2, 5, 9], [7, 11, 14]],
    arp: [0, -1, 1, -1, 2, -1, 3, -1, 2, -1, 3, -1, 1, -1, 2, -1],
    bass: [0, -99, -99, -99], pad: true, hats: false, arpWave: 'sine', bassWave: 'sine',
  },
  garden: {
    bpm: 116, root: 59,
    chords: [[0, 4, 7], [2, 5, 9], [5, 9, 12], [7, 11, 14]],
    arp: [0, 1, 2, -1, 1, 2, 0, -1, 2, 1, 0, -1, 1, 2, 1, -1],
    bass: [0, -99, 5, -99], pad: true, hats: true, arpWave: 'triangle', bassWave: 'triangle',
  },
  mech: {
    bpm: 122, root: 55,
    chords: [[0, 3, 7], [0, 3, 7], [5, 8, 12], [6, 10, 13]],
    arp: [0, 0, -1, 1, 0, 0, -1, 2, 0, 0, -1, 1, 2, -1, 1, 0],
    bass: [0, 0, 0, 3], pad: false, hats: true, arpWave: 'square', bassWave: 'sawtooth',
  },
  final: {
    bpm: 132, root: 57,
    chords: [[0, 3, 7, 10], [8, 12, 15], [5, 8, 12], [10, 14, 17]],
    arp: [0, 1, 2, 3, 2, 1, 0, 2, 0, 1, 2, 3, 2, 3, 2, 1],
    bass: [0, 0, 7, 7], pad: true, hats: true, arpWave: 'square', bassWave: 'sawtooth',
  },
};

function midiToFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

/** Generative pattern-based music: bass + arp + pad + hats on a 16th grid. */
class MusicPlayer {
  private profile: ProfileDef | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextStepTime = 0;
  private step = 0;

  constructor(
    private ctx: AudioContext,
    private out: GainNode
  ) {}

  play(name: MusicProfile): void {
    const p = PROFILES[name];
    if (this.profile === p && this.timer) return;
    this.stop();
    this.profile = p;
    this.step = 0;
    this.nextStepTime = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 60);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.profile = null;
  }

  private schedule(): void {
    const p = this.profile;
    if (!p || this.ctx.state !== 'running') return;
    const stepDur = 60 / p.bpm / 4;
    while (this.nextStepTime < this.ctx.currentTime + 0.25) {
      this.playStep(p, this.step, this.nextStepTime, stepDur);
      this.nextStepTime += stepDur;
      this.step = (this.step + 1) % (p.chords.length * 16);
    }
  }

  private note(freq: number, t: number, dur: number, wave: OscillatorType, vol: number, filterFreq = 3000): void {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    osc.type = wave;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(f);
    f.connect(g);
    g.connect(this.out);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  private playStep(p: ProfileDef, step: number, t: number, stepDur: number): void {
    const chordIdx = Math.floor(step / 16) % p.chords.length;
    const chord = p.chords[chordIdx];
    const s16 = step % 16;

    // arp
    const arpIdx = p.arp[s16];
    if (arpIdx >= 0) {
      const semis = chord[arpIdx % chord.length];
      this.note(midiToFreq(p.root + 12 + semis), t, stepDur * 1.8, p.arpWave, 0.09, 2600);
    }
    // bass on beats
    if (s16 % 4 === 0) {
      const b = p.bass[(s16 / 4) % p.bass.length];
      if (b !== -99) this.note(midiToFreq(p.root - 24 + b), t, stepDur * 3.4, p.bassWave, 0.16, 900);
    }
    // pad at chord boundaries
    if (p.pad && s16 === 0) {
      const dur = stepDur * 16;
      for (const semis of chord) {
        this.note(midiToFreq(p.root + semis), t, dur, 'sawtooth', 0.022, 1100);
        this.note(midiToFreq(p.root + semis) * 1.005, t, dur, 'sawtooth', 0.022, 1100);
      }
    }
    // hats on offbeats
    if (p.hats && s16 % 4 === 2) {
      this.note(midiToFreq(p.root + 60) + Math.random() * 300, t, stepDur * 0.4, 'square', 0.014, 8000);
    }
  }
}
