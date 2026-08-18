# Custom Slot Game Images Guide

This guide explains how to add custom PNG/WebP images for each slot game, replacing the default emoji symbols.

---

## Quick Start

1. **Create a folder** for your game in `frontend/public/assets/slots/{game-slug}/`
2. **Add images** named after symbol IDs (wild.png, scatter.png, etc.)
3. **Rebuild and deploy**

---

## Folder Structure

```
frontend/public/assets/slots/
│
├── README.md                          ← This file
│
├── fortune-tiger/                     ← Game slug folder
│   ├── wild.png                       ← Tiger Wild symbol
│   ├── scatter.png                    ← Red Envelope / Scatter
│   ├── seven.png                      ← Golden Tiger
│   ├── bar.png                        ← Lantern
│   ├── ace.png                        ← Ace card
│   ├── king.png                       ← King card
│   ├── queen.png                      ← Queen card
│   └── jack.png                       ← Jack card
│
├── mahjong-ways/
│   ├── wild.png                       ← Red Dragon
│   ├── scatter.png                    ← Mahjong Tile
│   ├── seven.png                      ← Character One
│   ├── bar.png                        ← Bamboo One
│   └── ... (ace, king, queen, jack)
│
├── gates-of-olympus/
│   ├── wild.png                       ← Zeus Lightning
│   ├── scatter.png                    ← Temple
│   ├── seven.png                      ← Crown
│   ├── bar.png                        ← Eagle
│   └── ... (ace, king, queen, jack)
│
└── ... (other game folders)
```

---

## Image Requirements

| Property | Specification |
|----------|---------------|
| **Format** | PNG (with transparency) or WebP |
| **Size** | 256x256px recommended (any size works, auto-scaled) |
| **Background** | Transparent |
| **Style** | Full symbol artwork, centered |
| **File naming** | Use lowercase symbol IDs (wild.png, scatter.png, etc.) |

---

## Symbol IDs Reference

Each slot game uses these symbol IDs. Create one image per ID:

| Symbol ID | Description | Typical Use |
|-----------|-------------|-------------|
| `wild` | Wild symbol | Substitutes for other symbols |
| `scatter` | Scatter symbol | Triggers free spins (3+ anywhere) |
| `seven` | High-value symbol | Top regular payout |
| `bar` | Mid-value symbol | Medium payout |
| `ace` | Card symbol | Lower payout |
| `king` | Card symbol | Lower payout |
| `queen` | Card symbol | Lower payout |
| `jack` | Card symbol | Lowest payout |

---

## Symbol IDs by Game Theme

| Game Slug | scatter | wild | seven | bar |
|-----------|---------|------|-------|-----|
| `fortune-tiger` | 🧧 Red Envelope | 🐅 Tiger Wild | 🐯 Golden Tiger | 🎪 Lantern |
| `fortune-ox` | 💰 Gold Ingot | 🐂 Ox Wild | 🐃 Water Buffalo | 🌾 Rice |
| `fortune-mouse` | 🧀 Golden Cheese | 🐭 Mouse Wild | 🐀 Rat King | 🍚 Rice Bowl |
| `gates-of-olympus` | 🏛️ Temple | ⚔️ Zeus Lightning | 👑 Crown | 🦅 Eagle |
| `starlight-princess` | ⭐ Star | 👸 Princess Wild | 👑 Crown | 💫 Sparkle |
| `sweet-bonanza` | 🍬 Candy Scatter | 🍭 Lollipop Wild | 🎂 Cake | 🍩 Donut |
| `wild-bandito` | 💰 Money Bag | 🤠 Bandito Wild | 🌵 Cactus | 🪣 Gold Pan |
| `mahjong-ways` | 🎴 Mahjong Tile | 🀄 Red Dragon | 🀇 Character One | 🀙 Bamboo One |
| `mahjong-ways-2` | 🎴 Golden Tile | 🀄 Red Dragon | 🀇 Character Wan | 🀙 Bamboo Suo |
| `dragon-legend` | 🥚 Dragon Egg | 🐉 Dragon Wild | 🐲 Fire Dragon | 🔥 Flame |
| `lucky-neko` | 🐟 Fish | 🐱 Lucky Cat Wild | 😺 Golden Neko | 🎁 Gift Box |
| `bali-vacation` | 🌺 Hibiscus | 🏝️ Island Wild | 🌴 Palm Tree | 🏄 Surfboard |
| `caishen-wins` | 💰 Gold Ingot | 🧧 Caishen Wild | 🏮 Lantern | 💎 Jade |
| `double-fortune` | 💎 Jewel | 🎎 Double Wild | ❤️ Heart | 🪭 Double Fan |
| `gem-saviour` | 💎 Emerald | ⚔️ Sword Wild | 🔮 Crystal | 🛡️ Shield |
| `dragon-fortune` | 🥚 Dragon Egg | 🐉 Dragon Wild | 💎 Blue Orb | 🔥 Fire |

---

## Step-by-Step: Adding Custom Images

### Step 1: Create the Game Folder

```bash
cd frontend/public/assets/slots
mkdir -p fortune-tiger
```

### Step 2: Prepare Your Images

- Use PNG format with transparent background
- Size: 256x256px (or any square dimension)
- Center the artwork within the canvas

### Step 3: Name and Place Files

```bash
# Copy your images with correct names
cp ~/Downloads/tiger-wild-artwork.png fortune-tiger/wild.png
cp ~/Downloads/red-envelope.png fortune-tiger/scatter.png
cp ~/Downloads/golden-tiger.png fortune-tiger/seven.png
cp ~/Downloads/lantern.png fortune-tiger/bar.png
```

### Step 4: Verify File Structure

```bash
ls -la fortune-tiger/
# Should show:
# wild.png
# scatter.png
# seven.png
# bar.png
# ace.png (optional)
# king.png (optional)
# queen.png (optional)
# jack.png (optional)
```

### Step 5: Rebuild and Deploy

```bash
# Local test
cd frontend
npm run build
npm run preview

# Production deploy
cd /opt/casino-platform
git pull origin main
cd frontend && npm run build
systemctl reload nginx
pm2 restart all
```

---

## Fallback Behavior

If no custom image is found, the system automatically falls back to emoji:

| Scenario | Result |
|----------|--------|
| Image file exists | Loads PNG/WebP image |
| Image file missing | Shows emoji (🐅, 🧧, etc.) |
| Game folder doesn't exist | All symbols use emoji |
| Invalid image file | Shows emoji |

---

## Tips for Best Results

### Image Design
- Use **vibrant colors** that match the game theme
- Add **subtle glow/shadow** for depth
- Keep designs **simple and recognizable** at small sizes
- Use **transparent PNG** for clean overlay on any background

### Performance
- **WebP format** is preferred (smaller file size)
- Keep file sizes under **50KB per image**
- Use **texture atlases** for many symbols (advanced)

### Testing
1. Test on **mobile devices** (smaller screens)
2. Check **win animations** don't clip images
3. Verify images load correctly on **slow connections**

---

## Example: Fortune Tiger Custom Set

```
frontend/public/assets/slots/fortune-tiger/
├── wild.png       ← detailed tiger face with gold border
├── scatter.png    ← red envelope with gold trim
├── seven.png      ← golden tiger roaring
├── bar.png        ← traditional red lantern
├── ace.png        ← styled "A" with flames
├── king.png       ← styled "K" with gold crown
├── queen.png      ← styled "Q" with lotus
└── jack.png       ← styled "J" with bamboo
```

---

## Troubleshooting

### Images not showing?
1. Check file names match exactly (lowercase: `wild.png` not `Wild.png`)
2. Verify folder name matches game slug exactly
3. Check file format (PNG or WebP only)
4. Clear browser cache and rebuild

### Images look blurry?
- Use higher resolution source images (512x512px)
- Ensure images aren't being stretched

### Images not loading on mobile?
- Check file sizes (keep under 50KB)
- Use WebP for better compression
- Test with Chrome DevTools throttling

---

## Advanced: Texture Atlas

For games with many symbols or animations, you can use a texture atlas:

```
frontend/public/assets/slots/fortune-tiger/
├── symbols.png    ← Single sprite sheet (all symbols)
└── symbols.json   ← JSON metadata with frame positions
```

The `symbols.json` format follows PixiJS texture atlas spec:

```json
{
  "frames": {
    "wild": { "frame": { "x": 0, "y": 0, "w": 256, "h": 256 } },
    "scatter": { "frame": { "x": 256, "y": 0, "w": 256, "h": 256 } },
    "seven": { "frame": { "x": 512, "y": 0, "w": 256, "h": 256 } }
  }
}
```

---

## Related Files

| File | Purpose |
|------|---------|
| `frontend/src/components/slots/SymbolTile.jsx` | Loads and displays symbol images |
| `frontend/src/data/gameThemes.js` | Defines symbol IDs and emoji fallbacks |
| `game-engine/engine.js` | Symbol IDs must match themes |

---

## Support

For issues or questions:
1. Check this documentation
2. Verify file structure matches examples
3. Test with browser DevTools Network tab
4. Check console for 404 errors on image files
