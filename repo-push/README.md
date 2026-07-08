# TCG Shop Order Fulfillment — hosted API version

A coded, self-hosted alternative to the Smartsheet build, implementing the exact same
process from the Solution Design Document (Sections 6–7): order intake, team lead
triage and assignment, employee handling with a start/end timer, an auto-calculated
SLA status, release, and a daily "orders by employee" review.

This is the traditional shape most TCG shop back-office systems take: a small REST
API in front of a database, with a lightweight staff-facing dashboard — as opposed to
a no-code sheet. Same rules, same fields, same in-house color key (gray = Customer,
purple = Team Lead, teal = Employee, amber = System), different delivery mechanism.

## Run it locally

```bash
npm install
npm start
# open http://localhost:3000
```

First run auto-seeds `data/db.json` with four sample orders and the roster from the
design doc. Delete that file any time to reset to the seed state.

## How the process maps to the API

| Design doc step (Section 6.1) | Role | Endpoint |
|---|---|---|
| 1. Order placed on website | Customer / System | `POST /api/webhooks/woocommerce` (or `POST /api/orders` for manual entry) |
| 2. Order triaged, Order Type set | Team Lead | `PATCH /api/orders/:id/triage` |
| 3. Employee assigned | Team Lead | `PATCH /api/orders/:id/assign` |
| 4. Handling starts | Employee | `POST /api/orders/:id/start` |
| 5. Handling ends, SLA computed | Employee / System | `POST /api/orders/:id/end` |
| 6. QC + release | Employee | `POST /api/orders/:id/release` |
| 7. Daily review | Team Lead | `GET /api/reports/orders-by-employee` |

The SLA formula is a direct port of the Smartsheet formulas already live on the
Order Tracking & Fulfillment sheet:

```
handlingMinutes = (endHour*60 + endMinute) - (startHour*60 + startMinute)
slaStatus       = handlingMinutes <= 20 ? "On Target" : "Delayed"
```

## Storage

Ships with a flat JSON file (`lib/store.js`) so it runs anywhere with zero setup —
good for a prototype or a single-location shop. The read/write shape (`load()`,
`save()`) is the seam to swap in a real database for production: Postgres or MySQL
on a VPS, or a managed option (Railway, Render, Supabase). Swapping the store is a
change to `lib/store.js` only — the routes don't touch the file format directly.

## Connecting the real storefront

`highmarketonline.shop` runs on WordPress/WooCommerce (per the SDD, hosted on
GoDaddy). WooCommerce has a built-in webhook system:
**WooCommerce → Settings → Advanced → Webhooks → Add webhook**, topic
`Order created`, delivery URL pointing at `/api/webhooks/woocommerce` on wherever
this is deployed. In production, verify the `X-WC-Webhook-Signature` header against
your webhook secret before trusting the payload — the handler in `server.js` has a
comment marking where that check belongs.

## Deploying to a live URL (recommended path: Render)

This repo is pre-configured for [Render](https://render.com) — free tier, no credit
card required, and it auto-detects Node apps. Fastest way to a live URL:

1. **Push this folder to a GitHub repo** (public or private — Render supports both).
   ```bash
   cd tcg-order-fulfillment
   git init && git add . && git commit -m "Initial commit"
   # create a repo on github.com, then:
   git remote add origin https://github.com/<you>/tcg-order-fulfillment.git
   git push -u origin main
   ```
2. Go to [render.com](https://render.com) → sign up → **New +** → **Web Service**.
3. Connect the GitHub repo. Render reads `render.yaml` automatically and pre-fills
   the build command (`npm install`) and start command (`npm start`) — just click
   **Create Web Service**.
4. In ~2 minutes you'll get a live URL like `https://tcg-order-fulfillment-api.onrender.com`.
   That's what you present to the client.

**No GitHub account?** Render also supports deploying directly from a zip via their
dashboard ("Deploy an existing image" isn't it — use **New + → Web Service → Public
Git Repository** isn't possible without git, so GitHub is the fastest route; a
5-minute GitHub signup is worth it here).

### A note on data persistence

Storage is a flat JSON file, which is not persistent on most free hosting tiers —
the filesystem resets whenever the service redeploys or wakes from idle sleep
(Render's free tier sleeps after 15 minutes of inactivity). For a client demo this
is actually convenient: every cold start gives you a clean, known demo state
automatically. For real production use once the client is live, swap in a free
hosted Postgres — [Neon](https://neon.tech) or [Supabase](https://supabase.com)
both offer free tiers that survive restarts — by replacing the file I/O in
`lib/store.js` with SQL queries; the rest of the app (routes, dashboard) doesn't
need to change since they only call `store.load()` / `store.save()`.

### Alternatives to Render

| Platform | Free tier | Notes |
|---|---|---|
| **Render** (recommended) | Yes | Simplest setup, auto-deploys from GitHub on push |
| **Railway** | Trial credit, then paid | Similarly simple, `Procfile` included works here too |
| **Fly.io** | Yes (limited) | More control, needs their CLI |
| **A small VPS** (DigitalOcean, Linode) | No, ~$4-6/mo | Full control, best if you'll self-manage long-term |
| GoDaddy shared hosting (current host of highmarketonline.shop) | — | Typically doesn't support Node — not recommended for this app |

### Custom domain

Once live on Render, add a custom domain under the service's **Settings → Custom
Domains** — e.g. `api.highmarketonline.shop` — and point a CNAME record at the
`.onrender.com` URL from wherever the shop's DNS is managed (likely GoDaddy DNS,
per the SDD). Render issues a free SSL certificate automatically once the DNS
record verifies.

## Why this exists alongside the Smartsheet build

Section 7.6 of the design doc flags that Smartsheet Pro has no API access — so once
the shop is handed a Pro-tier account, further automation there has to happen by
hand in the UI. This coded version doesn't have that ceiling: it's yours to extend,
self-host, and wire directly into the storefront, at the cost of needing someone to
maintain the code and the server it runs on. Which one to run day-to-day is a
tradeoff between developer maintenance and no-code simplicity — not a technical
limitation either way.
