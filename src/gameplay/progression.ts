import { LEVEL_COUNT, levelKey, mergeLevelResult, type SaveData } from '../save/save';
import { computeCampaignScore } from './score';

export interface RunResultInput {
  levelNumber: number;
  timeMs: number;
  score: number;
  stars: number;
  seedMask: number;
  failures: number;
}

export interface ProgressionOutcome {
  newBestTime: boolean;
  newBestScore: boolean;
  starsImproved: boolean;
  newSeeds: number;
  unlockedNext: number | null;
  campaignJustCompleted: boolean;
  campaignScore: number;
}

/**
 * Apply a completed run to the save (mutates save in place) and report what changed.
 * All merges are monotonic: nothing ever gets worse.
 */
export function applyRunResult(save: SaveData, run: RunResultInput): ProgressionOutcome {
  const key = levelKey(run.levelNumber);
  const prev = save.levels[key];
  const prevCampaignComplete = save.campaignCompleted;
  const merged = mergeLevelResult(prev, run);
  save.levels[key] = merged;

  const outcome: ProgressionOutcome = {
    newBestTime: prev.bestTimeMs === 0 || run.timeMs < prev.bestTimeMs,
    newBestScore: run.score > prev.bestScore,
    starsImproved: merged.stars > prev.stars,
    newSeeds: (run.seedMask | prev.seedMask) ^ prev.seedMask,
    unlockedNext: null,
    campaignJustCompleted: false,
    campaignScore: 0,
  };

  if (run.levelNumber < LEVEL_COUNT) {
    const nextKey = levelKey(run.levelNumber + 1);
    if (!save.levels[nextKey].unlocked) {
      save.levels[nextKey].unlocked = true;
      outcome.unlockedNext = run.levelNumber + 1;
    }
    save.highestUnlockedLevel = Math.max(save.highestUnlockedLevel, run.levelNumber + 1);
  }

  const allComplete = Array.from({ length: LEVEL_COUNT }, (_, i) => save.levels[levelKey(i + 1)].completed).every(
    Boolean
  );
  if (allComplete && !prevCampaignComplete) {
    save.campaignCompleted = true;
    save.cosmetics.goldRimUnlocked = true;
    outcome.campaignJustCompleted = true;
  }

  const campaignScore = computeCampaignScore(save);
  save.bestCampaignScore = Math.max(save.bestCampaignScore, campaignScore);
  outcome.campaignScore = campaignScore;
  return outcome;
}

export function totalStars(save: SaveData): number {
  let n = 0;
  for (let i = 1; i <= LEVEL_COUNT; i++) n += save.levels[levelKey(i)].stars;
  return n;
}

export function totalSeeds(save: SaveData): number {
  let n = 0;
  for (let i = 1; i <= LEVEL_COUNT; i++) {
    const m = save.levels[levelKey(i)].seedMask;
    n += ((m >> 0) & 1) + ((m >> 1) & 1) + ((m >> 2) & 1);
  }
  return n;
}
