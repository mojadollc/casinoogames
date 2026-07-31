# Online Gaming Platform v2.0

A full-stack, mobile-friendly online gaming platform with slot machine games, wallet management, Xendit payment integration, promotions, and admin dashboard.

## Architecture

```
Frontend (React) → API Gateway (Express) → PostgreSQL + Redis
                                         → Game Engine (RNG)
                                         → Xendit Payments
                                         → Socket.IO (Real-time)
```

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Redis 7+

### 1. Database Setup
```bash
createdb casino_platform
cd database/migrations && node 001_initial.js
cd ../seeders && node seed.js
```

### 2. Backend
```bash
cd backend
cp .env.example .env  # Edit with your credentials
npm install
npm run dev
```

### 3. Frontend
```bash
cd frontend
npm install
npm start
```

### Docker (Alternative)
```bash
docker-compose up -d
```

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@casino.com | admin123 |
| Player | player@casino.com | player123 |

## Features

### Player App (Mobile-First)
- Registration/Login with 2FA
- Slot machine games with animated reels
- Wallet with deposit (Xendit) and withdrawal
- Promotions: daily bonus, cashback, referrals, lucky draw
- Leaderboard
- Responsible gaming limits
- Real-time notifications

### Admin Dashboard
- Live stats: online players, revenue, RTP monitoring
- Player management: search, KYC, suspend
- Withdrawal approvals
- Game configuration: enable/disable, betting limits
- Promotion management
- Revenue reports
- Audit logs

### Game Engine
- Cryptographically secure RNG (crypto.randomBytes)
- Weighted symbol generation
- 20 paylines
- Wild & Scatter symbols
- Free spins with multiplier
- Progressive jackpots
- Spin history & verification

### Payment (Xendit)
- Deposit via invoice (GCash, Maya, bank transfer)
- Withdrawal via payout API
- Webhook processing
- Failed payment recovery
- Reconciliation

## API Endpoints

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/profile`
- `POST /api/auth/2fa/enable`

### Wallet
- `GET /api/wallet/balance`
- `GET /api/wallet/transactions`

### Payments
- `POST /api/payments/deposit`
- `POST /api/payments/withdraw`
- `POST /webhooks/xendit` (webhook)

### Games
- `GET /api/games`
- `POST /api/games/:id/spin`
- `POST /api/games/:id/free-spin`

### Promotions
- `GET /api/promotions`
- `POST /api/promotions/daily-login`
- `POST /api/promotions/cashback`
- `GET /api/promotions/leaderboard`

### Admin
- `GET /api/admin/dashboard`
- `GET /api/admin/players`
- `GET /api/admin/withdrawals`
- `POST /api/admin/withdrawals/:id/approve`
- `POST /api/admin/games`
- `GET /api/admin/reports/revenue`

## Tech Stack
- **Frontend**: React 18, React Router, Axios, Socket.IO Client
- **Backend**: Node.js, Express, Socket.IO
- **Database**: PostgreSQL, Redis
- **Payments**: Xendit
- **Auth**: JWT + 2FA (TOTP)
- **Security**: Helmet, CORS, Rate Limiting, bcrypt
