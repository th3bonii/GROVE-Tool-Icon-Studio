# Delta for reaper-path-detection

## ADDED Requirements

### Requirement: Bi-directional Path Detection (Added)

The system SHOULD detect REAPER toolbar icon directories at both `Data/toolbar_icons` and `toolbar_icons` paths. When both exist, it SHOULD prefer the `Data/toolbar_icons` variant.

#### Scenario: Detects both path variants

- GIVEN a REAPER resource path with both `Data/toolbar_icons` and `toolbar_icons` present
- WHEN the detection routine runs
- THEN it MUST identify both directories as valid icon paths
- AND it MUST prefer `Data/toolbar_icons` over `toolbar_icons`

#### Scenario: Detects Data/ variant only

- GIVEN only `Data/toolbar_icons` exists
- WHEN the detection routine runs
- THEN it MUST return `Data/toolbar_icons` as the valid path

#### Scenario: Detects legacy variant only

- GIVEN only `toolbar_icons` exists (legacy layout)
- WHEN the detection routine runs
- THEN it MUST return `toolbar_icons` as the valid path
- AND the system MUST still operate correctly with this path
