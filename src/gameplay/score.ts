import { SCORE_CFG } from '../config/config';
import { LEVEL_COUNT, levelKey, type SaveData } from '../save/save';

export interface RunStats {
  timeMs: number;
  timeLimitMs: number;
  goldTimeMs: number;
  seedMask: number;
  failures: number;
  shortcutsTaken: number;
  knockouts: number;
  glassBroken: number;
}

export interface ScoreBreakdown {
  completion: number;
  timeBonus: number;
  seedBonus: number;
  shortcutBonus: number;
  knockoutBonus: number;
  glassBonus: number;
  noFailureBonus: number;
  goldTimeBonus: number;
  total: number;
}

export function countSeeds(mask: number): number {
  return ((mask >> 0) & 1) + ((mask >> 1) & 1) + ((mask >> 2) & 1);
}

/** Deterministic integer level score. All event inputs are one-time-per-run counts. */
export function computeLevelScore(run: RunStats): ScoreBreakdown {
  const remainingMs = Math.max(0, run.timeLimitMs - run.timeMs);
  const timeBonus = Math.floor(remainingMs / 100) * SCORE_CFG.PER_100MS_REMAINING;
  const seedBonus = countSeeds(run.seedMask) * SCORE_CFG.SEED;
  const shortcutBonus = run.shortcutsTaken * SCORE_CFG.SHORTCUT;
  const knockoutBonus = run.knockouts * SCORE_CFG.KNOCKOUT;
  const glassBonus = run.glassBroken * SCORE_CFG.GLASS;
  const noFailureBonus = run.failures === 0 ? SCORE_CFG.NO_FAILURE : 0;
  const goldTimeBonus = run.timeMs <= run.goldTimeMs ? SCORE_CFG.GOLD_TIME : 0;
  const breakdown: ScoreBreakdown = {
    completion: SCORE_CFG.COMPLETION,
    timeBonus,
    seedBonus,
    shortcutBonus,
    knockoutBonus,
    glassBonus,
    noFailureBonus,
    goldTimeBonus,
    total: 0,
  };
  breakdown.total =
    breakdown.completion +
    timeBonus +
    seedBonus +
    shortcutBonus +
    knockoutBonus +
    glassBonus +
    noFailureBonus +
    goldTimeBonus;
  return breakdown;
}

/** Best campaign score = sum of highest recorded score per completed level. Stable + monotonic. */
export function computeCampaignScore(save: SaveData): number {
  let total = 0;
  for (let i = 1; i <= LEVEL_COUNT; i++) {
    const lp = save.levels[levelKey(i)];
    if (lp?.completed) total += lp.bestScore;
  }
  return total;
}

/**
 * Score submission selection: submit only when the candidate is a valid integer,
 * strictly exceeds the previously submitted value, and matches the stored best.
 */
export function selectScoreSubmission(save: SaveData): number | null {
  const campaign = computeCampaignScore(save);
  if (campaign !== save.bestCampaignScore) return null;
  if (!Number.isFinite(campaign) || !Number.isInteger(campaign) || campaign < 0) return null;
  if (campaign <= save.submittedScore) return null;
  return campaign;
}
