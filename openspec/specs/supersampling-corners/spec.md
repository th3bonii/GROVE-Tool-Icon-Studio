# supersampling-corners Specification

## Purpose

Optional 2× supersampling pass in the image processing pipeline to reduce visible corner aliasing (banding) at small icon scales. Applied only if visible banding remains after the existing floor-based corner radius formula (`((s*0.15)+0.5).floor().max(2.0)`).

## Requirements

### Requirement: Supersampling Conditional Activation

The system SHOULD apply a 2× supersampling pass before the corner rounding step when visible banding remains at small scales. This is a SHOULD, not a MUST — skipped if the current corner radius formula produces visually acceptable results.

#### Scenario: Supersampling disabled by default

- GIVEN the pipeline processes an icon at any scale
- WHEN no supersampling flag is passed
- THEN the output MUST be identical to the current pipeline output (no behavioral change)

#### Scenario: Supersampling enabled via config flag

- GIVEN `IconConfig` has `supersample: true`
- WHEN the pipeline processes an icon at small scales (≤ 30px)
- THEN the output MUST have visibly smoother corner transitions
- AND the output dimensions MUST remain at the target scale (not 2×)

### Requirement: 2× Render → Lanczos3 Downscale

When supersampling is active, the system MUST render at 2× the target scale, apply the existing pipeline steps (HSB, padding, corner rounding), then downscale to the target size using Lanczos3.

#### Scenario: Process flow with supersampling

- GIVEN a 30px target scale and `supersample: true`
- WHEN the pipeline runs
- THEN processing MUST happen at 60px (2×)
- AND the final output MUST be downscaled to 30px via `image::imageops::FilterType::Lanczos3`
- AND the corner radius at 60px MUST use the standard formula: `((60*0.15)+0.5).floor().max(2.0)`

### Requirement: Existing Golden Test Compatibility

If supersampling is enabled, the existing `corner_radius_30px_uses_round_half_up` test MUST still pass with updated expected alpha values.

#### Scenario: Golden test updated for supersampled output

- GIVEN supersampling is enabled
- WHEN the `corner_radius_30px_uses_round_half_up` test runs
- THEN pixel (1,1) alpha MUST be recomputed
- AND the assertion threshold MUST be updated to reflect smoother edge transitions

#### Scenario: Test unaffected when supersampling off

- GIVEN supersampling is disabled (default)
- WHEN the `corner_radius_30px_uses_round_half_up` test runs
- THEN the existing alpha assertion (alpha < 200) MUST continue to pass unchanged

### Requirement: Performance Impact

Supersampling MUST NOT perceptibly increase processing latency for single icons. The 2× intermediate buffer for a 30px icon is 60×60px — a negligible area.

#### Scenario: Single icon latency acceptable

- GIVEN a 32×32 source image with `supersample: true`
- WHEN the pipeline processes it
- THEN total processing time MUST be under 50ms on a modern CPU (measured, not asserted in CI)

## Key Decisions / Constraints

- Supersampling is OPTIONAL (SHOULD) — implemented only if banding remains after the corner radius fix
- The 2× rendering means corner radius is computed against the doubled scale, then downscaled — this gives naturally smoother AA
- Lanczos3 is already the project's resize filter (used in `resize_exact`), so no new dependency
- Implementation files: `src-tauri/src/image_processor.rs` (~50 lines)
- Existing test `corner_radius_30px_uses_round_half_up` needs updated expected values if supersampling is enabled
