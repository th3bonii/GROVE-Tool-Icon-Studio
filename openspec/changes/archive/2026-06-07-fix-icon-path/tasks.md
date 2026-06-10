# Tasks: Fix Icon Path Mismatch

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~190 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto (from preflight) |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Backend Path Fix

- [x] 1.1 `src-tauri/src/image_processor.rs:12` — Change `REAPER_SCALE_DIRS` to `&["Data/toolbar_icons", "Data/toolbar_icons/150", "Data/toolbar_icons/200"]`
- [x] 1.2 `src-tauri/src/installer.rs` — Refactor all path joins to use `reaper_resource_path.join(sub_dir)`, removing hardcoded `"toolbar_icons"` from `install_icon()`, `install_icon_set()`, `install_icon_set_raw()`, `list_installed_icons()`, `delete_icon()`, `get_icon_strip()`
- [x] 1.3 `src-tauri/src/path_detector.rs` — Add `check_toolbar_icons()` that detects both `Data/toolbar_icons` (preferred) and legacy `toolbar_icons`
- [x] 1.4 `src-tauri/src/image_processor.rs:712` — Update test assertion to expect new `REAPER_SCALE_DIRS` values
- [x] 1.5 `src-tauri/src/installer.rs` — Update all test expected paths from `toolbar_icons/…` to `Data/toolbar_icons/…`
- [x] 1.6 Verify `src/InstallPanel.tsx:20-24` — Confirm `SCALE_DIRS` pathSuffix already has `Data/toolbar_icons/` (no change needed)

## Phase 2: Corner Radius + Dead Code

- [x] 2.1 `src-tauri/src/image_processor.rs:194,451` — Replace `.round().max(2.0)` with `((s as f32) * 0.15 + 0.5).floor().max(2.0)` for round-half-up
- [x] 2.2 `src-tauri/src/image_processor.rs:662` — Remove dead `else if dx <= 0.0 || dy <= 0.0` branch in `apply_rounded_rect_mask`

## Phase 3: CSS Overflow

- [x] 3.1 `src/App.css` — Add `.state-preview { overflow-x: auto; }` to prevent strip preview overflow

## Phase 4: State Persistence

- [x] 4.1 Create `src/hooks/useLocalStorage.ts` — Generic `useLocalStorage<T>(key, defaultValue)` hook with versioned persistence
- [x] 4.2 `src/App.tsx` — Wire `useLocalStorage` for `padding`, `isToggle`, `viewMode` (3 fields); `iconName`, `installEnabled` wired in `useIconInstall`
- [x] 4.3 `src/hooks/useHsbAdjustments.ts` — Wire `useLocalStorage` for `offAdjustments`, `onAdjustments` (2 fields)
- [x] 4.4 `src/hooks/useReaperPath.ts` — Wire `useLocalStorage` for `reaperPath` (1 field)
