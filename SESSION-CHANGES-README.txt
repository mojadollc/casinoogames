Casino platform — all changes from the Grok session
====================================================

HOW TO APPLY (on your Mac, inside your project folder):

Option 1 — copy files (simplest)
  tar xzf ALL-CHANGED-FILES.tar.gz
  chmod +x deploy-vps.sh deploy.sh push-to-vps.sh update.sh 2>/dev/null
  git add -A
  git commit -m "apply session changes: games, wallet, deploy, CI"
  git push origin main

Option 2 — git bundle (preserves commits)
  git fetch ALL-SESSION-CHANGES.bundle main:session-updates
  git merge session-updates
  git push origin main

Option 3 — patch
  git apply ALL-SESSION-CHANGES.patch
  # or:  git am ALL-SESSION-CHANGES.patch

Then deploy:
  cp .env.production.example .env.production   # if needed, then edit
  ./deploy-vps.sh all

WHAT WAS CHANGED (high level)
- game-engine: forced outcomes, big_win, secure spin
- backend games/wallet/payment/auth/promotions routes hardened
- frontend Slot/GamePlay/Card/SicBo/Live alignment
- deploy-vps.sh (single update script)
- deploy.sh, push-to-vps.sh, DEPLOY.md, .env.production.example
- GitHub Actions CI/CD (test + auto deploy)
- scripts/smoke-test.js
