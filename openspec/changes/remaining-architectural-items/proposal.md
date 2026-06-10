# Proposal: Remaining Architectural Items

## Intent

Pay down 4 debts: App.tsx monolith (399 lines, 7 hooks), zero CI/CD, unsynced Rust↔TS types (254-line `api.ts`), uncovered ImageCropper canvas (410 lines).

## Scope

### In Scope
- App.tsx → focused components with localized state
- GitHub Actions CI: lint, type-check, test Rust + TS
- Zod schemas for IPC response validation
- ImageCropper unit tests + drag interaction tests

### Out of Scope
- Release/notarization, Zustand/Redux rewrite, E2E tests, ts-rs

## Capabilities

### New
- `ipc-type-validation`: Zod schemas validated on every `invoke()` call

### Modified
- None — all items are implementation-level

## Approach

| Item | Strategy |
|------|----------|
| App.tsx | Extract 6 panels (Source, Crop, Preview, Install, Generate, Batch) with local hook state. Shared state via thin context. Shell → ~80 lines. |
| CI/CD | `.github/workflows/ci.yml`: `npm run lint`, `npx tsc -b`, `npx vitest run`, `cargo clippy`, `cargo test`. PR trigger. |
| Validation | Zod schemas in `src/validation.ts`. Wrap each `invoke()` with `.parse()` for typed errors. |
| Cropper tests | Extract 6 pure functions to `cropper-math.ts` + unit tests. Integration via `@testing-library/react` with pointer events. |

## Affected Areas

`src/App.tsx` (refactor), `src/Panel*.tsx` (new, ~6 files), `.github/workflows/ci.yml` (new), `src/api.ts` (modify), `src/validation.ts` (new), `src/ImageCropper.tsx` (modify), `src/cropper-math.ts` (new), `src/__tests__/cropper-math.test.ts` (new), `src/__tests__/ImageCropper.test.tsx` (new)

## Phasing — 4 PRs

| PR | Item | Lines | Risk |
|----|------|-------|------|
| 1 | Cropper tests | ~180 | Low |
| 2 | CI/CD | ~100 | Low |
| 3 | Validation | ~200 | Med |
| 4 | App.tsx decomp | ~400 | Med |

All independent. Order: quick wins first.

## Risks & Mitigations

- **App.tsx state breakage** (Med): Extract one panel at a time, `npx vitest run` after each
- **CI missing config** (Med): Fix alongside CI setup; `continue-on-error` initially
- **Zod drift from Rust** (Low): Doc comment in Rust structs referencing zod
- **Drag test flakiness** (Low): Use `pointer` events + explicit `pointerCapture`

## Rollback

Revert commits for each item independently. Git revert for code changes; delete `.github/workflows/ci.yml`.

## Dependencies

- `zod` npm package (Item 3)
- `.github/` directory (Item 2)

## Success Criteria

- [ ] `src/App.tsx` under 120 lines
- [ ] CI passes on every PR commit
- [ ] Every `invoke()` validates response via zod
- [ ] Pure functions ≥90% coverage; drag test covers 4 modes
