const crypto = require('crypto');

// Cryptographically secure RNG
class SecureRNG {
  generate(min, max) {
    const range = max - min + 1;
    const bytes = crypto.randomBytes(4);
    const value = bytes.readUInt32BE(0);
    return min + (value % range);
  }

  generateSeed() {
    return crypto.randomBytes(32).toString('hex');
  }

  shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.generate(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

// Default slot configuration
const DEFAULT_CONFIG = {
  reels: 5,
  rows: 3,
  symbols: [
    { id: 'wild',   name: 'Wild',   weight: 2,  payout: { 3: 10,  4: 30,  5: 100  }, isWild: true },
    { id: 'scatter',name: 'Scatter',weight: 3,  payout: { 3: 2,   4: 8,   5: 25   }, isScatter: true },
    { id: 'seven',  name: 'Seven',  weight: 5,  payout: { 3: 8,   4: 20,  5: 75   } },
    { id: 'bar',    name: 'Bar',    weight: 8,  payout: { 3: 5,   4: 12,  5: 40   } },
    { id: 'bell',   name: 'Bell',   weight: 10, payout: { 3: 4,   4: 10,  5: 25   } },
    { id: 'cherry', name: 'Cherry', weight: 12, payout: { 3: 3,   4: 7,   5: 18   } },
    { id: 'lemon',  name: 'Lemon',  weight: 15, payout: { 3: 1.5, 4: 4,   5: 10   } },
    { id: 'orange', name: 'Orange', weight: 15, payout: { 3: 1.5, 4: 4,   5: 10   } },
    { id: 'plum',   name: 'Plum',   weight: 15, payout: { 3: 1,   4: 3,   5: 7    } },
    { id: 'grape',  name: 'Grape',  weight: 15, payout: { 3: 1,   4: 3,   5: 7    } }
  ],
  paylines: [
    [1, 1, 1, 1, 1], // middle
    [0, 0, 0, 0, 0], // top
    [2, 2, 2, 2, 2], // bottom
    [0, 1, 2, 1, 0], // V shape
    [2, 1, 0, 1, 2], // inverted V
    [0, 0, 1, 2, 2], // diagonal down
    [2, 2, 1, 0, 0], // diagonal up
    [1, 0, 0, 0, 1], // U shape top
    [1, 2, 2, 2, 1], // U shape bottom
    [0, 1, 1, 1, 0], // slight V
    [2, 1, 1, 1, 2], // slight inverted V
    [1, 0, 1, 0, 1], // zigzag top
    [1, 2, 1, 2, 1], // zigzag bottom
    [0, 1, 0, 1, 0], // W top
    [2, 1, 2, 1, 2], // W bottom
    [1, 1, 0, 1, 1], // dip top
    [1, 1, 2, 1, 1], // dip bottom
    [0, 0, 1, 0, 0], // bump top
    [2, 2, 1, 2, 2], // bump bottom
    [0, 2, 0, 2, 0], // extreme zigzag
  ],
  freeSpinsScatterCount: 3,
  freeSpinsAwarded: 10,
  bonusMultiplier: 2,
  jackpotContribution: 0.01
};

class GameEngine {
  constructor(config = DEFAULT_CONFIG, gameSettings = {}) {
    this.config = config;
    this.rng = new SecureRNG();
    // Admin control settings
    this.settings = {
      winRate: gameSettings.win_rate !== undefined ? gameSettings.win_rate : 25,
      forceOutcome: gameSettings.force_outcome !== undefined ? gameSettings.force_outcome : null,
      minPayout: gameSettings.min_payout !== undefined ? gameSettings.min_payout : 0,
      maxPayout: gameSettings.max_payout !== undefined ? gameSettings.max_payout : 30,
      rtpTarget: gameSettings.rtp !== undefined ? gameSettings.rtp : 92,
      playerClass: gameSettings.player_class || 'normal',
      dryRun: gameSettings.dry_run || false,
      payoutCap: gameSettings.payout_cap !== undefined ? gameSettings.payout_cap : 0,
    };
  }

  // Get symbol weights based on player class and settings
  getAdjustedWeights() {
    const weights = {};
    const multiplier = this.settings.playerClass === 'vip' ? 1.5 : 
                       this.settings.playerClass === 'low' ? 0.7 : 1;
    
    this.config.symbols.forEach(s => {
      if (s.isWild || s.isScatter) {
        weights[s.id] = s.weight * multiplier;
      } else if (s.payout[5] > 100) {
        // High value symbols
        weights[s.id] = s.weight * multiplier;
      } else {
        weights[s.id] = s.weight;
      }
    });
    
    return weights;
  }

  // Generate weighted random symbol with admin controls
  getRandomSymbol(forceWin = false) {
    const symbols = this.config.symbols;
    
    // If forcing win, bias towards high-value symbols (3-of-a-kind payout >= 5)
    if (forceWin) {
      const winSymbols = symbols.filter(s => !s.isScatter && s.payout && (s.payout[3] || 0) >= 5);
      if (winSymbols.length === 0) return symbols.find(s => s.id === 'seven') || symbols[0];
      return winSymbols[this.rng.generate(0, winSymbols.length - 1)];
    }
    
    const weights = this.getAdjustedWeights();
    const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
    let random = this.rng.generate(1, totalWeight);
    
    for (const symbol of symbols) {
      random -= weights[symbol.id];
      if (random <= 0) return symbol;
    }
    return symbols[symbols.length - 1];
  }

  // Generate reel grid with potential forced outcome
  generateReels(forceWin = false) {
    const grid = [];
    for (let reel = 0; reel < this.config.reels; reel++) {
      const column = [];
      for (let row = 0; row < this.config.rows; row++) {
        column.push(this.getRandomSymbol(forceWin));
      }
      grid.push(column);
    }
    return grid;
  }

  // Generate guaranteed winning grid
  generateWinningGrid(betAmount) {
    const grid = this.generateReels(true);
    
    // Force a winning payline (middle line)
    const winSymbol = this.config.symbols.find(s => s.payout[5] && !s.isWild && !s.isScatter);
    for (let reel = 0; reel < 5; reel++) {
      grid[reel][1] = winSymbol;
    }
    
    return { grid, forcedSymbol: winSymbol };
  }

  // Generate guaranteed losing grid — verified against all paylines
  generateLosingGrid() {
    const lowSymbols = this.config.symbols.filter(s =>
      !s.isWild && !s.isScatter
    );
    // Ensure we have enough distinct symbols to break paylines
    const distinctSymbols = [...new Set(lowSymbols.map(s => s.id))].map(id => lowSymbols.find(s => s.id === id));
    if (distinctSymbols.length < 2) return this.generateReels(false);

    let attempts = 0;
    while (attempts < 50) {
      attempts++;
      const grid = [];
      for (let reel = 0; reel < this.config.reels; reel++) {
        const column = [];
        for (let row = 0; row < this.config.rows; row++) {
          column.push(lowSymbols[this.rng.generate(0, lowSymbols.length - 1)]);
        }
        grid.push(column);
      }
      // Break any accidental 3+ matches on all paylines
      for (const payline of this.config.paylines) {
        const lineSymbols = payline.map((row, col) => grid[col][row]);
        const first = lineSymbols[0];
        let matchCount = 0;
        for (const sym of lineSymbols) {
          if (sym.id === first.id || sym.isWild) matchCount++;
          else break;
        }
        if (matchCount >= 3) {
          // Replace reel 2 symbol on this payline with a different symbol
          const row2 = payline[2];
          const current = grid[2][row2];
          const alt = distinctSymbols.find(s => s.id !== first.id && s.id !== current.id);
          if (alt) grid[2][row2] = alt;
        }
      }
      // Verify no wins remain
      const wins = this.evaluatePaylines(grid);
      if (wins.length === 0) return grid;
    }
    // Fallback: force all different symbols per reel
    const grid = [];
    for (let reel = 0; reel < this.config.reels; reel++) {
      const column = [];
      for (let row = 0; row < this.config.rows; row++) {
        column.push(distinctSymbols[(reel + row + 1) % distinctSymbols.length]);
      }
      grid.push(column);
    }
    return grid;
  }

  // Evaluate paylines
  evaluatePaylines(grid) {
    const wins = [];
    const wildSymbol = this.config.symbols.find(s => s.isWild);

    for (let i = 0; i < this.config.paylines.length; i++) {
      const payline = this.config.paylines[i];
      const lineSymbols = payline.map((row, col) => grid[col][row]);
      const firstNonWild = lineSymbols.find(s => !s.isWild);
      
      if (!firstNonWild) {
        wins.push({ payline: i, symbol: wildSymbol.id, count: 5, payout: wildSymbol.payout[5] || 0 });
        continue;
      }

      let count = 0;
      for (const sym of lineSymbols) {
        if (sym.id === firstNonWild.id || sym.isWild) count++;
        else break;
      }

      if (count >= 3 && firstNonWild.payout && firstNonWild.payout[count]) {
        wins.push({ payline: i, symbol: firstNonWild.id, count, payout: firstNonWild.payout[count] });
      }
    }
    return wins;
  }

  // Detect scatters
  detectScatters(grid) {
    let count = 0;
    const positions = [];
    for (let col = 0; col < grid.length; col++) {
      for (let row = 0; row < grid[col].length; row++) {
        if (grid[col][row].isScatter) {
          count++;
          positions.push({ col, row });
        }
      }
    }
    return { count, positions };
  }

  // Calculate win based on RTP enforcement
  calculateEnforcedWin(betAmount) {
    // Base win calculation
    const baseWin = betAmount * (this.settings.rtpTarget / 100);
    // Add variance (±30%)
    const variance = this.rng.generate(70, 130) / 100;
    return Math.max(0, baseWin * variance);
  }

  // Main spin function with admin controls
  // forcedGrid: optional pre-built grid (used by createForcedOutcome / admin triggers)
  spin(betAmount, isFreeSpin = false, sessionStats = { totalBet: 0, totalWin: 0, spins: 0 }, forcedGrid = null) {
    const seed = this.rng.generateSeed();
    let grid, forcedOutcome = false;

    // force_outcome=loss takes HIGHEST priority — overrides everything
    if (this.settings.forceOutcome === 'loss') {
      grid = this.generateLosingGrid();
      forcedOutcome = 'loss_forced';
    }
    // Payout cap — force loss if session total already hit or exceeded the cap
    else if (this.settings.payoutCap > 0 && sessionStats.totalWin >= this.settings.payoutCap) {
      grid = this.generateLosingGrid();
      forcedOutcome = 'loss_cap';
    }
    // Pre-built grid (admin jackpot trigger)
    else if (forcedGrid) {
      grid = forcedGrid;
      forcedOutcome = 'admin_forced';
    }
    // Check forced outcome from admin
    else if (this.settings.forceOutcome === 'win' || this.settings.forceOutcome === 'big_win') {
      const result = this.generateWinningGrid(betAmount);
      grid = result.grid;
      // For big_win, force 5-of-a-kind on middle line with high-value symbol
      if (this.settings.forceOutcome === 'big_win') {
        const seven = this.config.symbols.find(s => s.id === 'seven') || result.forcedSymbol;
        for (let reel = 0; reel < 5; reel++) {
          grid[reel][1] = seven;
        }
      }
      forcedOutcome = this.settings.forceOutcome === 'big_win' ? 'big_win_forced' : 'win_forced';
    }
    else if (this.settings.forceOutcome === 'jackpot') {
      // Force jackpot symbols (all wilds)
      grid = this.generateReels(true);
      const wild = this.config.symbols.find(s => s.isWild);
      for (let reel = 0; reel < 5; reel++) {
        for (let row = 0; row < 3; row++) {
          grid[reel][row] = wild;
        }
      }
      forcedOutcome = 'jackpot_forced';
    }
    // Win rate control
    else if (!isFreeSpin) {
      const winRoll = this.rng.generate(1, 100);
      
      if (winRoll <= this.settings.winRate) {
        // Should win - bias towards winning grid
        const shouldForceWin = this.rng.generate(1, 100) <= 60;
        if (shouldForceWin) {
          const result = this.generateWinningGrid(betAmount);
          grid = result.grid;
          forcedOutcome = 'win_biased';
        } else {
          grid = this.generateReels(true);
        }
      } else {
        // Should lose - generate guaranteed losing grid
        grid = this.generateLosingGrid();
      }
    } else {
      grid = this.generateReels(this.settings.playerClass === 'vip');
    }

    const paylineWins = this.evaluatePaylines(grid);
    const scatters = this.detectScatters(grid);

    const isForceLoss = forcedOutcome === 'loss_forced' || forcedOutcome === 'loss_cap';

    // Forced loss = zero win, no exceptions
    let totalWin = isForceLoss ? 0 : paylineWins.reduce((sum, w) => sum + (w.payout * betAmount), 0);
    let freeSpinsAwarded = 0;

    // Apply min/max payout — ONLY on real wins, never on forced losses
    if (totalWin > 0 && !isForceLoss) {
      const payoutMultiplier = totalWin / betAmount;
      if (this.settings.minPayout > 0 && payoutMultiplier < this.settings.minPayout) {
        totalWin = betAmount * this.settings.minPayout;
      }
      if (this.settings.maxPayout > 0 && payoutMultiplier > this.settings.maxPayout) {
        totalWin = betAmount * this.settings.maxPayout;
      }
    }

    // Scatter wins — suppressed on forced loss
    const scatterSymbol = this.config.symbols.find(s => s.isScatter);
    if (!isForceLoss && scatters.count >= 3 && scatterSymbol?.payout[scatters.count]) {
      totalWin += scatterSymbol.payout[scatters.count] * betAmount;
      freeSpinsAwarded = this.config.freeSpinsAwarded;
    }

    // Free spin multiplier — not on forced loss
    if (isFreeSpin && !isForceLoss) {
      totalWin *= this.config.bonusMultiplier;
    }

    // VIP bonus — not on forced loss
    if (this.settings.playerClass === 'vip' && totalWin > 0 && !isForceLoss) {
      totalWin *= 1.1;
    }

    // Jackpot contribution
    const jackpotContribution = betAmount * this.config.jackpotContribution;

    // Round to 2 decimals
    totalWin = parseFloat(totalWin.toFixed(2));

    return {
      seed,
      grid: grid.map(col => col.map(s => ({ id: s.id, name: s.name }))),
      paylineWins,
      scatters,
      totalWin,
      freeSpinsAwarded,
      bonusTriggered: freeSpinsAwarded > 0,
      jackpotContribution,
      isFreeSpin,
      betAmount,
      forcedOutcome,
      playerClass: this.settings.playerClass,
      dryRun: this.settings.dryRun
    };
  }

  // Check jackpot win
  checkJackpot(currentJackpot) {
    // VIP players have 2x jackpot chance
    const jackpotOdds = this.settings.playerClass === 'vip' ? 50000 : 100000;
    const roll = this.rng.generate(1, jackpotOdds);
    return roll === 1 ? currentJackpot : 0;
  }

  // Force specific outcome (admin control)
  // Returns a full spin result with the intended grid actually applied
  static createForcedOutcome(type, betAmount) {
    const engine = new GameEngine(DEFAULT_CONFIG);
    let grid;
    
    switch (type) {
      case 'big_win': {
        grid = engine.generateReels(true);
        const seven = DEFAULT_CONFIG.symbols.find(s => s.id === 'seven');
        for (let i = 0; i < 5; i++) grid[i][1] = seven;
        break;
      }
      case 'jackpot': {
        grid = engine.generateReels(true);
        const wild = DEFAULT_CONFIG.symbols.find(s => s.isWild);
        for (let i = 0; i < 5; i++) {
          for (let j = 0; j < 3; j++) {
            grid[i][j] = wild;
          }
        }
        break;
      }
      case 'loss':
        grid = engine.generateLosingGrid();
        break;
      default:
        grid = engine.generateReels(false);
    }
    
    // Pass the prepared grid so spin does not regenerate it
    return engine.spin(betAmount, false, { totalBet: 0, totalWin: 0, spins: 0 }, grid);
  }
}

module.exports = { GameEngine, SecureRNG, DEFAULT_CONFIG };
