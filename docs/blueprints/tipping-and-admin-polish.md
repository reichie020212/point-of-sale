# Blueprint: Tipping & Admin Polish

**Status**: Implemented
**Context**: HANDOFF §1, §9 (Tipping/RBAC) & Blueprint #24
**Architect**: Gemini
**Executor**: Claude

## 0. Executor adjustments (2026-05-03)

Two scope changes from the proposed Blueprint, agreed before execution:

- **Step 2 (refund RBAC gate) dropped.** The §9 policy memory closed
  2026-05-03 explicitly says cashier roles can refund. Disabling the
  refund button for cashiers would override that user-owned policy
  without explicit consent. The `processed_by_id` audit column already
  carries who did each refund. A "manager-PIN override" is a real
  feature — if Red wants it, it earns its own Blueprint.
- **Mobile export deferred.** Server-side export today writes to
  /tmp and streams the file in-process. Email-link delivery wants
  SES/SendGrid + a job queue + signed URL plumbing — too heavy for a
  polish commit and not load-bearing for mobile cashiers. Web-only UI
  is shipped here; mobile export-by-email is its own future Blueprint.

## 1. Goal
Complete the final §9 policy requirement (Tipping), enforce Role-Based Access Control (RBAC) on the mobile POS, and provide a UI for the "Your Data is Yours" export engine.

## 2. Why this next?
This "clears the deck" of all remaining §9 policy items and operational TODOs. By finishing the Tipping UI and the Refund RBAC gate, we ensure the POS is functionally complete for a PH cashier. Adding the Export UI fulfills a core project promise before we move to the complex Stripe Billing integration.

## 3. Implementation Strategy
- **Tipping**: We will use a dedicated "Add Tip" button on the `Cart` screen that opens a numeric input modal. This updates the `useCart` Zustand store.
- **RBAC Gating**: In `apps/mobile/app/orders/[id].tsx`, we will wrap the Refund button in a conditional check: `if (user.role === 'cashier') { /* disabled or hide */ }`.
- **Export Flow**: We will wire the existing `POST /api/v1/exports` endpoints to buttons in the Web/Mobile settings. The API already handles the CSV/JSON generation; the UI just needs to handle the download redirect.

## 4. Files touched

### Tokens
- `packages/tokens/src/colors.ts` — new `scrim` token
  (rgba(0, 0, 0, 0.45)) for modal/sheet backdrops. Without this the
  tip modal would fail the no-restricted-syntax color rule.
- `packages/tokens/src/native/index.ts` — re-exports
  `nativeTheme.colors.scrim`.
- `packages/tokens/src/web/variables.css` — adds `--color-scrim`.

### Mobile
- `apps/mobile/src/state/tip-input.ts` — new pure helper.
  `parseTipInputCents(raw)` returns integer cents, or `null` when the
  input is empty / negative / has > 2 decimals / unparseable. Strips a
  leading currency symbol and thousand separators so the cashier can
  paste freely.
- `apps/mobile/test/tip-input.test.ts` — 8 test groups via
  `node:test`. Whole pesos, decimals, currency-symbol stripping,
  thousand separators, negatives rejected, > 2 decimals rejected,
  garbage rejected.
- `apps/mobile/app/cart.tsx` — adds an "Add tip" / "Tip" row beneath
  the subtotal. Tap → fade-in scrim + bottom sheet with a numeric
  TextInput (`keyboardType="decimal-pad"`). Live preview of the
  parsed amount renders through `<Money>`. "Done" submits, "Clear"
  zeroes the tip and closes. Existing `useCart.setTip` already wired
  through to `payment.tsx` checkout math + the `orders.tip_cents`
  push payload, so no other surfaces need to change.

### Web
- `apps/web/app/(dashboard)/dashboard/settings/page.tsx` — adds a
  "Data portability" section after Team PINs. Three cards (Products,
  Customers, Orders) each with CSV + JSON `<ExportButton>`. Uses the
  existing `POST /api/v1/exports` (owner/manager-gated) and the
  ExportButton component that already drives Products / Customers
  pages.

## 5. Verification
- `pnpm lint` — green across all workspaces.
- `pnpm build` — green across all workspaces.
- `pnpm --filter @counter/mobile test` — adds 8 tip-input cases.
- Manual:
  1. Cart → "Add tip" → type `50.50` → "Done" → cart shows
     "Tip ₱50.50" below subtotal.
  2. Cart → "Tip" row → "Clear" → row collapses back to "Add tip".
  3. Payment screen reflects `Tip ₱50.50` line and adds it to the
     total.
  4. Web /dashboard/settings → "Data portability" → Export
     Products CSV → file downloads.

## 6. Definition of Done
- [x] Cart shows an "Add tip" affordance; tapping opens a numeric
      modal with live amount preview.
- [x] Tip is reflected in the payment summary, the receipt, the
      order's `tip_cents` column, and the sync push payload.
- [x] Web settings exposes CSV + JSON exports for products,
      customers, and orders.
- [x] No raw color literals introduced (scrim landed as a token).
- [x] `pnpm lint && pnpm build && pnpm test` green.

## 7. Out of scope (deferred)
- **Refund RBAC gate.** Per §9 (cashier may refund) — see §0.
- **Manager-PIN override on refunds.** Real feature, future Blueprint.
- **Mobile export by email.** Future Blueprint with SES/SendGrid +
  job-queue + signed-URL plumbing.
- **Tip in refunds.** Refunding a tipped order today refunds the
  base; tip handling on partial refunds is a separate concern.
