# Tasks: Fix Startup Crash and Slowness

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~55-65 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-forecast |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Rust Backend — Async Conversion

- [x] 1.1 `src-tauri/src/lib.rs` (lines 199-202): Convert `list_installed_icons` to `async fn`, wrap `installer::list_installed_icons` in `tokio::task::spawn_blocking`, keep `Result<Vec<String>, String>` signature
- [x] 1.2 `src-tauri/src/lib.rs` (lines 220-226): Convert `get_icon_thumbnails` to `async fn`, return `Result<HashMap<String, String>, String>`, wrap helper in `spawn_blocking`
- [x] 1.3 `src-tauri/src/lib.rs`: Add input-vs-output validation in `get_icon_thumbnails` — compare `names` against returned map keys, return `Err` listing missing names

## Phase 2: Frontend — Error Resilience

- [x] 2.1 `src/api.ts` (lines 220-226): Replace raw dynamic `invoke` with `safeInvoke` + `z.record(z.string(), z.string())` schema
- [x] 2.2 `src/sections/InstallSection.tsx` (line 111): Add `.catch()` after `load()` call to catch promise rejections from `getIconThumbnails`

## Phase 3: Tests

- [x] 3.1 `src-tauri/src/lib.rs` (lines 649-678): Change `list_installed_icons_command_returns_icons_from_all_scales` from `#[test]` to `#[tokio::test]`, add `.await` to the command call
- [x] 3.2 `src-tauri/src/lib.rs` (lines 680-692): Change `list_installed_icons_command_returns_empty_for_new_dir` from `#[test]` to `#[tokio::test]`, add `.await` to the command call
- [x] 3.3 `src-tauri/src/lib.rs`: Add `#[tokio::test]` test for `get_icon_thumbnails` — call with a non-existent icon name, assert `Err` is returned and no panic occurs

## Implementation Order

Phase 1 first (backbone — all other tasks depend on the new async signatures). Phase 2 next (frontend error handling). Phase 3 last (tests validate the work).
