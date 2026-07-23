/**
 * Central configuration — the single source of truth for product metadata and
 * global tuning. Level-specific data lives in the level definitions.
 */

export const PRODUCT = {
  title: 'HAMSTER ORBIT',
  subtitle: 'SKY SPRINT',
  fullTitle: 'Hamster Orbit: Sky Sprint',
  version: '1.0.0',
  developer: 'Orbit Games',
  saveKey: 'hamster-orbit-save-v1',
} as const;

export const PHYSICS = {
  FIXED_DT: 1 / 120,
  MAX_SUBSTEPS: 6,
  MAX_FRAME_DT: 1 / 30,
  GRAVITY_Y: -21,
  BALL_RADIUS: 0.48,
  GROUND_ACCEL: 34,
  AIR_ACCEL: 7,
  NORMAL_MAX_SPEED: 15,
  BOOST_MAX_SPEED: 23,
  BRAKE_MULTIPLIER: 1.45,
  RESTITUTION: 0.22,
  /** exponential ground friction rates per surface (higher = grippier slowdown when no input) */
  FRICTION_NORMAL: 1.4,
  FRICTION_GLASS: 0.12,
  FRICTION_TAR: 6.0,
  TAR_MAX_SPEED: 6.5,
  /** how strongly velocity soft-caps ease toward the cap, per second */
  SOFT_CAP_RATE: 3.2,
  GROUND_GRACE: 0.12,
  MAX_GROUND_DOT: 0.62,
  /** dizzy state after hard landings */
  HARD_LANDING_SPEED: 19,
  LETHAL_IMPACT_SPEED: 27,
  DIZZY_DURATION: 1.0,
  DIZZY_CONTROL: 0.35,
} as const;

export const CAMERA_CFG = {
  FOV_BASE: 54,
  FOV_SPEED_BOOST: 10,
  DISTANCE: 9.5,
  HEIGHT: 7.2,
  PORTRAIT_DISTANCE: 11.5,
  PORTRAIT_HEIGHT: 9.0,
  LOOK_AHEAD: 2.6,
  POS_DAMP: 7.0,
  TARGET_DAMP: 11.0,
  YAW_DAMP: 2.2,
  SHAKE_DECAY: 2.6,
  SHAKE_MAX_OFFSET: 0.42,
} as const;

export const RESPAWN_CFG = {
  FALL_FOLLOW_TIME: 0.45,
  FADE_TIME: 0.28,
  TOTAL_TIME: 1.1,
  PROTECTION_TIME: 1.0,
} as const;

export const SCORE_CFG = {
  COMPLETION: 2000,
  SEED: 500,
  SHORTCUT: 750,
  KNOCKOUT: 1000,
  GLASS: 300,
  NO_FAILURE: 1500,
  GOLD_TIME: 1000,
  PER_100MS_REMAINING: 4,
} as const;

export const GOAL_CFG = {
  /**
   * The finish only counts when the ball actually lands on the flag circle.
   * Its centre must be inside the pad radius, and it must be at pad height —
   * sailing over the top is a miss, so an overshoot falls and costs a respawn.
   */
  CONTACT_HEIGHT: 1.1,
  /** extra pad radius allowed, so grazing the rim still reads as "on the circle" */
  RADIUS_SLACK: 0.25,
} as const;

export const TIMING = {
  COUNTDOWN_STEP: 0.62,
  RESULT_DELAY: 0.9,
  LOW_TIME_WARNING_1: 10,
  LOW_TIME_WARNING_2: 5,
} as const;

export const SPRINT_CFG = {
  /** endless mode difficulty ramp */
  BASE_SPEED_CAP: 15,
  MAX_SPEED_CAP: 22,
  SEGMENT_SCORE: 250,
  SEED_SCORE: 500,
  DIST_PER_POINT: 0.5,
  SEGMENTS_AHEAD: 5,
  SEGMENTS_BEHIND: 2,
} as const;

export type QualityTier = 'low' | 'medium' | 'high';

export interface QualityPreset {
  dprCap: number;
  shadows: boolean;
  shadowMapSize: number;
  bloom: boolean;
  particleCap: number;
  antialias: boolean;
}

export const QUALITY_PRESETS: Record<QualityTier, QualityPreset> = {
  low: { dprCap: 1.2, shadows: false, shadowMapSize: 512, bloom: false, particleCap: 160, antialias: false },
  medium: { dprCap: 1.5, shadows: true, shadowMapSize: 1024, bloom: true, particleCap: 320, antialias: true },
  high: { dprCap: 2.0, shadows: true, shadowMapSize: 2048, bloom: true, particleCap: 512, antialias: true },
};

export const DEBUG = {
  enabled: import.meta.env.DEV,
  logStateTransitions: import.meta.env.DEV,
} as const;
