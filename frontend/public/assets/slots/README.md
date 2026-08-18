# 🎰 Slot Game Image Assets

Each game theme can have its own custom symbols loaded from this folder.

## Folder Structure

```
/assets/slots/
  ├── fortune-tiger/
  │   ├── wild.png        (or .webp)
  │   ├── scatter.png
  │   ├── seven.png
  │   ├── bar.png
  │   ├── ace.png
  │   ├── king.png
  │   ├── queen.png
  │   └── jack.png
  │
  ├── mahjong-ways/
  │   ├── scatter.png
  │   ├── wild.png
  │   ├── seven.png
  │   ├── bar.png
  │   └── ... (ace, king, queen, jack)
  │
  └── gates-of-olympus/
      └── ... (same pattern)
```

## How to Add Custom Images

1. **Create a folder** with your game's slug (e.g., `fortune-tiger`)
2. **Add PNG or WebP images** for each symbol ID:
   - `wild.png` - Wild symbol
   - `scatter.png` - Scatter symbol  
   - `seven.png` - High-value symbol
   - `bar.png` - Mid-value symbol
   - `ace.png`, `king.png`, `queen.png`, `jack.png` - Card symbols

3. **Image specs:**
   - Format: PNG (with transparency) or WebP
   - Size: 256x256px recommended (any size works, auto-scaled)
   - Style: Full symbol artwork, centered

## Symbol IDs by Theme

| Theme | scatter | wild | seven | bar |
|-------|---------|------|-------|-----|
| fortune-tiger | 🧧 Red Envelope | 🐅 Tiger | 🐯 Golden Tiger | 🎪 Lantern |
| mahjong-ways | 🎴 Mahjong Tile | 🀄 Red Dragon | 🀇 Character One | 🀙 Bamboo One |
| gates-of-olympus | 🏛️ Temple | ⚔️ Zeus Lightning | 👑 Crown | 🦅 Eagle |

## Fallback Behavior

- If no image is found for a symbol → displays the emoji instead
- If a theme folder doesn't exist → uses emoji for all symbols
- To reset to emoji → delete or rename the image file

## Example: Add Fortune Tiger Tiger Image

```bash
cd frontend/public/assets/slots
mkdir -p fortune-tiger
# Copy your tiger artwork:
cp ~/Downloads/tiger-wild.png fortune-tiger/wild.png
```

The wild symbol in Fortune Tiger will now show your custom PNG instead of 🐅.
