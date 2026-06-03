# Proposal: initial-setup

## Intent

Initialize the GROVE Icon Studio as a standalone Tauri application. This solves the need for a maintainable and user-friendly interface for creating and managing REAPER toolbar icons, opting for a robust standalone app instead of a constrained native ReaScript integration.

## Scope

### In Scope
- Scaffold the Tauri application structure (Rust backend + frontend framework).
- Implement basic cross-platform path detection logic for REAPER installations.
- Set up core image processing tooling in Rust for REAPER's 3-state toolbar icon formatting.
- Create the fundamental UI layout for icon management.

### Out of Scope
- Full implementation of all image processing effects (focusing on the pipeline first).
- Direct deployment/publishing scripts (to be added in later phases).
- ReaScript synchronization or direct REAPER API interaction.

## Capabilities

### New Capabilities
- `app-shell`: Basic Tauri application shell and UI framework.
- `reaper-path-detection`: Detection of REAPER installation directories, including hybrid Wine/Proton setups on Linux.
- `icon-processing-pipeline`: Rust-based pixel-level image processing for the 3-state toolbar format.

### Modified Capabilities
- None

## Approach

We will build a standalone application using Tauri. The frontend will handle the UI/UX for managing icons, while the Rust backend will handle precise pixel-level image processing and path detection. Path detection will include specific heuristics for Linux to locate REAPER installations running under Wine or Proton. Image processing will strictly adhere to REAPER's 3-state toolbar formatting rules.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src-tauri/` | New | Core Rust backend and configuration |
| `src/` | New | Frontend UI application |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Hybrid Wine/Proton path detection fails | High | Implement fallback manual path selection in the UI. Write robust heuristic tests. |
| Pixel processing doesn't match REAPER requirements | Med | Use test-driven image processing. Compare generated 3-state icons against known working examples. |

## Rollback Plan

If the Tauri architecture proves unviable, we will delete the scaffolding (`rm -rf src-tauri src package.json Cargo.toml`) and reconsider the ReaScript integration approach documented in earlier explorations.

## Dependencies

- Tauri CLI and Rust toolchain
- Node.js (for frontend tooling)
- REAPER (for testing generated icons)

## Success Criteria

- [ ] Tauri application successfully compiles and launches on the host OS.
- [ ] Application correctly identifies the default REAPER resource path (including Wine/Proton edge cases).
- [ ] A test image can be passed through the Rust backend and formatted into a valid 3-state REAPER toolbar icon.
