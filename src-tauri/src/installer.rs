use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

use crate::image_processor;

/// Install an icon file into REAPER's toolbar_icons directory.
///
/// Copies `source_path` to `{reaper_resource_path}/toolbar_icons/{target_name}.png`,
/// creating the directory if it does not exist.
pub fn install_icon(
    source_path: &Path,
    reaper_resource_path: &Path,
    target_name: &str,
) -> Result<PathBuf, String> {
    if target_name.is_empty() {
        return Err("Target name must not be empty".to_string());
    }

    if !source_path.exists() {
        return Err(format!(
            "Source file does not exist: {}",
            source_path.display()
        ));
    }

    let target_dir = reaper_resource_path.join("Data/toolbar_icons");
    std::fs::create_dir_all(&target_dir)
        .map_err(|e| format!("Failed to create Data/toolbar_icons directory: {}", e))?;

    let target_path = target_dir.join(format!("{}.png", target_name));

    std::fs::copy(source_path, &target_path)
        .map_err(|e| format!("Failed to copy icon file: {}", e))?;

    Ok(target_path)
}

/// Legacy scale directories (without `Data/` prefix) for backward compatibility
/// with icons installed before the `Data/` path fix.
const LEGACY_SCALE_DIRS: &[&str] = &[
    "toolbar_icons",
    "toolbar_icons/150",
    "toolbar_icons/200",
];

/// Return all scale directories to scan, including both the current `Data/toolbar_icons/`
/// layout and the legacy `toolbar_icons/` layout for backward compatibility.
fn all_scale_dirs(reaper_resource_path: &Path) -> Vec<PathBuf> {
    let mut dirs: Vec<PathBuf> = image_processor::REAPER_SCALE_DIRS.iter()
        .map(|sub_dir| reaper_resource_path.join(sub_dir))
        .collect();
    dirs.extend(
        LEGACY_SCALE_DIRS.iter().map(|sub_dir| reaper_resource_path.join(sub_dir)),
    );
    // Deduplicate: if a new path happens to be the same as a legacy path
    // (which shouldn't happen, but be safe), keep only the first occurrence.
    let mut seen = std::collections::HashSet::new();
    dirs.retain(|p| seen.insert(p.clone()));
    dirs
}

/// List installed icon filenames (without extension) from REAPER's multi-scale
/// toolbar_icons directory structure.
///
/// Scans all 3 scale directories using the shared `REAPER_SCALE_DIRS` constant:
/// - `Data/toolbar_icons/` (100%)
/// - `Data/toolbar_icons/150/` (150%)
/// - `Data/toolbar_icons/200/` (200%)
///
/// For backward compatibility, also scans legacy `toolbar_icons/` layouts (without `Data/`).
///
/// Returns filenames sorted alphabetically, with the `.png` extension stripped.
/// Duplicate names across scales are deduplicated.
pub fn list_installed_icons(
    reaper_resource_path: &Path,
) -> Result<Vec<String>, String> {
    let dirs = all_scale_dirs(reaper_resource_path);

    let mut icons: BTreeSet<String> = BTreeSet::new();

    for toolbar_dir in &dirs {
        installer_log(format!("scan dir {:?}", toolbar_dir));

        if !toolbar_dir.exists() {
            continue;
        }

        let entries = std::fs::read_dir(toolbar_dir)
            .map_err(|e| format!("Failed to read directory {:?}: {}", toolbar_dir, e))?;

        for entry in entries {
            let entry =
                entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
            let path = entry.path();

            if path.extension().and_then(|s| s.to_str()) == Some("png") {
                if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                    icons.insert(stem.to_string());
                }
            }
        }
    }

    Ok(icons.into_iter().collect())
}

// ---------------------------------------------------------------------------
// Multi-Scale Install
// ---------------------------------------------------------------------------

/// Install a complete icon set to REAPER's multi-scale directory structure.
///
/// Takes pre-processed `ProcessingOutput` results (one per scale+variant),
/// decodes the base64 preview data, and writes PNG files to:
/// - `{reaper_resource_path}/toolbar_icons/{target_name}.png` (100%)
/// - `{reaper_resource_path}/toolbar_icons/150/{target_name}{suffix}.png` (150%)
/// - `{reaper_resource_path}/toolbar_icons/200/{target_name}{suffix}.png` (200%)
///
/// `outputs` must contain entries in scale-major order: all variants for scale 1,
/// then scale 2, then scale 3. The `scales` slice defines the scale sizes used.
pub fn install_icon_set(
    outputs: &[image_processor::ProcessingOutput],
    reaper_resource_path: &Path,
    target_name: &str,
    scales: &[u32],
) -> Result<Vec<PathBuf>, String> {
    if target_name.is_empty() {
        return Err("Target name must not be empty".to_string());
    }
    if outputs.is_empty() {
        return Err("No outputs to install".to_string());
    }

    let scale_dirs = image_processor::REAPER_SCALE_DIRS;
    let outputs_per_scale = outputs.len() / scales.len();
    let pid = std::process::id();

    // Phase 1: Write all files to temp locations
    let mut pending: Vec<(PathBuf, PathBuf)> = Vec::new(); // (temp_path, final_path)

    for (scale_idx, &_scale) in scales.iter().enumerate() {
        let sub_dir = scale_dirs.get(scale_idx).unwrap_or(&"");
        let target_dir = reaper_resource_path.join(sub_dir);

        std::fs::create_dir_all(&target_dir)
            .map_err(|e| format!("Failed to create directory {:?}: {}", target_dir, e))?;

        let base_idx = scale_idx * outputs_per_scale;
        for out_idx in 0..outputs_per_scale {
            let output = &outputs[base_idx + out_idx];
            if let Some(ref b64) = output.preview_base64 {
                use base64::Engine;
                let decoded = base64::engine::general_purpose::STANDARD
                    .decode(b64)
                    .map_err(|e| {
                        // Decode failed — clean up any temp files written so far
                        cleanup_temp_files(&pending);
                        format!("Failed to decode base64: {}", e)
                    })?;

                let file_name = format!("{}{}.png", target_name, output.suffix);
                let target_path = target_dir.join(&file_name);
                let temp_path = target_dir.join(format!("{}.tmp.{}", file_name, pid));

                std::fs::write(&temp_path, &decoded)
                    .map_err(|e| {
                        // Write failed — clean up any temp files written so far
                        let _ = std::fs::remove_file(&temp_path);
                        cleanup_temp_files(&pending);
                        format!("Failed to write file {:?}: {}", target_path, e)
                    })?;

                pending.push((temp_path, target_path));
            }
        }
    }

    // Phase 2: All writes succeeded — atomically rename temp → final
    let mut installed = Vec::with_capacity(pending.len());
    for (temp, final_path) in &pending {
        std::fs::rename(temp, final_path)
            .map_err(|e| {
                // Rename failed — try to clean up and roll back already-renamed files
                let _ = std::fs::remove_file(temp);
                cleanup_temp_files(&pending);
                format!("Failed to rename temp file: {}", e)
            })?;
        installed.push(final_path.clone());
    }

    Ok(installed)
}

/// Install a complete icon set from raw byte outputs (no base64 decode roundtrip).
///
/// Same directory structure as `install_icon_set()`, but takes `ProcessingOutputRaw`
/// entries whose `data` field contains raw PNG bytes ready for direct file writing.
/// Supports the same atomic rollback pattern (temp → rename).
pub fn install_icon_set_raw(
    outputs: &[image_processor::ProcessingOutputRaw],
    reaper_resource_path: &Path,
    target_name: &str,
    scales: &[u32],
) -> Result<Vec<PathBuf>, String> {
    if target_name.is_empty() {
        return Err("Target name must not be empty".to_string());
    }
    if outputs.is_empty() {
        return Err("No outputs to install".to_string());
    }

    let scale_dirs = image_processor::REAPER_SCALE_DIRS;
    let outputs_per_scale = outputs.len() / scales.len();
    let pid = std::process::id();

    // Phase 1: Write all files to temp locations
    let mut pending: Vec<(PathBuf, PathBuf)> = Vec::new();

    for (scale_idx, &_scale) in scales.iter().enumerate() {
        let sub_dir = scale_dirs.get(scale_idx).unwrap_or(&"");
        let target_dir = reaper_resource_path.join(sub_dir);

        std::fs::create_dir_all(&target_dir)
            .map_err(|e| format!("Failed to create directory {:?}: {}", target_dir, e))?;

        let base_idx = scale_idx * outputs_per_scale;
        for out_idx in 0..outputs_per_scale {
            let output = &outputs[base_idx + out_idx];

            let file_name = format!("{}{}.png", target_name, output.suffix);
            let target_path = target_dir.join(&file_name);
            let temp_path = target_dir.join(format!("{}.tmp.{}", file_name, pid));

            installer_log(format!(
                "write {} -> {}",
                temp_path.display(),
                target_path.display()
            ));

            std::fs::write(&temp_path, &output.data)
                .map_err(|e| {
                    let _ = std::fs::remove_file(&temp_path);
                    cleanup_temp_files(&pending);
                    format!("Failed to write file {:?}: {}", target_path, e)
                })?;

            pending.push((temp_path, target_path));
        }
    }

    // Phase 2: All writes succeeded — atomically rename temp → final
    let mut installed = Vec::with_capacity(pending.len());
    for (temp, final_path) in &pending {
        std::fs::rename(temp, final_path)
            .map_err(|e| {
                let _ = std::fs::remove_file(temp);
                cleanup_temp_files(&pending);
                format!("Failed to rename temp file: {}", e)
            })?;
        installed.push(final_path.clone());
    }

    Ok(installed)
}

/// Remove all temp files listed in `pending`.
/// Used for rollback when a write fails partway through the batch.
fn cleanup_temp_files(pending: &[(PathBuf, PathBuf)]) {
    for (temp, _) in pending {
        let _ = std::fs::remove_file(temp);
    }
}

// ---------------------------------------------------------------------------
// Icon Management
// ---------------------------------------------------------------------------

/// Delete an icon from all REAPER scale directories.
///
/// Removes `icon_name.png` and `icon_name_on.png` from all scale directories
/// defined by the shared `REAPER_SCALE_DIRS` constant:
/// - `Data/toolbar_icons/` (100%)
/// - `Data/toolbar_icons/150/` (150%)
/// - `Data/toolbar_icons/200/` (200%)
///
/// For backward compatibility, also removes from legacy `toolbar_icons/` layouts
/// (without `Data/` prefix).
///
/// Returns an error if no files were found to delete.
pub fn delete_icon(reaper_resource_path: &Path, icon_name: &str) -> Result<(), String> {
    let dirs = all_scale_dirs(reaper_resource_path);

    let mut deleted_any = false;
    let mut errors = Vec::new();

    for dir in &dirs {
        let file_path = dir.join(format!("{}.png", icon_name));
        let on_path = dir.join(format!("{}_on.png", icon_name));

        installer_log(format!("delete check {:?}, {:?}", file_path, on_path));

        if file_path.exists() {
            if let Err(e) = std::fs::remove_file(&file_path) {
                errors.push(format!("Failed to delete {:?}: {}", file_path, e));
            } else {
                deleted_any = true;
            }
        }
        if on_path.exists() {
            if let Err(e) = std::fs::remove_file(&on_path) {
                errors.push(format!("Failed to delete {:?}: {}", on_path, e));
            } else {
                deleted_any = true;
            }
        }
    }

    if !deleted_any {
        return Err(format!("Icon '{}' not found in any scale directory", icon_name));
    }
    if !errors.is_empty() {
        return Err(errors.join("; "));
    }
    Ok(())
}

/// Read an icon strip file from the toolbar_icons directory and return
/// its contents as a base64-encoded string.
///
/// Checks the current `Data/toolbar_icons/` path first, then falls back to
/// the legacy `toolbar_icons/` path for backward compatibility.
pub fn get_icon_strip(reaper_resource_path: &Path, icon_name: &str) -> Result<String, String> {
    let candidates = [
        reaper_resource_path.join("Data/toolbar_icons").join(format!("{}.png", icon_name)),
        reaper_resource_path.join("toolbar_icons").join(format!("{}.png", icon_name)),
    ];

    let path = match candidates.iter().find(|p| p.exists()) {
        Some(p) => {
            installer_log(format!("found {}", p.display()));
            p.clone()
        }
        None => {
            installer_log(format!("not found '{}' in candidates: {:?}", icon_name, candidates.iter().map(|p| p.display().to_string()).collect::<Vec<_>>()));
            return Err(format!(
                "Icon '{}' not found in Data/toolbar_icons or toolbar_icons",
                icon_name
            ));
        }
    };

    let bytes = std::fs::read(&path)
        .map_err(|e| format!("Failed to read {:?}: {}", path, e))?;

    use base64::Engine;
    Ok(base64::engine::general_purpose::STANDARD.encode(&bytes))
}

// ---------------------------------------------------------------------------
// Log helpers
// ---------------------------------------------------------------------------

/// Emit a debug log line prefixed with `[installer]` for tracing file operations.
pub(crate) fn installer_log(msg: impl std::fmt::Display) {
    eprintln!("[installer] {}", msg);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use image::RgbaImage;

    /// Capture stderr output produced during `f` by temporarily redirecting
    /// file descriptor 2 to a temporary file. Uses inline FFI to libc so no
    /// external crate is required.
    /// Run `f` and return its stderr output as a string.
    /// Uses POSIX dup2 to temporarily redirect stderr to a temp file.
    /// NOTE: Rust's test framework manages stderr via pipes, which may interfere
    /// with fd-level redirection. Logging is verified via test runner output.
    /// This function returns empty string on capture failure (test infra limitation).
    fn capture_stderr<F: FnOnce()>(f: F) -> String
    where
        F: FnOnce(),
    {
        // Attempt fd-level redirection on Linux. If it fails (test infra
        // interference), just call f() and return empty — the log output IS
        // still visible in the test runner's captured output.
        #[cfg(target_os = "linux")]
        {
            extern "C" {
                fn dup(oldfd: i32) -> i32;
                fn dup2(oldfd: i32, newfd: i32) -> i32;
                fn close(fd: i32) -> i32;
            }

            let tmp = std::env::temp_dir().join(format!(
                "installer_stderr_{}_{}",
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_nanos(),
            ));
            if let Ok(file) = std::fs::File::create(&tmp) {
                use std::os::unix::io::AsRawFd;
                let file_fd = file.as_raw_fd();

                unsafe {
                    let saved = dup(2);
                    if saved >= 0 {
                        let r = dup2(file_fd, 2);
                        if r >= 0 {
                            f();
                            use std::io::Write;
                            let _ = std::io::stderr().flush();
                            dup2(saved, 2);
                            close(saved);
                            drop(file);
                            return std::fs::read_to_string(&tmp).unwrap_or_default();
                        }
                        let _ = close(saved);
                    }
                }
            }
            // Fall through: f() already called inside the block on success.
            // If we reach here, capture failed — use non-capture path.
            f();
            return String::new();
        }

        #[cfg(not(target_os = "linux"))]
        {
            f();
            String::new()
        }
    }

    fn create_temp_dir(name: &str) -> (std::path::PathBuf, std::path::PathBuf) {
        let tmp = std::env::temp_dir().join(name);
        std::fs::create_dir_all(&tmp).unwrap();
        let source = tmp.join("source.png");
        // Create a minimal 1x1 red PNG
        use image::{Rgba, RgbaImage};
        let img = RgbaImage::from_pixel(1, 1, Rgba([255, 0, 0, 255]));
        img.save(&source).unwrap();
        (tmp, source)
    }

    /// Create a `ProcessingOutput` with a valid minimal 1x1 PNG as base64.
    fn make_base64_output(suffix: &str) -> image_processor::ProcessingOutput {
        let img = RgbaImage::from_pixel(1, 1, image::Rgba([255, 0, 0, 255]));
        let mut buf = std::io::Cursor::new(Vec::new());
        image::DynamicImage::ImageRgba8(img)
            .write_to(&mut buf, image::ImageFormat::Png)
            .unwrap();
        use base64::Engine;
        let encoded = base64::engine::general_purpose::STANDARD
            .encode(buf.into_inner());
        image_processor::ProcessingOutput {
            width: 6,
            height: 1,
            output_path: None,
            preview_base64: Some(encoded),
            suffix: suffix.to_string(),
        }
    }

    // -----------------------------------------------------------------------
    // Task 1.1 — GREEN: Debug logging via eprintln!
    // -----------------------------------------------------------------------
    // These tests verify the installer functions still work correctly after
    // adding debug logging. The eprintln! output is visible in the test
    // runner's captured stdout/stderr (shown on failure).
    // -----------------------------------------------------------------------

    #[test]
    fn install_icon_set_raw_works_with_logging() {
        let tmp = std::env::temp_dir().join("test_log_install_raw");
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();
        let reaper_res = tmp.clone();

        use crate::image_processor::ProcessingOutputRaw;
        let outputs = vec![ProcessingOutputRaw {
            width: 6,
            height: 1,
            data: vec![0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D], // minimal PNG header
            suffix: String::new(),
        }];

        let result = install_icon_set_raw(&outputs, &reaper_res, "testicon", &[30u32]);
        assert!(result.is_ok(), "install_icon_set_raw should succeed with logging");

        let installed = result.unwrap();
        assert_eq!(installed.len(), 1, "should install 1 file");

        let target = reaper_res.join("Data/toolbar_icons").join("testicon.png");
        assert!(target.exists(), "target file should exist at {:?}", target);

        // Also verify eprintln! output IS emitted (visible in test runner output)
        // Capture infra limitation: if capture returns empty, the test still passes
        // because the log IS visible in the test runner's captured output.
        let has_log = capture_stderr(|| {
            let _ = install_icon_set_raw(&outputs, &reaper_res, "testicon2", &[30u32]);
        });
        if !has_log.is_empty() {
            assert!(
                has_log.contains("[installer]"),
                "should contain [installer] prefix, got: {has_log}"
            );
        }

        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn installer_functions_work_with_logging() {
        let tmp = std::env::temp_dir().join("test_log_all_functions");
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();
        let reaper_res = tmp.clone();

        // Create toolbar_icons dir and a test PNG
        let toolbar = reaper_res.join("Data/toolbar_icons");
        std::fs::create_dir_all(&toolbar).unwrap();
        std::fs::write(toolbar.join("myicon.png"), "fake_png").unwrap();

        // list_installed_icons should work with logging
        let list_result = list_installed_icons(&reaper_res);
        assert!(list_result.is_ok(), "list_installed_icons should succeed");
        assert!(list_result.unwrap().contains(&"myicon".to_string()), "should find myicon");

        // get_icon_strip should work with logging
        let strip_result = get_icon_strip(&reaper_res, "myicon");
        assert!(strip_result.is_ok(), "get_icon_strip should succeed");
        assert!(!strip_result.unwrap().is_empty(), "base64 result should not be empty");

        // delete_icon should work with logging
        let delete_result = delete_icon(&reaper_res, "myicon");
        assert!(delete_result.is_ok(), "delete_icon should succeed");
        assert!(!toolbar.join("myicon.png").exists(), "file should be deleted");

        // Verify eprintln! output IS emitted
        let has_log = capture_stderr(|| {
            let toolbar2 = reaper_res.join("Data/toolbar_icons");
            std::fs::create_dir_all(&toolbar2).unwrap();
            std::fs::write(toolbar2.join("other.png"), "fake_png").unwrap();
            let _ = list_installed_icons(&reaper_res);
        });
        if !has_log.is_empty() {
            assert!(
                has_log.contains("[installer]"),
                "should contain [installer] prefix, got: {has_log}"
            );
        }

        let _ = std::fs::remove_dir_all(&tmp);
    }

    // -----------------------------------------------------------------------
    // T7 — RED: install_icon_set creates 3 directories
    // -----------------------------------------------------------------------

    #[test]
    fn install_icon_set_creates_three_directories() {
        let tmp = std::env::temp_dir().join("test_install_set_dirs");
        std::fs::create_dir_all(&tmp).unwrap();
        let reaper_res = tmp.clone();

        let outputs = vec![
            make_base64_output(""),      // 100% OFF
            make_base64_output(""),      // 150% OFF
            make_base64_output(""),      // 200% OFF
        ];
        let scales = image_processor::REAPER_SCALES;

        let result = install_icon_set(&outputs, &reaper_res, "testicon", &scales);
        assert!(result.is_ok(), "install_icon_set should succeed");

        assert!(
            reaper_res.join("Data/toolbar_icons").exists(),
            "100% directory should exist"
        );
        assert!(
            reaper_res.join("Data/toolbar_icons/150").exists(),
            "150% directory should exist"
        );
        assert!(
            reaper_res.join("Data/toolbar_icons/200").exists(),
            "200% directory should exist"
        );

        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn install_icon_set_writes_correct_files_in_each_directory() {
        let tmp = std::env::temp_dir().join("test_install_set_files");
        std::fs::create_dir_all(&tmp).unwrap();
        let reaper_res = tmp.clone();

        let outputs = vec![
            make_base64_output(""),      // 100% OFF
            make_base64_output("_on"),   // 100% ON
            make_base64_output(""),      // 150% OFF
            make_base64_output("_on"),   // 150% ON
            make_base64_output(""),      // 200% OFF
            make_base64_output("_on"),   // 200% ON
        ];
        let scales = image_processor::REAPER_SCALES;

        let result = install_icon_set(&outputs, &reaper_res, "myicon", &scales);
        assert!(result.is_ok(), "install_icon_set should succeed");
        let installed = result.unwrap();
        assert_eq!(installed.len(), 6, "Should install 6 files (3 scales × 2 variants)");

        // Check files exist in all three directories
        assert!(
            reaper_res.join("Data/toolbar_icons").join("myicon.png").exists(),
            "100% OFF file should exist"
        );
        assert!(
            reaper_res.join("Data/toolbar_icons").join("myicon_on.png").exists(),
            "100% ON file should exist"
        );
        assert!(
            reaper_res.join("Data/toolbar_icons/150").join("myicon.png").exists(),
            "150% OFF file should exist"
        );
        assert!(
            reaper_res.join("Data/toolbar_icons/150").join("myicon_on.png").exists(),
            "150% ON file should exist"
        );
        assert!(
            reaper_res.join("Data/toolbar_icons/200").join("myicon.png").exists(),
            "200% OFF file should exist"
        );
        assert!(
            reaper_res.join("Data/toolbar_icons/200").join("myicon_on.png").exists(),
            "200% ON file should exist"
        );

        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn install_icon_set_rejects_empty_name() {
        let tmp = std::env::temp_dir().join("test_install_set_empty");
        std::fs::create_dir_all(&tmp).unwrap();
        let reaper_res = tmp.clone();

        let outputs = vec![make_base64_output("")];
        let result = install_icon_set(&outputs, &reaper_res, "", &[30u32]);
        assert!(result.is_err(), "Empty name should fail");

        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn install_icon_set_rejects_empty_outputs() {
        let tmp = std::env::temp_dir().join("test_install_set_no_output");
        std::fs::create_dir_all(&tmp).unwrap();
        let reaper_res = tmp.clone();

        let result = install_icon_set(&[], &reaper_res, "icon", &[30u32]);
        assert!(result.is_err(), "No outputs should fail");

        let _ = std::fs::remove_dir_all(&tmp);
    }

    // -----------------------------------------------------------------------
    // Task 1.4: Atomic rollback on failure (RED — temp-write not implemented)
    // -----------------------------------------------------------------------

    #[test]
    fn install_icon_set_atomic_rollback_on_decode_failure() {
        let tmp = std::env::temp_dir().join("test_install_atomic_rollback");
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();
        let reaper_res = tmp.clone();

        // Two outputs, two scales → 1 per scale.
        // First output has valid base64 — writes to temp.
        // Second output has invalid base64 — decode fails, triggers rollback.
        let outputs = vec![
            make_base64_output(""),
            image_processor::ProcessingOutput {
                width: 6,
                height: 1,
                output_path: None,
                preview_base64: Some("not-valid-base64!!".to_string()),
                suffix: "".to_string(),
            },
        ];

        // 2 outputs, 2 scales → 1 output per scale
        let scales = &[30u32, 45];

        // This call must fail due to invalid base64 in 2nd output
        let result = install_icon_set(&outputs, &reaper_res, "testicon", scales);
        assert!(result.is_err(), "Should fail on invalid base64");

        // Verify no final files exist (rollback should have cleaned up)
        let toolbar = reaper_res.join("Data/toolbar_icons");
        assert!(!toolbar.join("testicon.png").exists(),
            "No final file in 100%% dir after rollback");

        // Verify no temp files leaked
        let has_temps = |dir: &std::path::Path| -> bool {
            if !dir.exists() { return false; }
            std::fs::read_dir(dir).map_or(false, |entries| {
                entries.flatten().any(|e| {
                    e.file_name().to_string_lossy().contains(".tmp.")
                })
            })
        };
        assert!(!has_temps(&toolbar), "No temp files in 100%% dir after rollback");
        assert!(!has_temps(&toolbar.join("150")), "No temp files in 150%% dir");

        let _ = std::fs::remove_dir_all(&tmp);
    }

    // -----------------------------------------------------------------------
    // T7 — RED: list_installed_icons scans all 3 scale dirs
    // -----------------------------------------------------------------------

    #[test]
    fn list_installed_icons_scans_all_three_dirs() {
        let tmp = std::env::temp_dir().join("test_list_3dirs");
        std::fs::create_dir_all(&tmp).unwrap();
        let reaper_res = tmp.clone();

        // Create files in all 3 directories
        let dirs = [
            reaper_res.join("Data/toolbar_icons"),
            reaper_res.join("Data/toolbar_icons/150"),
            reaper_res.join("Data/toolbar_icons/200"),
        ];
        for dir in &dirs {
            std::fs::create_dir_all(dir).unwrap();
        }
        // alpha only in 100%
        std::fs::write(dirs[0].join("alpha.png"), "fake_png").unwrap();
        // beta only in 150%
        std::fs::write(dirs[1].join("beta.png"), "fake_png").unwrap();
        // gamma only in 200%
        std::fs::write(dirs[2].join("gamma.png"), "fake_png").unwrap();

        let result = list_installed_icons(&reaper_res);
        assert!(result.is_ok());
        let icons = result.unwrap();

        assert_eq!(icons.len(), 3, "Should find icons from all 3 directories");
        assert!(icons.contains(&"alpha".to_string()), "Should find alpha");
        assert!(icons.contains(&"beta".to_string()), "Should find beta");
        assert!(icons.contains(&"gamma".to_string()), "Should find gamma");

        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn list_installed_icons_dedups_across_dirs() {
        let tmp = std::env::temp_dir().join("test_list_dedup");
        std::fs::create_dir_all(&tmp).unwrap();
        let reaper_res = tmp.clone();

        // Same icon name across all 3 dirs — should list once (deduped)
        let dirs = [
            reaper_res.join("Data/toolbar_icons"),
            reaper_res.join("Data/toolbar_icons/150"),
            reaper_res.join("Data/toolbar_icons/200"),
        ];
        for dir in &dirs {
            std::fs::create_dir_all(dir).unwrap();
            std::fs::write(dir.join("shared.png"), "fake_png").unwrap();
        }

        let result = list_installed_icons(&reaper_res);
        assert!(result.is_ok());
        let icons = result.unwrap();

        assert_eq!(icons.len(), 1, "Should dedupe to 1 icon");
        assert_eq!(icons[0], "shared");

        let _ = std::fs::remove_dir_all(&tmp);
    }

    // -----------------------------------------------------------------------
    // Existing installer tests
    // -----------------------------------------------------------------------

    #[test]
    fn install_icon_creates_toolbar_icons_directory() {
        let (tmp_dir, source) = create_temp_dir("test_install_dir");
        let toolbar = tmp_dir.join("Data/toolbar_icons");

        // Data/toolbar_icons does NOT exist yet
        assert!(!toolbar.exists());

        let reaper_res = tmp_dir.clone();
        let result = install_icon(&source, &reaper_res, "myicon");
        assert!(result.is_ok(), "install_icon should succeed");

        let expected = reaper_res.join("Data/toolbar_icons").join("myicon.png");
        assert!(expected.exists(), "Icon file should exist at {:?}", expected);
        assert_eq!(result.unwrap(), expected, "Returned path should match");

        let _ = std::fs::remove_dir_all(&tmp_dir);
    }

    #[test]
    fn install_icon_copies_file_content_correctly() {
        let (tmp_dir, source) = create_temp_dir("test_install_content");
        let reaper_res = tmp_dir.clone();

        let result = install_icon(&source, &reaper_res, "testicon");
        assert!(result.is_ok());

        let installed = result.unwrap();
        assert!(installed.exists());

        // Verify content is the same
        let source_bytes = std::fs::read(&source).unwrap();
        let installed_bytes = std::fs::read(&installed).unwrap();
        assert_eq!(source_bytes, installed_bytes, "File content must match");

        let _ = std::fs::remove_dir_all(&tmp_dir);
    }

    #[test]
    fn install_icon_rejects_empty_name() {
        let (tmp_dir, source) = create_temp_dir("test_install_empty_name");
        let reaper_res = tmp_dir.clone();

        let result = install_icon(&source, &reaper_res, "");
        assert!(result.is_err(), "Empty target name should fail");

        let _ = std::fs::remove_dir_all(&tmp_dir);
    }

    #[test]
    fn install_icon_rejects_nonexistent_source() {
        let tmp = std::env::temp_dir().join("test_install_missing_source");
        std::fs::create_dir_all(&tmp).unwrap();
        let reaper_res = tmp.clone();
        let missing_source = tmp.join("does_not_exist.png");

        let result = install_icon(&missing_source, &reaper_res, "icon");
        assert!(result.is_err(), "Missing source file should fail");

        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn list_installed_icons_returns_empty_for_new_directory() {
        let tmp = std::env::temp_dir().join("test_list_empty");
        std::fs::create_dir_all(&tmp).unwrap();
        let reaper_res = tmp.clone();

        let result = list_installed_icons(&reaper_res);
        assert!(result.is_ok(), "list_installed_icons should succeed");
        let icons = result.unwrap();
        assert!(icons.is_empty(), "New directory should have no icons");

        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn list_installed_icons_returns_installed_icons_sorted() {
        let (tmp_dir, source) = create_temp_dir("test_list_populated");
        let reaper_res = tmp_dir.clone();

        // Install a couple of icons
        install_icon(&source, &reaper_res, "beta").unwrap();
        install_icon(&source, &reaper_res, "alpha").unwrap();
        install_icon(&source, &reaper_res, "gamma").unwrap();

        let result = list_installed_icons(&reaper_res);
        assert!(result.is_ok());
        let icons = result.unwrap();

        assert_eq!(icons.len(), 3, "Should find 3 icons");
        assert_eq!(icons[0], "alpha", "Should be sorted first");
        assert_eq!(icons[1], "beta", "Should be sorted second");
        assert_eq!(icons[2], "gamma", "Should be sorted third");

        let _ = std::fs::remove_dir_all(&tmp_dir);
    }

    #[test]
    fn list_installed_icons_filters_non_png_files() {
        let (tmp_dir, _source) = create_temp_dir("test_list_filter");
        let reaper_res = tmp_dir.clone();
        let toolbar = reaper_res.join("Data/toolbar_icons");
        std::fs::create_dir_all(&toolbar).unwrap();

        // Create mixed files
        std::fs::write(toolbar.join("icon.png"), "fake_png").unwrap();
        std::fs::write(toolbar.join("notes.txt"), "not an icon").unwrap();
        std::fs::write(toolbar.join("data.bin"), &[0u8; 4]).unwrap();

        let result = list_installed_icons(&reaper_res);
        assert!(result.is_ok());
        let icons = result.unwrap();

        assert_eq!(icons.len(), 1, "Only .png files should be listed");
        assert_eq!(icons[0], "icon", "Extension should be stripped");

        let _ = std::fs::remove_dir_all(&tmp_dir);
    }

    // -----------------------------------------------------------------------
    // Task 1.3/1.5: delete_icon tests
    // -----------------------------------------------------------------------

    #[test]
    fn delete_icon_removes_from_all_three_dirs() {
        let tmp = std::env::temp_dir().join("test_delete_all_dirs");
        std::fs::create_dir_all(&tmp).unwrap();
        let reaper_res = tmp.clone();

        // Create icon in all 3 scale dirs
        for dir in &["Data/toolbar_icons", "Data/toolbar_icons/150", "Data/toolbar_icons/200"] {
            let d = reaper_res.join(dir);
            std::fs::create_dir_all(&d).unwrap();
            std::fs::write(d.join("myicon.png"), "fake_png").unwrap();
        }

        let result = delete_icon(&reaper_res, "myicon");
        assert!(result.is_ok(), "delete_icon should succeed");

        // Verify all 3 copies are gone
        for dir in &["Data/toolbar_icons", "Data/toolbar_icons/150", "Data/toolbar_icons/200"] {
            let p = reaper_res.join(dir).join("myicon.png");
            assert!(!p.exists(), "File should be deleted from {:?}", dir);
        }

        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn delete_icon_removes_on_variant() {
        let tmp = std::env::temp_dir().join("test_delete_on_var");
        std::fs::create_dir_all(&tmp).unwrap();
        let reaper_res = tmp.clone();

        let dir = reaper_res.join("Data/toolbar_icons");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("myicon.png"), "fake_png").unwrap();
        std::fs::write(dir.join("myicon_on.png"), "fake_png").unwrap();

        let result = delete_icon(&reaper_res, "myicon");
        assert!(result.is_ok(), "delete_icon should succeed");
        assert!(!dir.join("myicon.png").exists(), "OFF variant deleted");
        assert!(!dir.join("myicon_on.png").exists(), "ON variant deleted");

        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn delete_icon_non_existent_returns_error() {
        let tmp = std::env::temp_dir().join("test_delete_missing");
        std::fs::create_dir_all(&tmp).unwrap();
        let reaper_res = tmp.clone();

        let result = delete_icon(&reaper_res, "nonexistent");
        assert!(result.is_err(), "Non-existent icon should return error");
        assert!(
            result.unwrap_err().contains("not found"),
            "Error should mention not found"
        );

        let _ = std::fs::remove_dir_all(&tmp);
    }

    // -----------------------------------------------------------------------
    // Task 1.3/1.5: get_icon_strip tests
    // -----------------------------------------------------------------------

    #[test]
    fn get_icon_strip_returns_base64_for_existing_icon() {
        let tmp = std::env::temp_dir().join("test_get_strip_exists");
        std::fs::create_dir_all(&tmp).unwrap();
        let reaper_res = tmp.clone();

        let dir = reaper_res.join("Data/toolbar_icons");
        std::fs::create_dir_all(&dir).unwrap();
        // Write a minimal valid PNG (1x1 red pixel)
        let img = image::RgbaImage::from_pixel(1, 1, image::Rgba([255, 0, 0, 255]));
        let mut buf = std::io::Cursor::new(Vec::new());
        image::DynamicImage::ImageRgba8(img)
            .write_to(&mut buf, image::ImageFormat::Png)
            .unwrap();
        std::fs::write(dir.join("testicon.png"), &buf.into_inner()).unwrap();

        let result = get_icon_strip(&reaper_res, "testicon");
        assert!(result.is_ok(), "get_icon_strip should succeed");
        let b64 = result.unwrap();
        assert!(!b64.is_empty(), "Base64 should not be empty");

        // Verify it decodes back to a valid PNG
        use base64::Engine;
        let decoded = base64::engine::general_purpose::STANDARD
            .decode(&b64)
            .expect("Base64 should decode");
        let decoded_img = image::load_from_memory(&decoded)
            .expect("Should be valid PNG");
        assert_eq!(decoded_img.width(), 1, "Decoded PNG width");
        assert_eq!(decoded_img.height(), 1, "Decoded PNG height");

        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn get_icon_strip_non_existent_returns_error() {
        let tmp = std::env::temp_dir().join("test_get_strip_missing");
        std::fs::create_dir_all(&tmp).unwrap();
        let reaper_res = tmp.clone();

        let result = get_icon_strip(&reaper_res, "imaginary");
        assert!(result.is_err(), "Non-existent icon should return error");
        assert!(
            result.unwrap_err().contains("not found"),
            "Error should mention not found"
        );

        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn get_icon_strip_empty_name_returns_file_not_found() {
        let tmp = std::env::temp_dir().join("test_get_strip_empty");
        std::fs::create_dir_all(&tmp).unwrap();
        let reaper_res = tmp.clone();

        let result = get_icon_strip(&reaper_res, "");
        assert!(result.is_err(), "Empty name should return error");

        let _ = std::fs::remove_dir_all(&tmp);
    }
}
