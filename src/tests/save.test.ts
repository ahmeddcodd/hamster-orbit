import { describe, expect, it } from 'vitest';
import { defaultSave, levelKey, mergeLevelResult, parseSave, serializeSave } from '../save/save';

describe('parseSave', () => {
  it('handles empty string', () => {
    const s = parseSave('');
    expect(s.version).toBe(1);
    expect(s.levels[levelKey(1)].unlocked).toBe(true);
    expect(s.levels[levelKey(2)].unlocked).toBe(false);
  });

  it('handles malformed JSON', () => {
    expect(parseSave('{oops')).toEqual(defaultSave());
    expect(parseSave('null')).toEqual(defaultSave());
    expect(parseSave('42')).toEqual(defaultSave());
  });

  it('preserves valid progress when one field is corrupt', () => {
    const good = defaultSave();
    good.levels[levelKey(1)] = {
      unlocked: true,
      completed: true,
      bestTimeMs: 30_000,
      bestScore: 5000,
      stars: 2,
      seedMask: 0b101,
      fewestFailures: 1,
    };
    const raw = JSON.parse(serializeSave(good));
    raw.levels.level02 = 'garbage';
    raw.bestCampaignScore = 'NaN please';
    const s = parseSave(JSON.stringify(raw));
    expect(s.levels[levelKey(1)].bestScore).toBe(5000);
    expect(s.levels[levelKey(1)].seedMask).toBe(0b101);
    expect(s.levels[levelKey(2)].unlocked).toBe(true); // derived from level 1 completion
    expect(s.bestCampaignScore).toBe(0);
  });

  it('clamps invalid numeric ranges', () => {
    const raw = JSON.parse(serializeSave(defaultSave()));
    raw.levels.level01.stars = 99;
    raw.levels.level01.seedMask = -5;
    raw.levels.level01.bestTimeMs = -100;
    raw.settings = { musicVolume: 4, effectsVolume: -2, quality: 'ultra' };
    const s = parseSave(JSON.stringify(raw));
    expect(s.levels[levelKey(1)].stars).toBe(3);
    expect(s.levels[levelKey(1)].seedMask).toBe(0);
    expect(s.levels[levelKey(1)].bestTimeMs).toBe(0);
    expect(s.settings.musicVolume).toBe(1);
    expect(s.settings.effectsVolume).toBe(0);
    expect(s.settings.quality).toBe('auto');
  });

  it('ignores unknown fields and future data', () => {
    const raw = JSON.parse(serializeSave(defaultSave()));
    raw.someFutureFeature = { nested: true };
    raw.version = 99;
    const s = parseSave(JSON.stringify(raw));
    expect(s.version).toBe(1);
    expect((s as unknown as Record<string, unknown>).someFutureFeature).toBeUndefined();
  });

  it('derives campaign completion + gold rim from all levels complete', () => {
    const save = defaultSave();
    for (let i = 1; i <= 10; i++) {
      save.levels[levelKey(i)] = { ...save.levels[levelKey(i)], unlocked: true, completed: true };
    }
    const s = parseSave(serializeSave(save));
    expect(s.campaignCompleted).toBe(true);
    expect(s.cosmetics.goldRimUnlocked).toBe(true);
  });

  it('never relocks unlocked levels via highestUnlockedLevel', () => {
    const save = defaultSave();
    save.highestUnlockedLevel = 5;
    const s = parseSave(serializeSave(save));
    for (let i = 1; i <= 5; i++) expect(s.levels[levelKey(i)].unlocked).toBe(true);
  });
});

describe('mergeLevelResult (monotonic guarantees)', () => {
  const existing = {
    unlocked: true,
    completed: true,
    bestTimeMs: 30_000,
    bestScore: 5000,
    stars: 3,
    seedMask: 0b011,
    fewestFailures: 0,
  };

  it('never lowers stars or best score, never raises best time', () => {
    const merged = mergeLevelResult(existing, { timeMs: 45_000, score: 3000, stars: 1, seedMask: 0, failures: 5 });
    expect(merged.stars).toBe(3);
    expect(merged.bestScore).toBe(5000);
    expect(merged.bestTimeMs).toBe(30_000);
    expect(merged.fewestFailures).toBe(0);
  });

  it('accumulates seeds as a union', () => {
    const merged = mergeLevelResult(existing, { timeMs: 45_000, score: 0, stars: 1, seedMask: 0b100, failures: 2 });
    expect(merged.seedMask).toBe(0b111);
  });

  it('records first-time completion values', () => {
    const fresh = { unlocked: true, completed: false, bestTimeMs: 0, bestScore: 0, stars: 0, seedMask: 0, fewestFailures: -1 };
    const merged = mergeLevelResult(fresh, { timeMs: 42_000, score: 3200, stars: 2, seedMask: 0b010, failures: 3 });
    expect(merged.completed).toBe(true);
    expect(merged.bestTimeMs).toBe(42_000);
    expect(merged.bestScore).toBe(3200);
    expect(merged.stars).toBe(2);
    expect(merged.fewestFailures).toBe(3);
  });
});
