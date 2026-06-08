# Design: Fix REAPER 3-State Icon Format

## Technical Approach

Reduce `REAPER_STATES` from 6 to 3 in the Rust constant, which cascades through `process_padded_to_bytes` (signature from `[&HsbAdjustment; 6]` → `[&HsbAdjustment; 3]`), `build_adjustments` (simplifies — no more toggle branching), and all output width calculations. The frontend `StatePreview.tsx` multipliers adjust in lockstep. The IPC contract (`api.ts`) and HSB panel layout (`App.tsx`) already use 3-element arrays — no changes there.

## Architecture Decisions

### Decision: Single constant drives pipeline width

**Choice**: Change only `REAPER_STATES` and let `output_width = sw * REAPER_STATES` cascade
**Alternatives**: Inline the 3 in each function
**Rationale**: The constant exists specifically for this purpose; changing it updates all dimension math automatically (`process_padded_to_bytes`, `apply_rounded_rect_mask` state iteration, `ProcessingOutputRaw`/`ProcessingOutput` doc comments). Only the `build_adjustments` return type and test assertions need independent changes.

### Decision: Eliminate toggle branching in `build_adjustments`

**Choice**: Return `[&HsbAdjustment; 3]` — always the 3 adjustments for the requested variant (OFF or ON)
**Alternatives**: Keep the 6-element array and let the outer loop handle it
**Rationale**: The outer loop in `generate_icon_set` / `generate_icon_set_raw` already iterates variants `&[(false, ""), (true, "_on")]` for toggle mode. With 3-state, each `process_padded_to_bytes` call processes exactly one variant's 3 states. No more repurposing — the toggle/non-toggle distinction moves entirely to the outer variant loop.

### Decision: Non-toggle output becomes 3-state (not 6-state)

**Choice**: Non-toggle outputs a single 3-state strip from OFF adjustments
**Alternatives**: Keep non-toggle as 6-state (OFF + ON combined)
**Rationale**: REAPER expects 3 states per file. A non-toggle icon means there's no ON variant — combining OFF+ON into a single strip would show ON states that are unreachable. The correct output is `<name>.png` with 3 states (Normal/Hover/Active).

## Data Flow

```
                 build_adjustments(config, use_on)
                         │
              [&HsbAdj; 3] — always 3 refs
                         │
              process_padded_to_bytes()
                         │
              output_width = sw * 3
                         │
              ┌────── variant loop ──────┐
              │ (false,"")  (true,"_on") │
              └───────────┬──────────────┘
                         │
              generate_icon_set / _raw
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src-tauri/src/image_processor.rs` | Modify | `REAPER_STATES: 6→3`; `build_adjustments` return type `[&HsbAdj; 6]→[&HsbAdj; 3]`; `process_padded_to_bytes` param type; all "6-state" comments → "3-state" |
| `src/StatePreview.tsx` | Modify | `getStripScale`: `*6→*3`; `renderStateView` backgroundSize `*6→*3`; `renderStripView` stripWidth `*6→*3` |
| `src/__tests__/StatePreview.test.tsx` | Modify | `makePreviewOutput` width: `height * 6 → height * 3` |
| `src-tauri/src/image_processor.rs` (tests) | Modify | All width assertions: 180→90, 270→135, 360→180; state-count assertions: 6→3; `state_ordering_follows_reaper_convention` reworked for 3-state |
| `src/__tests__/App-HSB.test.tsx` | Modify | Slider count comment: "9" → "9" (unchanged — OFF already 3 panels) |

## Interfaces / Contracts

No type changes. `HsbAdjustment` tuple `[HsbAdjustment; 3]` already used by both Rust and TypeScript. `ProcessingOutput.width` semantics unchanged (always `state_width * REAPER_STATES`).

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `process_padded_to_bytes` output width | Constant-driven — update assertions: `180→90`, `270→135`, `360→180` |
| Unit | `build_adjustments` returns exactly 3 refs | Existing tests check dimensions; no new test needed |
| Unit | Non-toggle produces 3-state output | Update `state_ordering_follows_reaper_convention` — non-toggle: 3 OFF states only |
| Unit | Toggle produces two 3-state strips | `toggle_each_variant_is_6_state` → `toggle_each_variant_is_3_state`; width assertions |
| Integration | `generate_icon_set_raw` dimensions | `expected` tuples: `(30,180)→(30,90)`, `(45,270)→(45,135)`, `(60,360)→(60,180)` |
| Frontend | StatePreview strip width | `makePreviewOutput` width: `height*6→height*3`; dimensions text already correct |
| Frontend | HSB panel labels | Already correct — "OFF Normal/Hover/Active" + ON variant |

## Migration / Rollout

No migration required. Old 6-state strips will show only the first 3 frames (Normal/Hover) when dropped into REAPER — the Active state will be missing, which is acceptable since it was always supposed to be a 3-state icon. New strips overwrite on reinstall.

## Open Questions

None.
