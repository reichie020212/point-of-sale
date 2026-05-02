# Blueprint: QR Pairing UX (web QR + mobile scanner)

**Status**: Completed — landed 2026-05-02
**Architect**: Gemini
**Executor**: Claude
**Approved by**: Red, 2026-05-02 (auto mode)
**Context**: HANDOFF §3 (Registers / Sync) & Blueprint #7 (Pairing Flow)

## 1. Goal

Replace the manual 12-character pairing code entry with a one-tap QR
scan. Web emits a QR for the active code; mobile scans it with the
back camera and pairs without any typing. Manual entry stays as a
fallback for accessibility, denied permissions, or broken cameras.

## 2. Why this next?

- **Closes the deferred follow-up from Blueprint #7.** Pairing shipped
  with manual entry only because the camera scaffold wasn't built yet.
  Until now a cashier had to type `CNTR-XXXX-XXXX` correctly with no
  typos within five minutes — fine for setup, friction for everyday
  re-pair after a wipe.
- **Fulfills the "calm POS" promise.** The HANDOFF brand voice and the
  HTML/JSX prototypes both assume zero-typing setup; the QR closes
  that gap without any new server work — the existing `POST
  /api/v1/devices/pair` endpoint already takes the 12-char code.
- **No new policy.** Camera permission, optional device-name input,
  and the post-pair redirect are all execution-only choices.

## 3. Implementation Strategy

- **Web** uses `qrcode.react` (`QRCodeSVG`, 200px, ECC level M, ink
  foreground via `@counter/tokens`'s `resolveColor('ink', 'hex')`,
  transparent background so it inherits the modal's surface). The
  manual 12-char readout stays under the QR for fallback. Card-style
  border around the QR matches the modal's existing visual language.
- **Mobile** uses `expo-camera`'s `CameraView` + `useCameraPermissions`
  hook. The /pair screen runs in three modes:
    1. *idle* — explains the flow, shows a primary "Scan QR code"
       CTA, plus the manual `CNTR-XXXX-XXXX` field directly below.
    2. *scanning* — a square camera preview with a centered reticle
       overlay. `barcodeScannerSettings: { barcodeTypes: ['qr'] }`
       narrows the decoder. `handlingScan` ref blocks re-entrant
       fires while the pair RTT is in flight.
    3. *manual* — falls through when permission is denied or when
       the user taps the secondary "Enter code by hand" link.
- **Shared completion lane.** `completePair(rawCode, deviceName?)`
  is one function called from both the manual submit and the scan
  callback. It validates the code matches `CODE_REGEX`, calls
  `apiCalls.pair`, persists the token via `setDeviceToken`, fires
  a success haptic (or error haptic on failure), and navigates to
  `/`. Stray non-CNTR QRs in the field of view are silently ignored.

## 4. Execution Steps (Single Commit: `feat(web,mobile): QR rendering + camera scanner for device pairing`)

### Step 1 — Web QR rendering
`apps/web/components/PairDeviceButton.tsx` — import `QRCodeSVG` from
`qrcode.react`, render it inside a card-bordered wrapper above the
existing 12-char display. Use `resolveColor('ink', 'hex')` for the
foreground; transparent background so the modal surface shows
through. The `next no-restricted-syntax` rule blocks raw hex
literals in `apps/**`, hence the token-resolved color.

### Step 2 — Mobile scanner
`apps/mobile/app/pair.tsx` — replace the manual-only screen with a
mode machine. `useCameraPermissions` from `expo-camera` drives the
permission UX; `requestPermission()` happens lazily on first scan
attempt so undecided users still see the manual fallback. Reticle is
a positioned `<View>` with a 2px ink-on-transparent border; the
camera view itself fills a square `aspectRatio: 1` container. Haptic
feedback on every scan (selection) and pair completion (success or
error) via `expo-haptics` (already a project dep).

### Step 3 — Expo plugin config
`apps/mobile/app.json` — add `expo-camera` plugin entry with
`cameraPermission` string ("Counter scans the pairing QR shown on
your dashboard."). This is what Expo writes into Info.plist
(`NSCameraUsageDescription`) and AndroidManifest.xml at prebuild
time.

### Step 4 — Verify
- `pnpm --filter @counter/web lint && typecheck && build` clean. The
  `/dashboard/registers` route grew from 1.55 kB to 7.86 kB — that's
  the QR component pulled into the client bundle, expected.
- `pnpm --filter @counter/mobile lint && typecheck` clean.
- `expo export --platform android` produces `index-*.hbc` (2.64 MB).
- The `pnpm --filter @counter/api typecheck` baseline stays clean
  (the API endpoint is unchanged — this Blueprint is web + mobile
  only).

## 5. Definition of Done

- [x] Web modal renders a scannable QR for the active pairing code.
- [x] Mobile pair screen offers a "Scan QR code" CTA and asks for
      camera permission lazily.
- [x] Successful scan auto-pairs and lands on `/`.
- [x] Manual entry fallback still works after permission denial or
      stray QR rejection.
- [x] Haptic feedback on scan, pair success, and pair failure.
- [x] No literal font-family or hex strings outside
      `@counter/tokens` (the `no-restricted-syntax` lint rule
      catches new violations).
- [x] All linters, typecheckers, web build, and `expo export` pass.

## 6. Open questions resolved at execution time

- **Permission denied**: dropping into the manual-entry mode with a
  red "Camera permission denied — enter the code by hand." hint is
  the least surprising path. Re-requesting from the same screen
  would loop on iOS where second-ask is silently ignored; users who
  granted-then-revoked have to re-grant in OS Settings.
- **Stray QR codes in the field of view**: the scan callback
  validates against `CODE_REGEX` before doing anything, so a barcode
  on a coffee bag or a poster nearby silently does nothing. The
  reticle helps users center the right one.
- **Sound on success**: skipped. The Haptic success notification is
  enough on phones; sound would surprise nearby customers in a quiet
  shop. If a future Blueprint adds an "Accessibility" toggle, sound
  can ride along.
- **Front-camera support**: the back camera is the default and matches
  the cashier-facing-the-dashboard mental model. A camera-toggle
  button would add clutter for an edge case.
