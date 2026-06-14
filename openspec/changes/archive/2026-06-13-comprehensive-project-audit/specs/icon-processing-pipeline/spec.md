# Delta for icon-processing-pipeline

## MODIFIED Requirements

### Requirement: HSB Transformation (was Pixel Accuracy)

The image processing MUST apply per-state HSB delta adjustments. The `bri_delta` and `sat_delta` values MUST be divided by 100.0 before applying as offsets to the pixel's HSB components. The alpha channel MUST be preserved unchanged.
(Previously: additive RGB brightness adjustments; sat_delta applied as raw offset without ÷100 scaling)

#### Scenario: HSB delta applied per pixel

- GIVEN an input pixel with RGB values
- WHEN computing any state
- THEN the pixel MUST be converted to HSB
- AND `bri_delta / 100.0` MUST be added to the brightness component
- AND `sat_delta / 100.0` MUST be added to the saturation component
- AND the result MUST be converted back to RGB
- AND the alpha channel MUST be preserved unchanged

#### Scenario: Intermediate sat_delta produces linear effect

- GIVEN sat_delta values of -50, -25, 25, and 50
- WHEN `apply_hsb` processes identical pixels
- THEN output saturation MUST scale linearly with input
- AND sat_delta = 50 MUST produce double the shift of sat_delta = 25

#### Scenario: Alpha channel preservation

- GIVEN an input image with transparent pixels
- WHEN processed into the 6-state format
- THEN the transparency MUST be correctly preserved in all six states

### Requirement: IPC HSB Parameters

All 3 IPC commands (process_icon, preview_icon, install_icon_set) MUST accept optional `off_adjustments` and `on_adjustments` parameters, each typed as `[HsbAdjustment; 3]`. When omitted, they MUST default to all-zero adjustments. The 3 adjustments in each array map to Normal/Hover/Active respectively.
(Previously: [OFF_N, OFF_H, OFF_A] and [ON_N, ON_H, ON_A] — semantic unchanged, iteration produces 3 states per call)

All 3 IPC commands MUST build `IconConfig` through a shared `build_icon_config(padding, is_toggle, off_adj, on_adj)` function in `lib.rs`.

The `process_icon` command MUST propagate write failures as `Err` to the caller instead of silently logging and returning `Ok`.
(Previously: process_icon silently logged write errors and returned Ok)

#### Scenario: HSB adjustments mapped to 3 states

- GIVEN the user provides non-zero HSB adjustments for 3 states
- WHEN either IPC command executes with one adjustment set
- THEN the output strip MUST contain exactly 3 states with applied HSB deltas
- AND the alpha channel MUST remain unchanged

#### Scenario: Default HSB preserves existing output

- GIVEN the user calls any IPC command without HSB parameters
- WHEN the command executes
- THEN the output MUST be all-zero adjustments as before

#### Scenario: Shared builder produces identical configs

- GIVEN identical parameters
- WHEN passed through `build_icon_config` vs the old inline construction
- THEN the resulting `IconConfig` MUST have identical field values

#### Scenario: All 3 commands accept all param combinations

- GIVEN the shared builder
- WHEN `process_icon`, `preview_icon`, and `install_icon_set` are called with any combination of optional params (None/Some)
- THEN all existing IPC command tests MUST pass unchanged

#### Scenario: Write failure returns Err

- GIVEN a target directory with insufficient write permissions
- WHEN `process_icon` attempts to write output files
- THEN the command MUST return an `Err` result
- AND no partial output MUST be reported as success
