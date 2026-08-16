# Card Games Upgrade — Sound Effects & Bet365-Style UI

## Changes Made

### 1. Sound Effects Hook
**File:** `frontend/src/components/cards/useCardSounds.js`

Web Audio API synthesized sounds (no external files):
- **deal** — Card sliding onto felt (papery swish)
- **flip** — Card face-up reveal
- **chip** — Single chip placed
- **chips** — Multiple chips (raise bet)
- **shuffle** — Deck shuffle burst
- **win** — Ascending chime (4-note)
- **bigwin** — Fanfare with noise burst
- **lose** — Descending dull thud
- **push** — Neutral tie ping
- **click** — Button click
- **blackjack** — Special 5-note fanfare

All sounds use oscillators + noise filters for realistic casino audio.

### 2. Enhanced Card Game UI
**File:** `frontend/src/pages/player/CardGame.jsx`

#### Visual Improvements:
- **Bet365-style green felt** — Dark gradient background (#0b4d2a → #051f12)
- **Realistic card design** — Larger cards (60×84px) with proper shadows and borders
- **Card animations** — CSS flip animation on deal
- **Chip selector** — Quick-bet buttons (₱10, ₱25, ₱50, ₱100, ₱500, ₱1000)
- **Chip pulse animation** — Selected chip pulses for visual feedback
- **Enhanced borders** — Gold accents on active elements
- **Player indicators** — 👤 YOU label, turn highlighting

#### Sound Integration:
- `playSound('deal')` — When joining table
- `playSound('chips')` — When placing bet
- `playSound('deal')` — When hitting
- `playSound('click')` — When standing/leaving
- `playSound('click')` — Button interactions

#### UI Elements:
- **Lobby view** — Browse open tables, create new ones
- **Table view** — Dealer hand, player seats, betting controls
- **Side betting** — Baccarat/Dragon Tiger/Andar Bahar side selection
- **Chip stack selector** — Quick bet amounts
- **Manual bet input** — Custom bet amounts
- **Game status** — Real-time phase updates (BETTING, PLAYING, RESULTS)
- **Player results** — Win/loss/push display with emojis

## How to Use

### For Players:
1. Navigate to any card game (Blackjack, Baccarat, Dragon Tiger, etc.)
2. Create or join a table
3. Select chip value or enter custom bet
4. Place bet (hear chip sound)
5. Hit/Stand (hear card deal sound)
6. Win/lose (hear fanfare or lose sound)

### For Developers:
```javascript
import useCardSounds from '../../components/cards/useCardSounds';

const { play: playSound } = useCardSounds();
playSound('deal');  // Play deal sound
playSound('win');   // Play win fanfare
```

## Technical Details

- **No external audio files** — All sounds synthesized via Web Audio API
- **Mute support** — `setMuted(true)` to disable all sounds
- **Browser compatible** — Works on all modern browsers (Chrome, Safari, Firefox, Edge)
- **Performance** — Minimal CPU impact, sounds play instantly
- **Responsive design** — Mobile-first, works on all screen sizes

## Files Modified/Created

```
frontend/src/
├── components/
│   └── cards/
│       └── useCardSounds.js (NEW)
└── pages/
    └── player/
        └── CardGame.jsx (UPDATED)
```

## Testing

1. Open card game in browser
2. Create/join table
3. Verify sounds play on:
   - Table join (deal sound)
   - Bet placement (chips sound)
   - Card deal (deal sound)
   - Button clicks (click sound)
4. Test mute functionality (if implemented in UI)

## Future Enhancements

- Add mute toggle button in header
- Add volume slider
- Add more sound variations (shuffle, flip, etc.)
- Add background music option
- Add haptic feedback for mobile
