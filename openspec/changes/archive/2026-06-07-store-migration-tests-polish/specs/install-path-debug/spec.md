# install-path-debug Specification

## Purpose

Debug logging and UI disclosure of the resolved REAPER install path so users and developers can verify where toolbar icons are written. This covers Rust-side `tracing`/`log` emits at key write points and front-end display of install target directories.

## Requirements

### Requirement: Write-Target Debug Logging

The system MUST emit a debug-level log message immediately before performing a file write operation in the installer.

#### Scenario: `install_icon` logs resolved target path

- GIVEN `install_icon` is called with a valid source and `reaper_resource_path`
- WHEN the function resolves `target_path` and before `std::fs::copy` executes
- THEN a debug log MUST be emitted containing the full target path
- AND the log MUST include `"install_icon"` as the component identifier

#### Scenario: `install_icon_set` logs each temp file write

- GIVEN `install_icon_set` is processing outputs at multiple scales
- WHEN each temp file is written to disk (Phase 1)
- THEN a debug log MUST be emitted per file containing the temp path and final target path
- AND the log MUST include the scale index for correlation

#### Scenario: `install_icon_set_raw` logs each temp file write

- GIVEN `install_icon_set_raw` is processing raw byte outputs
- WHEN each temp file is written to disk (Phase 1)
- THEN a debug log MUST be emitted containing the temp path

### Requirement: Path Resolution Debug Logging

The system MUST emit a debug-level log message when the REAPER resource path is detected, showing the resolved path and detection method.

#### Scenario: `detect()` logs detection method and path

- GIVEN `path_detector::detect()` runs
- WHEN a detection method succeeds (Native, Wine, Proton, or WSL)
- THEN a debug log MUST be emitted containing:
  - The detection method name (`Native`/`Wine`/`Proton`/`Wsl`)
  - The resolved `PathBuf`

#### Scenario: Manual fallback logged

- GIVEN `path_detector::detect()` fails all automatic methods
- WHEN returning `DetectionMethod::Manual`
- THEN a debug log MUST be emitted indicating no automatic path was found

### Requirement: Install Targets UI Display

The system SHOULD display the resolved install target paths in the frontend so the user can verify the destination before installing.

#### Scenario: Install panel shows scale directories

- GIVEN a REAPER path has been detected
- WHEN the install panel renders
- THEN it MUST show the full path for each scale directory (100%, 150%, 200%)
- AND each path MUST use the `{reaperPath}/Data/toolbar_icons[/150][/200]` format
- AND the display MUST be read-only (informational)

#### Scenario: No path — install targets hidden

- GIVEN no REAPER path has been detected (`reaperPath.path` is null)
- WHEN the install panel renders
- THEN the scale directory display MUST be hidden
- AND a message "REAPER path not detected" MUST be shown instead

## Key Decisions / Constraints

- All debug logging uses `log::debug!()` or `tracing::debug!()` — no new crate dependencies
- Log component identifier pattern: `"[{function_name}] {message}"`
- Frontend display is informational only — not actionable by the user
- UI is already partially implemented in `InstallPanel.tsx` (shows per-scale paths); this spec formalizes and completes it
- Rust files affected: `src-tauri/src/installer.rs`, `src-tauri/src/path_detector.rs`
- Frontend files affected: `src/InstallPanel.tsx` (already shows paths), `src/App.tsx` (shows top-level path)
