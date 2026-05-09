# JuniorInvest — Project Instructions for Claude Code

## Auto-merge policy (MANDATORY — follow without being asked)

After creating any pull request in this repository:
1. Immediately merge it to `main` using `mcp__github__merge_pull_request` (squash method).
2. Sync the local repo: `git fetch origin main && git pull origin main` on the feature branch is fine; reset local `main` to `origin/main` if needed.
3. Do **not** wait for the user to request the merge — do it automatically every time.

## Development branch

All new work goes on `claude/juniorinvest-architecture-plan-2uPS2` (or a new branch if that one is already merged).  Never push directly to `main` — always PR → auto-merge.

## Repository purpose

**JuniorInvest** — Vanilla JS SPA, Hebrew RTL, dark Tailwind theme.  
A multi-kid stock portfolio tracker: parent buys shares in one brokerage account; the app splits ownership across N kids by configurable % allocation.  Parent ghost shares are tracked internally for dividend math only and **must never appear in any UI output**.

## Key constraints

- Engine layer (`src/ledger`, `src/math`, `src/util`) is pure JS — zero DOM access.
- Ledger is append-only; all state is derived by `LedgerEngine.deriveState`.
- `proratePreservingTotal` (largest-remainder) is used everywhere money/shares are split across kids to avoid rounding leakage.
- SELL is kids-only (parent shares are never sold via this app).
- No WITHDRAW in v1.
- Quote source: manual `quotes` map; optional API refresh later.
- Persistence: `LocalStoragePersistence`, key `juniorinvest:v1`.
- `index.html` lives at repo root so GitHub Pages serves the app at `https://lironcon2015-prog.github.io/-/`.
