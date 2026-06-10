# Tasks: Layout, Preview, and Performance Fixes

## Review Workload Forecast

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

| Field | Value |
|-------|-------|
| Estimated changed lines | ~150-200 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Rust: cache + pre-resize + async | PR 1 | ~100 lines; each step TDD (RED→GREEN) |
| 2 | UI: preview cap + scroll + window | PR 1 | ~50-60 lines; no TDD needed |

## Phase 1: Rust Backend — Cache, Pre-resize, Async

- [x] **1.1 Source cache (TDD RED→GREEN)**
- [x] **1.2 Pre-resize optimization (TDD RED→GREEN)**
- [x] **1.3 Async commands (TDD RED→GREEN)**
  - RED: Write `#[tokio::test]` calling `preview_icon`/`process_icon`/`install_icon_set` with `.await` (won't compile — sync functions)
  - GREEN: Convert 3 commands to `async fn`; wrap CPU work in `tokio::task::spawn_blocking`; update tests to `#[tokio::test]` + `.await`
  - Files: `src-tauri/src/lib.rs` (add `tokio` dev-dep if absent)
  - Deps: 1.2
  - Acceptance: `cargo test` passes; commands return same data as before

## Phase 2: UI — Preview Cap & Size Annotation

- [x] **2.1 Preview cap:** Change `Math.min(3, computed)` → `Math.min(2, computed)` in `getDisplayScale()`
- [x] **2.2 Size annotation:** Show "(actual size)" at 1× zoom and "(2× zoom)" at 2× beside the scale header
  - Files: `src/StatePreview.tsx`
  - Deps: 2.1
  - Acceptance: Annotation visible and accurate per zoom level

## Phase 3: UI — Scroll Container & Window Config

- [x] **3.1 Installed icons scroll:** `.install-installed-tags` → add `max-height: 200px; overflow-y: auto`
- [x] **3.2 Container width:** `.container` max-width from 640px → 720px
- [x] **3.3 Window config:** Height 600 → 850; add `minWidth: 800, minHeight: 850` in `tauri.conf.json`
  - Files: `src-tauri/tauri.conf.json`
  - Deps: None
  - Acceptance: Window opens at 800×850; cannot resize below minima

## Phase 4: Verification

- [x] **4.1** `cargo test` — 105 tests pass (93 original + 12 new)
- [x] **4.2** `npx vitest run` — 114 JS tests pass
- [x] **4.3** `npx tsc -b` — TypeScript compiles clean
  - Deps: All phases 1-3
