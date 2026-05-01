# Master Blueprint: Weeks 2–8 Consolidated (Counter POS)

**Status**: Completed — all 14 milestones landed
**Architect**: Gemini
**Executor**: Claude
**Approved by**: Red, 2026-05-01
**Completed**: 2026-05-01
**Target**: Complete functional prototype with offline-first sync, catalog, payments, and dashboard.

## 1. Domain Model & Schema (`packages/schema`)

Every sync-relevant table includes: `id (UUID)`, `orgId (UUID)`, `version (BigInt – Lamport)`, `updatedAt`, `deletedAt (tombstone, nullable)`.

### Catalog & Inventory

- **categories**: `id, orgId, name, sortOrder`
- **products**: `id, orgId, categoryId, name, description, imagePath, status (active/archived)`
- **variants**: `id, productId, name, sku, price (Int – cents), barcode`
- **modifiers**: `id, productId, name, price, multiSelect (bool)`
- **inventory_movements**: `id, orgId, variantId, delta (Int), reason (sale/adjustment/restock), deviceId`
  - `onHand` is derived by summing movements per variant (Delta-CRDT — increments / decrements commute).

### Sales & Customers

- **customers**: `id, orgId, name, email, phone, loyaltyPoints (Int)`
- **orders**: `id, orgId, customerId, shiftId, deviceId, status (paid / refunded), total, tax, tip, paymentMethod`
- **order_items**: `id, orderId, variantId, qty, unitPrice, subtotal, modifiersJson`
- **refunds**: `id, orderId, orgId, amount, reason, processedBy (userId)`

### Devices & Sessions

- **shifts**: `id, orgId, deviceId, userId, openedAt, closedAt, openingCash, closingCash, variance`
- **devices**: `id, orgId, name, model, lastIp, status (live / offline), pairingCode`

## 2. Sync Engine MVP (`packages/sync`)

Offline-first synchronization using Lamport clocks and a WebSocket transport.

### Message Shapes

- `HELLO`: `{ type: 'hello', deviceId, token, cursor: bigint }`
- `PULL`: server streams records where `version > cursor`.
- `PUSH`: `{ type: 'push', ops: [{ table, data, tempId }] }`.
- `ACK`: server confirms write and returns canonical `id` and `version`.

### Conflict Resolution

- **Standard fields**: Last-Write-Wins (LWW) by server-side `updatedAt`.
- **Inventory `onHand`**: Delta-CRDT. Clients push `{ delta: -1 }`. Server sums movements.
- **Tombstones**: Rows where `deletedAt` is set are filtered from standard queries but streamed in `PULL` for 30 days so offline devices converge.

## 3. Mobile App (`apps/mobile`)

- **Persistence**: WatermelonDB. Schema mirrors `packages/schema` (less the version column — Watermelon manages its own sync metadata).
- **State**: Zustand for `useCart`, `useAuth`, `useSyncStatus`.
- **Sync Hook**: `useSync()` runs in a background task (Expo TaskManager), maintaining the WebSocket and flushing the local `sync_queue`.

## 4. Hardware Abstractions (`packages/payments`, `packages/printers`)

Interfaces that prevent vendor lock-in and let cash + mock printing ship immediately.

```typescript
interface PaymentResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

interface PaymentProvider {
  type: 'cash' | 'stripe' | 'mock';
  charge(amount: number, currency: string): Promise<PaymentResult>;
  refund(transactionId: string): Promise<PaymentResult>;
}

interface ReceiptPrinter {
  print(order: Order, items: OrderItem[]): Promise<void>;
}
```

- **W4 ships**: `CashProvider` (no-op success), `WebPrinter` (opens `window.print()`), `MockPrinter`.
- **W5 deferred**: `StripeTerminalProvider`, `BLEThermalPrinter` — scaffold + interface only, real verification needs hardware.

## 5. Pricing & Gating Strategy

- **Logic**: middleware layer in `apps/api` (sync + dashboard endpoints) and `apps/web` (route group entry).
- **Storage**: `organizations.tier` enum (`free`, `pro`, `business`), default `free`.
- **Downgrade Pro → Free**:
  - `apps/api` rejects `WSS /sync` for `free` orgs (`code: 'tier_required'`).
  - `apps/web` redirects `/dashboard/*` to `/pricing` for `free` orgs.
  - Mobile app keeps working locally; surfaces a "Sync disabled" toast.

## 6. Open Questions — Defaults (HANDOFF §9)

| Question          | Default Policy (W2–8)                                              | Code Marker            |
| ----------------- | ------------------------------------------------------------------ | ---------------------- |
| **Tipping**       | Fixed % (15 / 18 / 20) for US; disabled for EU.                    | `TODO(policy-tipping)` |
| **Tax**           | Flat 8.25% (US) / 20% (EU) per org.                                | `TODO(policy-tax)`     |
| **Refunds**       | Full refund only. Requires `manager` role.                         | `TODO(policy-refunds)` |
| **Loyalty**       | 1% cashback as points ($100 spend = $1 credit).                    | `TODO(policy-loyalty)` |
| **RBAC**          | `owner` (all) / `manager` (all bar billing) / `staff` (sell only). | `TODO(policy-rbac)`    |
| **Region matrix** | Hard-pinned to US at write time; EU paths exist but route to US.   | `TODO(policy-region)`  |

These stay TODOs until the user locks the policy.

## 7. Deferred / Scaffold-Only

- **Hardware integration tests**: BLE thermal printer, Stripe Terminal card dip, USB barcode scanner. CI uses Mock providers.
- **Multi-region Postgres routing**: schema is regionalized, runtime routing is stubbed (fixed to `US`).
- **Real sync soak / CRDT fuzz testing**: needs a multi-device test rig.
- **Sentry / PostHog**: wiring lands in code, activation requires real keys.
- **Stripe billing webhook handler**: scaffold only; real webhook exercised in W7 with a Stripe test account.
- **APK CDN distribution**: marketing has the download button; the EAS build → R2 upload pipeline is in `DEPLOY.md`, not yet automated.

## 8. Order of Operations for Claude

1. `feat(schema): core domain expansion` — all 11 new tables; `db:generate`.
2. `feat(api): product CRUD + catalog endpoints` — REST CRUD with validation, pagination.
3. `feat(sync): WebSocket server + Lamport logic` — `@fastify/websocket`, `HELLO` / `PULL` skeleton.
4. `feat(mobile): expo + watermelondb scaffold` — 15-screen file routing, local DB schema, tokens.
5. `feat(mobile): catalog + cart + cash checkout` — full local sale flow, no sync.
6. `feat(sync): mobile sync client` — `useSync`, FIFO queue, reconnect / backoff.
7. `feat(web): products + registers dashboards` — TanStack Table, live registers via WS.
8. `feat(payments,printers): hardware interfaces` — `PaymentProvider`, `ReceiptPrinter`, mocks.
9. `feat(payments): cash + mock flows wired` — mobile checkout + web preview.
10. `feat(customers): loyalty + history` — customer search, points.
11. `feat(reports): KPI cards + charts` — Recharts on dashboard home.
12. `feat(billing): tier gating middleware` — server + client enforcement.
13. `feat(admin): CSV import / export` — products + customers; export endpoints.
14. `test(e2e): master smoke + manual test plan` — API integration tests + documented offline flow.

## 9. Definition of Done

- All 14 commits land with `-s -S`, conventional prefix, no self-attribution.
- `pnpm lint` + `pnpm typecheck` + `pnpm build` clean across the workspace.
- API smoke + integration tests pass.
- `apps/mobile` builds (Metro bundler + tsc) — runtime verification on a device is W2+ manual work.
- `apps/web` builds + serves the new dashboards (products, registers, reports).
- All `TODO(...)` markers documented in `docs/open-questions.md`.

## 10. Out of Scope (requires user input or external resources)

- Real thermal printer BLE pairing — needs hardware.
- Real Stripe Terminal card dip — needs hardware + SDK access.
- Production multi-region DB failover — needs Neon / equivalent provisioned.
- Live Sentry + PostHog dashboards — needs accounts and keys.
- Stripe live-mode webhook signing.
- App Store / Play Store submissions.
