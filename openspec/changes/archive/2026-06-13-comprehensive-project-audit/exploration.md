## Exploration: Comprehensive Project Audit

### Current State

This is a Tauri v2 desktop application (React + TypeScript frontend, Rust backend) for generating REAPER 3-state toolbar icons. The codebase is well-structured overall — 93 Rust tests and 17 TypeScript test files with solid coverage. However, several significant bugs exist, primarily around the HSB adjustment pipeline (sat_delta scaling mismatch), silently swallowed file-write errors, and frontend/backend default inconsistencies.

---

### Findings by Severity

#### CRITICAL (must fix)

1. **`image_processor.rs:354-375` — `apply_hsb` sat_delta not divided by 100**  
   `bri_delta` IS divided by 100.0 (line 367): `(bri + adj.bri_delta / 100.0)`  
   `sat_delta` is NOT divided by 100.0 (line 366): `(sat + adj.sat_delta)`  
   The HsbPanel slider sends values in [-100, 100] (integer percentages) for ALL three fields. Since `sat` is in [0.0, 1.0] and `adj.sat_delta` arrives as e.g. `-50.0`, the result is `new_sat = sat + (-50.0)` which always clamps to 0.0 for any negative value and 1.0 for any positive value. **The saturation slider is effectively a boolean** — any non-zero adjustment saturates or desaturates fully.  
   **Fix**: Change line 366 to `let new_sat = (sat + adj.sat_delta / 100.0).clamp(0.0, 1.0);`

2. **`lib.rs:88-91` — Silent write failure in process_icon**  
   When `std::fs::write` fails (line 89), the error is only logged via `eprintln!`. The function continues to add the output to the `written` vec and returns `Ok(written)`. The user sees "success" with missing files.  
   **Fix**: Return `Err(...)` instead of logging silently. The `ProcessingOutput` entry should not be pushed when the write fails.

3. **`lib.rs:85` — Silently ignored directory creation failure**  
   `let _ = std::fs::create_dir_all(&target_dir);` — if directory creation fails, the write will also fail, but the first failure is invisible and the write error message may be confusing.  
   **Fix**: Propagate the error or combine with the write check.

#### HIGH (should fix)

4. **`validation.ts:65` — Dynamic import on every IPC call**  
   `const result = await (await import('@tauri-apps/api/core')).invoke(cmd, params);` — This does a dynamic `import()` on EVERY `safeInvoke` call. The module is a static dependency in `package.json`; it should be a top-level import. This adds unnecessary overhead and makes error stacks harder to trace.  
   **Fix**: Use `import { invoke } from '@tauri-apps/api/core'` at the top of the file.

5. **`lib.rs:68` — Hardcoded scale subdirs instead of shared constant**  
   `let scale_subdirs = ["", "150", "200"];` duplicates `image_processor::REAPER_SCALE_DIRS` (`&["Data/toolbar_icons", "Data/toolbar_icons/150", "Data/toolbar_icons/200"]`). The values differ — the constant includes the `Data/toolbar_icons` prefix but the hardcoded array doesn't, because the `process_icon` command prepends `output_dir` directly. This is fragile: if the directory structure changes in `REAPER_SCALE_DIRS`, the process_icon command won't follow.  
   **Fix**: Derive from `REAPER_SCALE_DIRS` by stripping the common prefix.

6. **`hooks/useHsbAdjustments.ts:7` — Default active state `bri_delta` mismatch with Rust**  
   TypeScript defaults: `ACTIVE_ADJ = { bri_delta: -15 }`  
   Rust defaults (`IconConfig::default()`): `off_adjustments[2].bri_delta = -40`, `on_adjustments[2].bri_delta = -40`  
   Since the frontend ALWAYS sends adjustments (the HSB hook initializes with values), the Rust backend's `-40` is never used for HSB mode. This means the default click feedback brightness differs between the frontend's HSB pipeline and the Rust backend's legacy `generate_three_state` mode.  
   **Fix**: Align both to the same value. Either set TypeScript to `-40` or Rust to `-15`.

7. **`installer.rs:251-261` — Non-atomic rename rollback**  
   In `install_icon_set_raw` Phase 2, if `std::fs::rename` fails at the Nth file, the cleanup removes the temp file for the failed rename but does NOT roll back the N-1 files that were already renamed to their final paths. The same issue exists in `install_icon_set`.  
   **Fix**: Either track and rollback already-renamed files, or accept this risk with a comment. The risk is low (rename failures are rare on the same filesystem) but should be documented.

8. **`lib.rs:69` — Integer division without validation**  
   `let outputs_per_scale = results.len() / image_processor::REAPER_SCALES.len();`  
   If `results.len()` is not evenly divisible by `REAPER_SCALES.len()` (3), the truncation causes incorrect indexing in the `scale_idx` calculation. While the upstream functions guarantee correct multiples, there is no assertion or defensive check.  
   **Fix**: Add `assert_eq!(results.len() % REAPER_SCALES.len(), 0)` or a runtime check.

#### MEDIUM (fix if touching area)

9. **`api.ts` — Type `IconConfig` is defined but never used**  
   The `IconConfig` interface is exported from `api.ts` but never consumed by any component. The parameters are passed individually throughout the call chain. Dead code.

10. **`ImageCropper.tsx:155` — Uses `scaleX` for Y-coordinate conversion**  
    `const cCropY = Math.round(rawCropY * scaleX);` — works correctly because the canvas aspect ratio matches the image (`ch = Math.round(cw * aspect)`), making `scaleX == scaleY`. But this is fragile: if the canvas sizing changes, the crop Y-coordinate would silently diverge.  
    **Fix**: Use a shared `scale` variable since scaleX == scaleY, or compute both separately.

11. **`StatePreview.tsx:122` — Hardcoded 3-state assumption**  
    `backgroundPosition: \`${-i * scale}px 0\`` assumes exactly 3 states in order Normal(0), Hover(1), Active(2). The Rust code guarantees this, but there's no validation on the frontend.

12. **`package.json` — ESLint config referenced but may not exist**  
    `"lint": "eslint ."` is configured, `openspec/config.yaml` says `eslint.config.js (present)`, but there is no `eslint.config.js` in the project root. The lint command would fail.

13. **`process_icon` empty input handling**  
    If `input_path` points to a non-existent file or a non-PNG file, `image_processor::load_source` returns an error which propagates correctly. Good. But `output_dir` could be a non-writable location and the error is only logged (see #2).

14. **`installer.rs:132-134` — `outputs.len() / scales.len()` division without validation**  
    Same pattern as #8. Non-divisible lengths cause silent index errors.

#### LOW (note for future)

15. **`image_processor.rs:409` — f64 to f32 cast in `icon_corner_radius`**  
    `CORNER_RADIUS_FACTOR as f32` is a lossy narrowing cast. Unlikely to cause issues for 0.15 but worth noting.

16. **`path_detector.rs:253` — Scans ALL Steam compatdata app IDs**  
    `std::fs::read_dir(&compatdata)` iterates every installed Steam game's Proton prefix. On a system with many games, this could be slow. Consider optimizing with common REAPER app ID (610710).

17. **`installer.rs:332` — `get_icon_strip` only checks 100% scale**  
    Only reads from `Data/toolbar_icons/` (100% scale), not from `150/` or `200/`. The function is used for preview, which shows the 100% scale strip. This is probably intentional but should be documented.

18. **`useBatchProcessing.ts:57-60` — Stale closure over `filesRef.current`**  
    The loop iterates `currentFiles` which is captured at invocation time. If files are added/removed during processing (blocked by UI), this is safe. Consider an assertion.

19. **Missing `src/types.ts`** — The audit request lists this file but it doesn't exist. Types are in `validation.ts`.

---

### Architecture Observations

1. **Good separation**: Rust backend handles all image processing and file I/O; TypeScript frontend handles UI, state, and debounced previews. Clean Tauri v2 architecture.

2. **IPC surface is monolithic**: All 10 commands are in `lib.rs` with no grouping. Consider splitting into domain modules (e.g., `process_commands.rs`, `install_commands.rs`).

3. **Dead code**: `ProcessingOutput` has both `output_path` and `preview_base64` as `Option<>` with mutual exclusivity enforced by convention, not the type system. Consider a sum type (`enum ProcessingMode { File(PathBuf), Preview(String) }`).

4. **No validation of crop against image dimensions on the Rust side**: The crop is received from the frontend and applied with clamping, but there's no validation that the crop area is reasonable (e.g., minimum crop size).

5. **Error strings, not error types**: All IPC commands return `Result<_, String>`. This loses structured error information on the frontend.

6. **No explicit CSP**: `"csp": null` in `tauri.conf.json`. This disables content security policy. While the app uses only local IPC and filesystem operations, it's a security hardening opportunity.

---

### Test Gaps

1. **No Rust test for `process_icon` with write failure** — The silent write failure (CRITICAL #2) has no test coverage.

2. **No Rust test for empty/non-writable directories** — `create_dir_all` failure path is untested.

3. **No Rust test for `sat_delta` scaling** — The `apply_hsb` test only uses `sat_delta: -1.0` (fully desaturate) and `sat_delta: 0.0`. No test with intermediate values like `-0.5` or `0.3` to verify the scaling is correct.

4. **No integration test** that runs `process_icon` → reads the output file → verifies correct byte content. All tests verify dimensions but not visual content.

5. **No test for `detect_wsl()` or `detect_proton_prefix()`** — These are inherently environment-dependent but could be exercised with mock filesystem tests.

6. **Frontend: No test for `handleGenerate` error handling in `GenerateSection`** — The catch path generates an error message string but there's no test verifying it renders correctly.

7. **Frontend: `useIconInstall` `handleAutoInstall` has no test for the early-return path when `installEnabled` is false or `iconName` is empty.**

8. **Frontend: No mutation/error testing for `writeFile` call in `handleExportIcon`** — the catch block logs to console but has no error state in the UI.

---

### Recommendation

**Fix immediately (critical):**
1. Fix `sat_delta` scaling in `apply_hsb` (divide by 100.0) — this is a functional bug that makes saturation adjustment unusable.
2. Fix silent write failure in `process_icon` — propagate errors instead of logging.

**Fix before next release (high):**
3. Replace dynamic import in `validation.ts` with static import.
4. Reuse `REAPER_SCALE_DIRS` constant instead of hardcoded array.
5. Align TypeScript/Rust default `bri_delta` for active state.
6. Add rollback documentation/tracking in installer.

**Fix when touching area (medium):**
7. Add validation for integer division in `process_icon` and `install_icon_set`.
8. Remove dead `IconConfig` type or wire it into the parameter pipeline.
9. Check if `eslint.config.js` exists or remove the lint script.

---

### Risks

- **sat_delta bug**: Users adjusting saturation see no meaningful effect until the slider is at extreme values, then it jumps to full desaturation/saturation. This makes the HSB adjustment feature effectively broken for saturation.
- **Silent write failures**: If a disk is full or a path is unwritable, the app reports success while files are missing. Users may deploy broken icon sets.
- **Dynamic import overhead**: On low-end machines, the repeated dynamic import could cause noticeable IPC latency.
- **ESLint config missing**: The build pipeline's `lint` step will fail on fresh clones.

---

### Ready for Proposal

Yes. The audit reveals two critical bugs that should be addressed in a proposal immediately. The existing proposal (if any) should be adjusted to include:

1. **Fix sat_delta scaling bug** in `image_processor.rs:apply_hsb`
2. **Fix silent write failures** in `lib.rs:process_icon`
3. **Static import refactor** in `validation.ts`
4. **REAPER_SCALE_DIRS deduplication** in `lib.rs`
5. **Default value alignment** between TypeScript and Rust
6. **Installer rename rollback documentation**

The remaining medium/low findings can be addressed as part of the apply phase when touching adjacent code.

---

### Files Affected

- `src-tauri/src/image_processor.rs` — sat_delta scaling fix (CRITICAL)
- `src-tauri/src/lib.rs` — silent write errors (CRITICAL), REAPER_SCALE_DIRS dedup (HIGH)
- `src/validation.ts` — dynamic import → static import (HIGH)
- `src/hooks/useHsbAdjustments.ts` — default bri_delta alignment (HIGH)
- `src-tauri/src/installer.rs` — rollback documentation (HIGH)
- `src/api.ts` — dead IconConfig type (MEDIUM)
- `src-tauri/Cargo.toml` — no issues found
- `src-tauri/tauri.conf.json` — CSP hardening opportunity (LOW)
- `package.json` — eslint config check (MEDIUM)
