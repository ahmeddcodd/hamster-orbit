import { describe, expect, it } from 'vitest';
import { applyRunResult, totalSeeds, totalStars } from '../gameplay/progression';
import { defaultSave, levelKey } from '../save/save';

function completeLevel(save: ReturnType<typeof defaultSave>, n: number, score = 4000): void {
  applyRunResult(save, { levelNumber: n, timeMs: 30_000, score, stars: 2, seedMask: 0b001, failures: 0 });
}

describe('applyRunResult', () => {
  it('unlocks the next level on first completion', () => {
    const save = defaultSave();
    const outcome = applyRunResult(save, { levelNumber: 1, timeMs: 30_000, score: 4000, stars: 2, seedMask: 1, failures: 0 });
    expect(outcome.unlockedNext).toBe(2);
    expect(save.levels[levelKey(2)].unlocked).toBe(true);
    expect(save.highestUnlockedLevel).toBe(2);
  });

  it('does not re-report an unlock twice', () => {
    const save = defaultSave();
    completeLevel(save, 1);
    const outcome = applyRunResult(save, { levelNumber: 1, timeMs: 25_000, score: 4200, stars: 2, seedMask: 1, failures: 0 });
    expect(outcome.unlockedNext).toBeNull();
  });

  it('reports new bests correctly', () => {
    const save = defaultSave();
    completeLevel(save, 1, 4000);
    const outcome = applyRunResult(save, { levelNumber: 1, timeMs: 20_000, score: 3000, stars: 1, seedMask: 0, failures: 2 });
    expect(outcome.newBestTime).toBe(true);
    expect(outcome.newBestScore).toBe(false);
    expect(save.levels[levelKey(1)].bestScore).toBe(4000);
    expect(save.levels[levelKey(1)].bestTimeMs).toBe(20_000);
  });

  it('completes the campaign after all 10 levels and unlocks the gold rim', () => {
    const save = defaultSave();
    for (let n = 1; n <= 9; n++) completeLevel(save, n);
    expect(save.campaignCompleted).toBe(false);
    const outcome = applyRunResult(save, { levelNumber: 10, timeMs: 60_000, score: 5000, stars: 1, seedMask: 0, failures: 1 });
    expect(outcome.campaignJustCompleted).toBe(true);
    expect(save.campaignCompleted).toBe(true);
    expect(save.cosmetics.goldRimUnlocked).toBe(true);
    expect(outcome.campaignScore).toBe(9 * 4000 + 5000);
    expect(save.bestCampaignScore).toBe(outcome.campaignScore);
  });

  it('campaign score never decreases even after worse replays', () => {
    const save = defaultSave();
    for (let n = 1; n <= 10; n++) completeLevel(save, n, 5000);
    const best = save.bestCampaignScore;
    applyRunResult(save, { levelNumber: 5, timeMs: 60_000, score: 100, stars: 1, seedMask: 0, failures: 9 });
    expect(save.bestCampaignScore).toBe(best);
  });
});

describe('totals', () => {
  it('counts stars and seeds across the save', () => {
    const save = defaultSave();
    applyRunResult(save, { levelNumber: 1, timeMs: 30_000, score: 100, stars: 3, seedMask: 0b111, failures: 0 });
    applyRunResult(save, { levelNumber: 2, timeMs: 30_000, score: 100, stars: 2, seedMask: 0b101, failures: 0 });
    expect(totalStars(save)).toBe(5);
    expect(totalSeeds(save)).toBe(5);
  });
});
