# HOUSE frontend

A static React + TypeScript application built with Vite. GitHub Pages serves the files; the Railway API owns authentication, chat, votes, funds and sessions. There is no server code, secret, fake bankroll or demo casino in this directory.

## Run locally

```sh
cp .env.example .env
npm ci
npm run dev
```

`VITE_API_URL` should point at your backend (for example `http://localhost:3000` in development). Add the frontend's exact origin to the backend's `PUBLIC_ORIGINS`.

```sh
npm run build
npm run preview
```

## GitHub Pages

1. Extract this ZIP into your frontend repository root. Include `.github/workflows/`, `.env.example` and `package-lock.json`.
2. Add an Actions repository **variable** named `VITE_API_URL`, set to your Railway API HTTPS URL without a trailing slash.
3. Under repository Settings → Pages, choose **GitHub Actions** as the source.
4. Add the Actions variable `HOUSE_PAGES_ENABLED=true`, then run the root Pages workflow. Future pushes to `main` publish automatically.

The build uses `base: './'` and hash routes. A repository site such as `https://YOUR_ACCOUNT.github.io/YOUR_REPOSITORY/#/rewards` works without a SPA rewrite server. For backend CORS/auth configuration, the origin is `https://YOUR_ACCOUNT.github.io`, **without the repository path**. Prefer a dedicated custom domain if other users/projects can publish pages under the same origin.

`VITE_*` values are public. Never put an OpenAI key, JWT secret, casino credential, LiveKit secret, signing key, or database URL in the frontend.

## Wallets and launch signing

Wallet discovery and message/transaction signing use Wallet Standard. A compatible Phantom/Solflare wallet or Solana wallet browser must be available. Sessions expire after 15 minutes. Switching accounts clears authentication. Access tokens are not stored in localStorage.

Saving a coin creates a draft room only. Preparing and signing a token launch is a distinct explicit action and is disabled when integration prerequisites are missing. The provider's transaction must be inspected in the wallet before approval. The frontend sends the confirmed signature back for authoritative verification.

## Video and interaction

The player subscribes to one LiveKit room per HOUSE session using a short-lived subscribe-only token. The video SDK is lazy-loaded. If the feed is unavailable, disconnected or unsafe, the player shows a neutral state. There is no local game rendering pretending to be a remote browser.

Decision countdowns use server clock messages; expired controls disappear. Backend deadlines and state versions remain authoritative. Chat and buttons submit to the same ballot table. Public users can watch; wallet authentication is required for chat, and fixed session eligibility is required for control.

## Known release boundaries

- No full mobile-wallet deep-link flow; use an injected Wallet Standard provider or wallet browser.
- Logo input is an HTTPS URL; no file-storage/upload integration is included.
- Explore currently loads up to 100 rooms; production-scale discovery needs pagination/search indexing.
- Claim view shows confirmed allocations. A per-session unsecured estimate appears in the room. A consolidated pending-rewards dashboard is not implemented.
- The operations UI covers health, pause and session recovery. Additional recovery and activation routes are documented for operators.
- The client is compiled and statically checked; browser visual acceptance remains required on your deployed staging environment.
