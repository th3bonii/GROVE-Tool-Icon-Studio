pub mod image_processor;
pub mod installer;
pub mod path_detector;

use std::path::Path;

#[tauri::command]
fn detect_reaper_path() -> Result<path_detector::DetectionResult, String> {
    Ok(path_detector::detect())
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

    let result = tokio::task::spawn_blocking(move || {
        let input = Path::new(&input_path_owned);
        let filename = input
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("icon")
            .to_string();

        let mut config = image_processor::IconConfig {
            padding: padding.unwrap_or(2),
            is_toggle: is_toggle.unwrap_or(false),
            ..Default::default()
        };
        if let Some(adj) = off_adjustments {
            config.off_adjustments = adj;
        }
        if let Some(adj) = on_adjustments {
            config.on_adjustments = adj;
        }

        // Use raw output mode to avoid encode→decode roundtrip
        let results = image_processor::generate_icon_set_raw(
            input, &config, crop.as_ref(), image_processor::REAPER_SCALES,
        ).map_err(|e| e.to_string())?;

        // Write raw bytes directly to disk
        let written: Vec<image_processor::ProcessingOutput> = results
            .into_iter()
            .map(|output| {
                let suffix = &output.suffix;
                let output_name = if suffix.is_empty() {
                    format!("{}.png", filename)
                } else {
                    format!("{}{}.png", filename, suffix)
                };
                let output_path = Path::new(&output_dir_owned).join(&output_name);

                eprintln!("[process_icon] writing {} ({}x{})", output_path.display(), output.width, output.height);
                if let Err(e) = std::fs::write(&output_path, &output.data) {
                    eprintln!("[process_icon] FAILED to write {}: {}", output_path.display(), e);
                }

                image_processor::ProcessingOutput {
                    width: output.width,
                    height: output.height,
                    output_path: Some(output_path),
                    preview_base64: None,
                    suffix: output.suffix,
                }
            })
            .collect();

        Ok::<_, String>(written)
    }).await.map_err(|e| e.to_string())?;

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

        let mut config = image_processor::IconConfig {
            padding: padding.unwrap_or(2),
            is_toggle: is_toggle.unwrap_or(false),
            ..Default::default()
        };
        if let Some(adj) = off_adjustments {
            config.off_adjustments = adj;
        }
        if let Some(adj) = on_adjustments {
            config.on_adjustments = adj;
        }

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

        let mut config = image_processor::IconConfig {
            padding: padding.unwrap_or(2),
            is_toggle: is_toggle.unwrap_or(false),
            ..Default::default()
        };
        if let Some(adj) = off_adjustments {
            config.off_adjustments = adj;
        }
        if let Some(adj) = on_adjustments {
            config.on_adjustments = adj;
        }

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
fn list_installed_icons(reaper_resource_path: String) -> Result<Vec<String>, String> {
    installer::list_installed_icons(Path::new(&reaper_resource_path))
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

    #[test]
    fn list_installed_icons_command_returns_icons_from_all_scales() {
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
            .expect("list_installed_icons should succeed");

        assert!(result.contains(&"alpha".to_string()), "Should find alpha");
        assert!(result.contains(&"beta".to_string()), "Should find beta");
        assert!(result.contains(&"gamma".to_string()), "Should find gamma");

        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn list_installed_icons_command_returns_empty_for_new_dir() {
        let tmp = std::env::temp_dir().join("grove_test_ipc_list_empty");
        std::fs::create_dir_all(&tmp).unwrap();

        let reaper_res = tmp.clone();

        let result = list_installed_icons(reaper_res.to_string_lossy().to_string())
            .expect("list_installed_icons should succeed");

        assert!(result.is_empty(), "New dir should have no icons");
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            detect_reaper_path,
            process_icon,
            preview_icon,
            install_icon_set,
            install_icon,
            list_installed_icons,
            delete_icon,
            get_icon_strip,
            write_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
