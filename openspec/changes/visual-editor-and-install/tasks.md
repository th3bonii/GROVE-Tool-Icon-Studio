# Tasks: Visual Editor & Auto-Install

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~700–850 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes (resolved — feature-branch-chain, PR 1)
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Rust backend core (image_processor + installer + tests) | PR 1 ✅ | Base: main. Crop/resize/preview logic, install module, Cargo.toml. **Completed.** |
| 2 | Rust IPC commands + frontend API types | PR 2 | Base: PR 1 branch. lib.rs commands, api.ts types, useDebounce |
| 3 | Frontend components (cropper, preview, install panel) | PR 3 | Base: PR 2 branch. ImageCropper, StatePreview, InstallPanel |
| 4 | Integration & verification | PR 4 | Base: PR 3 branch. App.tsx, App.css, App.test.tsx, cargo test + build |

## Phase 1: Rust Backend Core — TDD (Image Processor + Installer)

- [x] 1.1 RED: Write failing tests for crop support, state_size parameter, and preview mode in `image_processor.rs`
- [x] 1.2 GREEN: Add `CropArea` struct and `crop_region()` fn to `image_processor.rs` — crop source before processing
- [x] 1.3 GREEN: Add `state_size` (30|38) param — scale cropped region to target size before 3-state generation
- [x] 1.4 GREEN: Add `preview_mode` — return base64-encoded PNGs for 3 states instead of writing to disk
- [x] 1.5 RED: Write failing test for `install_icon` in new `src-tauri/src/installer.rs`
- [x] 1.6 GREEN: Create `installer.rs` — `install_icon(src, name)` copies to `{reaper}/Data/toolbar_icons/{name}.png`
- [x] 1.7 GREEN: Add `list_installed_icons()` to `installer.rs` — list files in toolbar_icons directory
- [x] 1.8 Add `base64` crate to `src-tauri/Cargo.toml` for preview IPC encoding

## Phase 2: Rust IPC Commands

- [x] 2.1 Modify `process_icon` in `lib.rs` — accept `crop: Option<CropArea>`, `state_size: Optional<u32>` (defaults 30), optional crop
- [x] 2.2 Add `preview_icon` command — calls `generate_three_state` with `output_path=None`, returns base64 in `PreviewOutput`
- [x] 2.3 Add `install_icon` command — wraps `installer::install_icon`, returns installed path as `String`
- [x] 2.4 Add `list_installed_icons` command — wraps `installer::list_installed_icons`
- [x] 2.5 Register all new commands in `tauri::generate_handler![]`

## Phase 3: Frontend API Layer & Hooks

- [x] 3.1 Add `CropArea`, `ProcessingOutput` types to `src/api.ts` (matches Rust structs)
- [x] 3.2 Extend `processIcon()` to accept optional `crop` and `stateSize` (backward-compatible)
- [x] 3.3 Add `previewIcon()`, `installIcon()`, `listInstalledIcons()` to `src/api.ts`
- [x] 3.4 Create `src/hooks/useDebounce.ts` — generic debounce hook (300ms default)

## Phase 4: Frontend Components

- [x] 4.1 Create `src/ImageCropper.tsx` — HTML canvas with mousedown/mousemove/mouseup drag rect, 1:1 aspect ratio clamp, emits `onCrop(CropArea | null)`
- [x] 4.2 Create `src/StatePreview.tsx` — debounced preview IPC call, renders 3 `<img>` states side-by-side with dimension labels
- [x] 4.3 Create `src/InstallPanel.tsx` — name input, install toggle, installed icons `<select>`, size selector (30/38), generate button

## Phase 5: Integration & Wiring

- [x] 5.1 Refactor `src/App.tsx` — replace linear flow with ImageCropper + StatePreview + InstallPanel layout
- [x] 5.2 Add cropper, preview panel, install panel styles to `src/App.css`
- [x] 5.3 Wire full flow: file select → crop → preview (debounced) → generate → install

## Phase 6: Testing & Verification

- [ ] 6.1 Verify `cargo test` passes — crop, state_size, preview mode, install_icon tests all green
- [ ] 6.2 Write frontend tests: `ImageCropper` mouse events + `useDebounce` timing
- [x] 6.3 Update `src/__tests__/App.test.tsx` — mock new API surface, verify new UI sections render
- [x] 6.4 Run `npm run build` — verify TypeScript compilation and Vite bundling succeed
