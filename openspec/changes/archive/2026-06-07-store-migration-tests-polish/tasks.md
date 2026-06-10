# Tasks: store-migration-tests-polish

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~150-200 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | single-pr |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Debug Logging (Rust Backend)

- [x] 1.1 Add `eprintln!` with `[installer]` prefix in `src-tauri/src/installer.rs` at `install_icon_set_raw` write points, logging target temp path and final path before each file operation
- [x] 1.2 Add `eprintln!` with `[path_detector]` prefix in `src-tauri/src/path_detector.rs` in `detect()`, logging each candidate method checked and the resolved path + method

## Phase 2: Path Display (UI)

- [x] 2.1 Add muted `<p>` line in `src/App.tsx` within `#reaper-path-section` showing `{path}/Data/toolbar_icons/` below the existing detected path code block

## Phase 3: Testing

- [x] 3.1 Create `src/hooks/__tests__/useLocalStorage.test.ts` with 9 `renderHook` + `act` scenarios: basic set/get, overwrite, functional update, missing key → default, JSON parse error → default, version mismatch → default, storage full → silent fail, multiple keys, mount/unmount safety

## Phase 4: Configuration & Verification

- [x] 4.1 Update `openspec/config.yaml` — change JS test runner from `NONE` to `vitest` and `Test framework` from `NONE` to `@testing-library/react`, reflect jsdom + vitest 4.1.8 reality
- [x] 4.2 Note: `openspec/specs/reaper-path-detection/spec.md` already updated during spec phase — no action needed
- [x] 4.3 Run `cargo test` — all Rust tests pass (93 total, including 3 new)
- [x] 4.4 Run `npx vitest run` — all 114 tests pass (9 new useLocalStorage scenarios)
- [x] 4.5 Run `npx tsc -b` — TypeScript compiles without errors
