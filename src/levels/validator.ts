import type { LevelDefinition, V3 } from './types';

function finiteV3(v: V3 | undefined): boolean {
  return !!v && v.length === 3 && v.every((n) => Number.isFinite(n));
}

/**
 * Validates a level definition. Returns a list of human-readable errors;
 * empty list = valid. Dev builds fail loudly on any error.
 */
export function validateLevel(def: LevelDefinition): string[] {
  const errors: string[] = [];
  const tag = def?.id ?? 'unknown';

  if (!def.id) errors.push(`${tag}: missing id`);
  if (!def.name) errors.push(`${tag}: missing name`);
  if (!def.subtitle) errors.push(`${tag}: missing subtitle`);
  if (!Number.isInteger(def.number) || def.number < 1) errors.push(`${tag}: invalid number`);
  if (!def.palette) errors.push(`${tag}: missing palette`);
  if (!def.musicProfile) errors.push(`${tag}: missing music profile`);

  if (!Number.isFinite(def.timeLimitMs) || def.timeLimitMs <= 0) errors.push(`${tag}: invalid time limit`);
  if (!Number.isFinite(def.silverTimeMs) || def.silverTimeMs <= 0) errors.push(`${tag}: invalid silver time`);
  if (!Number.isFinite(def.goldTimeMs) || def.goldTimeMs <= 0) errors.push(`${tag}: invalid gold time`);
  if (def.goldTimeMs >= def.silverTimeMs) errors.push(`${tag}: gold time must be stricter than silver`);
  if (def.silverTimeMs >= def.timeLimitMs) errors.push(`${tag}: silver time must be under the time limit`);

  if (!def.start || !finiteV3(def.start.p) || !Number.isFinite(def.start.yaw)) errors.push(`${tag}: missing/invalid start`);
  if (!def.goal || !finiteV3(def.goal.p)) errors.push(`${tag}: missing/invalid goal`);
  if (!Number.isFinite(def.fallY)) errors.push(`${tag}: missing fall plane`);
  else if (def.start && finiteV3(def.start.p) && def.fallY >= def.start.p[1]) {
    errors.push(`${tag}: fall plane must be below the start`);
  }

  if (!def.seeds || def.seeds.length !== 3) errors.push(`${tag}: must have exactly 3 seeds`);
  else def.seeds.forEach((s, i) => !finiteV3(s) && errors.push(`${tag}: seed ${i} has non-finite transform`));

  if (!def.checkpoints || def.checkpoints.length < 1) errors.push(`${tag}: needs at least 1 checkpoint`);
  else {
    def.checkpoints.forEach((c, i) => {
      if (!finiteV3(c.p)) errors.push(`${tag}: checkpoint ${i} non-finite position`);
      if (!Number.isFinite(c.yaw)) errors.push(`${tag}: checkpoint ${i} missing yaw`);
      if (c.spawn && !finiteV3(c.spawn)) errors.push(`${tag}: checkpoint ${i} non-finite spawn`);
    });
    const ids = new Set(def.checkpoints.map((c) => c.id));
    if (ids.size !== def.checkpoints.length) errors.push(`${tag}: duplicate checkpoint ids`);
  }

  if (!def.geometry || def.geometry.length === 0) errors.push(`${tag}: no geometry`);
  else {
    for (const p of def.geometry) {
      if (p.t === 'box' && (!finiteV3(p.p) || !finiteV3(p.s))) errors.push(`${tag}: box with non-finite transform`);
      if (p.t === 'curve' && (!finiteV3(p.c) || !Number.isFinite(p.r))) errors.push(`${tag}: curve with non-finite transform`);
      if (p.t === 'rail' && (!finiteV3(p.from) || !finiteV3(p.to))) errors.push(`${tag}: rail with non-finite transform`);
      if (p.t === 'deco' && !finiteV3(p.p)) errors.push(`${tag}: deco with non-finite transform`);
    }
  }

  if (def.hazards) {
    const ids = new Set<string>();
    for (const h of def.hazards) {
      if (!h.id) errors.push(`${tag}: hazard missing id`);
      if (ids.has(h.id)) errors.push(`${tag}: duplicate hazard id ${h.id}`);
      ids.add(h.id);
    }
  }

  if (!def.arrows || def.arrows.length === 0) errors.push(`${tag}: needs route arrows`);

  return errors;
}

/** Validate the whole campaign: per-level rules + cross-level uniqueness + numbering. */
export function validateCampaign(defs: LevelDefinition[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const numbers = new Set<number>();
  for (const def of defs) {
    errors.push(...validateLevel(def));
    if (ids.has(def.id)) errors.push(`duplicate level id ${def.id}`);
    ids.add(def.id);
    if (numbers.has(def.number)) errors.push(`duplicate level number ${def.number}`);
    numbers.add(def.number);
  }
  for (let i = 1; i <= defs.length; i++) {
    if (!numbers.has(i)) errors.push(`missing level number ${i}`);
  }
  return errors;
}
