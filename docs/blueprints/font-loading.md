# Blueprint: Real Font Loading (Web & Mobile)

**Status**: Completed — landed 2026-05-02
**Architect**: Gemini
**Executor**: Claude
**Approved by**: Red, 2026-05-02 (auto mode)
**Context**: HANDOFF §1 (Brand) & §8 (Non-negotiables: tokens are law,
every price is JetBrains Mono)

## 1. Goal

Replace system-font fallbacks with the brand typefaces — Inter, JetBrains
Mono, and Fraunces — on both surfaces, so every price actually renders
in monospace and every display heading actually renders in Fraunces.

## 2. Why this next?

- **Closes a non-negotiable.** HANDOFF §8 #3 reads "every price is
  JetBrains Mono. Money never renders in a proportional font." Without
  loaders wired, web prices fell back to `ui-monospace` (close, but
  not the right glyphs) and mobile prices fell back to whatever the OS
  system mono is — neither is JetBrains Mono.
- **Closes a silent web bug.** `apps/web/app/layout.tsx` was already
  using `next/font/google` to fetch the right faces, but registered
  them under CSS variables `--font-ui-loaded`/`--font-mono-loaded`/
  `--font-display-loaded` while Tailwind and `globals.css` consumed
  `--font-ui`/`--font-mono`/`--font-display`. The loaded faces were
  never applied. SSR shipped Inter via `<link>` and the browser saw it
  but no rule referenced it.
- **Closes the M5 TODO.** `apps/mobile/app/_layout.tsx` carried a
  `TODO(M5): preload JetBrainsMono-Regular, Inter, and Fraunces via
  expo-font`. The earlier scaffold pointed at a Roboto path inside
  RN internals, which stopped resolving in 0.74. We replace it with
  the canonical `@expo-google-fonts/*` packages (ttf bundled in the
  package, `useFonts` hook re-exported from `expo-font`).

## 3. Implementation Strategy

- **Web**: rename the `next/font` `variable:` keys to match the names
  Tailwind/CSS already read (`--font-ui`, etc.), and add `fallback:`
  entries so the synthesized adjusted-fallback metric stays close to
  the loaded face during the small `display: swap` window. The
  `:root` declarations in `variables.css` stay as the SSR baseline; the
  generated `<html>` className overrides them at higher specificity.
- **Mobile**: add three `@expo-google-fonts/*` packages, call
  `useFonts` with the four needed weights of each family in the root
  layout, gate first paint on `fontsLoaded`, and hide the splash once
  loading resolves. RN cannot synthesize bold/italic from a single ttf,
  so the native theme exposes weight-specific family names
  (`Inter_500Medium`, `JetBrainsMono_700Bold`, etc.) — consumers pick
  the exact face they want.

## 4. Execution Steps (Single Commit: `feat(web,mobile): load brand fonts (Inter, JetBrains Mono, Fraunces)`)

### Step 1 — Web: align next/font variable names
`apps/web/app/layout.tsx` — change `variable: '--font-ui-loaded'` →
`'--font-ui'` (and the same for `mono`/`display`), and add `fallback:`
arrays so the swap-time adjustment metric is computed against a
concrete fallback rather than nothing.

### Step 2 — Mobile: install Google Font packages
`apps/mobile/package.json` — add `@expo-google-fonts/inter@0.2.3`,
`@expo-google-fonts/jetbrains-mono@0.2.3`,
`@expo-google-fonts/fraunces@0.2.3`. Each ships its full ttf set;
`useFonts` is re-exported from `expo-font` and works the same across
all three.

### Step 3 — Mobile: useFonts + splash gate
`apps/mobile/app/_layout.tsx` — call `SplashScreen.preventAutoHideAsync()`
at module scope, call `useFonts({...})` with the 12 specific weight
files we use (4×Inter, 4×JetBrainsMono, 2×Fraunces normal +
2×Fraunces italic), `useEffect(() => fontsLoaded && hideAsync())`,
and `return null` while loading. Apply `nativeTheme.fonts.display`
to `headerTitleStyle.fontFamily` so screen titles use Fraunces.

### Step 4 — Native theme: weight-specific family names
`packages/tokens/src/native/index.ts` — replace the single `'Inter'`
/`'JetBrainsMono-Regular'`/`'Fraunces'` strings with the exact family
names registered by `@expo-google-fonts` (`Inter_400Regular`,
`Inter_500Medium`, `Inter_600SemiBold`, `Inter_700Bold`, the matching
JetBrains Mono four, plus `Fraunces_400Regular`/`_Italic` and the
`_500Medium`/`_Italic` pair). Update `text.money.fontFamily` to
`'JetBrainsMono_400Regular'`. Existing consumer
`apps/mobile/src/components/Money.tsx` keeps working unchanged
because it reads through `nativeTheme.text.money.fontFamily`.

### Step 5 — Drop the literal in receipt
`apps/mobile/app/receipt.tsx` — the only place that hard-coded
`'JetBrainsMono-Regular'` switches to `nativeTheme.fonts.mono`.

### Step 6 — Verify
- `pnpm --filter @counter/web typecheck && lint && build`: clean.
  Build output shows no font-route regressions.
- `pnpm --filter @counter/mobile typecheck && lint`: clean. `expo
  export --platform android` produces `index-*.hbc` (2.62 MB) and
  bundles the ttf files used by `useFonts`.
- `pnpm --filter @counter/tokens build && lint && typecheck`: clean.

## 5. Definition of Done

- [x] `next/font` variable names match what Tailwind/CSS read.
- [x] Loaded faces resolve: `var(--font-ui)` =
      `__Inter_*, __Inter_Fallback_*, -apple-system, ...` instead
      of just the system stack.
- [x] Mobile splash stays up until 12 weight files load; first
      paint never shows fallback fonts.
- [x] Native theme exposes weight-specific family names matching
      the keys registered by `useFonts`.
- [x] No literal font-family strings outside `@counter/tokens`.
- [x] All linters, typecheckers, web build, and `expo export` pass.

## 6. Open questions resolved at execution time

- **Variable fonts on mobile**: skipped. Expo's variable-font support
  is still inconsistent across Android driver versions; we ship
  discrete weight files. The Inter file alone is small (the four
  weights total ~640KB), and the bundle's main cost is JetBrains
  Mono's 12 italic+roman weights that ship via the
  `@expo-google-fonts/jetbrains-mono` package even when only four
  are referenced (Metro's static-asset handling does not tree-shake
  `require()`-based exports). Acceptable for now; if the bundle
  budget tightens we can vendor only the needed ttfs in
  `apps/mobile/assets/fonts/`.
- **Marketing site without next/font**: not a concern — the only
  consumer of `variables.css` in this repo is `apps/web`, which now
  has next/font wired. The `:root` fallback chain in `variables.css`
  is preserved as a safety net for any future package that imports
  the CSS file directly without next/font.
- **Italic Fraunces**: only the "normal" 400+500 and italic 400+500
  are loaded. The HTML/JSX prototypes use italic Fraunces sparingly
  (hero accent words); we do not need bold italic. If display copy
  later needs 600+ italic, add the entries to `useFonts` and a new
  field on `nativeTheme.fonts`.
