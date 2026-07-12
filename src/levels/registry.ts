import { DEBUG } from '../config/config';
import type { LevelDefinition } from './types';
import { validateCampaign } from './validator';
import { level01 } from './definitions/level01';
import { level02 } from './definitions/level02';
import { level03 } from './definitions/level03';
import { level04 } from './definitions/level04';
import { level05 } from './definitions/level05';
import { level06 } from './definitions/level06';
import { level07 } from './definitions/level07';
import { level08 } from './definitions/level08';
import { level09 } from './definitions/level09';
import { level10 } from './definitions/level10';

export const LEVELS: LevelDefinition[] = [
  level01,
  level02,
  level03,
  level04,
  level05,
  level06,
  level07,
  level08,
  level09,
  level10,
];

if (DEBUG.enabled) {
  const errors = validateCampaign(LEVELS);
  if (errors.length > 0) {
    throw new Error(`Level validation failed:\n${errors.join('\n')}`);
  }
}

export function getLevel(number: number): LevelDefinition {
  const def = LEVELS.find((l) => l.number === number);
  if (!def) throw new Error(`Unknown level ${number}`);
  return def;
}
