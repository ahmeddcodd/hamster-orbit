import { countSeeds } from './score';

/**
 * Star rules:
 * 1 star  = complete the level
 * 2 stars = complete at/under silver time
 * 3 stars = complete at/under gold time AND all 3 seeds collected in that run
 */
export function computeStars(timeMs: number, runSeedMask: number, silverTimeMs: number, goldTimeMs: number): number {
  let stars = 1;
  if (timeMs <= silverTimeMs) stars = 2;
  if (timeMs <= goldTimeMs && countSeeds(runSeedMask) === 3) stars = 3;
  return stars;
}

/** Human-readable hint for what's missing for the next star. */
export function starHint(stars: number, timeMs: number, runSeedMask: number, silverMs: number, goldMs: number): string {
  if (stars >= 3) return 'Perfect run!';
  if (stars === 2) {
    const missing: string[] = [];
    if (timeMs > goldMs) missing.push(`beat ${(goldMs / 1000).toFixed(1)}s`);
    if (countSeeds(runSeedMask) < 3) missing.push('collect all 3 seeds');
    return `3 stars: ${missing.join(' and ')}`;
  }
  return `2 stars: beat ${(silverMs / 1000).toFixed(1)}s`;
}
