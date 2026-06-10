# Proposal: REAPER Standard Compliance

## Intent

GROVE Icon Studio generates icons that don't match REAPER's real standard: additive RGB brightness instead of HSB deltas, single-scale output, no padding, no toggle ON/OFF variants. Generated icons look visually inconsistent with native REAPER toolbar icons. This change aligns all 4 areas with the REAPER standard.

## Scope

### In Scope
- HSB-based 6-state adjustments replacing RGB brightness
- Configurable padding (0-4px, default: 2px)
- Multi-scale output (100%/150%/200%) to correct REAPER directories
- Toggle ON/OFF generation (`name.png` + `name_on.png`)

### Out of Scope
- Non-REAPER output formats (Cubase, Logic, etc.)
- Batch processing multiple icons at once
- User-defined custom HSB values per state
- Hue rotation per state (all at 0° per REAPER spec)

## Capabilities

### New Capabilities
None — all changes modify existing capabilities.

### Modified Capabilities
- `icon-processing-pipeline`: HSB adjustments, padding, multi-scale, and toggle ON/OFF generation replace current brightness model — requirements for all 4 sub-pipelines change
- `visual-editor`: Padding control, toggle checkbox, multi-scale output display, and ON/OFF variant preview replace current single-scale UI

## Approach

Implementation order (dependency-driven):

1. **HSB Foundation**: Replace `adjust_brightness()` with `rgb_to_hsb()` / `hsb_to_rgb()` (native math, no new crates). Add `HsbAdjustment { hue_shift, sat_delta, bri_delta }`. `IconConfig` stores 6 arrays (OFF/ON × Normal/Hover/Active). Add padding field with inset logic: scale icon to `(size - 2*padding)` and center on transparent canvas.
2. **Toggle ON/OFF**: When `is_toggle=true`, pipeline runs twice per scale — OFF with `off_adjustments`, ON with `on_adjustments`. File naming: `{name}.png` / `{name}_on.png`.
3. **Multi-scale**: New `generate_icon_set()` loops over 100%/150%/200%, creates `toolbar_icons/`, `toolbar_icons/150/`, `toolbar_icons/200/`. Returns `Vec<ProcessingOutput>`.
4. **UI**: Padding slider, toggle checkbox in App.tsx. StatePreview shows ON variant. InstallPanel shows multi-scale paths. Remove state-size radio button (always all 3).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src-tauri/src/image_processor.rs` | Modified | Core pipeline: HSB engine, padding, multi-scale, toggle |
| `src-tauri/src/lib.rs` | Modified | New IPC params and return types |
| `src-tauri/src/installer.rs` | Modified | Multi-scale directory copy |
| `src/api.ts` | Modified | New types, commands, result shapes |
| `src/App.tsx` | Modified | Padding slider, toggle, multi-scale output |
| `src/StatePreview.tsx` | Modified | ON/OFF variant labels |
| `src/InstallPanel.tsx` | Modified | Multi-scale target paths |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| HSB delta semantics ambiguous (additive % vs absolute) | Medium | Additive percentage points; verify visually in preview |
| Multi-scale breaks install flow | Medium | Test end-to-end with real REAPER path |
| 6-file output complex for frontend UX | Medium | Show file count summary, not all paths |
| Existing brightness tests break | Certain | Rewrite tests for HSB pipeline |

## Rollback Plan

Phase-gated: each phase independently revertible via `git revert`. If multi-scale fails, revert to single-scale while keeping HSB + padding + toggle. If HSB output is wrong, revert `image_processor.rs` to brightness model.

## Dependencies

- No new Rust crates (HSB math is native)
- `image` crate v0.24 already present

## Success Criteria

- [ ] 6-state HSB adjustments produce correct visual output matching REAPER reference
- [ ] Padding inset works at 0, 2, 4px without visual artifacts
- [ ] `generate_icon_set()` creates files in all 3 scale directories
- [ ] Toggle mode generates both `name.png` and `name_on.png`
- [ ] `cargo test` passes (tests rewritten for HSB)
- [ ] Frontend renders multi-scale output without layout breakage
