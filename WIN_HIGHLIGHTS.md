# Win Highlighting System — Card Games

## 🎯 Visual Win Effects Based on Win Size

### **Win Size Categories**

| Win Ratio | Category | Emoji | Animation | Colors | Sound |
|-----------|----------|-------|-----------|--------|-------|
| 10x+ | **MEGA WIN** | 🏆 | `megaWin` pulse + shine | Gold-Orange-Gold gradient | `bigwin` |
| 5x-9.9x | **BIG WIN** | 💰 | `bigWin` pulse | Gold-Orange gradient | `bigwin` |
| 2x-4.9x | **MEDIUM WIN** | 💸 | `mediumWin` pulse | Gold gradient | `win` |
| 1x-1.9x | **SMALL WIN** | 🎉 | `winPulse` pulse | Gold gradient | `win` |
| Blackjack | **BLACKJACK** | 🃏 | `blackjackWin` pulse | Gold-Green-Gold gradient | `blackjack` |

### **Visual Effects**

#### 1. **Win Display Banner**
- **Pulsing animation** — Scale up/down with different intensities
- **Gradient backgrounds** — Different colors based on win size
- **Shine effect** — Moving light reflection across the banner
- **Glowing shadows** — Intensified glow for bigger wins
- **Win multiplier** — Shows X.X multiplier (e.g., 5.0x MULTIPLIER)

#### 2. **Card Highlights**
- **Glowing cards** — Winning cards pulse with gold glow
- **Radial gradient** — Gold overlay on winning cards
- **Enhanced shadows** — Cards cast golden shadows

#### 3. **Player Seat Effects**
- **Winner border** — Green border for winning players
- **Loser border** — Red border for losing players
- **Shine overlay** — Moving light effect on winning seats
- **Emoji indicators** — 🏆 for winners, ❌ for losers

### **Sound Integration**

#### Win Sounds:
- **Small/Medium wins** → `win` sound (4-note ascending chime)
- **Big/Mega wins** → `bigwin` sound (6-note fanfare with noise burst)
- **Blackjack** → `blackjack` sound (special 5-note fanfare)
- **Lose** → `lose` sound (descending dull thud)
- **Push/Tie** → `push` sound (neutral ping)

#### Automatic Sound Triggers:
- Detects win ratio and plays appropriate sound
- Blackjack gets special sound
- Auto-clears win display after 5 seconds

### **CSS Animations Added**

```css
@keyframes winCardGlow { 0%, 100% { box-shadow: 0 0 10px gold; } 50% { box-shadow: 0 0 25px gold; } }
@keyframes goldPulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.7; } }
@keyframes winPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
@keyframes mediumWin { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }
@keyframes bigWin { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
@keyframes megaWin { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
@keyframes blackjackWin { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.07); } }
@keyframes shine { 0% { transform: translateX(-100%) rotate(45deg); } 100% { transform: translateX(100%) rotate(45deg); } }
```

### **Components**

#### `WinDisplay` Component
```javascript
<WinDisplay amount={winAmount} betAmount={betAmount} resultType={result} />
```

**Features:**
- Auto-calculates win ratio
- Applies appropriate animation
- Shows win multiplier
- Displays category (SMALL WIN, BIG WIN, etc.)
- Includes emoji based on win size

#### Enhanced `Card` Component
```javascript
<Card card={card} winHighlight={isWinner} />
```

**Features:**
- Gold glow animation on winning cards
- Radial gradient overlay
- Enhanced shadows

### **Real-time Detection**

**Win Detection Logic:**
```javascript
// When table state updates
if (state?.phase === 'results' && oldTable?.phase !== 'results') {
  const mySeat = state.seats?.find(s => s.userId === user.id);
  if (mySeat?.lastPayout > 0) {
    const winRatio = mySeat.lastPayout / mySeat.bet;
    setLastWin({ amount: mySeat.lastPayout, bet: mySeat.bet, result: mySeat.result });
    
    // Play appropriate sound
    if (winRatio >= 5) playSound('bigwin');
    else playSound('win');
    
    if (mySeat.result === 'blackjack') playSound('blackjack');
  }
}
```

### **Visual Hierarchy**

1. **MEGA WIN** (10x+) — Most prominent, orange-gold gradient, largest scale
2. **BIG WIN** (5x-9.9x) — Strong gold-orange, noticeable scale
3. **MEDIUM WIN** (2x-4.9x) — Gold gradient, moderate scale
4. **SMALL WIN** (1x-1.9x) — Gold gradient, subtle scale
5. **BLACKJACK** — Special green-gold gradient, unique animation

### **User Experience**

**For Players:**
- Immediate visual feedback on win size
- Exciting animations for big wins
- Clear distinction between small/big wins
- Professional casino feel
- Audio-visual celebration

**For Developers:**
- Easy to extend with more win categories
- Modular component system
- Performance optimized (CSS animations)
- Responsive design ready

### **Files Modified**

```
frontend/src/pages/player/CardGame.jsx
```

### **Testing Scenarios**

1. **Small win** (1.5x) → Gold banner, 🎉 emoji, subtle pulse
2. **Medium win** (3x) → Gold banner, 💸 emoji, medium pulse
3. **Big win** (7x) → Gold-orange banner, 💰 emoji, strong pulse
4. **Mega win** (15x) → Gold-orange-gold banner, 🏆 emoji, intense pulse
5. **Blackjack** (2.5x) → Gold-green banner, 🃏 emoji, special animation
6. **Lose** → Red border, ❌ indicator, lose sound
7. **Push** → Neutral display, push sound

### **Future Enhancements**

- Add confetti animation for mega wins
- Add win streak counter
- Add achievement badges
- Add win history panel
- Add social sharing for big wins
- Add haptic feedback for mobile
