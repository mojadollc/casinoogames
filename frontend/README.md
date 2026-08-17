# CasinoOGames — V6 PixiJS Texture-Atlas Build

This is the V6 visual build of the existing React/Vite slot game.

### Main renderer

`frontend/src/components/slots/PixiSlotReels.jsx`

### Assets

`frontend/public/assets/slots/symbols.png`
`frontend/public/assets/slots/symbols.json`
`frontend/public/assets/slots/particle.png`

### Install and build

```bash
cd frontend
npm ci
npm run build
```

If you are using the existing backend/API, keep your existing environment/API configuration when deploying the frontend.

### Notes

V6 changes the presentation/rendering layer. It does not intentionally change server-side outcome/RNG or wallet accounting logic.

The included symbol artwork is original generated artwork intended as a replaceable starter asset pack. It does not copy artwork from the reference game.
