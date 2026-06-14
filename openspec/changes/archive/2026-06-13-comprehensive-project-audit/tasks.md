# Tasks: Comprehensive Project Audit

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 50–120 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-always |
| Chain strategy | single-pr |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: single-pr
400-line budget risk: Low

## Phase 1: Critical Rust Bug Fixes

- [x] 1.1 RED: Write test expecting linear sat_delta for values -50, -25, 25, 50 in `image_processor.rs`
- [x] 1.2 RED: Write test confirming S=0 pixel unchanged regardless of sat_delta
- [x] 1.3 GREEN: Divide `sat_delta` by 100.0 in `apply_hsb` (L366, `image_processor.rs`)
- [x] 1.4 RED: Write test expecting `Err` from `process_icon` on write failure
- [x] 1.5 GREEN: Return `Err` from `process_icon` on `std::fs::write` failure (L88–91, `lib.rs`)
- [x] 1.6 REFACTOR: Run `cargo test` — verify sat_delta + write error tests pass

## Phase 2: High-Severity Rust Fixes

- [x] 2.1 RED: Write test for integer division guard returning `Err` on mismatched counts
- [x] 2.2 GREEN: Add integer division guard returning `Err` in `lib.rs` `process_icon`
- [x] 2.3 GREEN: Add integer division guard returning `Err` in `installer.rs` `install_icon_set`
- [x] 2.4 GREEN: Derive scale subdirs from `REAPER_SCALE_DIRS` constant in `lib.rs` (L68)
- [x] 2.5 GREEN: Document rename rollback gap as comment in `installer.rs`
- [x] 2.6 VERIFY: `cargo test` green after all Phase 2 changes

## Phase 3: Frontend & Config Fixes

- [x] 3.1 GREEN: Replace `await import()` with static `import { invoke }` in `validation.ts`
- [x] 3.2 GREEN: Align active `bri_delta` default from -15 to -40 in `useHsbAdjustments.ts`
- [x] 3.3 GREEN: Remove unused `IconConfig` interface from `api.ts` (L14–23)
- [x] 3.4 GREEN: Replace `scaleX` with shared `scale` variable for Y-coordinate in `ImageCropper.tsx`
- [x] 3.5 GREEN: Enable CSP in `src-tauri/tauri.conf.json`
- [x] 3.6 VERIFY: `npx vitest run` + `npx tsc -b` green after all Phase 3 changes

## Phase 4: Final Verification

- [x] 4.1 VERIFY: `cargo test` — all Rust tests pass
- [x] 4.2 VERIFY: `npx vitest run` — all frontend tests pass
- [x] 4.3 VERIFY: `npx tsc -b` — no type errors
- [x] 4.4 VERIFY: Confirm `eslint.config.js` exists or fix lint script in `package.json`
