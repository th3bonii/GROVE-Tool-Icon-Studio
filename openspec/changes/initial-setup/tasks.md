# Tasks: initial-setup

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~600-800 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | App Shell Scaffold | PR 1 | Target: main. Scaffold Tauri + React + Vite, basic UI (`src/App.tsx`). |
| 2 | Path Detection Engine | PR 2 | Target: PR 1 branch. Implement `src-tauri/src/path_detector.rs` & tests. |
| 3 | Image Processing | PR 3 | Target: PR 2 branch. Implement `src-tauri/src/image_processor.rs` & tests. |
| 4 | Integration & IPC | PR 4 | Target: PR 3 branch. Wire commands in `main.rs` & frontend API calls. |

## Phase 1: Foundation (App Shell)

- [x] 1.1 Scaffold `package.json`, `vite.config.ts`, and frontend tooling for React+Vite+TS.
- [x] 1.2 Scaffold `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json` for Rust backend, including `tauri-plugin-dialog` for fallback selection.
- [x] 1.3 Create basic application shell UI in `src/main.tsx` and `src/App.tsx`.

## Phase 2: Core Implementation (Engines)

- [x] 2.1 Create `src-tauri/src/path_detector.rs` to detect standard REAPER paths on Windows/macOS/Linux.
- [x] 2.2 Add Linux Wine/Proton fallback heuristics to `path_detector.rs`.
- [x] 2.3 Create `src-tauri/src/image_processor.rs` using `image` crate.
- [x] 2.4 Implement 3-state generation (W*3 x H dimensions) and alpha channel preservation in `image_processor.rs`.

## Phase 3: Integration (IPC & Wiring)

- [x] 3.1 Register `detect_reaper_path` and `process_icon` as Tauri IPC commands in `src-tauri/src/main.rs`.
- [x] 3.2 Create frontend API wrapper in `src/api.ts` to call IPC commands.
- [x] 3.3 Connect UI in `src/App.tsx` to handle path detection, open directory dialog for manual fallback, and trigger icon processing.

## Phase 4: Testing & Verification

- [ ] 4.1 Write unit tests for `path_detector.rs` mocking filesystem structures.
- [ ] 4.2 Write unit tests for `image_processor.rs` validating dimensions and transparency.
- [ ] 4.3 Verify application compiles and launches successfully via E2E/manual check.
