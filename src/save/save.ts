import { clamp } from '../utils/math';

export const SAVE_VERSION = 1;
export const LEVEL_COUNT = 10;

export interface LevelProgress {
  unlocked: boolean;
  completed: boolean;
  bestTimeMs: number; // 0 = none
  bestScore: number;
  stars: number; // 0-3
  seedMask: number; // 3-bit mask of permanently collected seeds
  fewestFailures: number; // -1 = none recorded
}

export interface SaveSettings {
  musicVolume: number;
  effectsVolume: number;
  cameraShake: boolean;
  reducedMotion: boolean;
  quality: 'auto' | 'low' | 'medium' | 'high';
}

export interface SaveData {
  version: number;
  updatedAt: number;
  highestUnlockedLevel: number;
  campaignCompleted: boolean;
  bestCampaignScore: number;
  bestEndlessScore: number;
  submittedScore: number;
  levels: Record<string, LevelProgress>;
  cosmetics: { goldRimUnlocked: boolean; selectedRim: 'classic' | 'gold' };
  settings: SaveSettings;
}

export function levelKey(levelNumber: number): string {
  return `level${String(levelNumber).padStart(2, '0')}`;
}

export function defaultLevelProgress(unlocked: boolean): LevelProgress {
  return { unlocked, completed: false, bestTimeMs: 0, bestScore: 0, stars: 0, seedMask: 0, fewestFailures: -1 };
}

export function defaultSave(): SaveData {
  const levels: Record<string, LevelProgress> = {};
  for (let i = 1; i <= LEVEL_COUNT; i++) levels[levelKey(i)] = defaultLevelProgress(i === 1);
  return {
    version: SAVE_VERSION,
    updatedAt: 0,
    highestUnlockedLevel: 1,
    campaignCompleted: false,
    bestCampaignScore: 0,
    bestEndlessScore: 0,
    submittedScore: 0,
    levels,
    cosmetics: { goldRimUnlocked: false, selectedRim: 'classic' },
    settings: { musicVolume: 0.8, effectsVolume: 0.9, cameraShake: true, reducedMotion: false, quality: 'auto' },
  };
}

function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function asInt(v: unknown, fallback: number, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return clamp(Math.round(v), min, max);
}

function asFloat(v: unknown, fallback: number, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return clamp(v, min, max);
}

function validateLevelProgress(raw: unknown, fallbackUnlocked: boolean): LevelProgress {
  const d = defaultLevelProgress(fallbackUnlocked);
  if (typeof raw !== 'object' || raw === null) return d;
  const r = raw as Record<string, unknown>;
  return {
    unlocked: asBool(r.unlocked, d.unlocked),
    completed: asBool(r.completed, d.completed),
    bestTimeMs: asInt(r.bestTimeMs, d.bestTimeMs, 0, 36_000_000),
    bestScore: asInt(r.bestScore, d.bestScore, 0, 100_000_000),
    stars: asInt(r.stars, d.stars, 0, 3),
    seedMask: asInt(r.seedMask, d.seedMask, 0, 7),
    fewestFailures: asInt(r.fewestFailures, d.fewestFailures, -1, 99_999),
  };
}

/**
 * Parse + validate a raw save string. Any malformed, missing, or corrupt field
 * falls back to a safe default without discarding the rest of the save.
 */
export function parseSave(raw: string): SaveData {
  const base = defaultSave();
  if (!raw || typeof raw !== 'string') return base;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return base;
  }
  if (typeof parsed !== 'object' || parsed === null) return base;
  return migrateSave(parsed as Record<string, unknown>);
}

/** Migrate + validate an already-parsed save object of any prior version. */
export function migrateSave(r: Record<string, unknown>): SaveData {
  const base = defaultSave();
  // version 0 or missing version: treat as version 1 layout with defensive parsing.
  const out: SaveData = {
    version: SAVE_VERSION,
    updatedAt: asInt(r.updatedAt, 0, 0, Number.MAX_SAFE_INTEGER),
    highestUnlockedLevel: asInt(r.highestUnlockedLevel, 1, 1, LEVEL_COUNT),
    campaignCompleted: asBool(r.campaignCompleted, false),
    bestCampaignScore: asInt(r.bestCampaignScore, 0, 0, 100_000_000),
    bestEndlessScore: asInt(r.bestEndlessScore, 0, 0, 100_000_000),
    submittedScore: asInt(r.submittedScore, 0, 0, 100_000_000),
    levels: base.levels,
    cosmetics: {
      goldRimUnlocked: false,
      selectedRim: 'classic',
    },
    settings: base.settings,
  };

  const rawLevels = typeof r.levels === 'object' && r.levels !== null ? (r.levels as Record<string, unknown>) : {};
  for (let i = 1; i <= LEVEL_COUNT; i++) {
    const key = levelKey(i);
    out.levels[key] = validateLevelProgress(rawLevels[key], i === 1);
  }
  // Enforce consistency: level 1 always unlocked; unlock chain follows completions.
  out.levels[levelKey(1)].unlocked = true;
  for (let i = 2; i <= LEVEL_COUNT; i++) {
    if (out.levels[levelKey(i - 1)].completed) out.levels[levelKey(i)].unlocked = true;
  }
  let highest = 1;
  for (let i = 1; i <= LEVEL_COUNT; i++) if (out.levels[levelKey(i)].unlocked) highest = i;
  out.highestUnlockedLevel = Math.max(highest, out.highestUnlockedLevel <= LEVEL_COUNT ? out.highestUnlockedLevel : 1);
  for (let i = 1; i <= out.highestUnlockedLevel; i++) out.levels[levelKey(i)].unlocked = true;

  if (typeof r.cosmetics === 'object' && r.cosmetics !== null) {
    const c = r.cosmetics as Record<string, unknown>;
    out.cosmetics.goldRimUnlocked = asBool(c.goldRimUnlocked, false);
    out.cosmetics.selectedRim = c.selectedRim === 'gold' ? 'gold' : 'classic';
  }
  const allComplete = Array.from({ length: LEVEL_COUNT }, (_, i) => out.levels[levelKey(i + 1)].completed).every(Boolean);
  if (allComplete) out.campaignCompleted = true;
  if (out.campaignCompleted) out.cosmetics.goldRimUnlocked = true;
  if (!out.cosmetics.goldRimUnlocked && out.cosmetics.selectedRim === 'gold') out.cosmetics.selectedRim = 'classic';

  if (typeof r.settings === 'object' && r.settings !== null) {
    const s = r.settings as Record<string, unknown>;
    out.settings = {
      musicVolume: asFloat(s.musicVolume, base.settings.musicVolume, 0, 1),
      effectsVolume: asFloat(s.effectsVolume, base.settings.effectsVolume, 0, 1),
      cameraShake: asBool(s.cameraShake, true),
      reducedMotion: asBool(s.reducedMotion, false),
      quality:
        s.quality === 'low' || s.quality === 'medium' || s.quality === 'high' || s.quality === 'auto'
          ? s.quality
          : 'auto',
    };
  }
  return out;
}

/**
 * Merge a run result into level progress with monotonic guarantees:
 * never lower stars, never worsen best time/score, never remove seeds,
 * never relock.
 */
export function mergeLevelResult(
  existing: LevelProgress,
  result: { timeMs: number; score: number; stars: number; seedMask: number; failures: number }
): LevelProgress {
  return {
    unlocked: true,
    completed: true,
    bestTimeMs: existing.bestTimeMs === 0 ? result.timeMs : Math.min(existing.bestTimeMs, result.timeMs),
    bestScore: Math.max(existing.bestScore, result.score),
    stars: Math.max(existing.stars, result.stars),
    seedMask: existing.seedMask | result.seedMask,
    fewestFailures:
      existing.fewestFailures === -1 ? result.failures : Math.min(existing.fewestFailures, result.failures),
  };
}

export function serializeSave(save: SaveData): string {
  return JSON.stringify(save);
}
