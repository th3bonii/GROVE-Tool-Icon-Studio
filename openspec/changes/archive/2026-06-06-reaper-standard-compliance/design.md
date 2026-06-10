# Design: REAPER Standard Compliance

## Technical Approach

Replace additive RGB brightness with HSB delta math (pure Rust, no new crates), add padding inset logic, multi-scale generation loop (100%/150%/200%), and optional toggle ON/OFF output. Pipeline order: crop → center-crop square → scale to `(size - 2×padding)` → paste centered → HSB per state → assemble strip → rounded corners → encode.

## Architecture Decisions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `HsbAdjustment` as struct vs raw floats | Struct enforces named fields, self-documenting | **Struct** — 3 fields: `hue_shift`, `sat_delta`, `bri_delta` (all `f32`) |
| `IconConfig` adjustment layout | 6 separate fields vs 2×3 arrays | **2 arrays of 3** — `off_adjustments: [HsbAdjustment; 3]` + `on_adjustments: [HsbAdjustment; 3]` — mirrors REAPER structure (OFF/ON × Normal/Hover/Active) |
| HSB math crate vs native | `palette` crate vs 40 lines of math | **Native** — standard RGB↔HSB is trivial, avoids dependency audit |
| Padding implementation | Resize canvas vs crop + paste | **Scale icon to `(size - 2p)` then paste centered on transparent `size×size` canvas** — preserves aspect ratio |
| `generate_icon_set` return | `Vec<ProcessingOutput>` vs single output | **`Vec<ProcessingOutput>`** — one per scale; frontend iterates for display |
| Toggle file output | 6-state strip vs split 3-state files | **Non-toggle**: `{name}.png` (6-state, width 6×size). **Toggle**: `{name}.png` + `{name}_on.png` (each 6-state). Open question: REAPER may expect 3-state per file — verify against actual REAPER behavior. |

## Data Flow

```
Browser                     Rust                          Filesystem
──────                      ────                          ──────────
crop, padding ──→ IPC ──→  crop + center-square          
HSB adjustments            scale to (size-2p) ──┐         
toggle flag                paste centered ──────┤         
                            ┌───────────────────┘         
                            ↓                             
                            for each scale (30/45/60):    
                              6-state HSB loop ──→ base64 ──→ preview
                                                    or           
                              install_icon_set ──→ toolbar_icons/
                                                    toolbar_icons/150/
                                                    toolbar_icons/200/
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src-tauri/src/image_processor.rs` | Modify | Replace `adjust_brightness` with HSB math, add `HsbAdjustment`, new `IconConfig`, padding, multi-scale, toggle |
| `src-tauri/src/lib.rs` | Modify | New IPC params (padding, toggle, scale), preview returns base64 for all 6 states |
| `src-tauri/src/installer.rs` | Modify | `install_icon_set()` copies to 3 scale directories |
| `src/api.ts` | Modify | New types, `processIcon()`/`previewIcon()` signatures, `installIconSet()` |
| `src/App.tsx` | Modify | Padding slider, toggle checkbox, multi-scale output display |
| `src/StatePreview.tsx` | Modify | 6-state layout with ON/OFF labels per row |
| `src/InstallPanel.tsx` | Modify | Multi-scale path display + file count summary |

## Interfaces

```rust
// NEW — replaces brightness fields
#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize)]
pub struct HsbAdjustment {
    pub hue_shift: f32,  // degrees, locked at 0
    pub sat_delta: f32,  // additive percentage points
    pub bri_delta: f32,  // additive percentage points
}

// MODIFIED — replaces hover_brightness/click_brightness
pub struct IconConfig {
    pub off_adjustments: [HsbAdjustment; 3],  // [Normal, Hover, Active]
    pub on_adjustments: [HsbAdjustment; 3],
    pub padding: u8,                            // 0–4, default 2
    pub is_toggle: bool,
}

// NEW — pure functions
fn rgb_to_hsb(r: u8, g: u8, b: u8) -> (f32, f32, f32);
fn hsb_to_rgb(h: f32, s: f32, b: f32) -> (u8, u8, u8);
fn apply_hsb(img: &RgbaImage, adj: &HsbAdjustment) -> RgbaImage;
fn apply_padding(img: &RgbaImage, canvas_size: u32, padding: u8) -> RgbaImage;

// NEW — replaces generate_three_state
pub fn generate_icon_set(
    input: &Path,
    config: &IconConfig,
    crop: Option<&CropArea>,
) -> Result<Vec<ProcessingOutput>, ProcessingError>;
```

```typescript
// NEW in api.ts
interface HsbAdjustment {
  hue_shift: number;
  sat_delta: number;
  bri_delta: number;
}

interface IconConfig {
  padding: number;
  is_toggle: boolean;
  // adjustments sent as two arrays of 3
}
```

## HSB Algorithm

```rust
// Standard RGB→HSB: normalize, find max/min, compute delta
fn rgb_to_hsb(r: u8, g: u8, b: u8) -> (f32, f32, f32) {
    let (r, g, b) = (r as f32 / 255.0, g as f32 / 255.0, b as f32 / 255.0);
    let max = r.max(g).max(b);
    let min = r.min(g).min(b);
    let delta = max - min;
    let h = if delta == 0.0 { 0.0 } else {
        if max == r { 60.0 * (((g - b) / delta) % 6.0) }
        else if max == g { 60.0 * (((b - r) / delta) + 2.0) }
        else { 60.0 * (((r - g) / delta) + 4.0) }
    };
    let s = if max == 0.0 { 0.0 } else { delta / max };
    (h, s, max)
}
// HSB→RGB: standard 6-sector inversion, clamps to [0,255]
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `rgb_to_hsb` / `hsb_to_rgb` roundtrip | Known RGBA values → HSB → back → assert identity |
| Unit | `apply_hsb` alpha preservation | Varying alpha across pixels, assert no change |
| Unit | `apply_padding` dimensions | 30px canvas + 2px padding → 26×26 centered |
| Unit | Padding edge case | padding=4 on 30px → 22×22; padding≥15 → 0 (clamped) |
| Unit | `generate_icon_set` 3 scales | assert 3 outputs at 30/45/60 |
| Unit | Toggle vs non-toggle | assert file count differences |
| Integration | IPC commands | Full pipeline via `process_icon` / `preview_icon` |

## Migration / Rollout

No data migration. All changes are backward-incompatible at the API layer — IPC signatures change (padding, toggle, scale params). Frontend must be updated in lockstep with backend. Phase-gated via git: each phase independently revertible.

## Open Questions

- [ ] **6-state vs 3-state output**: Spec says "width = 6 × state_width" but REAPER toolbar convention uses 3-state strips per file. Toggle mode's `_on.png` — is it a separate 3-state strip or another 6-state? Will verify against real REAPER icon files.
- [ ] **HSB delta semantics**: Are sat_delta/bri_delta additive percentage points (e.g., bri_delta: -20 → brightness drops 20pp) or multiplicative? Default: additive. Verify visually in preview.
