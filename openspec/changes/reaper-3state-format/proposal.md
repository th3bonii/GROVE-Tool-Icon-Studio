# Proposal: Fix REAPER 3-State Icon Format

## Intent

Our app generates 6-state strips (180×30px at 100%) but REAPER expects 3-state strips (90×30px). Standard format: `<name>.png` = 3 states (Normal/Hover/Active), and for toggle: `<name>_on.png` = 3 ON states. This mismatch produces broken icons in REAPER.

## Scope

### In Scope
- Change `REAPER_STATES` constant from 6 to 3
- Simplify `build_adjustments` to return 3 refs instead of 6
- Update `StatePreview.tsx` multipliers (6→3), strip dimensions, state labels
- Update all Rust test assertions (widths: 180→90, 270→135, 360→180)
- Update frontend test mocks and vitest assertions
- Update spec requirements in `icon-processing-pipeline` and `visual-editor`

### Out of Scope
- Batch processing logic (handles individual files correctly already)
- Installer/export logic (writes files correctly already)
- Data migration (old files overwritten on reinstall)
- Backward compatibility shim (not needed — REAPER only reads 3-state)

## Capabilities

### New Capabilities
None — reducing state count, not introducing new features.

### Modified Capabilities
- `icon-processing-pipeline`: Strip generation changes from 6 states to 3 per file; toggle outputs `<name>_on.png` with 3 ON states; dimension formula changes from `6 × W` to `3 × W`.
- `visual-editor`: Preview renders 3 states per file instead of 6; HSB slider panels change from 6 panels (OFF/ON × 3) to 3 panels per file; strip view width updates accordingly.

## Approach

1. Change `REAPER_STATES = 6` → `3` in Rust constant
2. Update `build_adjustments()` to iterate `[Normal, Hover, Active]` instead of `[OFF_N, OFF_H, OFF_A, ON_N, ON_H, ON_A]`
3. Update `StatePreview.tsx` width calculation: `state_count * state_width` becomes `3 * state_width`
4. Update all test assertions matching pixel widths and state counts
5. Update vitest mocks to return 3-state strips instead of 6

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src-tauri/src/image_processor.rs` | Modified | `REAPER_STATES`, `build_adjustments`, state iteration |
| `src-tauri/src/image_processor.rs` (tests) | Modified | All width assertions (180→90, 270→135, 360→180) |
| `src/StatePreview.tsx` | Modified | Multiplier 6→3, strip dimensions, state labels |
| `src/App.tsx` | Modified | HSB panels count 6→3 per file in toggle mode |
| `src/__tests__/*.test.tsx` | Modified | Mock strips, width expectations |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Toggle split logic breaks (single file vs ON/OFF) | Low | Toggle path already separates OFF/ON — only iteration count changes |
| Existing strips in user's REAPER render wrong | Low | REAPER reads 3-state; old 6-state strips will show only first 3 frames, looking correct for Normal, cropped for Hover/Active |

## Rollback Plan

Revert `REAPER_STATES` to 6 and restore `build_adjustments` iteration. Reset StatePreview multiplier to 6. Revert test assertions. All existing 6-state strips remain valid.

## Dependencies

None.

## Success Criteria

- [ ] Generated `<name>.png` is exactly 3 states wide (90px at 100%)
- [ ] Generated `<name>_on.png` is exactly 3 states wide (90px at 100%)
- [ ] All unit tests pass (`cargo test`)
- [ ] All frontend tests pass (`npx vitest run`)
- [ ] REAPER correctly displays installed icons (all 3 states visible)
