# Hamster Orbit: Sky Sprint

A premium 3D arcade roll-and-race obstacle platformer built as a **YouTube Playable**. Guide a
plucky hamster inside a transparent ball across floating sky-high checkerboard courses: build
momentum, balance on narrow bridges, ride magnetic walls, dodge toy-like machinery,
collect golden sunflower seeds, and beat the clock across a 10-level campaign plus an endless
**Sky Sprint** bonus mode.

- **Stack:** TypeScript (strict) · Three.js (core) · Vite · Web Audio · Vitest
- **Physics:** 100% procedural — native Three.js math (`Vector3`, `Quaternion`, OBB sphere sweeps).
  No external physics engine.
- **Assets:** 100% procedural (canvas textures, generated geometry, synthesized audio). Zero
  downloaded/bundled media files; the production bundle is ~700 KB (~185 KB gzipped).

## Core gameplay

- **Drag anywhere** (touch or mouse) to steer — drag distance is analog speed. **WASD/arrows** on
  keyboard. **R** restarts, **P**/**Escape** pauses. Braking = steer against your motion.
- Each level is a time race: reach the goal pad before the countdown hits zero.
- **Checkpoints** (paired flags) save your progress; falling or getting crushed costs time, never
  lives — respawns are ~1 second.
- **3 golden seeds per level** (30 total): one on the route, one requiring a detour, one on a
  risky line. Collected seeds persist (shown silver on replays).
- **Stars:** 1 = finish · 2 = beat silver time · 3 = beat gold time **and** collect all 3 seeds in
  that run.
- **Score:** completion + remaining-time bonus + seeds + shortcuts + enemy knockouts + glass
  smashes + clean-run + gold-time bonuses. Campaign score (sum of per-level bests) is submitted to
  the YouTube leaderboard.
- Finish the campaign to unlock the **gold ball rim** cosmetic and endless **Sprint Mode**.

## The 10 levels

| # | Name | Teaches |
|---|------|---------|
| 1 | Cloudtop Academy | Movement, momentum, braking, checkpoints, seeds |
| 2 | Skybridge Sprint | Narrow bridges, momentum gaps, route choice, timed gate |
| 3 | Bumper Boulevard | Bumpers, launch pads, enemy-ball knockouts |
| 4 | Windmill Heights | Fan force, rotating bridges, moving platforms |
| 5 | Wobble Workshop | Seesaws, tilting platforms, balance |
| 6 | Neon Switchway | Flicker-bridge timing, speed tubes, route reading |
| 7 | Crystal Glide | Low-traction glass, early braking, breakable walls |
| 8 | Gravity Garden | Magnetic wall-rides, local gravity, speed boosts |
| 9 | Clockwork Core | Crushers, saws, hammers, mechanical timing |
| 10 | Orbit Mastery | Final exam: everything combined + mega launch |

## Commands

```sh
npm install        # install dependencies
npm run dev        # dev server (http://localhost:5173)
npm run build      # production build to dist/
npm run preview    # serve the production build statically
npm run typecheck  # strict TypeScript check
npm run lint       # ESLint
npm test           # Vitest logic tests
npm run check      # typecheck + lint + test + build
```

Dev-only flags: `?softraf` swaps requestAnimationFrame for a timer (for rAF-throttled embedded
panes); `window.__game` exposes the game instance for QA in dev builds.

## Deployment (Vercel)

The repo is Vercel-ready — `vercel.json` pins the framework (Vite), build command, and output
directory, and adds long-lived caching for the hashed `/assets/*` bundle.

- **One-click:** import the GitHub repo at [vercel.com/new](https://vercel.com/new). Vercel
  auto-detects the config; no environment variables are needed (the game is fully self-contained
  and makes no server calls).
- **CLI:** `npm i -g vercel && vercel` (or `vercel --prod`).

Because Vite is configured with `base: './'` (relative asset paths, required for YouTube
Playables), the built site also works from any subpath or static host, not just the domain root.
The YouTube Playables SDK is loaded from `youtube.com` at runtime and is a harmless no-op when the
game runs outside the Playables environment (e.g. on your Vercel URL), falling back to
`localStorage` for saves.

## Architecture

```
src/
  config/config.ts       central tuning + product metadata (single source of truth)
  app/StateMachine.ts     explicit game-state machine (no loose booleans)
  platform/               PlayablesBridge: ALL YouTube SDK usage lives here
  save/                   versioned, defensively-parsed cloud save + write coordinator
  physics/                procedural OBB colliders + sphere resolver + magnet/force/trigger fields
  input/                  unified pointer joystick + keyboard
  player/                 fixed-timestep ball controller, shell visuals, procedural hamster
  camera/                 damped three-quarter follow rig with trauma shake + dynamic FOV
  rendering/              renderer/quality tiers, palette materials, environment, post FX
  audio/                  fully synthesized SFX + generative music (no audio files)
  effects/                pooled particles, ring pulses, floating score text
  hazards/                14 hazard types behind one deterministic interface
  levels/                 data-driven definitions (L1-L10), builder, validator, mesh factories
  game/                   Game orchestrator + endless Sprint generator
  gameplay/               timer/score/stars/progression pure logic (unit-tested)
  ui/                     HTML/CSS screens + HUD
  tests/                  Vitest suites
```

### YouTube Playables integration

- The SDK `<script src="https://www.youtube.com/game_api/v1">` loads **before** the game module in
  `index.html`.
- `firstFrameReady()` fires once after the first painted loading frame; `gameReady()` fires once
  when the title screen is interactive. Duplicate/ordering violations are guarded.
- `loadData()` is always awaited before any `saveData()`. Saves are debounced for settings and
  immediate for milestones; writes are serialized and never per-frame.
- Platform pause halts simulation, rendering, and audio (context suspended) and flushes a save;
  resume never auto-resumes gameplay (lands on the pause menu). The Page Visibility API is not used
  as pause authority.
- Audio obeys `isAudioEnabled()`/`onAudioEnabledChange` with highest priority; there is no
  master-mute toggle in-game.
- Scores: only the best campaign score (sum of per-level best scores) is submitted, only when it
  is a valid integer, matches the stored best, and strictly exceeds the previously submitted value.
- Outside the Playables environment a local-development bridge emulates save/load via
  `localStorage` (dev only) and no-ops platform calls.

### Cloud save format (v1, ~1.5 KB)

```jsonc
{
  "version": 1, "updatedAt": 0,
  "highestUnlockedLevel": 1, "campaignCompleted": false,
  "bestCampaignScore": 0, "bestEndlessScore": 0, "submittedScore": 0,
  "levels": { "level01": { "unlocked": true, "completed": false, "bestTimeMs": 0,
              "bestScore": 0, "stars": 0, "seedMask": 0, "fewestFailures": -1 } /* ...level10 */ },
  "cosmetics": { "goldRimUnlocked": false, "selectedRim": "classic" },
  "settings": { "musicVolume": 0.8, "effectsVolume": 0.9, "cameraShake": true,
                "reducedMotion": false, "quality": "auto" }
}
```

Parsing is fully defensive (empty/malformed/corrupt/older data all recover), merges are monotonic
(stars/bests/seeds/unlocks never regress), and unknown fields are ignored.

## How to…

- **Add a level:** create `src/levels/definitions/levelNN.ts` (copy an existing one — helpers in
  `levels/helpers.ts` keep it compact), register it in `levels/registry.ts`, bump `LEVEL_COUNT` in
  `save/save.ts`. The validator enforces start/goal/3 seeds/checkpoints/times at dev boot and in
  tests.
- **Add a hazard:** implement the `Hazard` base class (deterministic `update(dt, elapsed)`,
  `reset()`, `dispose()`), add a def variant in `levels/types.ts`, and wire it in
  `hazards/factory.ts`.
- **Tune physics/camera/score:** everything lives in `src/config/config.ts`.
- **Change title/version/developer:** `PRODUCT` in `src/config/config.ts`.
- **Replace audio:** all audio is synthesized in `src/audio/AudioManager.ts`; profiles for music
  live in the same file.
- **Quality tiers:** `QUALITY_PRESETS` in config; AUTO monitors sustained frame time and steps
  down (never oscillates up). Changing tier at runtime never resets game state.

## Performance strategy

One dynamic physics body (the ball); analytic kinematic hazards; a handful of OBB colliders per
level (never per-checker-tile); shared per-palette materials; a single pooled particle system;
2-3 dynamic lights with one tight-fitted shadow camera that follows the player; pixel ratio capped
at 2 (1.2 on low tier); bloom/grade post FX only on medium+ tiers; zero allocations in hot loops
(preallocated scratch vectors); DOM writes only on value changes.

## Submission checklist (verify with current YouTube tooling before submitting)

- [x] `dist/index.html` at build root, relative paths only, SDK script before game code
- [x] Initial bundle < 30 MiB (actual: ~0.7 MB) · save < 3 MiB (actual: ~1.5 KB)
- [x] Touch + mouse + keyboard; portrait/landscape/square; no orientation lock
- [x] firstFrameReady/gameReady ordering; load-before-save; pause/resume; audio state
- [x] No external runtime requests, links, logins, purchases, or quit buttons
- [ ] Final review against the latest official Playables requirements & test suite

**Note:** this project cannot self-certify — final submission must be validated against the
latest official YouTube Playables requirements and tooling.

## Known limitations

- Music is generative/synthesized — pleasant but simple; swap in composed loops for more character.
- The magnetic wall-ride is an arcade approximation (radial gravity field), tuned for fun
  rather than physical accuracy.
- A full vertical loop-the-loop was cut: a closed ring standing on the floor is geometrically
  unenterable without a dedicated banked entry ramp (the ring's lower arc blocks the approach),
  and it could soft-lock the ball. Levels 8 and 10 use the magnetic wall-ride and boost pads
  instead. Re-adding it would need a tangential entry ramp feeding the ring's inner surface.
- Camera yaw follows velocity; on tight S-curves it can lag a fast, sloppy line.
- English strings only (structure supports adding languages via the platform language API).

## Licensing

All code, art, audio, and content are original and generated procedurally in-project. See
`LICENSES.md`. Three.js is MIT-licensed.
