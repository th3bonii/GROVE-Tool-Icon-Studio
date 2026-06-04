# Design: Visual Editor & Auto-Install

## Technical Approach

Extend the current file-select-and-generate flow into an interactive visual editor. Frontend gains three new React components (canvas cropper, 3-state preview panel, install controls) that communicate with the existing Rust pipeline via extended IPC. The key architectural shift: preview renders run through the **same Rust pipeline** as final generation (returning base64 instead of writing to disk), guaranteeing pixel-identical output between preview and saved result.

## Architecture Decisions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| **Preview via Canvas JS** (Approach A) | Fast, zero IPC latency, but brightness logic differs from Rust — preview doesn't match final output | ❌ Rejected — accuracy mismatch defeats purpose of preview |
| **Preview via Rust IPC** (Approach B, debounced 300ms) | Pixel-identical to final output; adds 300ms IPC latency per crop move | ✅ Chosen — correctness > speed for a design tool |
| **Canvas cropper via external lib** (e.g. react-easy-crop) | Faster to implement, but heavier bundle, less control over 1:1 constraint | ❌ Rejected — crop logic is trivial (mousedown/mousemove/mouseup + aspect clamp) |
| **Canvas cropper via native `<canvas>`** | Full control, zero deps, ~100 lines | ✅ Chosen — straightforward drag selection with fixed 1:1 ratio |

## Data Flow

```
[File Open Dialog] ──→ [ImageCropper: canvas + drag rect]
                              │ crop: {x, y, w, h}
                              ↓
                    [StatePreview: 3-state IPC]
                              │ invoke('process_icon', {crop, size, preview: true})
                              ↓
                    [Rust pipeline: crop → scale → brighten → encode base64]
                              │ base64 PNG
                              ↓
                    [StatePreview renders <img> x3]
                              │ user clicks "Generate"
                              ↓
                    [App: invoke('process_icon', {crop, size, outputDir})]
                              │ output_path
                              ↓
                    [InstallPanel: invoke('install_icon', ...)] ──→ REAPER toolbar_icons/
```

### Preview debounce logic

```
crop change ──→ clear 300ms timer ──→ set new timer
                  ↓ (if no change for 300ms)
                invoke preview ──→ cache result ──→ render <img>
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/App.tsx` | Modify | Refactor to host ImageCropper, StatePreview, InstallPanel; replace linear flow |
| `src/App.css` | Modify | Add cropper, preview, install panel styles |
| `src/api.ts` | Modify | Add `processIcon` crop/size params, `installIcon`, `listInstalledIcons`, preview mode |
| `src/ImageCropper.tsx` | Create | Canvas with 1:1 drag crop, emits `crop: CropArea \| null` |
| `src/StatePreview.tsx` | Create | Debounced preview IPC, renders 3 `<img>` states with dimensions |
| `src/InstallPanel.tsx` | Create | Name input, install toggle, installed icons `<select>`, generate button |
| `src-tauri/src/lib.rs` | Modify | Add `install_icon`, `list_installed_icons` commands; update `process_icon` signature |
| `src-tauri/src/image_processor.rs` | Modify | Accept `CropArea` + `state_size`; add `preview_mode → base64` output |
| `src-tauri/src/installer.rs` | Create | `install_icon` copy logic, `list_installed_icons` file scan |
| `src-tauri/Cargo.toml` | Modify | Add `base64` crate for preview IPC |
| `src/__tests__/App.test.tsx` | Modify | Update mocks for new API surface |

## Interfaces / Contracts

```typescript
// src/api.ts — extended

export interface CropArea {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ProcessIconOptions {
  inputPath: string;
  outputDir?: string;        // omitted when preview=true
  crop?: CropArea;           // optional — backward compatible
  stateSize: 30 | 38;        // standard or double-width
  preview?: boolean;         // true → returns base64, false → writes file
}

export interface PreviewResult {
  normal: string;   // base64 PNG
  hover: string;
  click: string;
  state_width: number;
  state_height: number;
}

export async function processIcon(
  options: ProcessIconOptions
): Promise<ProcessingResult | PreviewResult>;

export async function installIcon(
  sourcePath: string,
  targetName: string
): Promise<void>;

export async function listInstalledIcons(): Promise<string[]>;
```

```rust
// Rust — new/extended types

#[derive(Serialize, Deserialize)]
pub struct CropArea {
    pub x: u32, pub y: u32, pub w: u32, pub h: u32,
}

#[derive(Serialize, Deserialize)]
pub struct PreviewOutput {
    pub normal: String,    // base64
    pub hover: String,
    pub click: String,
    pub state_width: u32,
    pub state_height: u32,
}

#[tauri::command]
fn process_icon(
    input_path: String,
    output_dir: Option<String>,   // None = preview mode
    crop: Option<CropArea>,
    state_size: u32,              // 30 or 38
) -> Result<Value, String>       // OutputInfo or PreviewOutput
```

## Component Architecture

```
<App>
  ├── <ReaperPathBanner />       (existing, unchanged)
  ├── <ImageCropper />           (new)
  │     props: imagePath: string
  │     emits: onCrop(crop: CropArea | null)
  ├── <StatePreview />           (new)
  │     props: crop, stateSize, imagePath
  │     internal: debounced preview IPC
  └── <InstallPanel />           (new)
        props: outputPath, reaperPath
        emits: onGenerate()
```

## Error Handling

- **Canvas load fails**: show error message, disable preview/generate
- **Preview IPC fails**: show error, keep last valid preview (stale OK)
- **Install fails (no REAPER path)**: disable install toggle, show hint
- **Install fails (write error)**: inline error bubble, keep icon file
- **All Rust errors**: surfaced as `String` via Tauri — render in `<div className="error">`

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (Rust) | `process_icon` with crop coords | cargo test — assert cropped region matches expected pixels |
| Unit (Rust) | `process_icon` with preview mode | cargo test — assert base64 output decodes to correct dimensions |
| Unit (Rust) | `install_icon` happy path | cargo test — temp dir, create file, verify copy |
| Unit (TS) | `ImageCropper` mouse events | vitest + jsdom — simulate mousedown/mousemove/mouseup, assert crop state |
| Unit (TS) | `StatePreview` debounce | vitest — fire crop change, assert IPC called once after 300ms |
| Unit (TS) | `api.ts` serialization | vitest — assert invoke args match expected shape |
| Integration | Full generate cycle | Manual / e2e — select file, crop, generate, verify output |

## Migration / Rollout

No migration required. The `process_icon` changes are backward compatible (crop/state_size optional with defaults). New features are additive — old UI flow can coexist until App.tsx is rewritten. Single-step rollout: the visual editor replaces the old flow atomically.

## Open Questions

- [ ] Does the REAPER resource path need `Data/toolbar_icons` appended automatically, or does the user select the `toolbar_icons` folder directly? Proposal says auto-append — confirm with user.
- [ ] `list_installed_icons` — cache the list or re-scan each time? Re-scan is cheap for a directory read.
- [ ] Overwrite confirmation for `install_icon` — spec says "overwrite with user confirmation?" but no UI for confirmation dialog yet. Start with silent overwrite, add dialog if users complain.
