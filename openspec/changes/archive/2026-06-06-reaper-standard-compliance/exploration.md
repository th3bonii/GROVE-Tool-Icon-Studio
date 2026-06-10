## Exploration: REAPER Standard Compliance

### Current State

GROVE Icon Studio generates 3-state REAPER toolbar icons (Normal/Hover/Active horizontal strip) using a **simple additive brightness model**:

- **`image_processor.rs`**: `adjust_brightness()` adds the same delta to all RGB channels per pixel. `IconConfig` has `hover_brightness: i16` (default +30) and `click_brightness: i16` (default -40). Preserves alpha.
- **Single scale**: User chooses between 30px (standard) or 38px (double-width) radio buttons. One output file.
- **Edge-to-edge**: Icon fills the entire state area with no padding.
- **Single output**: One file named `{input_stem}_3state.png`. No concept of ON/OFF variants.
- **Install**: `installer.rs` copies the single file to `{reaper}/Data/toolbar_icons/{name}.png`.

The current architecture is simple but does NOT match REAPER's real standard (HSB adjustments, multi-scale directories, toggle ON/OFF support).

### Affected Areas

| File | Change | Impact |
|------|--------|--------|
| `src-tauri/src/image_processor.rs` | Core pipeline rewrite | High — new HSB engine, padding, multi-state generation |
| `src-tauri/src/lib.rs` | IPC commands | High — new parameters, new return types, new commands |
| `src-tauri/src/installer.rs` | Install logic | Medium — needs multi-scale directory support |
| `src-tauri/Cargo.toml` | Dependencies | Low — no new crates needed (HSB is manual math) |
| `src/api.ts` | API layer | High — new types, new params, new commands |
| `src/App.tsx` | UI | High — new controls (padding, toggle), multi-scale result display |
| `src/StatePreview.tsx` | Preview component | Medium — update state labels, show ON/OFF variant |
| `src/InstallPanel.tsx` | Install panel | Medium — update target path display for multi-scale |
| `openspec/specs/icon-processing-pipeline/spec.md` | Spec update | Medium — requirements need updating |
| `openspec/specs/visual-editor/spec.md` | Spec update | Medium — UI requirements need updating |

### Approaches

#### Change 1 — HSB Adjustments (instead of brightness)

**Replace `adjust_brightness()` with RGB↔HSB conversion and adjustment per the REAPER standard.**

| State | Hue Shift | Saturation Delta | Brightness Delta |
|-------|-----------|-----------------|------------------|
| OFF Normal | 0° | 0% | -10% |
| OFF Hover | 0° | 0% | +15% |
| OFF Active | 0° | -20% | -25% |
| ON Normal | 0° | +15% | +10% |
| ON Hover | 0° | +15% | +25% |
| ON Active | 0° | 0% | -10% |

- **Approach**: Implement `rgb_to_hsb()` / `hsb_to_rgb()` manually (~40 lines each). The `image` crate v0.24 does not have built-in HSB. No new dependencies needed.
- **Required struct**: `HsbAdjustment { hue_shift: f32, sat_delta: f32, bri_delta: f32 }`
- **`IconConfig` becomes**: `off_adjustments: [HsbAdjustment; 3]` + `on_adjustments: [HsbAdjustment; 3]` (or `Option<[HsbAdjustment; 3]>`)
- **Effort**: Low
- **Risk**: Very low. Math is well-known. Main question: are deltas additive percentage points or relative? Assuming additive based on REAPER convention.

#### Change 2 — Adjustable Padding

**Inset the icon within each state area by a configurable number of pixels.**

- **Approach**: After center-crop to square, scale the image to `(state_size - 2*padding) × (state_size - 2*padding)`. Place it centered on a `state_size × state_size` transparent canvas. Then apply HSB adjustments.
- **Validation**: Clamp padding so `2*padding < state_size`.
- **Effort**: Low
- **Risk**: Very low. Simple centering math.

#### Change 3 — Multi-scale Output

**Generate all 3 REAPER standard scales in one pass instead of one-at-a-time.**

| Scale | Label | State Size | Directory |
|-------|-------|-----------|-----------|
| 100% | — | 30px | `toolbar_icons/` |
| 150% | 150 | 45px | `toolbar_icons/150/` |
| 200% | 200 | 60px | `toolbar_icons/200/` |

- **Approach A (recommended)**: New top-level function `generate_icon_set()` that:
  1. Takes `input_path`, `output_base_dir`, `icon_name`, `config`, `crop`, `padding`, `is_toggle`
  2. Generates all 3 scales in a loop
  3. Creates subdirectory structure
  4. Returns `Vec<ProcessingOutput>` (one per generated file)
  5. `generate_three_state()` becomes internal, called per-scale

- **Approach B**: Keep `generate_three_state()` public, add a wrapper in `lib.rs`. Less clean but less disruptive.

- **Effort**: High (most disruptive change — affects output model, installer, API, and UI)
- **Risk**: Medium-High. Output path model changes fundamentally. The installer needs to handle directories instead of a single file.

#### Change 4 — Toggle ON/OFF Support

**Generate both `iconname.png` (OFF states) and `iconname_on.png` (ON states) for toggleable actions.**

- **Approach**: When `is_toggle=true`, the pipeline runs twice per scale:
  1. OFF: 3-state strip with `off_adjustments`
  2. ON: 3-state strip with `on_adjustments`
- File naming: `{icon_name}.png` (OFF), `{icon_name}_on.png` (ON) per REAPER convention.
- **Effort**: Medium
- **Risk**: Low-Medium. Simple iteration but interacts with multi-scale (potentially 6 files per icon).

### Dependencies Between Changes

```
HSB (Change 1) ───┬──> Toggle (Change 4)
                   │       ^
                   │       │
                   └──> Padding (Change 2) ──┐
                                            │
                                            v
                                     Multi-scale (Change 3)
```

- **#1 → #4**: Toggle needs the ON/OFF HSB config from Change 1
- **#1 → #2**: Padding's pipeline runs after HSB adjustments are defined
- **#2 + #1 → #3**: Multi-scale uses the adjusted pipeline per scale
- **#4 + #3 → output**: Combined, generates 6 files per icon

**Recommended order**: HSB → Padding → Toggle → Multi-scale

### Implementation Strategy

**Phase 1 — HSB Foundation (Change 1 + Change 2 together)**
- Rewrite `image_processor.rs`:
  - Add `HsbAdjustment` struct and `adjust_hsb()` function
  - Update `IconConfig` with 6-state adjustments
  - Add `padding` field to `IconConfig`
  - Update `generate_three_state()` pipeline to use HSB + padding
- Update `lib.rs` commands to pass new config (from frontend or default)
- Update `api.ts` types
- **Caveat**: Remove old `adjust_brightness()` or keep for backward compat? Recommend remove — no other callers.

**Phase 2 — Toggle ON/OFF (Change 4)**
- Add `is_toggle` flag to process_icon command
- When true, generate both OFF and ON strips
- Update return type to include both output paths
- Add toggle checkbox to UI (App.tsx)
- Update StatePreview to show ON variant when applicable

**Phase 3 — Multi-scale (Change 3)**
- Add `generate_icon_set()` to image_processor.rs
- Update `process_icon` command to accept icon_name and generate all scales
- Update installer.rs for multi-scale directory copy
- Remove stateSize UI toggle (always generate all 3)
- Update result display to show all generated files

### Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| HSB delta semantics ambiguous (additive % vs relative) | Wrong visual output | Medium | Use additive percentage points; verify visually in preview |
| Multi-scale breaks install flow | Installer copies wrong dirs | Medium | Test multi-scale install end-to-end with real REAPER path |
| Padding + small state_size (30px) makes icon too small | Usable but tiny icon | Low | Clamp padding to max 4px for 30px size; show visual warning |
| 6-file output model is complex for frontend to display | Poor UX | Medium | Show summary with file count, don't show all 6 paths inline |
| Existing tests test brightness-specific behavior | Tests break | Certain | Update adjust_brightness tests → adjust_hsb tests; update IconConfig tests |
| `process_icon` called externally (unlikely) | API break | Very Low | Internal-only API; we control both sides |

### Ready for Proposal

**Yes** — provided the HSB delta semantics are confirmed (additive percentage points?). Recommend starting with Specification phase covering all 4 changes, then Design, then Phase 1 implementation.
