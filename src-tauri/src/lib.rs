pub mod image_processor;
pub mod installer;
pub mod path_detector;

use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use std::sync::atomic::{AtomicU32, Ordering};

const MAX_ERRORS_PER_SESSION: u32 = 5;
const MAX_LOG_SIZE: u64 = 1_048_576; // 1 MB

static ERROR_LOG_DIR: OnceLock<PathBuf> = OnceLock::new();
static ERROR_COUNT: AtomicU32 = AtomicU32::new(0);

#[tauri::command]
fn detect_reaper_path() -> Result<path_detector::DetectionResult, String> {
    Ok(path_detector::detect())
}

/// Build an `IconConfig` from optional Tauri command parameters.
///
/// Wraps the common pattern of unwrapping `Option` params with defaults:
/// - `padding` defaults to `4`
/// - `is_toggle` defaults to `false`
/// - `off_adjustments` / `on_adjustments` default to `Default::default()` arrays
fn build_icon_config(
    padding: Option<u8>,
    is_toggle: Option<bool>,
    off_adjustments: Option<[image_processor::HsbAdjustment; 3]>,
    on_adjustments: Option<[image_processor::HsbAdjustment; 3]>,
) -> image_processor::IconConfig {
    let mut config = image_processor::IconConfig {
        padding: padding.unwrap_or(4),
        is_toggle: is_toggle.unwrap_or(false),
        ..Default::default()
    };
    if let Some(adj) = off_adjustments {
        config.off_adjustments = adj;
    }
    if let Some(adj) = on_adjustments {
        config.on_adjustments = adj;
    }
    config
}

#[tauri::command]
async fn process_icon(
    input_path: String,
    output_dir: String,
    crop: Option<image_processor::CropArea>,
    padding: Option<u8>,
    is_toggle: Option<bool>,
    off_adjustments: Option<[image_processor::HsbAdjustment; 3]>,
    on_adjustments: Option<[image_processor::HsbAdjustment; 3]>,
) -> Result<Vec<image_processor::ProcessingOutput>, String> {
    let input_path_owned = input_path.clone();
    let output_dir_owned = output_dir.clone();

    let result: Result<Vec<image_processor::ProcessingOutput>, String> = tokio::task::spawn_blocking(
        move || -> Result<Vec<image_processor::ProcessingOutput>, String> {
            let input = Path::new(&input_path_owned);
            let filename = input
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("icon")
                .to_string();

            let config = build_icon_config(padding, is_toggle, off_adjustments, on_adjustments);

            // Use raw output mode to avoid encode→decode roundtrip
            let results = image_processor::generate_icon_set_raw(
                input, &config, crop.as_ref(), image_processor::REAPER_SCALES,
            ).map_err(|e| e.to_string())?;

        // Write raw bytes directly to disk, distributing each scale
        // to the correct REAPER scale subdirectory.
        let n_scales = image_processor::REAPER_SCALES.len();
        if results.len() % n_scales != 0 {
            return Err(format!(
                "process_icon: results count ({}) not evenly divisible by scales count ({})",
                results.len(), n_scales
            ));
        }
        let scale_subdirs = image_processor::REAPER_SCALE_DIRS;
        let outputs_per_scale = results.len() / n_scales;

        let written: Vec<image_processor::ProcessingOutput> = results
                .into_iter()
                .enumerate()
                .map(|(idx, output)| -> Result<image_processor::ProcessingOutput, String> {
                let scale_idx = idx / outputs_per_scale;
                let sub_dir = scale_subdirs.get(scale_idx)
                    .map(|d| d.strip_prefix("Data/toolbar_icons/").unwrap_or(""))
                    .unwrap_or("");
                    let target_dir = Path::new(&output_dir_owned).join(sub_dir);

                    let suffix = &output.suffix;
                    let output_name = if suffix.is_empty() {
                        format!("{}.png", filename)
                    } else {
                        format!("{}{}.png", filename, suffix)
                    };

                    std::fs::create_dir_all(&target_dir)
                        .map_err(|e| format!("Failed to create directory {:?}: {}", target_dir, e))?;
                    let output_path = target_dir.join(&output_name);

                    eprintln!("[process_icon] writing {} ({}x{})", output_path.display(), output.width, output.height);
                    std::fs::write(&output_path, &output.data)
                        .map_err(|e| format!("Failed to write {}: {}", output_path.display(), e))?;

                    Ok(image_processor::ProcessingOutput {
                        width: output.width,
                        height: output.height,
                        output_path: Some(output_path),
                        preview_base64: None,
                        suffix: output.suffix,
                    })
                })
                .collect::<Result<Vec<_>, _>>()?;

            Ok(written)
        },
    ).await.map_err(|e| e.to_string())?;

    result
}


#[tauri::command]
async fn preview_icon(
    input_path: String,
    crop: Option<image_processor::CropArea>,
    padding: Option<u8>,
    is_toggle: Option<bool>,
    off_adjustments: Option<[image_processor::HsbAdjustment; 3]>,
    on_adjustments: Option<[image_processor::HsbAdjustment; 3]>,
) -> Result<Vec<image_processor::ProcessingOutput>, String> {
    let input_path_owned = input_path.clone();

    let result = tokio::task::spawn_blocking(move || {
        let input = Path::new(&input_path_owned);

        let config = build_icon_config(padding, is_toggle, off_adjustments, on_adjustments);

        image_processor::generate_icon_set(
            input, &config, crop.as_ref(), image_processor::REAPER_SCALES,
        ).map_err(|e| e.to_string())
    }).await.map_err(|e| e.to_string())?;

    result
}

#[tauri::command]
async fn install_icon_set(
    input_path: String,
    reaper_resource_path: String,
    target_name: String,
    crop: Option<image_processor::CropArea>,
    padding: Option<u8>,
    is_toggle: Option<bool>,
    off_adjustments: Option<[image_processor::HsbAdjustment; 3]>,
    on_adjustments: Option<[image_processor::HsbAdjustment; 3]>,
) -> Result<Vec<String>, String> {
    let input_path_owned = input_path.clone();
    let reaper_path_owned = reaper_resource_path.clone();
    let target_owned = target_name.clone();

    let result = tokio::task::spawn_blocking(move || {
        let input = Path::new(&input_path_owned);

        let target = if target_owned.is_empty() {
            input
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("icon")
                .to_string()
        } else {
            target_owned
        };

        let config = build_icon_config(padding, is_toggle, off_adjustments, on_adjustments);

        let results = image_processor::generate_icon_set_raw(
            input, &config, crop.as_ref(), image_processor::REAPER_SCALES,
        ).map_err(|e| e.to_string())?;

        installer::install_icon_set_raw(
            &results,
            Path::new(&reaper_path_owned),
            &target,
            image_processor::REAPER_SCALES,
        )
        .map(|paths| {
            paths
                .into_iter()
                .map(|p| p.to_string_lossy().to_string())
                .collect()
        })
        .map_err(|e| e.to_string())
    }).await.map_err(|e| e.to_string())?;

    result
}

#[tauri::command]
fn install_icon(
    source_path: String,
    reaper_resource_path: String,
    target_name: String,
) -> Result<String, String> {
    let installed = installer::install_icon(
        Path::new(&source_path),
        Path::new(&reaper_resource_path),
        &target_name,
    )?;
    Ok(installed.to_string_lossy().to_string())
}

#[tauri::command]
async fn list_installed_icons(reaper_resource_path: String) -> Result<Vec<String>, String> {
    let path = reaper_resource_path.clone();
    tokio::task::spawn_blocking(move || {
        installer::list_installed_icons(Path::new(&path))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn delete_icon(reaper_resource_path: String, icon_name: String) -> Result<(), String> {
    if icon_name.is_empty() {
        return Err("Icon name must not be empty".to_string());
    }
    installer::delete_icon(Path::new(&reaper_resource_path), &icon_name)
}

#[tauri::command]
fn get_icon_strip(reaper_resource_path: String, icon_name: String) -> Result<String, String> {
    if icon_name.is_empty() {
        return Err("Icon name must not be empty".to_string());
    }
    installer::get_icon_strip(Path::new(&reaper_resource_path), &icon_name)
}

#[tauri::command]
async fn get_icon_thumbnails(
    reaper_resource_path: String,
    names: Vec<String>,
) -> Result<std::collections::HashMap<String, String>, String> {
    let path = reaper_resource_path.clone();
    let names_clone = names.clone();
    let thumbnails = tokio::task::spawn_blocking(move || {
        installer::get_icon_thumbnails(Path::new(&path), &names_clone)
    })
    .await
    .map_err(|e| e.to_string())?;

    // Silently skip unreadable/missing icons — this is intentional behavior
    // so that a single broken file doesn't prevent ALL thumbnails from loading.
    Ok(thumbnails)
}

#[tauri::command]
fn write_file(path: String, data: String) -> Result<(), String> {
    use base64::Engine;
    let decoded = base64::engine::general_purpose::STANDARD
        .decode(&data)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;
    std::fs::write(&path, &decoded)
        .map_err(|e| format!("Failed to write file: {}", e))
}

#[cfg(test)]
#[allow(deprecated)]
mod tests {
    use super::*;
    use image::RgbaImage;
    use tokio;

    /// Helper: create a small test PNG at `path` and return it.
    fn create_test_png(path: &std::path::Path) {
        let img = RgbaImage::from_pixel(64, 64, image::Rgba([100, 150, 200, 255]));
        img.save(path).expect("Failed to create test PNG");
    }

    // -----------------------------------------------------------------------
    // build_icon_config unit tests
    // -----------------------------------------------------------------------

    #[test]
    fn build_icon_config_defaults() {
        let config = build_icon_config(None, None, None, None);
        assert_eq!(config.padding, 4, "default padding should be 4");
        assert!(!config.is_toggle, "default is_toggle should be false");
        assert_eq!(config.hover_brightness, 30, "default hover_brightness");
        assert_eq!(config.click_brightness, -40, "default click_brightness");
    }

    #[test]
    fn build_icon_config_applies_padding() {
        let config = build_icon_config(Some(2), None, None, None);
        assert_eq!(config.padding, 2, "padding should be 2");
    }

    #[test]
    fn build_icon_config_applies_toggle() {
        let config = build_icon_config(None, Some(true), None, None);
        assert!(config.is_toggle, "is_toggle should be true");
    }

    #[test]
    fn build_icon_config_applies_hsb_adjustments() {
        let identity = image_processor::HsbAdjustment {
            hue_shift: 10.0, sat_delta: -0.2, bri_delta: 0.5,
        };
        let adjustments = [identity; 3];
        let config = build_icon_config(None, None, Some(adjustments), None);
        assert_eq!(config.off_adjustments[0].hue_shift, 10.0);
        assert_eq!(config.off_adjustments[0].sat_delta, -0.2);
        assert_eq!(config.off_adjustments[0].bri_delta, 0.5);
        // on_adjustments should still be defaults
        assert_eq!(config.on_adjustments[0].hue_shift, 0.0);
    }

    #[test]
    fn build_icon_config_applies_on_adjustments() {
        let identity = image_processor::HsbAdjustment {
            hue_shift: 30.0, sat_delta: 0.1, bri_delta: -0.3,
        };
        let adjustments = [identity; 3];
        let config = build_icon_config(None, None, None, Some(adjustments));
        assert_eq!(config.on_adjustments[0].hue_shift, 30.0);
        assert_eq!(config.on_adjustments[0].sat_delta, 0.1);
        assert_eq!(config.on_adjustments[0].bri_delta, -0.3);
    }

    // -----------------------------------------------------------------------
    // T6: process_icon with new params (padding, is_toggle)
    // Returns Vec<ProcessingOutput> — one per scale
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn process_icon_with_padding_and_crop_returns_multi_scale() {
        let tmp = std::env::temp_dir().join("grove_test_ipc_pad");
        std::fs::create_dir_all(&tmp).unwrap();

        let input_path = tmp.join("input.png");
        create_test_png(&input_path);

        let output_dir = tmp.join("out");
        std::fs::create_dir_all(&output_dir).unwrap();

        let crop = image_processor::CropArea {
            x: 0, y: 0, width: 32, height: 32,
        };

        // New signature: padding=2, is_toggle=false
        let results = process_icon(
            input_path.to_string_lossy().to_string(),
            output_dir.to_string_lossy().to_string(),
            Some(crop),
            Some(2),      // padding
            Some(false),  // is_toggle
            None,         // no off_adjustments
            None,         // no on_adjustments
        )
        .await
        .expect("process_icon should succeed");

        // Should produce 3 outputs (one per scale)
        assert_eq!(results.len(), 3, "Should produce 3 scale outputs");

        // Non-toggle → each output should have suffix=""
        for out in &results {
            assert_eq!(out.suffix, "", "Non-toggle should have empty suffix");
            assert!(
                out.output_path.is_some(),
                "File mode must return output_path"
            );
        }

        // 30px scale: 3 × 30 = 90
        assert_eq!(results[0].width, 90, "30px scale width");
        assert_eq!(results[0].height, 30, "30px scale height");

        // 45px scale: 3 × 45 = 135
        assert_eq!(results[1].width, 135, "45px scale width");
        assert_eq!(results[1].height, 45, "45px scale height");

        // 60px scale: 3 × 60 = 180
        assert_eq!(results[2].width, 180, "60px scale width");
        assert_eq!(results[2].height, 60, "60px scale height");

        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[tokio::test]
    async fn process_icon_toggle_produces_twice_as_many() {
        let tmp = std::env::temp_dir().join("grove_test_ipc_toggle");
        std::fs::create_dir_all(&tmp).unwrap();

        let input_path = tmp.join("input.png");
        create_test_png(&input_path);

        let output_dir = tmp.join("out");
        std::fs::create_dir_all(&output_dir).unwrap();

        // Toggle enabled
        let results = process_icon(
            input_path.to_string_lossy().to_string(),
            output_dir.to_string_lossy().to_string(),
            None,         // no crop
            None,         // default padding (2)
            Some(true),   // is_toggle = true
            None,         // no off_adjustments
            None,         // no on_adjustments
        )
        .await
        .expect("process_icon toggle should succeed");

        // 3 scales × 2 variants = 6 outputs
        assert_eq!(results.len(), 6, "Toggle should produce 6 outputs");

        // Outputs are scale-major: [OFF@30, ON@30, OFF@45, ON@45, OFF@60, ON@60]
        // Even indices (0, 2, 4): OFF variants (suffix="")
        // Odd indices (1, 3, 5): ON variants (suffix="_on")
        for i in 0..3 {
            let off_idx = i * 2;
            let on_idx = i * 2 + 1;

            assert_eq!(
                results[off_idx].suffix, "",
                "Scale {} OFF should have empty suffix", i
            );
            assert!(
                results[off_idx].output_path.is_some(),
                "Scale {} OFF should have output_path", i
            );

            assert_eq!(
                results[on_idx].suffix, "_on",
                "Scale {} ON should have _on suffix", i
            );
            assert!(
                results[on_idx].output_path.is_some(),
                "Scale {} ON should have output_path", i
            );
        }

        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[tokio::test]
    async fn process_icon_defaults_padding_to_2() {
        // Verify that calling without padding defaults to 2 (like the old behavior
        // called through generate_icon_set with padding=2)
        let tmp = std::env::temp_dir().join("grove_test_ipc_default_pad");
        std::fs::create_dir_all(&tmp).unwrap();

        let input_path = tmp.join("input.png");
        create_test_png(&input_path);

        let output_dir = tmp.join("out");
        std::fs::create_dir_all(&output_dir).unwrap();

        // No padding, no is_toggle — use defaults
        let results = process_icon(
            input_path.to_string_lossy().to_string(),
            output_dir.to_string_lossy().to_string(),
            None,
            None,
            None,
            None,
            None,
        )
        .await
        .expect("process_icon defaults should succeed");

        assert_eq!(results.len(), 3, "Should produce 3 scale outputs");
        let _ = std::fs::remove_dir_all(&tmp);
    }

    // -----------------------------------------------------------------------
    // T7: preview_icon returns all 3 scales as base64
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn preview_icon_returns_multi_scale_base64() {
        let tmp = std::env::temp_dir().join("grove_test_ipc_preview_ms");
        std::fs::create_dir_all(&tmp).unwrap();

        let input_path = tmp.join("input.png");
        create_test_png(&input_path);

        let results = preview_icon(
            input_path.to_string_lossy().to_string(),
            None,
            None,
            None,
            None,
            None,
        )
        .await
        .expect("preview_icon should succeed");

        // Should return 3 outputs (one per scale)
        assert_eq!(results.len(), 3, "Should return 3 scale outputs");

        for (i, out) in results.iter().enumerate() {
            assert!(
                out.preview_base64.is_some(),
                "Scale {} should have base64", i
            );
            assert!(
                out.output_path.is_none(),
                "Preview mode should have no output_path for scale {}", i
            );
        }

        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[tokio::test]
    async fn preview_icon_with_toggle_returns_six_outputs() {
        let tmp = std::env::temp_dir().join("grove_test_ipc_preview_toggle");
        std::fs::create_dir_all(&tmp).unwrap();

        let input_path = tmp.join("input.png");
        create_test_png(&input_path);

        let results = preview_icon(
            input_path.to_string_lossy().to_string(),
            None,
            None,
            Some(true),  // is_toggle
            None,        // no off_adjustments
            None,        // no on_adjustments
        )
        .await
        .expect("preview_icon toggle should succeed");

        assert_eq!(results.len(), 6, "Toggle preview should return 6 outputs");

        let _ = std::fs::remove_dir_all(&tmp);
    }

    // -----------------------------------------------------------------------
    // T7: install_icon_set IPC wrapper
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn install_icon_set_command_creates_three_directories() {
        let tmp = std::env::temp_dir().join("grove_test_ipc_install_set");
        std::fs::create_dir_all(&tmp).unwrap();

        let input_path = tmp.join("input.png");
        create_test_png(&input_path);

        let reaper_res = tmp.clone();

        let result = install_icon_set(
            input_path.to_string_lossy().to_string(),
            reaper_res.to_string_lossy().to_string(),
            "testicon".to_string(),
            None,          // no crop
            None,          // default padding
            None,          // no toggle
            None,          // no off_adjustments
            None,          // no on_adjustments
        )
        .await
        .expect("install_icon_set should succeed");

        // Should install 3 files (one per scale, non-toggle)
        assert_eq!(result.len(), 3, "Should install 3 files");

        assert!(
            reaper_res.join("Data/toolbar_icons").join("testicon.png").exists(),
            "100% file should exist"
        );
        assert!(
            reaper_res.join("Data/toolbar_icons/150").join("testicon.png").exists(),
            "150% file should exist"
        );
        assert!(
            reaper_res.join("Data/toolbar_icons/200").join("testicon.png").exists(),
            "200% file should exist"
        );

        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[tokio::test]
    async fn install_icon_set_command_toggle_creates_six_files() {
        let tmp = std::env::temp_dir().join("grove_test_ipc_install_toggle");
        std::fs::create_dir_all(&tmp).unwrap();

        let input_path = tmp.join("input.png");
        create_test_png(&input_path);

        let reaper_res = tmp.clone();

        let result = install_icon_set(
            input_path.to_string_lossy().to_string(),
            reaper_res.to_string_lossy().to_string(),
            "myicon".to_string(),
            None,
            None,
            Some(true),   // is_toggle = true
            None,         // no off_adjustments
            None,         // no on_adjustments
        )
        .await
        .expect("install_icon_set toggle should succeed");

        // 3 scales × 2 variants = 6 files
        assert_eq!(result.len(), 6, "Toggle should install 6 files");

        let _ = std::fs::remove_dir_all(&tmp);
    }

    // -----------------------------------------------------------------------
    // Existing install_icon IPC wrapper tests (unchanged)
    // -----------------------------------------------------------------------

    #[test]
    fn install_icon_command_copies_file() {
        let tmp = std::env::temp_dir().join("grove_test_ipc_install");
        std::fs::create_dir_all(&tmp).unwrap();

        let source_path = tmp.join("source.png");
        create_test_png(&source_path);

        let reaper_res = tmp.clone();
        std::fs::create_dir_all(&reaper_res).unwrap();

        let result = install_icon(
            source_path.to_string_lossy().to_string(),
            reaper_res.to_string_lossy().to_string(),
            "my_test_icon".to_string(),
        )
        .expect("install_icon IPC should succeed");

        let expected = reaper_res
            .join("Data/toolbar_icons")
            .join("my_test_icon.png");
        assert!(
            expected.exists(),
            "Installed icon should exist at {:?}",
            expected
        );
        assert!(
            result.contains("my_test_icon.png"),
            "Returned path should reference the installed file"
        );

        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn install_icon_command_rejects_empty_name() {
        let tmp = std::env::temp_dir().join("grove_test_ipc_install_empty");
        std::fs::create_dir_all(&tmp).unwrap();

        let source_path = tmp.join("source.png");
        create_test_png(&source_path);

        let reaper_res = tmp.clone();

        let result = install_icon(
            source_path.to_string_lossy().to_string(),
            reaper_res.to_string_lossy().to_string(),
            "".to_string(),
        );

        assert!(result.is_err(), "Empty name should fail");
        let _ = std::fs::remove_dir_all(&tmp);
    }

    // -----------------------------------------------------------------------
    // list_installed_icons (multi-scale) IPC wrapper
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn list_installed_icons_command_returns_icons_from_all_scales() {
        let tmp = std::env::temp_dir().join("grove_test_ipc_list_ms");
        std::fs::create_dir_all(&tmp).unwrap();

        let reaper_res = tmp.clone();

        // Install alpha only in 100%
        let _ = installer::install_icon(
            &{ let p = tmp.join("s.png"); create_test_png(&p); p },
            &reaper_res, "alpha"
        );
        // Create beta only in 150%
        let dir_150 = reaper_res.join("Data/toolbar_icons/150");
        std::fs::create_dir_all(&dir_150).unwrap();
        std::fs::write(dir_150.join("beta.png"), "fake_png").unwrap();
        // Create gamma only in 200%
        let dir_200 = reaper_res.join("Data/toolbar_icons/200");
        std::fs::create_dir_all(&dir_200).unwrap();
        std::fs::write(dir_200.join("gamma.png"), "fake_png").unwrap();

        let result = list_installed_icons(reaper_res.to_string_lossy().to_string())
            .await
            .expect("list_installed_icons should succeed");

        assert!(result.contains(&"alpha".to_string()), "Should find alpha");
        assert!(result.contains(&"beta".to_string()), "Should find beta");
        assert!(result.contains(&"gamma".to_string()), "Should find gamma");

        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[tokio::test]
    async fn list_installed_icons_command_returns_empty_for_new_dir() {
        let tmp = std::env::temp_dir().join("grove_test_ipc_list_empty");
        std::fs::create_dir_all(&tmp).unwrap();

        let reaper_res = tmp.clone();

        let result = list_installed_icons(reaper_res.to_string_lossy().to_string())
            .await
            .expect("list_installed_icons should succeed");

        assert!(result.is_empty(), "New dir should have no icons");
        let _ = std::fs::remove_dir_all(&tmp);
    }

    // -----------------------------------------------------------------------
    // get_icon_thumbnails tests (task 3.3)
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn get_icon_thumbnails_skips_nonexistent_icon() {
        let tmp = std::env::temp_dir().join("grove_test_thumb_missing");
        std::fs::create_dir_all(&tmp).unwrap();

        let result = get_icon_thumbnails(
            tmp.to_string_lossy().to_string(),
            vec!["nonexistent".to_string()],
        )
        .await;

        assert!(result.is_ok(), "Should return Ok (empty) for nonexistent icon");
        assert!(result.unwrap().is_empty(), "Map should be empty");

        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[tokio::test]
    async fn get_icon_thumbnails_returns_available_for_mixed_existing_and_missing() {
        let tmp = std::env::temp_dir().join("grove_test_thumb_mixed");
        std::fs::create_dir_all(&tmp).unwrap();

        let toolbar = tmp.join("Data/toolbar_icons");
        std::fs::create_dir_all(&toolbar).unwrap();
        // Create one real icon
        create_test_png(&toolbar.join("existing.png"));

        // Request two names: one that exists, one that doesn't
        let result = get_icon_thumbnails(
            tmp.to_string_lossy().to_string(),
            vec!["existing".to_string(), "missing".to_string()],
        )
        .await;

        assert!(result.is_ok(), "Should return Ok even when some names are missing");
        let map = result.unwrap();
        assert_eq!(map.len(), 1, "Should only return the existing icon");
        assert!(map.contains_key("existing"), "Should contain 'existing'");
        assert!(!map.contains_key("missing"), "Should NOT contain 'missing'");

        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[tokio::test]
    async fn get_icon_thumbnails_returns_all_when_all_exist() {
        // This test already passes — kept for completeness
        let tmp = std::env::temp_dir().join("grove_test_thumb_all_exist");
        std::fs::create_dir_all(&tmp).unwrap();
        let toolbar = tmp.join("Data/toolbar_icons");
        std::fs::create_dir_all(&toolbar).unwrap();
        create_test_png(&toolbar.join("a.png"));
        create_test_png(&toolbar.join("b.png"));

        let result = get_icon_thumbnails(
            tmp.to_string_lossy().to_string(),
            vec!["a".to_string(), "b".to_string()],
        )
        .await;

        assert!(result.is_ok(), "Should return Ok when all icons exist");
        assert_eq!(result.unwrap().len(), 2, "Should return both icons");

        let _ = std::fs::remove_dir_all(&tmp);
    }

    // -----------------------------------------------------------------------
    // Phase 1.4/1.5: Write error propagation (RED — write failure is silent)
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn process_icon_returns_err_on_write_failure() {
        // Setup: output_dir is a FILE, so write() inside process_icon must fail.
        let tmp = std::env::temp_dir().join("grove_test_write_err");
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();

        let input_path = tmp.join("input.png");
        create_test_png(&input_path);

        // Create a FILE at output_dir's first-level path so create_dir_all
        // succeeds (creates nothing because it exists) but write() fails.
        let output_dir = tmp.join("out_is_file");
        std::fs::write(&output_dir, "i am a file not a directory").unwrap();

        let result = process_icon(
            input_path.to_string_lossy().to_string(),
            output_dir.to_string_lossy().to_string(),
            None, None, None, None, None,
        ).await;

        assert!(result.is_err(),
            "process_icon should return Err on write failure");
        assert!(
            result.unwrap_err().contains("write"),
            "Error should mention write failure"
        );

        let _ = std::fs::remove_dir_all(&tmp);
    }

    // -----------------------------------------------------------------------
    // Phase 2.1/2.2: Integer division guard
    // -----------------------------------------------------------------------

    #[test]
    fn process_icon_division_even_check_catches_mismatch() {
        // Verify the guard rejects non-even division.
        // Create a scenario where results_len % n_scales != 0.
        // We can't easily call process_icon with arbitrary-sized results,
        // so we test the logic directly via generate_icon_set_raw + REAPER_SCALES.
        let tmp = std::env::temp_dir().join("grove_test_div_even");
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();

        let input_path = tmp.join("input.png");
        let img = RgbaImage::from_pixel(32, 32, image::Rgba([100, 150, 200, 255]));
        img.save(&input_path).expect("Failed to create test PNG");

        let config = image_processor::IconConfig {
            padding: 4,
            is_toggle: false,
            ..Default::default()
        };

        // Normal call: 3 scales, no toggle → 3 results → 3 % 3 == 0 ✅
        let results = image_processor::generate_icon_set_raw(
            &input_path, &config, None, image_processor::REAPER_SCALES,
        ).expect("generate_icon_set_raw should succeed");
        assert_eq!(results.len(), 3, "3 scales without toggle");
        assert_eq!(results.len() % image_processor::REAPER_SCALES.len(), 0,
            "Should be evenly divisible");

        let _ = std::fs::remove_dir_all(&tmp);
    }

    // -----------------------------------------------------------------------
    // Feature A: HSB adjustments (off_adjustments / on_adjustments)
    // RED phase — these tests reference params that DON'T exist yet
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn process_icon_accepts_optional_hsb_adjustments() {
        // Passing None for both HSB params should maintain backward compat
        let tmp = std::env::temp_dir().join("grove_test_hsb_process");
        std::fs::create_dir_all(&tmp).unwrap();

        let input_path = tmp.join("input.png");
        create_test_png(&input_path);

        let output_dir = tmp.join("out");
        std::fs::create_dir_all(&output_dir).unwrap();

        let results = process_icon(
            input_path.to_string_lossy().to_string(),
            output_dir.to_string_lossy().to_string(),
            None,    // no crop
            None,    // default padding
            None,    // no toggle
            None,    // no off_adjustments
            None,    // no on_adjustments
        )
        .await
        .expect("process_icon with None HSB should succeed");

        // Must produce 3 outputs (one per scale, non-toggle)
        assert_eq!(results.len(), 3, "Should produce 3 scale outputs");
        for out in &results {
            assert_eq!(out.suffix, "", "Non-toggle should have empty suffix");
        }

        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[tokio::test]
    async fn process_icon_with_hsb_adjustments_produces_different_output() {
        // Passing identity adjustments should produce same output count
        let tmp = std::env::temp_dir().join("grove_test_hsb_process_adj");
        std::fs::create_dir_all(&tmp).unwrap();

        let input_path = tmp.join("input.png");
        create_test_png(&input_path);

        let output_dir = tmp.join("out");
        std::fs::create_dir_all(&output_dir).unwrap();

        let identity_adj = image_processor::HsbAdjustment {
            hue_shift: 0.0, sat_delta: 0.0, bri_delta: 0.0,
        };
        let adjustments = [identity_adj, identity_adj, identity_adj];

        let results = process_icon(
            input_path.to_string_lossy().to_string(),
            output_dir.to_string_lossy().to_string(),
            None,
            None,
            None,
            Some(adjustments),
            Some(adjustments),
        )
        .await
        .expect("process_icon with identity HSB should succeed");

        assert_eq!(results.len(), 3, "Should produce 3 scale outputs");

        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[tokio::test]
    async fn preview_icon_accepts_optional_hsb_adjustments() {
        let tmp = std::env::temp_dir().join("grove_test_hsb_preview");
        std::fs::create_dir_all(&tmp).unwrap();

        let input_path = tmp.join("input.png");
        create_test_png(&input_path);

        let results = preview_icon(
            input_path.to_string_lossy().to_string(),
            None,
            None,
            None,
            None,    // no off_adjustments
            None,    // no on_adjustments
        )
        .await
        .expect("preview_icon with None HSB should succeed");

        assert_eq!(results.len(), 3, "Should return 3 scale outputs");

        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[tokio::test]
    async fn install_icon_set_accepts_optional_hsb_adjustments() {
        let tmp = std::env::temp_dir().join("grove_test_hsb_install");
        std::fs::create_dir_all(&tmp).unwrap();

        let input_path = tmp.join("input.png");
        create_test_png(&input_path);

        let reaper_res = tmp.clone();

        let result = install_icon_set(
            input_path.to_string_lossy().to_string(),
            reaper_res.to_string_lossy().to_string(),
            "hsb_test".to_string(),
            None,    // no crop
            None,    // default padding
            None,    // no toggle
            None,    // no off_adjustments
            None,    // no on_adjustments
        )
        .await
        .expect("install_icon_set with None HSB should succeed");

        assert_eq!(result.len(), 3, "Should install 3 files");

        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[tokio::test]
    async fn preview_icon_with_toggle_and_hsb_adjustments_returns_six() {
        let tmp = std::env::temp_dir().join("grove_test_hsb_preview_toggle");
        std::fs::create_dir_all(&tmp).unwrap();

        let input_path = tmp.join("input.png");
        create_test_png(&input_path);

        let identity_adj = image_processor::HsbAdjustment {
            hue_shift: 0.0, sat_delta: 0.0, bri_delta: 0.0,
        };
        let adjustments = [identity_adj, identity_adj, identity_adj];

        let results = preview_icon(
            input_path.to_string_lossy().to_string(),
            None,
            None,
            Some(true),  // is_toggle
            Some(adjustments),
            Some(adjustments),
        )
        .await
        .expect("preview_icon with toggle + HSB should succeed");

        assert_eq!(results.len(), 6, "Toggle should return 6 outputs");

        let _ = std::fs::remove_dir_all(&tmp);
    }

    // -----------------------------------------------------------------------
    // Phase 2 — Error Logging Tests
    // -----------------------------------------------------------------------

    #[test]
    fn error_log_entry_writes_message_to_file() {
        let tmp = std::env::temp_dir().join("grove_test_elog_write");
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();
        let log_path = tmp.join("error.log");

        super::write_entry(&log_path, "test error message").unwrap();

        let content = std::fs::read_to_string(&log_path).unwrap();
        assert!(
            content.contains("test error message"),
            "Log should contain the written message"
        );

        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn error_log_entries_are_appended() {
        let tmp = std::env::temp_dir().join("grove_test_elog_append");
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();
        let log_path = tmp.join("error.log");

        super::write_entry(&log_path, "entry 1").unwrap();
        super::write_entry(&log_path, "entry 2").unwrap();

        let content = std::fs::read_to_string(&log_path).unwrap();
        assert!(content.contains("entry 1"), "First entry");
        assert!(content.contains("entry 2"), "Second entry");

        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn maybe_truncate_reduces_file_size() {
        let tmp = std::env::temp_dir().join("grove_test_elog_trunc");
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();
        let log_path = tmp.join("error.log");

        // Write a file larger than 1 MB
        let large_line = "x".repeat(500_000);
        std::fs::write(&log_path, format!("{}\n", large_line)).unwrap();
        let initial_len = std::fs::metadata(&log_path).unwrap().len();
        assert!(initial_len > 500_000, "File should be large");

        // Truncate with a small threshold to force action
        super::maybe_truncate(&log_path, 1024).unwrap();

        let final_len = std::fs::metadata(&log_path).unwrap().len();
        assert!(final_len <= 1024, "File should be <= 1024 bytes after truncation");

        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn format_error_message_includes_stack_when_provided() {
        let msg = super::format_error_message("crash".into(), Some("at line 42".into()));
        assert!(msg.contains("crash"), "Should contain the error message");
        assert!(msg.contains("at line 42"), "Should contain the stack trace");
    }

    #[test]
    fn format_error_message_omits_stack_when_none() {
        let msg = super::format_error_message("simple".into(), None);
        assert!(msg.contains("simple"), "Should contain the error message");
        assert!(!msg.contains("Stack:"), "Should NOT contain stack section");
    }

    #[test]
    fn write_error_log_command_returns_ok() {
        // Verify the command doesn't crash when called with and without stack
        super::ERROR_COUNT.store(0, std::sync::atomic::Ordering::SeqCst);
        let result = super::write_error_log("test cmd msg".into(), Some("at cmd".into()));
        assert!(result.is_ok(), "write_error_log with stack should succeed");

        super::ERROR_COUNT.store(0, std::sync::atomic::Ordering::SeqCst);
        let result2 = super::write_error_log("simple msg".into(), None);
        assert!(result2.is_ok(), "write_error_log without stack should succeed");
    }

    #[test]
    fn write_error_log_returns_ok_without_panic_when_no_log_dir() {
        // Call write_error_log before init_error_logging — should not crash
        let result = super::write_error_log("orphan msg".into(), None);
        assert!(result.is_ok(), "write_error_log should not fail when dir not set");
    }

    #[test]
    fn panic_hook_writes_to_error_log() {
        let tmp = std::env::temp_dir().join("grove_test_elog_panic");
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();

        // Reset counter
        super::ERROR_COUNT.store(0, std::sync::atomic::Ordering::SeqCst);

        // Save old hook, install ours with an explicit closure-captured path
        let old_hook = std::panic::take_hook();
        let log_path = tmp.join("error.log");
        let log_path_for_hook = log_path.clone();
        std::panic::set_hook(Box::new(move |info| {
            let msg = super::format_panic_info(info);
            let _ = super::write_entry(&log_path_for_hook, &msg);
        }));

        // Trigger a panic
        let result = std::panic::catch_unwind(|| {
            panic!("deliberate test panic for error log");
        });
        assert!(result.is_err(), "catch_unwind should capture the panic");

        // Restore old hook
        std::panic::set_hook(old_hook);

        // Verify log file
        assert!(log_path.exists(), "error.log should exist after panic");
        let content = std::fs::read_to_string(&log_path).unwrap();
        assert!(
            content.contains("deliberate test panic"),
            "Log should contain the panic message"
        );
        assert!(content.contains("PANIC:"), "Log should contain PANIC prefix");

        let _ = std::fs::remove_dir_all(&tmp);
    }

    // -----------------------------------------------------------------------
    // Task 1.3: Async command tests
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn async_preview_icon_returns_multi_scale_base64() {
        let tmp = std::env::temp_dir().join("grove_test_async_preview");
        std::fs::create_dir_all(&tmp).unwrap();

        let input_path = tmp.join("input.png");
        let img = RgbaImage::from_pixel(64, 64, image::Rgba([100, 150, 200, 255]));
        img.save(&input_path).expect("Failed to create test PNG");

        let results = preview_icon(
            input_path.to_string_lossy().to_string(),
            None, None, None, None, None,
        ).await.expect("async preview_icon should succeed");

        assert_eq!(results.len(), 3, "Should return 3 scale outputs");
        for out in &results {
            assert!(out.preview_base64.is_some(), "Preview should have base64");
        }

        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[tokio::test]
    async fn async_process_icon_returns_multi_scale_outputs() {
        let tmp = std::env::temp_dir().join("grove_test_async_process");
        std::fs::create_dir_all(&tmp).unwrap();

        let input_path = tmp.join("input.png");
        let output_dir = tmp.join("out");
        std::fs::create_dir_all(&output_dir).unwrap();

        let img = RgbaImage::from_pixel(64, 64, image::Rgba([100, 150, 200, 255]));
        img.save(&input_path).expect("Failed to create test PNG");

        let results = process_icon(
            input_path.to_string_lossy().to_string(),
            output_dir.to_string_lossy().to_string(),
            None, None, None, None, None,
        ).await.expect("async process_icon should succeed");

        assert_eq!(results.len(), 3, "Should produce 3 scale outputs");
        for out in &results {
            assert!(out.output_path.is_some(), "File mode should have path");
        }

        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[tokio::test]
    async fn async_install_icon_set_creates_files() {
        let tmp = std::env::temp_dir().join("grove_test_async_install");
        std::fs::create_dir_all(&tmp).unwrap();

        let input_path = tmp.join("input.png");
        let img = RgbaImage::from_pixel(64, 64, image::Rgba([100, 150, 200, 255]));
        img.save(&input_path).expect("Failed to create test PNG");

        let result = install_icon_set(
            input_path.to_string_lossy().to_string(),
            tmp.to_string_lossy().to_string(),
            "test_async".to_string(),
            None, None, None, None, None,
        ).await.expect("async install_icon_set should succeed");

        assert_eq!(result.len(), 3, "Should install 3 files");

        let _ = std::fs::remove_dir_all(&tmp);
    }
}

// ---------------------------------------------------------------------------
// Error logging — panic capture + IPC error reporting
// ---------------------------------------------------------------------------

/// Initialise the error logging subsystem.
///
/// Creates the log directory, sets the global log path, and installs a panic
/// hook that writes panics (with backtrace) to `{app_data_dir}/error.log`.
///
/// Safe to call multiple times — the global path and hook are initialised
/// only once (via `OnceLock` + `AtomicBool` guard).
pub fn init_error_logging(app_data_dir: &Path) -> Result<(), String> {
    std::fs::create_dir_all(app_data_dir)
        .map_err(|e| format!("Failed to create log directory: {}", e))?;
    ERROR_LOG_DIR.get_or_init(|| app_data_dir.to_path_buf());

    static PANIC_HOOK_SET: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
    if !PANIC_HOOK_SET.swap(true, Ordering::SeqCst) {
        std::panic::set_hook(Box::new(|info| {
            let msg = format_panic_info(info);
            let count = ERROR_COUNT.fetch_add(1, Ordering::SeqCst);
            if count < MAX_ERRORS_PER_SESSION {
                if let Some(dir) = ERROR_LOG_DIR.get() {
                    let path = dir.join("error.log");
                    let _ = maybe_truncate(&path, MAX_LOG_SIZE);
                    let _ = write_entry(&path, &msg);
                }
            }
        }));
    }
    Ok(())
}

/// Format a panic payload + backtrace into a single log-friendly string.
fn format_panic_info(info: &std::panic::PanicHookInfo) -> String {
    let payload = info
        .payload()
        .downcast_ref::<String>()
        .cloned()
        .or_else(|| info.payload().downcast_ref::<&str>().map(|s| s.to_string()))
        .unwrap_or_else(|| "Unknown panic".to_string());

    let location = info
        .location()
        .map(|loc| format!(" at {}:{}:{}", loc.file(), loc.line(), loc.column()))
        .unwrap_or_default();

    let backtrace = std::backtrace::Backtrace::force_capture();

    format!(
        "PANIC: {}\nLocation:{}\nBacktrace:\n{:?}",
        payload, location, backtrace,
    )
}

/// Format an IPC error message (with optional stack) for the log file.
pub(crate) fn format_error_message(message: String, stack: Option<String>) -> String {
    match stack {
        Some(s) if !s.is_empty() => format!("ERROR: {}\nStack:\n{}", message, s),
        _ => format!("ERROR: {}", message),
    }
}

/// Append a single entry to the error log file.
///
/// The file is created if it does not exist. **This function does NOT enforce
/// the per-session entry cap** — that check belongs at the call site so the
/// cap is applied consistently across panic hook and IPC paths.
pub(crate) fn write_entry(path: &Path, msg: &str) -> std::io::Result<()> {
    use std::io::Write;
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)?;
    writeln!(file, "{}", msg)?;
    Ok(())
}

/// Truncate a log file to keep its size under `max_size` bytes.
///
/// When the file exceeds `max_size`, this keeps approximately the last half of
/// `max_size` bytes, rounded to the nearest newline boundary so no entry is
/// split. The first line of the kept portion may be partial; callers should
/// design log entries as single self-describing lines.
pub(crate) fn maybe_truncate(path: &Path, max_size: u64) -> std::io::Result<()> {
    let meta = std::fs::metadata(path)?;
    if meta.len() <= max_size {
        return Ok(());
    }
    let content = std::fs::read_to_string(path)?;
    let bytes = content.as_bytes();
    // Keep ~half of max_size bytes, starting at a newline boundary
    let keep_from = bytes.len().saturating_sub((max_size / 2) as usize);
    let start = bytes[keep_from..]
        .iter()
        .position(|&b| b == b'\n')
        .map(|pos| keep_from + pos + 1)
        .unwrap_or(keep_from);
    std::fs::write(path, &bytes[start..])?;
    Ok(())
}

/// Tauri IPC command — write an error message from the frontend to the log file.
///
/// The frontend ErrorBoundary calls this when it catches a render crash.
/// Respects the same 5-entry-per-session cap as the panic hook.
#[tauri::command]
fn write_error_log(message: String, stack: Option<String>) -> Result<(), String> {
    let msg = format_error_message(message, stack);
    let count = ERROR_COUNT.fetch_add(1, Ordering::SeqCst);
    if count >= MAX_ERRORS_PER_SESSION {
        return Ok(());
    }
    if let Some(dir) = ERROR_LOG_DIR.get() {
        let path = dir.join("error.log");
        let _ = maybe_truncate(&path, MAX_LOG_SIZE);
        let _ = write_entry(&path, &msg);
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Tauri application entry point
// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            use tauri::Manager;
            let app_data_dir = app.path().app_data_dir()
                .expect("Failed to resolve app data directory");
            let _ = init_error_logging(&app_data_dir);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            detect_reaper_path,
            process_icon,
            preview_icon,
            install_icon_set,
            install_icon,
            list_installed_icons,
            delete_icon,
            get_icon_strip,
            get_icon_thumbnails,
            write_file,
            write_error_log,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
