# CLAUDE.md — Counter POS

Instructions for Claude Code working in this repo. Reads in addition to the user's global `~/.claude/CLAUDE.md`. Where this file conflicts with the global, **this file wins**.

---

## Project in one paragraph

**Counter** is a calm, offline-first point-of-sale for small independent shops. Three surfaces share one account: a **mobile app** (React Native + Expo, Android APK + iOS TestFlight), a **web dashboard + marketing site** (Next.js 14, `app.counter.app` and `counter.app`), and a **backend** (Node.js + Fastify, Postgres, Redis). A custom WebSocket-based **sync engine** keeps them coherent. The authoritative spec is [`HANDOFF.md`](./HANDOFF.md); the visual source of truth is `Counter POS.html` and `Counter Web.html` plus the JSX prototypes in `src/`, `web/`, and `shared/`.

---

## Repo-specific overrides

### 1. Do **not** use git worktrees in this repo
The user's global rule mandates worktrees for all work. **This repo opts out.** Commit on the active branch directly. The "always use a worktree" rule does not apply here.

### 2. Treat `HANDOFF.md` as the spec
HANDOFF defines stack, screens, sync rules, and non-negotiables. The HTML/JSX prototypes win on visual detail; HANDOFF wins on architecture and behavior. If a request contradicts HANDOFF, surface the conflict before implementing.

### 3. Visual-prototype files are reference, not production
`Counter POS.html`, `Counter Web.html`, `src/*.jsx`, `web/*.jsx`, `shared/*.jsx` are React-via-Babel-standalone prototypes. They are **read-only design source**. Do not edit them as if they were the app. Production code lives under `apps/` and `packages/` (to be scaffolded).

### 4. Architect / Executor split
For project work in this repo, **Gemini is the Architect** (owns Blueprints) and **Claude is the Executor** (implements Blueprints). When a roadblock requires a design change, re-consult Gemini via `/ask gemini` rather than improvising. Read `GEMINI.md` for the Architect's brief.

---

## Inherited rules (from global CLAUDE.md, restated for emphasis)

- **Always sign commits with both `-s` and `-S`**: `git commit -s -S -m "..."`. Every commit, no exceptions.
- **No self-attribution.** No `Co-Authored-By: Claude`, no "Generated with Claude Code" footer.
- **Conventional Commits prefix.** `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`.
- **Linter + formatter before every commit.** Once tooling lands, that means `pnpm lint && pnpm format`. Do not skip pre-commit hooks (`--no-verify` forbidden).
- **Fail fast.** On a non-obvious error or unresolved traceback, stop and report full output. Do not silently retry or hack around it. Re-consult Gemini.

---

## Counter non-negotiables (from HANDOFF §8)

1. **Offline-first or nothing.** Never block a user action on a network call. No spinners on sell actions.
2. **Tokens are law.** No hard-coded colors, font families, or radii outside `packages/tokens`. ESLint rule should enforce once tokens land.
3. **Every price is JetBrains Mono.** Every timestamp is JetBrains Mono. Money never renders in a proportional font.
4. **Accessibility:** 44px minimum touch target on mobile, WCAG AA contrast on web, keyboard-navigable tables, screen-reader labels on every icon button.
5. **Free tier stays free forever.** No dark patterns. Sync gating is the only paywall.
6. **Your data is yours.** CSV/JSON export works on every tier. Account delete wipes within 30 days.

---

## Open questions flagged in HANDOFF §9 (do not improvise — ask)

These are explicitly out of scope until the user provides direction:

- Tipping model (percent vs fixed vs no-tip; varies by region)
- Tax engine (flat / multi-rate / TaxJar / Avalara)
- Refund rules (full/partial, time window, reason required)
- Loyalty model (punchcard / points / spend-based)
- Team RBAC matrix
- Region & currency matrix for launch

When implementing anything that touches these, default to the mobile prototype's visible behavior, flag it in the PR, and surface to the user.

---

## Stack reference (per HANDOFF)

| Surface | Tech |
|---|---|
| Mobile | React Native + Expo (bare), TypeScript strict, Zustand, WatermelonDB, Expo Router |
| Web | Next.js 14 App Router, TypeScript strict, Tailwind, TanStack Table, Recharts |
| API | Node.js 20 + Fastify, TypeScript strict, Postgres 16, Redis 7, S3-compatible object store |
| Sync | Custom WebSocket + HTTPS fallback, Lamport-clock per org, delta-CRDT for inventory |
| Tooling | pnpm 9 workspaces + Turborepo, one ESLint config, one Prettier config, one tsconfig base |

Planned monorepo layout (HANDOFF §6):

```
apps/{mobile,web,api}
packages/{tokens,ui-web,ui-mobile,sync,schema,utils}
tooling/
```

The repo currently contains design references only; scaffolding lives in the Week 1 plan.

---

## Working agreements

- When starting non-trivial work, check `GEMINI.md` and the latest Blueprint from Gemini before coding.
- When the spec is silent, prefer the prototype's visible behavior and flag the assumption in the commit/PR.
- Update this file when (a) a new repo-specific rule is established or (b) an inherited rule is overridden.
- Update `GEMINI.md` whenever the Architect's brief shifts (new constraints, new open questions, completed milestones).
- Update `README.md` whenever onboarding facts change (stack, layout, commands).
- Update `DEPLOY.md` whenever environment/setup steps change.
