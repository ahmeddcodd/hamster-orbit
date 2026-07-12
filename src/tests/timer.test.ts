import { describe, expect, it } from 'vitest';
import { formatRunTime, formatTimeMs } from '../gameplay/timer';

describe('formatTimeMs', () => {
  it('formats the spec examples', () => {
    expect(formatTimeMs(65_400)).toBe('65.4');
    expect(formatTimeMs(9_800)).toBe('09.8');
    expect(formatTimeMs(0)).toBe('00.0');
  });

  it('floors tenths and clamps negatives', () => {
    expect(formatTimeMs(9_990)).toBe('09.9');
    expect(formatTimeMs(59)).toBe('00.0');
    expect(formatTimeMs(-500)).toBe('00.0');
  });

  it('supports minutes-long values as raw seconds', () => {
    expect(formatTimeMs(120_000)).toBe('120.0');
  });
});

describe('formatRunTime', () => {
  it('formats hundredths with suffix', () => {
    expect(formatRunTime(34_567)).toBe('34.57s');
    expect(formatRunTime(0)).toBe('0.00s');
  });
});
