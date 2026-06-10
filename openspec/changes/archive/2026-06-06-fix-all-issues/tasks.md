# Tasks: Fix All Issues — Rust Backend & React Frontend Refactor

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~550–700 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: Rust cleanup → PR 2: Hooks extraction → PR 3: Components |
| Delivery strategy | auto-forecast |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Rust: constants, dedup, rollback, raw mode, pixel loops | PR 1 | Base main; `cargo test` verifies pixel identity |
| 2 | Frontend: 4 hooks + App.tsx refactor | PR 2 | Depends on PR 1 for API shape; includes `tsc -b` check |
| 3 | Frontend: CSS, ErrorBoundary, a11y, error surfacing | PR 3 | Independent of PR 2; UI-only visual check |

## Phase 1: Rust — Constants & Cleanup

- [ ] 1.1 Add `REAPER_SCALES` & `REAPER_SCALE_DIRS` consts to `image_processor.rs`
- [ ] 1.2 Remove hardcoded `vec![30, 45, 60]` from `lib.rs` (3 sites), import const
- [ ] 1.3 Remove hardcoded scales from `installer.rs` tests, use imported consts
- [ ] 1.4 Delete unused `ProcessingError::EmptyError` variant
- [ ] 1.5 Replace `Vec` dedup with `HashSet` in `list_installed_icons()`
- [ ] 1.6 Add atomic rollback: temp-dir writes + `std::fs::rename` in `install_icon_set()`

## Phase 2: Rust — Encode→Decode Elimination

- [ ] 2.1 Add `OutputMode` enum (`Preview` | `File`) to `image_processor.rs`
- [ ] 2.2 Add `mode: OutputMode` param to `generate_icon_set()`, skip base64 on `File`
- [ ] 2.3 Update `process_icon` in `lib.rs` to use `OutputMode::File`
- [ ] 2.4 Verify `preview_icon` uses `OutputMode::Preview` — confirm base64 unchanged

## Phase 3: Rust — Pixel-Loop Optimization

- [ ] 3.1 Replace `copy_region()` pixel loop with `image::imageops::replace()`
- [ ] 3.2 Rewrite `adjust_brightness()` using `enumerate_pixels_mut()`
- [ ] 3.3 Replace `apply_padding()` paste loop with `image::imageops::overlay()`
- [ ] 3.4 Rewrite `apply_hsb()` with `enumerate_pixels_mut()`
- [ ] 3.5 Run `cargo test` — verify pixel output identical on known inputs

## Phase 4: Frontend — Hooks Extraction

- [x] 4.1 Create `src/hooks/useReaperPath.ts`: detect + list + manual-select
- [x] 4.2 Create `src/hooks/useIconPreview.ts`: debounced preview with cancel + error
- [x] 4.3 Create `src/hooks/useIconProcessing.ts`: generate state + error
- [x] 4.4 Create `src/hooks/useIconInstall.ts`: install + refresh installed icons
- [x] 4.5 Refactor `src/App.tsx`: compose 4 hooks, keep orchestration + JSX only

## Phase 5: Frontend — CSS, Components & A11y

- [x] 5.1 Create `src/ErrorBoundary.tsx` class component with retry button
- [x] 5.2 Wrap `<App />` in `<ErrorBoundary>` in `src/main.tsx`
- [x] 5.3 Migrate `InstallPanel.tsx` inline styles → CSS classes in `App.css`
- [x] 5.4 Migrate `StatePreview.tsx` inline styles → CSS classes in `App.css`
- [x] 5.5 Add keyboard nudge (arrow=1px, Shift+arrow=10px) + ARIA to `ImageCropper.tsx`
- [x] 5.6 Surface preview errors: render `previewError` in `StatePreview`
- [x] 5.7 Remove dead CSS rules (dl, dt, dd) from `App.css`
