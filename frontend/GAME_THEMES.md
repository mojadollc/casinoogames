# Slot Game Symbol Themes

Each slot game now has unique, themed symbols instead of generic fruit/bar symbols. Here's what players will see:

## Fortune Tiger 🐅
- **Wild**: 🐅 Tiger Wild (Orange)
- **Scatter**: 🧧 Lucky Red Envelope (Red)
- **High Value**: 🐯 Golden Tiger, 🎪 Lantern, 🎋 Bamboo
- **Standard**: 🍊 Mandarin, 🏯 Temple, 🎎 Daruma, 🪭 Fan, 🎐 Wind Chime

## Fortune Ox 🐂
- **Wild**: 🐂 Ox Wild (Red)
- **Scatter**: 💰 Gold Ingot (Gold)
- **High Value**: 🐃 Water Buffalo, 🌾 Rice, 🏔️ Mountain
- **Standard**: 🥬 Cabbage, 🧺 Basket, 🎋 Bamboo, 🪷 Lotus, ☔ Umbrella

## Fortune Mouse 🐭
- **Wild**: 🐭 Mouse Wild (Pink)
- **Scatter**: 🧀 Golden Cheese (Gold)
- **High Value**: 🐀 Rat King, 🍚 Rice Bowl, 🧧 Red Packet
- **Standard**: 🥮 Mooncake, 🏮 Lantern, 🧨 Firecracker, 🎎 Doll, 🪙 Coin

## Gates of Olympus ⚔️
- **Wild**: ⚔️ Zeus Lightning (Red)
- **Scatter**: 🏛️ Temple (Royal Blue)
- **High Value**: 👑 Crown, 🦅 Eagle, ⚡ Lightning Bolt
- **Standard**: 🛡️ Shield, 🏺 Amphora, 🌊 Wave, 🦉 Owl, 🍇 Grapes

## Starlight Princess 👸
- **Wild**: 👸 Princess Wild (Pink)
- **Scatter**: ⭐ Star (Gold)
- **High Value**: 👑 Crown, 💫 Sparkle, 🌙 Moon
- **Standard**: 💎 Diamond, 🌸 Cherry Blossom, 🎀 Ribbon, 💒 Castle, 🦄 Unicorn

## Sweet Bonanza 🍭
- **Wild**: 🍭 Lollipop Wild (Pink)
- **Scatter**: 🍬 Candy Scatter (Deep Pink)
- **High Value**: 🎂 Cake, 🍩 Donut, 🧁 Cupcake
- **Standard**: 🍪 Cookie, 🍦 Ice Cream, 🍫 Chocolate, 🧃 Juice Box, 🍇 Grape

## Wild Bandito 🤠
- **Wild**: 🤠 Bandito Wild (Orange)
- **Scatter**: 💰 Money Bag (Gold)
- **High Value**: 🌵 Cactus, 🪣 Gold Pan, 🦎 Lizard
- **Standard**: 🐎 Horse, 🌄 Sunset, 🎯 Target, 🪨 Rock

## Mahjong Ways 🀄
- **Wild**: 🀄 Red Dragon (Red)
- **Scatter**: 🎴 Mahjong Tile (Green)
- **High Value**: 🀇 Character One, 🀙 Bamboo One, 🀡 Dot One
- **Standard**: 🀐 Wind Tile, 🀅 Dragon Tile, 🀝 Bamboo Tile, 🀒 Number Tile, 🏛️ Mahjong Table

## Mahjong Ways 2 🀄
- **Wild**: 🀄 Red Dragon (Red)
- **Scatter**: 🎴 Golden Tile (Gold)
- **High Value**: 🀇 Character Wan, 🀙 Bamboo Suo, 🀡 Dots Tong
- **Standard**: 🏮 Lantern, 🧧 Red Envelope, 🏯 Pagoda, 🪭 Fan, 🌸 Sakura

## Dragon Legend 🐉
- **Wild**: 🐉 Dragon Wild (Orange-Red)
- **Scatter**: 🐉 Dragon Egg (Gold)
- **High Value**: 🐲 Fire Dragon, 🔥 Flame, ⚔️ Sword
- **Standard**: 💎 Jade Orb, 🏯 Temple, 🥋 Yin Yang, 📿 Prayer Beads, 🎋 Bamboo

## Lucky Neko 🐱
- **Wild**: 🐱 Lucky Cat Wild (Pink)
- **Scatter**: 🐟 Fish (Orange)
- **High Value**: 😺 Golden Neko, 🎁 Gift Box, 🏮 Lantern
- **Standard**: 🧧 Red Envelope, 🌸 Sakura, 🏯 Shrine, 🪭 Fan, 🎐 Wind Bell

## Bali Vacation 🏝️
- **Wild**: 🏝️ Island Wild (Cyan)
- **Scatter**: 🌺 Hibiscus (Deep Pink)
- **High Value**: 🌴 Palm Tree, 🏄 Surfboard, 🐚 Seashell
- **Standard**: 🍹 Cocktail, 🌅 Sunset, 🥥 Coconut, 🐢 Turtle, 🐠 Tropical Fish

## Caishen Wins 🧧
- **Wild**: 🧧 Caishen Wild (Red)
- **Scatter**: 💰 Gold Ingot (Gold)
- **High Value**: 🏮 Lantern, 💎 Jade, 🪙 Coin
- **Standard**: 📜 Scroll, 🏯 Temple, 🧨 Firecracker, 🎎 Statue, 🎋 Bamboo

## Double Fortune 🎎
- **Wild**: 🎎 Double Wild (Pink)
- **Scatter**: 💎 Jewel (Deep Pink)
- **High Value**: ❤️ Heart, 🪭 Double Fan, 🧧 Red Envelope
- **Standard**: 🏮 Lantern, 🌸 Blossom, 🪙 Coin, 🎐 Chime, 🏯 Pagoda

## Gem Saviour ⚔️
- **Wild**: ⚔️ Sword Wild (Royal Blue)
- **Scatter**: 💎 Emerald (Spring Green)
- **High Value**: 🔮 Crystal, 🛡️ Shield, 💅 Amethyst
- **Standard**: 💛 Topaz, 💙 Sapphire, ❤️ Ruby, 💎 Diamond, 📿 Necklace

## Dragon Fortune 🐉
- **Wild**: 🐉 Dragon Wild (Red)
- **Scatter**: 🥚 Dragon Egg (Gold)
- **High Value**: 💎 Blue Orb, 🔥 Fire, 💧 Water
- **Standard**: 🌳 Earth, 💨 Wind, ⚡ Thunder, ❄️ Ice, 🌀 Void

---

## Technical Details

### Frontend (SlotGame.jsx)
- Game-specific symbol themes defined in `GAME_THEMES` object
- Icons are rendered using Unicode emoji characters
- Colors are applied to symbol backgrounds and borders
- Fallback to `DEFAULT_SYMBOLS` for unlisted games

### Backend (engine.js)
- `GAME_SYMBOL_THEMES` configures symbol weights and payouts per game
- GameEngine constructor accepts `gameSlug` parameter
- Automatically applies themed symbols when game is identified

### Color Psychology
- **Tiger/Fortune games**: Warm oranges, reds, golds (lucky, prosperity)
- **Olympus/Mythology**: Royal blues, golds, silver (power, divinity)
- **Princess/Fantasy**: Pinks, purples, pastels (dreamy, magical)
- **Sweet Bonanza**: Bright pinks, candies, pastels (fun, playful)
- **Dragon/Asian**: Red, gold, jade green (traditional, auspicious)
- **Bali/Vacation**: Cyan, coral, tropical colors (relaxing, exotic)

All symbols maintain the same payout structure across games for consistency while providing visual variety and thematic immersion.
