# PixiJS V4 Visual Upgrade

This version builds on V3 and adds a dedicated PixiJS FX layer while preserving the existing React/game API flow.

## Added
- Full-screen Big Win animation driven by existing `showBigWin` / `lastWin` state
- Win burst animation for ordinary wins
- Free Spins transition/banner when the free-spin count increases
- Animated rays, overlay bloom, coins and confetti
- Responsive PixiJS rendering and device-pixel-ratio support from V3
- Existing procedural symbol artwork retained as original placeholder artwork
- Existing server-side result flow is untouched

## Main files
- `frontend/src/components/slots/PixiSlotReels.jsx`
- `frontend/src/pages/player/SlotGame.jsx`

## Build note
A full `npm ci` / Vite production build could not be completed in the execution environment because dependency installation timed out. The package manifest includes PixiJS and the source is packaged for local verification.
