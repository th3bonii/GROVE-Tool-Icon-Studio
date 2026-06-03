# Design: initial-setup

## Technical Approach

We will initialize the GROVE Icon Studio using Tauri v2, combining a React + Vite + TypeScript frontend for the UI and a Rust backend for high-performance image processing and filesystem access. The Rust backend will expose IPC commands to detect REAPER installations (including Wine/Proton edge cases) and to process standard images into REAPER's specialized 3-state toolbar format.

## Architecture Decisions

### Decision: Frontend Framework

**Choice**: React with Vite and TypeScript
**Alternatives considered**: Svelte, Vue, or Vanilla JS
**Rationale**: React provides a robust ecosystem for building complex UI layouts (such as drag-and-drop zones and state previews). Vite offers extremely fast HMR, and TypeScript ensures type safety across the frontend and when defining Tauri IPC payloads.

### Decision: Image Processing Engine

**Choice**: `image` crate in Rust
**Alternatives considered**: HTML5 Canvas processing in the frontend, calling out to ImageMagick CLI.
**Rationale**: Processing in Rust via the `image` crate provides precise, native pixel manipulation with full control over the alpha channel and color mapping. It avoids external CLI dependencies and is significantly more robust than relying on browser canvas quirks.

### Decision: REAPER Path Detection Strategy

**Choice**: OS-specific path heuristics with a manual fallback option
**Alternatives considered**: Exhaustive full disk search.
**Rationale**: A full disk search is excessively slow. REAPER's installation and resource paths are highly predictable on native OSes (`AppData/Roaming/REAPER` on Windows, `~/.config/REAPER` on Linux, `~/Library/Application Support/REAPER` on macOS). For Linux Wine/Proton setups, we can check standard default prefix paths (`~/.wine/drive_c/users/$USER/AppData/Roaming/REAPER`). If heuristics fail, the UI will prompt the user to select the path manually.

## Data Flow

    [React Frontend] ── IPC `invoke` ──→ [Rust Backend]
         │                                      │
         │ (1) User drops image                 │ (2) Read image via `image` crate
         │ (5) UI displays success/preview      │ (3) Generate 3-state buffer (W*3 x H)
         │                                      │ (4) Save to detected REAPER path
         └───────────── IPC Return ─────────────┘

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `package.json` / `vite.config.ts` | Create | Scaffold frontend tooling |
| `src/main.tsx`, `src/App.tsx` | Create | Basic application shell UI |
| `src-tauri/Cargo.toml` | Create | Rust backend dependencies (`tauri`, `image`, etc.) |
| `src-tauri/tauri.conf.json` | Create | Tauri configuration and build settings |
| `src-tauri/src/main.rs` | Create | Tauri entry point and command registration |
| `src-tauri/src/path_detector.rs` | Create | Logic for detecting native and Wine/Proton REAPER paths |
| `src-tauri/src/image_processor.rs` | Create | 3-state image processing pipeline |

## Interfaces / Contracts

```rust
// Rust Tauri IPC Commands
#[tauri::command]
pub fn detect_reaper_path() -> Result<String, String>;

#[tauri::command]
pub fn process_icon(input_path: String) -> Result<String, String>;
```

```typescript
// Frontend API wrapper
export async function detectReaperPath(): Promise<string> {
    return await invoke('detect_reaper_path');
}

export async function processIcon(inputPath: string): Promise<string> {
    return await invoke('process_icon', { inputPath });
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Path Detection | Test heuristics by mocking filesystem structures (native and Wine). |
| Unit | Image Processing | Pass test images and assert output dimensions are exactly W*3 x H and alpha is preserved. |
| Integration | Tauri Commands | Use `cargo test` to verify Tauri commands execute successfully with valid inputs. |
| E2E | App Launch | Verify the application shell compiles and opens the main window successfully. |

## Migration / Rollout

No migration required as this is a greenfield initialization.

## Open Questions

- [ ] What specific image adjustments (brightness, contrast, saturation) does REAPER expect for the "Hovered" and "Clicked" states? We may need to tweak these based on visual parity with native icons.
