# Platform Flows Documentation

---

## 1. Game Flow

### 1.1 Slot Machine Spin

```
Player clicks SPIN
  │
  ├─ Frontend validates bet amount (min/max)
  │
  └─ POST /api/games/:gameId/spin { betAmount }
       │
       ├─ Auth middleware (JWT)
       ├─ Validate game is active + bet within limits
       ├─ Check responsible gaming daily limit
       ├─ Load game controls from DB (TTL-cached 60s)
       │    └─ win_rate, force_outcome, min_payout, max_payout, payout_cap
       ├─ Check player-specific forced outcome (forced_outcomes table)
       ├─ Debit wallet (bet amount)
       │
       ├─ GameEngine.spin()
       │    ├─ Payout cap hit?  → generateLosingGrid()
       │    ├─ force_outcome = 'win'?  → generateWinningGrid()
       │    ├─ force_outcome = 'loss'? → generateLosingGrid()
       │    ├─ force_outcome = 'jackpot'? → all-wild grid
       │    └─ Normal flow:
       │         ├─ Roll 1–100 vs win_rate
       │         ├─ Win roll ≤ win_rate → generateWinningGrid() or biased reels
       │         └─ Win roll > win_rate → generateLosingGrid()
       │
       ├─ evaluatePaylines() → paylineWins[]
       ├─ detectScatters() → freeSpinsAwarded if ≥ 3 scatters
       ├─ Apply min/max payout multiplier clamp
       ├─ Apply free spin 2× multiplier (if isFreeSpin)
       ├─ Apply VIP 1.1× bonus (if player_class = 'vip')
       │
       ├─ checkJackpot() → 1 in 100,000 chance (1 in 50,000 for VIP)
       │    └─ Win → reset jackpot pool, create new pool
       │    └─ No win → add jackpotContribution (1% of bet) to pool
       │
       ├─ Credit wallet (totalWin)
       ├─ Insert game_rounds record
       ├─ Insert bets + wins records
       ├─ Insert free_spins record (if awarded)
       ├─ Mark forced_outcome as used
       │
       └─ Response: { grid, paylineWins, totalWin, freeSpinsAwarded, balance }
```

### 1.2 Free Spin

```
POST /api/games/:gameId/free-spin
  │
  ├─ Lookup active free_spins row (used_spins < total_spins, not expired)
  ├─ GameEngine.spin(min_bet, isFreeSpin=true)
  │    └─ No wallet debit
  │    └─ 2× bonusMultiplier applied to winnings
  ├─ Credit wallet (win)
  ├─ Increment used_spins
  └─ Response: { ...result, freeSpinsRemaining }
```

### 1.3 Fishing Game

```
POST /api/games/:gameId/fishing-shoot { betAmount }
  │
  ├─ Debit wallet (bet)
  ├─ Roll win_rate vs controls
  ├─ Hit → weighted random fish selection
  │    Fish table: Small Fish (1.2×) → Golden Fish (30×)
  ├─ totalWin = betAmount × fish.multiplier
  ├─ Credit wallet (win)
  └─ Response: { hit, fish, totalWin, balance }
```

### 1.4 Symbol Payouts (Slot)

| Symbol   | Weight | 3× | 4× | 5× |
|----------|--------|----|----|----|
| Wild     | 2      | 10 | 30 | 100 |
| Scatter  | 3      | 2  | 8  | 25  |
| Seven    | 5      | 8  | 20 | 75  |
| Bar      | 8      | 5  | 12 | 40  |
| Bell     | 10     | 4  | 10 | 25  |
| Cherry   | 12     | 3  | 7  | 18  |
| Lemon    | 15     | 1.5| 4  | 10  |
| Orange   | 15     | 1.5| 4  | 10  |
| Plum     | 15     | 1  | 3  | 7   |
| Grape    | 15     | 1  | 3  | 7   |

- Wild substitutes for any non-scatter symbol
- 3+ Scatters anywhere → 10 free spins (2× multiplier)
- 20 paylines evaluated left-to-right

### 1.5 Admin Game Controls

| Control | Description |
|---------|-------------|
| `win_rate` | % chance of a winning spin (0–100) |
| `force_outcome` | Global override: `win`, `loss`, `jackpot`, `null` |
| `min_payout` | Minimum payout multiplier on wins |
| `max_payout` | Maximum payout multiplier cap |
| `payout_cap` | Session total win cap (forces loss after reached) |
| `dry_run` | Simulate spins without real wallet changes |
| `player_class` | Per-player: `vip` (1.1× bonus, 2× jackpot odds), `normal`, `low` (0.7× weights) |
| `force_outcome` (per-player) | Queue specific outcomes for a player's next N spins |

---

## 2. Affiliation / Referral Flow

### 2.1 Referral Link Generation

```
GET /api/affiliation/my-code
  │
  ├─ Check users.referral_code
  ├─ If null → generate random 8-char alphanumeric code
  ├─ Save to users.referral_code
  └─ Return { code, link: "https://reelx.lazapee.ph/register?ref=CODE" }
```

### 2.2 New Player Registration via Referral

```
Player visits /register?ref=ABCD1234
  │
  └─ POST /api/auth/register { ..., referral_code: 'ABCD1234' }
       │
       ├─ Create user account
       └─ createAffiliation(newUserId, 'ABCD1234')
            ├─ Lookup referrer by referral_code
            ├─ Prevent self-referral
            ├─ INSERT affiliations { referrer_id, referee_id, status: 'registered' }
            └─ UPDATE users SET referred_by = referrerId WHERE id = newUserId
```

### 2.3 Commission on Deposit

```
Player completes a deposit (Xendit webhook PAID)
  │
  └─ updateAffiliationOnDeposit(userId, amount)
       │
       ├─ Lookup affiliations WHERE referee_id = userId
       ├─ commission = amount × 5%
       ├─ UPDATE affiliations SET
       │    has_deposited = 1,
       │    total_deposited += amount,
       │    commission_earned += commission,
       │    status = 'deposited'
       └─ creditWallet(referrer_id, commission, 'commission')
            └─ Referrer receives 5% of referee's deposit instantly
```

### 2.4 Affiliation Status Lifecycle

```
registered → (referee makes first deposit) → deposited
```

### 2.5 Referral Stats (Player Dashboard)

```
GET /api/affiliation/stats
  └─ Returns:
       total_referrals, deposited_count, not_deposited_count,
       total_deposited, total_commission

GET /api/affiliation/my-affiliates
  └─ Returns list of referred users with their deposit/commission data
```

### 2.6 Admin Affiliation Views

```
GET /api/affiliation/admin/all?page=1&search=username
  └─ All affiliation records with referrer + referee details

GET /api/affiliation/admin/top-referrers
  └─ Top 50 referrers ranked by total_referrals
```

### 2.7 Commission Rate

| Event | Reward |
|-------|--------|
| Referee registers | Affiliation record created, no bonus yet |
| Referee makes first deposit | Referrer earns **5%** of deposit amount |
| Subsequent deposits | Referrer earns **5%** of each deposit |

> Commission is credited directly to the referrer's wallet as `type = 'commission'`.

---

## 3. Payment Flow

### 3.1 Deposit

```
POST /api/payments/deposit { amount, payment_method }
  │
  ├─ Minimum ₱100
  ├─ Create Xendit invoice (GCash / Maya / bank)
  ├─ Store payment_transactions (status: pending)
  └─ Return { invoice_url } → player redirected to Xendit

Xendit → POST /webhooks/xendit
  │
  ├─ Verify x-callback-token
  ├─ status = PAID →
  │    ├─ creditWallet(userId, amount, 'deposit')
  │    ├─ updateAffiliationOnDeposit() (5% commission to referrer)
  │    └─ UPDATE payment_transactions status = 'completed'
  └─ status = EXPIRED/FAILED → mark transaction accordingly
```

### 3.2 Withdrawal

```
POST /api/payments/withdraw { amount, bank_code, account_number, account_name }
  │
  ├─ Minimum ₱100
  ├─ KYC check (selfie + phone + location all required)
  ├─ Must have at least 1 completed real deposit
  ├─ Check wallet balance
  ├─ debitWallet() immediately (balance held)
  ├─ INSERT withdrawal_requests (status: pending)
  └─ Notify admins via Socket.IO

Admin approves → processPayout(withdrawalId)
  │
  ├─ POST Xendit /payouts
  └─ UPDATE withdrawal_requests status = 'processing'

Xendit webhook (payout result)
  ├─ COMPLETED → status = 'completed'
  └─ FAILED → status = 'failed' + creditWallet() refund
```

---

## 4. Promotions Flow

| Promotion | Trigger | Reward | Frequency |
|-----------|---------|--------|-----------|
| Daily Login Bonus | `POST /promotions/daily-login` | ₱10 | Once per 24h |
| Weekly Cashback | `POST /promotions/cashback` | 5% of net losses | Once per week |
| Referral Bonus | `POST /promotions/referral` | ₱50 to both parties | Once per account |
| Lucky Draw | Automatic (hourly cron) | ₱100 to random active player | Hourly |

> Lucky draw selects randomly from players who spun within the last hour.

---

## 5. RNG & Fairness

- All randomness uses `crypto.randomBytes(4)` — cryptographically secure
- Each spin generates a unique `seed` (32-byte hex) stored in `game_rounds`
- Spin results are verifiable via the stored seed + result JSON
- Admin controls (win_rate, force_outcome) are logged to `audit_logs`
