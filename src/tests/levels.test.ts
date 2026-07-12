import { describe, expect, it } from 'vitest';
import { LEVELS } from '../levels/registry';
import { validateCampaign, validateLevel } from '../levels/validator';
import type { LevelDefinition } from '../levels/types';

describe('campaign definitions', () => {
  it('has exactly 10 levels numbered 1..10', () => {
    expect(LEVELS.length).toBe(10);
    expect(new Set(LEVELS.map((l) => l.number)).size).toBe(10);
  });

  it('every level passes full validation', () => {
    const errors = validateCampaign(LEVELS);
    expect(errors).toEqual([]);
  });

  it('every level has exactly 3 seeds (30 total)', () => {
    let total = 0;
    for (const def of LEVELS) {
      expect(def.seeds.length).toBe(3);
      total += def.seeds.length;
    }
    expect(total).toBe(30);
  });

  it('gold < silver < time limit in every level', () => {
    for (const def of LEVELS) {
      expect(def.goldTimeMs).toBeLessThan(def.silverTimeMs);
      expect(def.silverTimeMs).toBeLessThan(def.timeLimitMs);
    }
  });

  it('every level has checkpoints in order and a fall plane below the start', () => {
    for (const def of LEVELS) {
      expect(def.checkpoints.length).toBeGreaterThanOrEqual(1);
      expect(def.fallY).toBeLessThan(def.start.p[1]);
    }
  });

  it('every level has at least one shortcut gate and a tutorial', () => {
    for (const def of LEVELS) {
      expect(def.shortcuts?.length ?? 0).toBeGreaterThanOrEqual(1);
      expect(def.tutorials?.length ?? 0).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('validateLevel catches broken data', () => {
  const good = LEVELS[0];

  function clone(def: LevelDefinition): LevelDefinition {
    return JSON.parse(JSON.stringify(def)) as LevelDefinition;
  }

  it('rejects missing goal', () => {
    const bad = clone(good);
    (bad as unknown as Record<string, unknown>).goal = undefined;
    expect(validateLevel(bad).length).toBeGreaterThan(0);
  });

  it('rejects wrong seed count', () => {
    const bad = clone(good);
    (bad.seeds as unknown as number[][]).push([0, 0, 0]);
    expect(validateLevel(bad).some((e) => e.includes('3 seeds'))).toBe(true);
  });

  it('rejects gold >= silver', () => {
    const bad = clone(good);
    bad.goldTimeMs = bad.silverTimeMs;
    expect(validateLevel(bad).some((e) => e.includes('gold'))).toBe(true);
  });

  it('rejects non-finite transforms', () => {
    const bad = clone(good);
    bad.seeds[0] = [Number.NaN, 0, 0];
    expect(validateLevel(bad).some((e) => e.includes('non-finite'))).toBe(true);
  });

  it('rejects duplicate hazard ids', () => {
    const bad = clone(good);
    bad.hazards = [
      { t: 'bumper', id: 'x', p: [0, 0, 0] },
      { t: 'bumper', id: 'x', p: [1, 0, 0] },
    ];
    expect(validateLevel(bad).some((e) => e.includes('duplicate hazard'))).toBe(true);
  });

  it('rejects fall plane above start', () => {
    const bad = clone(good);
    bad.fallY = bad.start.p[1] + 5;
    expect(validateLevel(bad).some((e) => e.includes('fall plane'))).toBe(true);
  });
});
