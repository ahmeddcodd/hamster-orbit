# Licenses

## Project code and content

All game code, level designs, procedural art (canvas textures, generated geometry, shaders),
the hamster character, UI, and all synthesized audio in this repository are original works
created for this project.

No third-party media assets (images, models, fonts, audio files) are bundled. Text rendering
uses the player's system font stack.

## Third-party dependencies (runtime)

| Package | License | Use |
|---------|---------|-----|
| three | MIT | Rendering engine + math + post-processing passes (bundled locally) |

## Third-party dependencies (development only, not shipped)

| Package | License |
|---------|---------|
| typescript | Apache-2.0 |
| vite | MIT |
| vitest | MIT |
| eslint / typescript-eslint / @eslint/js | MIT |
| @types/three | MIT |

## Platform

The YouTube Playables SDK is loaded at runtime from `https://www.youtube.com/game_api/v1` as
required by the platform; it is not bundled or redistributed.

This game is an original work. It does not include or reproduce assets, names, courses, UI,
audio, or other content from any existing game.
