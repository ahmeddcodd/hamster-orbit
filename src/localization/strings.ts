/**
 * Key-based UI strings. English is complete and is the fallback for any
 * unsupported language reported by the platform.
 */
const en: Record<string, string> = {
  play: 'PLAY',
  levelSelect: 'LEVEL SELECT',
  settings: 'SETTINGS',
  sprintMode: 'SPRINT MODE',
  resume: 'RESUME',
  restart: 'RESTART LEVEL',
  paused: 'PAUSED',
  results: 'RESULTS',
  nextLevel: 'NEXT LEVEL',
  replay: 'REPLAY',
  back: 'BACK',
  level: 'LEVEL',
  score: 'SCORE',
  best: 'BEST',
  time: 'TIME',
  newBest: 'NEW BEST!',
  timeUp: "TIME'S UP!",
  backOnTrack: 'BACK ON TRACK!',
  checkpoint: 'CHECKPOINT!',
  goldTarget: 'Gold',
  silverTarget: 'Silver',
  seeds: 'Seeds',
  failures: 'Falls',
  musicVolume: 'Music Volume',
  effectsVolume: 'Effects Volume',
  cameraShake: 'Camera Shake',
  reducedMotion: 'Reduced Motion',
  quality: 'Quality',
  qualityAuto: 'Auto',
  qualityLow: 'Low',
  qualityMedium: 'Medium',
  qualityHigh: 'High',
  resetProgress: 'Reset Progress',
  resetConfirm: 'Really erase all progress? This cannot be undone.',
  confirm: 'YES, RESET',
  cancel: 'CANCEL',
  lockedHint: 'Complete the previous level to unlock',
  campaignComplete: 'CAMPAIGN COMPLETE!',
  congratulations: 'You conquered every sky course!',
  totalScore: 'Total Score',
  totalStars: 'Stars',
  totalSeeds: 'Seeds',
  goldRimUnlocked: 'Gold Rim unlocked!',
  sprintUnlocked: 'Sprint Mode unlocked!',
  replayCampaign: 'REPLAY CAMPAIGN',
  replayFinal: 'REPLAY FINAL LEVEL',
  playSprint: 'PLAY SPRINT MODE',
  sprintOver: 'SPRINT OVER',
  distance: 'Distance',
  tryAgain: 'TRY AGAIN',
  loading: 'Loading',
  tapToStart: 'TAP TO START',
  go: 'ROLL!',
  starReq3: 'Gold time + all 3 seeds for 3 stars',
  starReqSilver: 'Beat the silver time for 2 stars',
  errorTitle: 'Something went wrong',
  errorRetry: 'RETRY',
  version: 'v',
};

let active = en;

export function setLanguage(lang: string): void {
  // English only for now; structure allows adding translations without code changes.
  if (lang.startsWith('en')) active = en;
  else active = en;
}

export function t(key: string): string {
  return active[key] ?? en[key] ?? key;
}
