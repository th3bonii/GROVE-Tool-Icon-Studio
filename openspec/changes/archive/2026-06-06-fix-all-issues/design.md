# Design: Fix All Issues — Rust Backend & React Frontend Refactor

## Technical Approach

Pure refactor across 12 independent issues: 6 Rust, 6 React. Each issue has a narrow, testable change with no behavioral side effects. Approach is additive where possible (new functions, new hooks) then swap callers.

## Architecture Decisions

### 1. Rust Output Mode: Enum parameter over new function

| Option | Tradeoff | Decision |
|--------|----------|----------|
| New `generate_icon_set_raw()` function | Duplicates pipeline logic | ✗ |
| Enum param on `generate_icon_set()` | Backward compat via default, single pipeline | ✓ |

**Rationale**: A single pipeline with `OutputMode::Preview` | `OutputMode::File` avoids branching two parallel code paths. `Preview` base64-encodes; `File` returns raw `Vec<u8>`. Callers (`process_icon`, `install_icon_set`) use `File` and skip the encode→decode roundtrip.

### 2. Pixel-loop replacement: `image` crate bulk ops

| Function | Current | Replacement |
|----------|---------|-------------|
| `copy_region()` | pixel loop | `image::imageops::replace()` |
| `adjust_brightness()` | pixel loop | Keep pixel loop but `enumerate_pixels_mut()` |
| `apply_hsb()` | pixel loop with get/put | `enumerate_pixels_mut()` |
| `apply_padding()` | pixel paste loop | `image::imageops::overlay()` |
| `crop_region()` | pixel loop | `image::imageops::crop()` / `sub_image()` |
| Strip assembly in `generate_icon_set()` | pixel loop per state | `image::imageops::replace()` |

**Rationale**: `enumerate_pixels_mut()` avoids bound checks and get/put overhead. `replace()`, `overlay()`, and `crop_imm()` use optimized SIMD paths in the `image` crate.

### 3. Scales: Single `const` in `image_processor.rs`

Extract `REAPER_SCALES: &[u32]` and `REAPER_SCALE_DIRS: &[&str]`. All callers in `lib.rs` and `installer.rs` import and use them. Scale dirs like `["", "150", "200"]` move alongside scales for cohesion.

### 4. Dedup: `Vec` → `HashSet`

Replace `let mut icons: Vec<String>` with `HashSet<String>` in `list_installed_icons()`. Collect to sorted `Vec` at return.

### 5. Install rollback: Temp dir + atomic rename

Write each file to a temp dir under the same parent (using `tempfile::Builder` or manual `std::fs::rename`). On success, rename temp→target. On any failure, delete temp dir. No crate dependency needed — `std::fs::rename` is atomic on the same filesystem.

### 6. Dead code: Remove `ProcessingError::EmptyError`

Delete the enum variant. No callers reference it. Compiler confirms.

### 7. App.tsx: 4 extracted hooks

```
src/hooks/
├── useDebounce.ts       (exists)
├── useReaperPath.ts     ← new
├── useIconPreview.ts    ← new
├── useIconProcessing.ts ← new
└── useIconInstall.ts    ← new
```

Each hook encapsulates one concern. App.tsx composes them, keeps orchestration and JSX only.

### 8. Inline styles → CSS classes

Migrate every `style={}` in `InstallPanel.tsx` and `StatePreview.tsx` to CSS classes in `App.css`. Use existing CSS custom properties (e.g., `--color-surface`, `--color-text-muted`).

### 9. ErrorBoundary: Class component in `ErrorBoundary.tsx`

Standard lifecycle: `componentDidCatch`, `getDerivedStateFromError`. Fallback with retry button. Wrap `<App />` in `main.tsx`.

### 10. Preview error surfacing: Set error state

Replace `.catch(() => setPreviewResults([]))` with `.catch((err) => setPreviewError(err))`. Add `previewError` state, render in `StatePreview`.

### 11. ImageCropper a11y

Add `onKeyDown` handler (arrow=nudge 1px, Shift+arrow=10px). Add `role="application"`, `aria-label="Image crop area"`, `tabIndex={0}` on canvas element.

### 12. Dead CSS removal

Remove `dl`, `dt`, `dd` rules (App.css lines 179-196). No components use these elements.

## Data Flow

```
User crop action → ImageCropper (keyboard/mouse)
                       │
                       ▼
              useIconPreview (debounced 300ms)
                       │
                       ▼
         preview_icon [OutputMode::Preview] → base64 → StatePreview
                       
User clicks Generate → useIconProcessing
                       │
                       ▼
         process_icon [OutputMode::File] → raw bytes → disk
                       │
                       ▼
         useIconInstall (atomic rename) → REAPER dirs
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src-tauri/src/image_processor.rs` | Modify | OutputMode enum, bulk ops, scales const, remove EmptyError |
| `src-tauri/src/installer.rs` | Modify | HashSet dedup, atomic rollback, import scales const |
| `src-tauri/src/lib.rs` | Modify | Reference scales const, use OutputMode::File |
| `src/hooks/useReaperPath.ts` | Create | Detect + list + select reaper dir hook |
| `src/hooks/useIconPreview.ts` | Create | Debounced preview with cancel + error state |
| `src/hooks/useIconProcessing.ts` | Create | processIcon + results/error/loading state |
| `src/hooks/useIconInstall.ts` | Create | install + list refresh logic |
| `src/ErrorBoundary.tsx` | Create | Class component with retry |
| `src/App.tsx` | Modify | Compose hooks, reduced to orchestration + JSX |
| `src/ImageCropper.tsx` | Modify | Keyboard nudge handlers, ARIA attributes |
| `src/StatePreview.tsx` | Modify | Inline styles → CSS classes, error display |
| `src/InstallPanel.tsx` | Modify | Inline styles → CSS classes |
| `src/App.css` | Modify | Add new classes, remove dead dl/dt/dd rules |
| `src/main.tsx` | Modify | Wrap in `<ErrorBoundary>` |

## Interfaces / Contracts

```rust
// New output mode enum in image_processor.rs
pub enum OutputMode {
    Preview,  // base64 in preview_base64 field
    File,     // raw bytes — preview_base64 remains None
}

// generate_icon_set signature change:
// Before: fn generate_icon_set(..., scales: &[u32]) -> Result<Vec<ProcessingOutput>, ProcessingError>
// After:  fn generate_icon_set(..., scales: &[u32], mode: OutputMode) -> Result<Vec<ProcessingOutput>, ProcessingError>

// Scale constants added to image_processor.rs:
pub const REAPER_SCALES: &[u32] = &[30, 45, 60];
pub const REAPER_SCALE_DIRS: &[&str] = &["", "150", "200"];
```

```typescript
// New hook signatures:
function useReaperPath(): { reaperPath, installedIcons, handleSelectReaperDir, loading }
function useIconPreview(file, crop, padding, isToggle): { previewResults, previewError, loading }
function useIconProcessing(): { processResults, processing, error, process }
function useIconInstall(reaperPath): { install, installing }
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (Rust) | Raw mode output, bulk ops pixel match, scale const dedup | Extend existing tests in each module — decode raw mode output, compare pixels before/after |
| Build | Compilation, TypeScript | `cargo test`, `tsc -b`, `npm run build` |
| Manual | End-to-end crop→preview→install flow | Visual check on app launch |

Existing tests already cover scale dimensions, alpha preservation, and HSB math. Key risk is pixel-identical output after bulk op replacement — mitigate by running existing tests which verify pixel values.

## Migration / Rollout

No migration required. All changes are code-only. Feature flag not needed — each issue is independently revertible.

## Open Questions

None. All 12 issues have clear, bounded implementation paths with existing test coverage to validate correctness.
