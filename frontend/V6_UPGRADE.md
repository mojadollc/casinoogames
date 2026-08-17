# CasinoOGames V6 — Texture Atlas Renderer

V6 is the production-oriented visual asset pass on top of the V5 PixiJS renderer.

## What changed

- Added a local PixiJS texture atlas under `frontend/public/assets/slots/`.
- Replaced runtime procedural/emoji symbol rendering with GPU-friendly `Sprite` textures.
- Added `symbols.png` + `symbols.json` atlas metadata for deterministic browser caching.
- Added `particle.png` as a reusable particle asset for future particle batching.
- Kept the existing React game state, spin API, reel state, win state and free-spin state flow.
- Kept the V5 layered FX system: win, Big Win, Scatter-style ring, Free Spins transition, coins/confetti and light sweep.
- Added fallback `Texture.WHITE` handling if the atlas cannot be loaded.
- Fixed the V5 FX-layer initialization width reference.
- Updated the React/Pixi effect synchronization so win/free-spin props trigger FX updates.

## Asset pipeline

The intended production flow is now:

`PNG/WebP source art -> texture atlas -> PixiJS Assets.load() -> Sprite -> animation/FX`

The included atlas is original generated artwork and is not copied from the reference site/game.

## Compile

```bash
cd frontend
npm ci
npm run build
```

For local development:

```bash
npm run start
```

Vite serves `frontend/public` at the site root, so the atlas is loaded from:

`/assets/slots/symbols.json`

## Replacing the included art later

Keep the frame IDs the same (`wild`, `scatter`, `seven`, `bar`, `bell`, `cherry`, `lemon`, `orange`, `plum`, `grape`) and regenerate `symbols.png` + `symbols.json`. No reel-engine changes are required.
