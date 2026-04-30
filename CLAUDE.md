# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Sandwitchy / طلباتي** — Arabic-language (RTL) group food-ordering web app. One person opens a session, shares a link, everyone adds their items, an admin closes the session and the totals (with delivery split) get pushed to a Telegram bot via n8n.

The codebase is fully bilingual in spirit: code/identifiers are English, but all UI strings, comments in docs, and user-facing copy are Arabic. Preserve Arabic text exactly when editing — do not "translate" it.

## Commands

```bash
npm install
npm run dev       # = node server.js — serves API + dist/ on PORT (default 3000). Used in production.
npm run server    # alias for above
npm run client    # vite dev server on :5173 with /api and /events proxied to :3000
npx vite build    # builds frontend into dist/
./start.sh        # one-shot: install + build + node server.js
```

There is **no test runner, linter, or formatter configured**. Don't add or invoke one unless asked.

Local dev typically means running `npm run dev` AND `npm run client` in two terminals (server on 3000, hot-reloading frontend on 5173). For a production-like check, run `npx vite build` then `npm run dev` and hit `:3000`.

Admin UI is reached by appending `?admin=1` to the URL — there is no separate route or build.

## Environment variables

Set via shell/Vercel — `start.sh` shows the shape. None are required for the server to boot, but several change behavior:

- `N8N_WEBHOOK` — POST target for completed-order payloads. Without it, completion still works but no Telegram message fires. See `TELEGRAM_SETUP.md` for the n8n + Telegram + Vercel wiring.
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — defaults are `admin` / `123456789`. The server logs a warning when defaults are in use.
- `ADMIN_SESSION_SECRET`, `JWT_SECRET` — HMAC secrets for the admin cookie and the user JWT. Defaults derive from hostname+pid, so they rotate on every restart in dev (sessions invalidate). Set them for any persistent deployment.
- `DB_PATH` — overrides `data/sandwitchy.db`.
- `PORT` — server port (default 3000).
- `VERCEL` — when set, the server **skips SQLite entirely** and falls back to in-memory storage (see "Storage" below).

## Architecture

### Single-file backend
The entire backend lives in [server.js](server.js) (~1700 lines). It contains:
- **Schema + migrations** (lines ~265–430): `CREATE TABLE IF NOT EXISTS` for `sessions`, `orders`, `expected_members`, `votes`, `app_settings`, `order_history`, `users`, `user_addresses`, `favorites`, `promo_codes`, `order_status_logs`, `notifications`, `restaurant_hours`, `order_status`. New columns are added via best-effort `ALTER TABLE … try/catch` blocks — follow that pattern when adding columns rather than versioned migrations.
- **Two parallel auth systems** that share the file but don't share state:
  - **Admin** — username/password → HMAC-signed cookie (`sandwitchy_admin`), `requireAdmin` middleware. Used for all `/api/admin/*` and most session-mutation endpoints.
  - **User** — register/login → JWT (`createJwtToken` / `verifyJwtToken`), `requireAuth` middleware. Used for `/api/users/me`, `/api/addresses`, `/api/favorites`, `/api/notifications`. Anonymous users can still create orders without registering.
- **Domain logic** — `getSession`, `setOrder`, `delOrder`, `setPayment`, `buildPayload`, `maybeAutoApplyDelivery`, `fireN8nWebhook`, etc. These functions branch on `if (!db)` to handle the in-memory fallback.
- **Routes** — REST endpoints + one SSE endpoint `GET /events/:sid` that streams session payload changes to connected clients. `broadcast(sid)` is what fans out updates after every mutation.
- **Static serving** — `dist/` is served and a catch-all `app.get('*')` returns `dist/index.html` for SPA routing.

When adding endpoints: there is no router file. Add it inline in `server.js`, pick the right middleware (`requireAdmin` / `requireAuth` / none), and remember to call `broadcast(sid)` if the change should reach connected clients via SSE.

### Storage: SQLite with in-memory fallback
The server attempts `better-sqlite3` against `data/sandwitchy.db`. If `process.env.VERCEL` is set, or if the DB fails to open, every helper switches to module-level in-memory objects (`memSessions`, `memUsers`, `memOrderHistory`, etc.). **Every storage helper must handle both branches** — read existing helpers like `getOrders` / `setOrder` before adding new ones.

This means Vercel deployments are stateless across cold starts. The git status often shows `M data/sandwitchy.db` because the live DB is committed; treat changes there as data, not code.

### Frontend (React 18 + Vite, JSX, no TypeScript)
- [src/main.jsx](src/main.jsx) → wraps `<App/>` in `AuthProvider`.
- [src/App.jsx](src/App.jsx) → splits on `?admin=1` query param: renders either `AdminPage` or `UserApp`. There is no router library.
- [src/screens/UserApp.jsx](src/screens/UserApp.jsx) is the **state machine for the user flow**. It owns `screen` (`'welcome' | 'login' | 'name' | 'home' | 'menu' | 'submitted' | 'summary' | 'vote'`) plus all session state, and conditionally renders one screen component per state. Real-time updates come via `EventSource('/events/:sid')` with auto-reconnect.
- [src/admin/AdminPage.jsx](src/admin/AdminPage.jsx) is the equivalent monolith for the admin UI; the other admin tabs (`AnalyticsTab`, `OrderStatusTab`, `PromoCodesTab`) are children.
- [src/api/client.js](src/api/client.js) is a flat object of fetch wrappers — every backend call goes through it. Add new endpoints here, not inline in components.
- [src/context/AuthContext.jsx](src/context/AuthContext.jsx) — user-side auth. Stores token + user in `localStorage`. Admin auth is cookie-based and lives entirely in `AdminPage`, separate from this context.
- Order/session math (totals, per-person delivery split, paid summaries, CSV export) lives in [src/utils/orders.js](src/utils/orders.js). Reuse those helpers — don't reimplement.
- No CSS framework. Styling is inline `style={{}}` props plus `src/index.css` (Cairo font, RTL-aware base styles). Color tokens come from [src/constants/colors.js](src/constants/colors.js) — import `C` rather than hardcoding hex values.

### Deployment
[vercel.json](vercel.json) rewrites `/api/*` and `/events/*` to a single serverless entry [api/server.js](api/server.js), which just `require('../server.js')`. The same Express app handles both `node server.js` (long-running) and Vercel (serverless) — that's why `app.listen` is gated behind `if (!process.env.VERCEL)`.

### Realtime
SSE only. No WebSocket. Clients connect to `/events/:sid`; every mutation that should be visible to other participants ends in `broadcast(sid)`. If a new endpoint mutates session-visible state and you forget the broadcast, other tabs won't see it until they reconnect.

### Telegram / n8n integration
`fireN8nWebhook(sid)` is invoked when a session is completed. It POSTs the rolled-up summary (per-person totals, delivery share, lines, telegram usernames) to `N8N_WEBHOOK`. The n8n workflow JSON is checked in at [n8n-workflow.json](n8n-workflow.json) and the setup flow is documented in [TELEGRAM_SETUP.md](TELEGRAM_SETUP.md).
