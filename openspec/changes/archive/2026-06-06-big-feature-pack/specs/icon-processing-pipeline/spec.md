# Delta for icon-processing-pipeline

## ADDED Requirements

### Requirement: IPC HSB Parameters

All 3 IPC commands (process_icon, preview_icon, install_icon_set) MUST accept optional `off_adjustments` and `on_adjustments` parameters, each typed as `[HsbAdjustment; 3]`. When omitted, they MUST default to all-zero adjustments, preserving existing backward-compatible behavior.

#### Scenario: HSB adjustments alter output

- GIVEN the user provides non-zero HSB adjustments for both OFF and ON states
- WHEN any of the 3 IPC commands executes
- THEN the output strip MUST reflect the applied HSB deltas per state
- AND the alpha channel MUST remain unchanged

#### Scenario: Default HSB preserves existing output

- GIVEN the user calls any IPC command without HSB parameters
- WHEN the command executes
- THEN the output MUST be identical to the current code's output (all-zero adjustments)
