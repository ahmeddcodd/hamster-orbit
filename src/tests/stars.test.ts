import { describe, expect, it } from 'vitest';
import { computeStars, starHint } from '../gameplay/stars';

const SILVER = 40_000;
const GOLD = 30_000;

describe('computeStars', () => {
  it('1 star for any completion', () => {
    expect(computeStars(60_000, 0, SILVER, GOLD)).toBe(1);
    expect(computeStars(60_000, 0b111, SILVER, GOLD)).toBe(1);
  });

  it('2 stars at/under silver', () => {
    expect(computeStars(40_000, 0, SILVER, GOLD)).toBe(2);
    expect(computeStars(39_999, 0b011, SILVER, GOLD)).toBe(2);
  });

  it('3 stars requires gold time AND all seeds in the same run', () => {
    expect(computeStars(30_000, 0b111, SILVER, GOLD)).toBe(3);
    expect(computeStars(29_000, 0b110, SILVER, GOLD)).toBe(2); // missing a seed
    expect(computeStars(31_000, 0b111, SILVER, GOLD)).toBe(2); // over gold
    expect(computeStars(29_000, 0b111, SILVER, GOLD)).toBe(3);
  });

  it('boundary times count', () => {
    expect(computeStars(GOLD, 0b111, SILVER, GOLD)).toBe(3);
    expect(computeStars(SILVER, 0, SILVER, GOLD)).toBe(2);
  });
});

describe('starHint', () => {
  it('explains what is missing', () => {
    expect(starHint(2, 31_000, 0b111, SILVER, GOLD)).toContain('beat');
    expect(starHint(2, 29_000, 0b011, SILVER, GOLD)).toContain('seeds');
    expect(starHint(3, 29_000, 0b111, SILVER, GOLD)).toContain('Perfect');
    expect(starHint(1, 60_000, 0, SILVER, GOLD)).toContain('2 stars');
  });
});
