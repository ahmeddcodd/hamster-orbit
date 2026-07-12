import { describe, expect, it } from 'vitest';
import { computeCampaignScore, computeLevelScore, countSeeds, selectScoreSubmission } from '../gameplay/score';
import { defaultSave, levelKey } from '../save/save';

const baseRun = {
  timeMs: 30_000,
  timeLimitMs: 65_000,
  goldTimeMs: 30_000,
  seedMask: 0,
  failures: 1,
  shortcutsTaken: 0,
  knockouts: 0,
  glassBroken: 0,
};

describe('computeLevelScore', () => {
  it('awards completion + remaining time', () => {
    const b = computeLevelScore({ ...baseRun, timeMs: 35_000, goldTimeMs: 30_000 });
    expect(b.completion).toBe(2000);
    expect(b.timeBonus).toBe(Math.floor(30_000 / 100) * 4);
    expect(b.goldTimeBonus).toBe(0);
    expect(b.noFailureBonus).toBe(0);
    expect(b.total).toBe(2000 + 1200);
  });

  it('awards seeds, shortcuts, knockouts, glass, clean run, gold time', () => {
    const b = computeLevelScore({
      timeMs: 25_000,
      timeLimitMs: 65_000,
      goldTimeMs: 30_000,
      seedMask: 0b111,
      failures: 0,
      shortcutsTaken: 2,
      knockouts: 1,
      glassBroken: 1,
    });
    expect(b.seedBonus).toBe(1500);
    expect(b.shortcutBonus).toBe(1500);
    expect(b.knockoutBonus).toBe(1000);
    expect(b.glassBonus).toBe(300);
    expect(b.noFailureBonus).toBe(1500);
    expect(b.goldTimeBonus).toBe(1000);
    expect(b.total).toBe(2000 + Math.floor(40_000 / 100) * 4 + 1500 + 1500 + 1000 + 300 + 1500 + 1000);
  });

  it('never awards negative time bonus on overtime', () => {
    const b = computeLevelScore({ ...baseRun, timeMs: 70_000 });
    expect(b.timeBonus).toBe(0);
    expect(b.total).toBeGreaterThan(0);
  });

  it('is a deterministic integer', () => {
    const b = computeLevelScore({ ...baseRun, timeMs: 33_333 });
    expect(Number.isInteger(b.total)).toBe(true);
    expect(computeLevelScore({ ...baseRun, timeMs: 33_333 }).total).toBe(b.total);
  });
});

describe('countSeeds', () => {
  it('counts 3-bit masks', () => {
    expect(countSeeds(0)).toBe(0);
    expect(countSeeds(0b001)).toBe(1);
    expect(countSeeds(0b101)).toBe(2);
    expect(countSeeds(0b111)).toBe(3);
  });
});

describe('campaign score + submission selection', () => {
  it('sums best scores of completed levels only', () => {
    const save = defaultSave();
    save.levels[levelKey(1)] = { ...save.levels[levelKey(1)], completed: true, bestScore: 5000 };
    save.levels[levelKey(2)] = { ...save.levels[levelKey(2)], completed: true, bestScore: 4000 };
    save.levels[levelKey(3)] = { ...save.levels[levelKey(3)], completed: false, bestScore: 9999 };
    expect(computeCampaignScore(save)).toBe(9000);
  });

  it('submits only when campaign score matches stored best and exceeds submitted', () => {
    const save = defaultSave();
    save.levels[levelKey(1)] = { ...save.levels[levelKey(1)], completed: true, bestScore: 5000 };
    save.bestCampaignScore = 5000;
    save.submittedScore = 4000;
    expect(selectScoreSubmission(save)).toBe(5000);
    save.submittedScore = 5000;
    expect(selectScoreSubmission(save)).toBeNull();
    save.submittedScore = 6000;
    expect(selectScoreSubmission(save)).toBeNull();
  });

  it('never submits when stored best is out of sync', () => {
    const save = defaultSave();
    save.levels[levelKey(1)] = { ...save.levels[levelKey(1)], completed: true, bestScore: 5000 };
    save.bestCampaignScore = 4200; // out of sync
    save.submittedScore = 0;
    expect(selectScoreSubmission(save)).toBeNull();
  });
});
