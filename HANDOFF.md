# Counter POS — Engineering Handoff

> Combined build brief for the **mobile app** and **web dashboard**. The two products share an account, a catalog, and a live sync layer — they must ship together and behave as one.

---

## 0 · The product in one paragraph

**Counter** is a calm, offline-first point-of-sale for small independent shops (cafés, bakeries, boutiques, studios). The **mobile app** (Android APK, iOS TestFlight) is the register that lives in an apron pocket — single-operator, touch-first, works with no signal. The **web dashboard** (`app.counter.app`) is the back-office cousin — multi-device view, full-size product tables, reports, remote register management. A **marketing site** (`counter.app`) distributes the APK and sells the Pro/Business tiers. The three surfaces share one account and one real-time cloud catalog.

Design source of truth: the two HTML prototypes in this repo (`Counter POS.html`, `Counter Web.html`). Treat those as the spec. When this doc and the prototypes disagree, the prototypes win on visual detail; this doc wins on architecture and behavior.

---

## 1 · Brand & design system (shared)

These tokens are used by **both** surfaces. Ship them as a published package (`@counter/tokens`) consumed by mobile, web, and marketing.

### Palette (OKLCH-first, hex fallback)
| Token | Value | Use |
|---|---|---|
| `--bg` | `#F5F2EC` | App canvas (warm off-white) |
| `--surface` | `#FFFFFF` | Cards, sheets |
| `--surface-2` | `#FBF8F2` | Inset/hover surfaces |
| `--ink` | `#161615` | Primary text, dark slabs |
| `--ink-2` | `#4A4842` | Body text |
| `--ink-3` | `#8B887F` | Secondary / captions |
| `--line` | `rgba(0,0,0,0.07)` | Hairline dividers |
| `--line-2` | `rgba(0,0,0,0.12)` | Button borders |
| `--accent` | `oklch(0.72 0.14 70)` | Warm amber — CTAs, brand marks |
| `--accent-deep` | `oklch(0.55 0.16 70)` | Accent text on light bg |
| `--accent-soft` | `oklch(0.94 0.05 70)` | Accent surface tint |
| `--ok` | `#4BA971` | Paid / live / success |
| `--warn` | `#D4A842` | Low stock |
| `--bad` | `#D84C3F` | Refund / error / destructive |

### Type
- **UI**: Inter (400 / 500 / 600 / 700)
- **Numerals & codes**: JetBrains Mono (400 / 500 / 600 / 700) — prices, SKUs, sync timestamps, pairing codes
- **Display**: Fraunces (400 / 500 + italic) — section headers, hero, landing page display

Never mix these roles. Prices are **always** JetBrains Mono. Section headings on slabs/hero are **always** Fraunces — usually with an italic accent word in `--accent`/`--accent-deep`.

### Spacing & radii
4px base unit. Radii scale: 4 / 6 / 8 / 10 / 12 / 14 / 18 / 24 / 999 (pill). Shadows: one soft card shadow (`0 1px 2px rgba(0,0,0,0.04)`), one lifted (`0 24px 48px rgba(20,15,5,0.15)`), one hero (`0 40px 80px rgba(20,15,5,0.18)`).

### Voice
Plain, calm, declarative. "Sync healthy · 3 devices". "Open since 7:12a". Never "Sync Status: OK ✓". No exclamation marks. No emoji in product UI.

---

## 2 · Mobile app — `apps/mobile`

### Stack
- **React Native + Expo** (bare workflow for the APK + TestFlight targets)
- **TypeScript** strict mode
- **State**: Zustand for UI state, **WatermelonDB** for local persistence (SQLite under the hood; critical for offline-first)
- **Sync**: Custom sync engine over WebSocket + HTTPS fallback — see §4
- **Navigation**: Expo Router (file-based)
- **Hardware**: `react-native-ble-plx` for thermal printers (Star TSP143, Epson TM series), `expo-barcode-scanner` for SKU lookups, `react-native-payments` / provider SDK for card readers

### Screens (reference: `Counter POS.html`)
| # | Screen | Key behaviors |
|---|---|---|
| 1 | PIN sign-in | 4-digit PIN per team member; Face/Touch ID after first PIN; remembers last signed-in user |
| 2 | Open shift | Starting cash input → drawer opens → registers a shift with `openedAt`, `openingCash`, `deviceId` |
| 3 | Catalog / Sell | Grid of products, category chips, search, cart badge. Swipe between categories. |
| 4 | Search | Fuzzy match on name + SKU + barcode; scan icon opens camera |
| 5 | Product detail | Variant picker, modifiers, price, add-to-cart |
| 6 | Variant / modifier sheet | Bottom sheet — half-screen spring, snap points [0.5, 0.9] |
| 7 | Cart | Swipe-to-remove, qty stepper, discount line, tax summary, tip picker |
| 8 | Payment | Card / Cash / Split. Number pad. Cash returns change. Card calls reader SDK. |
| 9 | Receipt / success | Thermal print preview, SMS / Email send, "New sale" CTA |
| 10 | Order history | Filter by day / register / status. Tap → order detail with refund. |
| 11 | Customers | Search, tags, loyalty points, order history per customer |
| 12 | Import / Export | CSV + XLSX, templates for Square/Shopify, preview + live progress bar |
| 13 | Data export | Products / Customers / Orders / Inventory; CSV / XLSX / JSON; date range; recent exports list |
| 14 | Settings | Profile, tax rates, receipt branding, printer pairing, sync status, plan |
| 15 | Shift close | Cash count (expected vs actual), variance, shift report, thermal print |

### Offline-first rules (non-negotiable)
1. Every user action writes to local WatermelonDB **first**, then enqueues a sync op.
2. The app must be fully usable with the radio off. Sales, receipts, inventory decrements — all work offline.
3. Sync queue is durable across app kills. On reconnect: flush queue FIFO, then pull remote changes.
4. Conflict resolution: **last-write-wins by server timestamp** for simple fields; inventory uses **delta-based CRDT** (increments/decrements commute) so two offline registers can't double-subtract.
5. Never show a loading spinner for a user action. If the network fails, the action still succeeds locally and surfaces a small "Syncing when online" toast.

### Hardware
- **Thermal printer**: pair via BLE in Settings. Store `printerId` per device. Fallback to "Print via browser" on web.
- **Card reader**: abstract behind a `PaymentProvider` interface. Ship with Stripe Terminal first; leave room for Square Reader SDK.
- **Barcode**: camera-based first; USB HID scanner support later (appears as keyboard input on Android).

### Acceptance
- Cold-start to first tap under 1.2s on Pixel 5.
- Ring up a 3-item sale, cash payment, print receipt — **under 15 seconds, airplane mode on**.
- Kill the app mid-sale. Relaunch. The open cart is restored.

---

## 3 · Web dashboard & marketing — `apps/web`

Single Next.js 14 app with two route groups:

```
app/
  (marketing)/
    page.tsx              → counter.app            (landing)
    pricing/page.tsx
    changelog/page.tsx
  (dashboard)/
    layout.tsx            → shared sidebar + topbar
    dashboard/page.tsx    → app.counter.app/dashboard
    orders/page.tsx
    products/page.tsx
    customers/page.tsx
    reports/page.tsx
    registers/page.tsx    → live device sync screen
    locations/page.tsx
    team/page.tsx
    settings/…
```

### Stack
- **Next.js 14 App Router**, TypeScript strict
- **Tailwind CSS** with design tokens from §1 as CSS variables
- **tRPC** or REST — pick one, consistent across both clients
- **Auth**: Clerk or Auth.js. Session token doubles as device token for the mobile sync engine.
- **Charts**: Recharts (matches the prototype's clean line style)
- **Tables**: TanStack Table for Products / Orders / Customers (virtualized — users will have 10k+ SKUs)
- **Realtime**: Same WebSocket channel as mobile. Dashboard subscribes to `org:{orgId}:events` and reflects new orders within one tick.

### Surfaces (reference: `Counter Web.html`)

**Marketing / landing**
- Sticky translucent nav, hero with the dual-device "live sync" mockup, feature grid (6 cards), dark "Sync" slab with hub-and-spoke diagram, pricing (3 tiers), APK/iOS download strip, footer.
- APK hosted on our CDN; button should hit `/api/download/apk?channel=stable` which redirects to the versioned file.
- iOS button → TestFlight public link.
- "Open dashboard" → `app.counter.app` (or in-product route during dev).

**Dashboard home**
- Four KPI cards (gross, orders, avg ticket, net margin) each with a sparkline + delta pill.
- Sales-over-time chart with Today / 7d / 30d / 90d toggle; highlight the current hour.
- **Live registers** card — WebSocket-driven list of open shifts; "LIVE" pulse dot for devices in the last 30s.
- Recent orders + Top items.

**Products**
- Full-bleed table, bulk checkbox, category tabs with counts, stock column with low-stock warning, variant summary, status pill.
- Row hover reveals inline edit for price/stock.
- Bulk actions bar slides up when rows are selected: Edit price, Edit stock, Archive, Export.
- Import CSV → match the mobile app's Import flow visually.

**Registers / Sync** — the story screen
- Device list: each card shows name, device model, signed-in user, local IP, sync latency, shift details, battery, status (`LIVE` / `OFFLINE`).
- Per-device actions: View orders · Rename · **Sign out remotely** (revokes device token → mobile app drops back to sign-in next sync tick)
- Right rail: pairing QR code + 12-char code (format `CNTR-XXXX-XXXX`, 5-minute TTL). Sync health panel with 24h metrics.

### Pricing tiers (source of truth for billing code)

| Tier | Price | What's included | Gating |
|---|---|---|---|
| **Free** | $0 forever | Mobile app, local only, 1 device, CSV import/export | No account required. Optional account = cloud backup only. |
| **Pro** | $29 / mo | Everything in Free + cloud sync + web dashboard + unlimited devices + 1 location + 90-day backups + email support | Required to sign into the web dashboard. |
| **Business** | $79 / mo | Everything in Pro + multi-location + team roles + advanced reports + REST API + webhooks + priority support | Required for org > 1 location or team > 5. |

Stripe integration: monthly + annual (annual = 2 months free). 14-day Pro trial, no card required. Downgrade from Pro → Free freezes cloud sync but keeps local data intact.

---

## 4 · Sync engine — `packages/sync`

Shared TypeScript package consumed by mobile and web.

### Transport
- Primary: **WebSocket** (`wss://sync.counter.app`), one connection per device, authenticated by device token
- Fallback: long-poll over HTTPS for restrictive networks
- Ping every 15s, auto-reconnect with exponential backoff capped at 30s

### Data shape
Every record carries `{ id, orgId, updatedAt, deletedAt?, version }`. `version` is a Lamport clock per org. Sync is per-entity (products, customers, orders, shifts, inventory).

### Flow
1. **Connect** → send `{ type: 'hello', deviceId, cursor: lastVersion }`
2. **Pull** → server streams records with `version > cursor`
3. **Push** → client sends `{ type: 'mutate', ops: [...] }`; server replies with canonical versions
4. **Live** → server pushes `{ type: 'event', record }` as other devices mutate

### Conflict rules
- Simple fields (name, price, category): last-write-wins by server `updatedAt`
- Inventory `onHand`: delta CRDT — clients send `{ delta: -1 }`, server sums
- Orders: append-only, never edited; refunds are new records
- Deletes: soft via `deletedAt`; tombstones survive 30 days so offline devices converge

### Acceptance
- Write on phone, visible on web in **< 500ms** under good network
- Two phones sell the last unit offline → when both reconnect, one succeeds, one gets a "Sold out elsewhere, item removed" notice
- Server crash mid-push → client retry succeeds with idempotency key

---

## 5 · Backend — `apps/api`

- **Node.js + Fastify** (or NestJS if you prefer), TypeScript
- **Postgres** primary store, one DB per region (US, EU). Org is region-pinned at signup.
- **Redis** for WebSocket pub/sub and rate limiting
- **S3-compatible** object store for receipt images, product photos, export files
- Deploy: Fly.io or Railway for app tier; managed Postgres (Neon / Supabase / RDS).

Endpoints (partial):
```
POST /auth/session              Sign in, issue session + device token
POST /devices/pair              Exchange pairing code for device token
POST /devices/:id/revoke        Remote sign-out
GET  /orgs/:id/dashboard        KPIs for the home screen
GET  /products?cursor=…         Paginated catalog
POST /sync/push                 Bulk mutate
WSS  /sync                      Live channel
POST /exports                   Enqueue export job; returns signed URL when ready
GET  /download/apk              CDN redirect, captures analytics
```

---

## 6 · Monorepo layout

```
counter/
├── apps/
│   ├── mobile/              React Native
│   ├── web/                 Next.js (marketing + dashboard)
│   └── api/                 Fastify backend
├── packages/
│   ├── tokens/              Design tokens (TS + CSS + RN variants)
│   ├── ui-web/              React components (cards, tables, buttons)
│   ├── ui-mobile/           RN components (sheets, pickers, keypads)
│   ├── sync/                Sync engine
│   ├── schema/              Shared Zod schemas + TypeScript types
│   └── utils/               Money, time, receipt formatting
└── tooling/                 ESLint, tsconfig, Prettier, CI
```

Tooling: **pnpm workspaces** + **Turborepo**. One lockfile. One ESLint config. One Prettier config.

---

## 7 · Build order

1. **Week 1** — Monorepo scaffold, design tokens package, auth flow (sign up, sign in, create org).
2. **Week 2** — Product CRUD end-to-end. Web products table. Mobile catalog. No sync yet — direct API calls.
3. **Week 3** — Sync engine MVP. Mobile goes offline-first. Web subscribes to live events.
4. **Week 4** — Cart, payment (cash first), receipt. Landing page shipped.
5. **Week 5** — Card reader (Stripe Terminal), thermal printer, customers + loyalty.
6. **Week 6** — Dashboard reports, Registers page with pairing + remote sign-out.
7. **Week 7** — Import/Export, billing (Stripe), Free/Pro/Business gating.
8. **Week 8** — Hardening, error tracking (Sentry), analytics (PostHog), beta launch.

---

## 8 · Non-negotiables

1. **Offline-first or nothing.** Never block a sale on a network call. If you're tempted to add a spinner to a sell action, stop and rewrite it.
2. **Every price is monospace.** Every timestamp is monospace. Never render money in a proportional font.
3. **Tokens are law.** No hard-coded colors outside `packages/tokens`. ESLint rule to enforce.
4. **Accessibility**: 44px minimum touch target on mobile, WCAG AA contrast on web, keyboard-navigable tables, screen-reader labels on every icon button.
5. **Free tier stays free forever.** No dark patterns. Sync gating is the only paywall.
6. **Your data is yours.** CSV/JSON export works on every tier. Account delete wipes within 30 days.

---

## 9 · What this handoff does NOT cover (ask before building)

- Tipping model (percent vs fixed vs no-tip) — confirm by region
- Tax engine (flat vs multi-rate vs TaxJar/Avalara integration)
- Refund rules (full/partial, time window, reason required)
- Loyalty model (punchcard vs points vs spend-based)
- Team RBAC matrix (which roles can do what)
- Region/currency matrix for launch

Default to the mobile-app prototype's visible behavior when in doubt, and flag it in the PR.
