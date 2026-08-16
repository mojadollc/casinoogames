# Game Control Settings Guide

## 1. Set Minimum Bet to ₱50

Go to **Admin → Game Controls** → find the game → click ✏️ edit:

- Set `Min Bet` = **50**
- Set `Max Bet` = whatever max you want (e.g. 10000)

> This blocks any bet below ₱50 from being placed.

---

## 2. Control the Winning Amount (₱150 to ₱5000)

This is done via **Min Payout** and **Max Payout** multipliers in the Control Settings panel on the right side.

Since bets range ₱50–₱100, you need to calculate the multipliers:

| Goal | Formula | Multiplier to set |
|------|---------|-------------------|
| Min win = ₱150 on a ₱50 bet | 150 ÷ 50 | **Min Payout = 3×** |
| Max win = ₱5000 on a ₱100 bet | 5000 ÷ 100 | **Max Payout = 50×** |

So in the Control Settings panel set:

- `Min Payout` = **3**
- `Max Payout` = **50**

> This means every winning spin will pay between **3× and 50× the bet amount**, which gives you ₱150–₱5000 range.

---

## 3. Control How Often They Win

Use the **Win Rate** slider:

- `Win Rate = 30%` → player wins roughly 3 out of 10 spins
- `Win Rate = 20%` → wins 2 out of 10 spins
- Lower = less frequent wins but when they win, payout is within your ₱150–₱5000 range

---

## 4. Set a Session Payout Cap (Optional)

Use `Payout Cap` to limit total winnings per session:

- Example: set `Payout Cap = 5000` → once a player wins ₱5000 total in a session, the engine forces losses for the rest of that session

---

## Summary of Settings to Apply

| Setting | Value |
|---------|-------|
| Min Bet | ₱50 |
| Max Bet | ₱10,000 |
| Min Payout | 3× |
| Max Payout | 50× |
| Win Rate | 20–35% |
| Payout Cap | ₱5,000 (optional) |

> All of these are adjustable **live** from Admin → Game Controls without any code changes or restart needed.
