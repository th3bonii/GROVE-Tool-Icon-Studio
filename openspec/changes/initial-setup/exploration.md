## Exploration: initial-setup

### Current State
Currently, creating 3-state toolbar icons for REAPER (Normal, Hover, Click) is a manual process requiring image editing software or using fragmented web apps that don't cover the end-to-end workflow. The project requirements in `dev docs/Gemini-_11.md` outline "GROVE Icon Studio", a tool designed to fully automate this from image upload, to precise cropping, to auto-installation into the DAW.

### Affected Areas
- **Backend (Rust/Tauri)** — Core engine for image processing (cropping, compositing the 90x30 or 114x38 strips), CLI implementation, and file system routing for auto-installation into REAPER directories.
- **Frontend (TS/HTML/CSS)** — User interface providing a dropzone, interactive canvas for cropping, and real-time preview of the 3 button states.
- **System Integration** — OS-level logic to detect REAPER installations, including native paths and Wine/Proton prefixes on Linux.

### Approaches
1. **Standalone Tauri Application (Recommended)** — Build a desktop app using Tauri (Rust backend, lightweight web frontend).
   - Pros: Complete freedom for UI/UX (critical for a smooth cropping tool), native performance, tiny executable footprint, allows for a robust headless CLI mode, easier to maintain than ReaScripts.
   - Cons: Requires a minimal context switch out of the DAW to create the icons.
   - Effort: Medium

2. **Native REAPER ReaScript (Hybrid)** — Use ReaImGui for the UI within REAPER and a background CLI tool for the image processing.
   - Pros: Fully integrated into the DAW without switching windows.
   - Cons: High development friction (building a smooth image cropper in Lua/ReaImGui is very difficult and limited), dependent on REAPER API quirks, less scalable.
   - Effort: High

### Recommendation
Proceed with **Approach 1 (Standalone Tauri Application)** as defined in the conceptualization document. It provides the best developer experience, optimal UI control for the image cropper, and the necessary system access via Rust to handle auto-installation and image processing efficiently.

### Risks
- Accurately detecting REAPER paths across different OS setups, particularly hybrid/Wine installations on Linux.
- Ensuring the Rust image processing library (`image` crate) handles vector rasterization, alpha channels, and exact pixel alignments flawlessly to meet REAPER's strict toolbar image formatting.
- Balancing the scope: features like "Hardware Isolation" (background removal) could drastically increase complexity if not deferred to a later phase.

### Ready for Proposal
Yes. The vision, target stack (Tauri, Rust, TS), and core modules are clearly outlined and ready for the `sdd-propose` phase.
