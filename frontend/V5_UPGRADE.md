# PixiJS V5 Visual Upgrade

V5 builds on V4 and adds a layered, runtime-generated effects system.

## Added
- Layered win-energy rays
- Expanding scatter ring
- Free-spin energy ring/transition
- Moving light-sweep/bloom layer
- Big-win multiplier badge
- Improved coin/confetti burst sequencing
- Runtime vector effects, avoiding copied third-party game artwork
- Existing React/game API/result flow preserved

## Main file
`frontend/src/components/slots/PixiSlotReels.jsx`

The renderer remains responsible for presentation. Game outcomes and wallet accounting remain outside the visual layer.
