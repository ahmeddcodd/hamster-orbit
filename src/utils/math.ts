export const TAU = Math.PI * 2;

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Frame-rate-independent damping factor: use as lerp(current, target, dampFactor(rate, dt)) */
export function dampFactor(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * dt);
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * Deterministic ping-pong cycle with pauses at each end.
 * Returns 0..1 position along the path for a given elapsed time.
 * period covers a full there-and-back cycle including both pauses.
 */
export function pingPongPause(elapsed: number, period: number, pauseFrac = 0.15): number {
  const t = ((elapsed % period) + period) % period / period;
  const moveFrac = (1 - pauseFrac * 2) / 2;
  if (t < moveFrac) return smoothstep(0, 1, t / moveFrac);
  if (t < moveFrac + pauseFrac) return 1;
  if (t < moveFrac * 2 + pauseFrac) return smoothstep(0, 1, 1 - (t - moveFrac - pauseFrac) / moveFrac);
  return 0;
}

/** Deterministic seeded PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function angleLerp(a: number, b: number, t: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return a + d * t;
}
