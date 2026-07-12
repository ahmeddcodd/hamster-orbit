# CLAUDE.md — Hamster Orbit: Sky Sprint

YouTube Playable: 3D hamster-ball time-race. TypeScript strict + Three.js core + Vite. npm only.

## Commands

- `npm run dev` / `npm run build` / `npm run preview`
- `npm run typecheck` · `npm run lint` · `npm test`
- `npm run check` — run ALL of the above + build before declaring work done.

## Hard invariants (do not break)

- **No external runtime dependencies**: no CDNs, fonts, remote assets, analytics, or network
  calls. Everything is procedural or bundled with relative paths (`vite base: './'`).
- **No physics engine**: ball physics is procedural (src/physics). One dynamic sphere; hazards
  are kinematic OBBs. Fixed timestep 1/120, frame delta clamped to 1/30.
- **All YouTube SDK usage stays in `src/platform/PlayablesBridge.ts`.** firstFrameReady before
  gameReady, each exactly once; loadData awaited before any saveData; never save per-frame.
- **Save merges are monotonic**: never lower stars/bests, never relock levels, never drop seeds.
- **Hazards are deterministic**: transforms are pure functions of run-elapsed time; `reset()`
  restores phase zero. Level restart must reproduce identical hazard timing.
- **10 levels, exactly 3 seeds each**; `levels/validator.ts` + tests enforce structure. Level
  count changes require `LEVEL_COUNT` in `save/save.ts`.
- Central tuning lives in `src/config/config.ts`; level data in `src/levels/definitions/`.
  No scattered magic numbers.
- Escape key must never be preventDefault-ed. No in-game quit/exit button, external links,
  logins, or purchases (platform certification).

## Architecture map

`game/Game.ts` orchestrates: state machine (`app/StateMachine.ts`), level lifecycle
(`levels/builder.ts` -> `LevelRuntime`), run rules (timer/score/respawn inside Game),
Sprint mode (`game/Sprint.ts`). Pure logic (score/stars/progression/save/timer) is separated and
unit-tested in `src/tests/`. UI is HTML/CSS (`ui/`), audio is fully synthesized
(`audio/AudioManager.ts`).

## Level authoring

Use helpers (`levels/helpers.ts`): `plat(x, z, w, d, yTop)`, `rampZ/rampX`, `rail`, `arrow`,
`cp`, `seed`. Convention: courses flow toward -Z; yaw 0 faces -Z. **Always check seams**: curve
pieces end on the arc-end line (e.g. exit at a=-PI/2 ends on the `x = center.x` line) — the next
platform must reach that line. Gaps must land LOWER (>=0.8) than the takeoff edge.

## Dev QA

Dev builds expose `window.__game`; `?softraf` runs the loop off setTimeout for rAF-throttled
panes. A waypoint bot pattern for driving levels lives in the session notes / can be re-injected
via console. Level validation throws at dev boot and runs in `npm test`.
