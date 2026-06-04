use image::{DynamicImage, GenericImageView, ImageBuffer, RgbaImage};
use std::path::Path;

/// Errors that can occur during icon processing.
#[derive(Debug, thiserror::Error)]
pub enum ProcessingError {
    #[error("Failed to open image: {0}")]
    OpenError(String),
    #[error("Failed to save image: {0}")]
    SaveError(String),
    #[error("Encoded image is empty: {0}")]
    EmptyError(String),
    #[error("Invalid image dimensions: {0}")]
    DimensionError(String),
}

/// Configuration for 3-state icon generation.
#[derive(Debug, Clone)]
pub struct IconConfig {
    /// Brightness adjustment for the hover state (additive, 0–255 range offset).
    pub hover_brightness: i16,
    /// Brightness adjustment for the clicked state (subtractive, 0–255 range offset).
    pub click_brightness: i16,
}

impl Default for IconConfig {
    fn default() -> Self {
        Self {
            hover_brightness: 30,
            click_brightness: -40,
        }
    }
}

/// Defines a rectangular region for cropping.
#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize)]
pub struct CropArea {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

/// Result of processing an icon — used for both file-save and preview modes.
#[derive(Debug, Clone, serde::Serialize)]
pub struct ProcessingOutput {
    /// Total width of the 3-state output (state_width * 3).
    pub width: u32,
    /// Height of each state (and total output).
    pub height: u32,
    /// Path to saved file, or None in preview mode.
    pub output_path: Option<std::path::PathBuf>,
    /// Base64-encoded PNG data, or None in file-save mode.
    pub preview_base64: Option<String>,
}

/// Information about a successfully saved icon (legacy, for backward compat).
#[derive(Debug, Clone, serde::Serialize)]
pub struct OutputInfo {
    pub width: u32,
    pub height: u32,
    pub output_path: std::path::PathBuf,
}

/// Generate a 3-state REAPER toolbar icon from a single source image.
///
/// The pipeline is:
///   1. Open the source image
///   2. Optionally crop to `CropArea`
///   3. Center-crop to a square
///   4. Scale to `state_size` × `state_size`
///   5. Generate three brightness-adjusted states (Normal, Hover, Clicked)
///   6. If `output_path` is Some → save to file; if None → encode as base64
///
/// Output dimensions: `(state_size * 3, state_size)` — a horizontal strip
/// where each state is `state_size` × `state_size`.
///
/// Alpha channel is strictly preserved across all three states.
pub fn generate_three_state(
    input_path: &Path,
    output_path: Option<&Path>,
    config: &IconConfig,
    crop: Option<&CropArea>,
    state_size: u32,
) -> Result<ProcessingOutput, ProcessingError> {
    let source = image::open(input_path)
        .map_err(|e| ProcessingError::OpenError(e.to_string()))?;

    let (w, h) = source.dimensions();
    if w == 0 || h == 0 {
        return Err(ProcessingError::DimensionError(
            format!("Source image has zero dimension: {}x{}", w, h),
        ));
    }

    let source_rgba = source.to_rgba8();

    // Step 1: Optionally crop the source
    let working = match crop {
        Some(area) => crop_region(&source_rgba, area),
        None => source_rgba,
    };

    // Step 2: Center-crop to square
    let square = center_crop_square(&working);

    // Step 3: Scale to state_size
    let scaled = resize_exact(&square, state_size, state_size);

    // Step 4: Generate 3 states
    let (sw, sh) = scaled.dimensions();
    let output_width = sw * 3;

    let mut output: RgbaImage = ImageBuffer::new(output_width, sh);

    copy_region(&scaled, &mut output, 0);
    let hover = adjust_brightness(&scaled, config.hover_brightness);
    copy_region(&hover, &mut output, sw);
    let clicked = adjust_brightness(&scaled, config.click_brightness);
    copy_region(&clicked, &mut output, sw * 2);

    // Step 5: Save to file or encode as base64
    match output_path {
        Some(out_path) => {
            DynamicImage::ImageRgba8(output)
                .save(out_path)
                .map_err(|e| ProcessingError::SaveError(e.to_string()))?;

            Ok(ProcessingOutput {
                width: output_width,
                height: sh,
                output_path: Some(out_path.to_path_buf()),
                preview_base64: None,
            })
        }
        None => {
            let mut buf = std::io::Cursor::new(Vec::new());
            DynamicImage::ImageRgba8(output)
                .write_to(&mut buf, image::ImageFormat::Png)
                .map_err(|e| ProcessingError::SaveError(e.to_string()))?;

            let encoded = base64::Engine::encode(
                &base64::engine::general_purpose::STANDARD,
                buf.into_inner(),
            );

            Ok(ProcessingOutput {
                width: output_width,
                height: sh,
                output_path: None,
                preview_base64: Some(encoded),
            })
        }
    }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/// Copy `source` into `target` starting at horizontal offset `x_offset`.
fn copy_region(source: &RgbaImage, target: &mut RgbaImage, x_offset: u32) {
    let (w, h) = source.dimensions();
    for y in 0..h {
        for x in 0..w {
            let pixel = *source.get_pixel(x, y);
            target.put_pixel(x + x_offset, y, pixel);
        }
    }
}

/// Adjust brightness of an RGBA image while preserving alpha exactly.
fn adjust_brightness(img: &RgbaImage, adjustment: i16) -> RgbaImage {
    let (w, h) = img.dimensions();
    let mut result: RgbaImage = ImageBuffer::new(w, h);

    for y in 0..h {
        for x in 0..w {
            let pixel = img.get_pixel(x, y);
            let [r, g, b, a] = pixel.0;

            let clamp = |v: i16| -> u8 { v.clamp(0, 255) as u8 };

            let new_pixel = image::Rgba([
                clamp(r as i16 + adjustment),
                clamp(g as i16 + adjustment),
                clamp(b as i16 + adjustment),
                a, // Alpha is NEVER modified
            ]);

            result.put_pixel(x, y, new_pixel);
        }
    }

    result
}

/// Extract a rectangular region from an image, clamping to image bounds.
fn crop_region(img: &RgbaImage, crop: &CropArea) -> RgbaImage {
    let (img_w, img_h) = img.dimensions();

    // Clamp to image bounds
    let x = crop.x.min(img_w.saturating_sub(1));
    let y = crop.y.min(img_h.saturating_sub(1));
    let w = crop.width.min(img_w.saturating_sub(x));
    let h = crop.height.min(img_h.saturating_sub(y));

    if w == 0 || h == 0 {
        return RgbaImage::new(0, 0);
    }

    let mut result = RgbaImage::new(w, h);
    for dy in 0..h {
        for dx in 0..w {
            let pixel = *img.get_pixel(x + dx, y + dy);
            result.put_pixel(dx, dy, pixel);
        }
    }
    result
}

/// Center-crop an image to a square (min of width and height).
fn center_crop_square(img: &RgbaImage) -> RgbaImage {
    let (w, h) = img.dimensions();
    let size = w.min(h);
    let x = (w - size) / 2;
    let y = (h - size) / 2;
    let crop = CropArea { x, y, width: size, height: size };
    crop_region(img, &crop)
}

/// Resize an image to exact dimensions using Lanczos3 filter.
fn resize_exact(img: &RgbaImage, w: u32, h: u32) -> RgbaImage {
    image::imageops::resize(img, w, h, image::imageops::FilterType::Lanczos3)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use image::{Rgba, RgbaImage};

    fn make_test_image(w: u32, h: u32) -> RgbaImage {
        let mut img = RgbaImage::new(w, h);
        for y in 0..h {
            for x in 0..w {
                // Checkerboard: some pixels opaque, some semi-transparent
                let alpha = if (x + y) % 2 == 0 { 255 } else { 128 };
                img.put_pixel(x, y, Rgba([100, 150, 200, alpha]));
            }
        }
        img
    }

    #[test]
    fn adjust_brightness_preserves_alpha() {
        let img = make_test_image(4, 4);
        let brighter = adjust_brightness(&img, 30);

        for y in 0..4 {
            for x in 0..4 {
                let original_alpha = img.get_pixel(x, y).0[3];
                let adjusted_alpha = brighter.get_pixel(x, y).0[3];
                assert_eq!(
                    original_alpha, adjusted_alpha,
                    "Alpha must be preserved at ({}, {})",
                    x, y
                );
            }
        }
    }

    #[test]
    fn adjust_brightness_clamps_correctly() {
        let mut img = RgbaImage::new(1, 1);
        img.put_pixel(0, 0, Rgba([250, 10, 128, 200]));

        let brighter = adjust_brightness(&img, 30);
        let p = brighter.get_pixel(0, 0).0;
        assert_eq!(p[0], 255, "R should clamp to 255");
        assert_eq!(p[1], 40, "G should be 10+30=40");
        assert_eq!(p[2], 158, "B should be 128+30=158");
        assert_eq!(p[3], 200, "Alpha unchanged");

        let darker = adjust_brightness(&img, -40);
        let p2 = darker.get_pixel(0, 0).0;
        assert_eq!(p2[0], 210, "R should be 250-40=210");
        assert_eq!(p2[1], 0, "G should clamp to 0");
        assert_eq!(p2[2], 88, "B should be 128-40=88");
        assert_eq!(p2[3], 200, "Alpha unchanged");
    }

    #[test]
    fn three_state_output_dimensions() {
        let tmp_dir = std::env::temp_dir().join("grove_test_3state");
        std::fs::create_dir_all(&tmp_dir).unwrap();

        let input_path = tmp_dir.join("input.png");
        let output_path = tmp_dir.join("output.png");

        // Create a 16x16 test image and save it
        let img = make_test_image(16, 16);
        DynamicImage::ImageRgba8(img).save(&input_path).unwrap();

        let config = IconConfig::default();
        let info = generate_three_state(
            &input_path,
            Some(&output_path),
            &config,
            None,
            16,
        ).unwrap();

        assert_eq!(info.width, 48, "Output width must be 3 * 16 = 48");
        assert_eq!(info.height, 16, "Output height must remain 16");

        // Verify the file on disk matches
        let output_img = image::open(&output_path).unwrap();
        assert_eq!(output_img.width(), 48);
        assert_eq!(output_img.height(), 16);

        // Cleanup
        let _ = std::fs::remove_dir_all(&tmp_dir);
    }

    #[test]
    fn three_state_preserves_alpha_in_all_states() {
        let tmp_dir = std::env::temp_dir().join("grove_test_alpha");
        std::fs::create_dir_all(&tmp_dir).unwrap();

        let input_path = tmp_dir.join("input.png");
        let output_path = tmp_dir.join("output.png");

        // 4x4 with specific alpha pattern
        let mut img = RgbaImage::new(4, 4);
        for y in 0..4 {
            for x in 0..4 {
                let alpha = ((x * 64 + y * 16) % 256) as u8;
                img.put_pixel(x, y, Rgba([100, 100, 100, alpha]));
            }
        }
        DynamicImage::ImageRgba8(img.clone()).save(&input_path).unwrap();

        let config = IconConfig::default();
        generate_three_state(
            &input_path,
            Some(&output_path),
            &config,
            None,
            4,
        ).unwrap();

        let output_img = image::open(&output_path).unwrap().to_rgba8();

        // Check alpha in all three states matches original
        for y in 0..4 {
            for x in 0..4 {
                let original_alpha = img.get_pixel(x, y).0[3];
                for state in 0..3u32 {
                    let ox = x + state * 4;
                    let output_alpha = output_img.get_pixel(ox, y).0[3];
                    assert_eq!(
                        original_alpha, output_alpha,
                        "Alpha mismatch at state={}, ({}, {})",
                        state, x, y
                    );
                }
            }
        }

        let _ = std::fs::remove_dir_all(&tmp_dir);
    }

    // -----------------------------------------------------------------------
    // RED tests for CropArea + crop_region + state_size (Tasks 1.1–1.3)
    // These reference types/functions that do NOT exist yet — guaranteed RED
    // -----------------------------------------------------------------------

    #[test]
    fn crop_area_struct_exists() {
        let crop = CropArea { x: 5, y: 10, width: 20, height: 20 };
        assert_eq!(crop.x, 5);
        assert_eq!(crop.y, 10);
        assert_eq!(crop.width, 20);
        assert_eq!(crop.height, 20);
    }

    #[test]
    fn crop_region_reduces_dimensions() {
        let img = make_test_image(100, 100);
        let crop = CropArea { x: 10, y: 20, width: 30, height: 40 };
        let cropped = crop_region(&img, &crop);
        assert_eq!(cropped.width(), 30, "Cropped width must match crop width");
        assert_eq!(cropped.height(), 40, "Cropped height must match crop height");
    }

    #[test]
    fn crop_region_content_matches_source() {
        let mut img = RgbaImage::new(10, 10);
        img.put_pixel(2, 3, Rgba([255, 0, 0, 255]));
        let crop = CropArea { x: 2, y: 3, width: 1, height: 1 };
        let cropped = crop_region(&img, &crop);
        let pixel = cropped.get_pixel(0, 0);
        assert_eq!(pixel.0, [255, 0, 0, 255], "Pixel at (2,3) must be copied to (0,0)");
    }

    #[test]
    fn generate_three_state_with_state_size_scales_correctly() {
        let tmp_dir = std::env::temp_dir().join("grove_test_size");
        std::fs::create_dir_all(&tmp_dir).unwrap();

        let input_path = tmp_dir.join("input.png");
        let output_path = tmp_dir.join("output.png");

        // 64x64 input image (larger than state_size)
        let img = make_test_image(64, 64);
        DynamicImage::ImageRgba8(img).save(&input_path).unwrap();

        let config = IconConfig::default();
        let info = generate_three_state(
            &input_path,
            Some(&output_path),
            &config,
            None,    // no crop
            30,      // state_size = 30
        ).unwrap();

        // Per-state should be 30x30, total width 30*3=90
        assert_eq!(info.width, 90, "Total output width must be state_size * 3");
        assert_eq!(info.height, 30, "Output height must equal state_size");

        let output_img = image::open(&output_path).unwrap();
        assert_eq!(output_img.width(), 90);
        assert_eq!(output_img.height(), 30);

        let _ = std::fs::remove_dir_all(&tmp_dir);
    }

    #[test]
    fn generate_three_state_with_crop_and_size_uses_cropped_region() {
        let tmp_dir = std::env::temp_dir().join("grove_test_crop_size");
        std::fs::create_dir_all(&tmp_dir).unwrap();

        let input_path = tmp_dir.join("input.png");
        let output_path = tmp_dir.join("output.png");

        // 100x100 image with a distinct red pixel at (5,5)
        let mut img = RgbaImage::new(100, 100);
        img.put_pixel(5, 5, Rgba([255, 0, 0, 255]));
        DynamicImage::ImageRgba8(img).save(&input_path).unwrap();

        let crop = CropArea { x: 0, y: 0, width: 10, height: 10 };
        let config = IconConfig::default();
        let info = generate_three_state(
            &input_path,
            Some(&output_path),
            &config,
            Some(&crop),
            30,
        ).unwrap();

        // Per-state should be 30x30 (scaled from 10x10 crop)
        assert_eq!(info.width, 90, "Total output width must be state_size * 3");
        assert_eq!(info.height, 30, "Output height must equal state_size");

        let _ = std::fs::remove_dir_all(&tmp_dir);
    }

    #[test]
    fn crop_region_preserves_alpha() {
        let mut img = RgbaImage::new(5, 5);
        for y in 0..5 {
            for x in 0..5 {
                let alpha = ((x * 50 + y * 10) % 256) as u8;
                img.put_pixel(x, y, Rgba([100, 100, 100, alpha]));
            }
        }
        let crop = CropArea { x: 1, y: 1, width: 3, height: 3 };
        let cropped = crop_region(&img, &crop);
        for y in 0..3 {
            for x in 0..3 {
                let expected_alpha = img.get_pixel(x + 1, y + 1).0[3];
                let actual_alpha = cropped.get_pixel(x, y).0[3];
                assert_eq!(expected_alpha, actual_alpha,
                    "Alpha preserved at ({}, {})", x, y);
            }
        }
    }

    #[test]
    fn crop_region_out_of_bounds_returns_available_pixels() {
        let img = make_test_image(10, 10);
        // Crop that extends beyond image bounds — should clamp
        let crop = CropArea { x: 8, y: 8, width: 5, height: 5 };
        let cropped = crop_region(&img, &crop);
        // Should return whatever is available (2x2 from 8,8 to 9,9)
        assert_eq!(cropped.width(), 2, "Should clamp to available width");
        assert_eq!(cropped.height(), 2, "Should clamp to available height");
    }

    // -----------------------------------------------------------------------
    // Tests for preview mode (Task 1.4) — base64 output
    // -----------------------------------------------------------------------

    #[test]
    fn preview_mode_returns_base64_instead_of_file() {
        let tmp_dir = std::env::temp_dir().join("grove_test_preview");
        std::fs::create_dir_all(&tmp_dir).unwrap();

        let input_path = tmp_dir.join("input.png");
        let output_path = tmp_dir.join("output.png"); // should NOT be created

        let img = make_test_image(32, 32);
        DynamicImage::ImageRgba8(img).save(&input_path).unwrap();

        let config = IconConfig::default();
        // output_path = None → preview mode
        let result = generate_three_state(
            &input_path,
            None,
            &config,
            None,
            30,
        ).unwrap();

        // Should return base64, not a file path
        assert!(result.preview_base64.is_some(), "Preview mode must return base64");
        assert!(result.output_path.is_none(), "Preview mode must not have output_path");
        assert_eq!(result.width, 90, "3 states × 30px = 90px wide");
        assert_eq!(result.height, 30, "30px tall");

        // The file should NOT exist on disk
        assert!(!output_path.exists(), "Preview mode must not write to disk");

        let _ = std::fs::remove_dir_all(&tmp_dir);
    }

    #[test]
    fn preview_base64_decodes_to_valid_png() {
        let tmp_dir = std::env::temp_dir().join("grove_test_decode");
        std::fs::create_dir_all(&tmp_dir).unwrap();

        let input_path = tmp_dir.join("input.png");
        let img = make_test_image(16, 16);
        DynamicImage::ImageRgba8(img).save(&input_path).unwrap();

        let config = IconConfig::default();
        let result = generate_three_state(
            &input_path,
            None,
            &config,
            None,
            16,
        ).unwrap();

        let b64 = result.preview_base64.expect("Should have base64");
        assert!(!b64.is_empty(), "Base64 string must not be empty");

        // Decode from base64 back to PNG bytes
        use base64::Engine;
        let decoded = base64::engine::general_purpose::STANDARD
            .decode(&b64)
            .expect("Base64 must decode successfully");

        // Load as PNG and verify dimensions
        let decoded_img = image::load_from_memory(&decoded)
            .expect("Decoded bytes must be a valid PNG");
        assert_eq!(decoded_img.width(), 48, "3 states × 16px = 48px");
        assert_eq!(decoded_img.height(), 16, "16px tall");

        let _ = std::fs::remove_dir_all(&tmp_dir);
    }

    #[test]
    fn preview_mode_with_crop_and_size_returns_correct_dimensions() {
        let tmp_dir = std::env::temp_dir().join("grove_test_preview_crop");
        std::fs::create_dir_all(&tmp_dir).unwrap();

        let input_path = tmp_dir.join("input.png");
        let mut img = RgbaImage::new(100, 100);
        img.put_pixel(0, 0, Rgba([255, 0, 0, 255]));
        DynamicImage::ImageRgba8(img).save(&input_path).unwrap();

        let crop = CropArea { x: 0, y: 0, width: 20, height: 20 };
        let config = IconConfig::default();
        let result = generate_three_state(
            &input_path,
            None,
            &config,
            Some(&crop),
            38,
        ).unwrap();

        assert_eq!(result.width, 114, "3 states × 38px = 114px");
        assert_eq!(result.height, 38, "38px tall");
        assert!(result.preview_base64.is_some());

        let _ = std::fs::remove_dir_all(&tmp_dir);
    }

    #[test]
    fn preview_mode_state_38_returns_correct_size() {
        let tmp_dir = std::env::temp_dir().join("grove_test_preview_38");
        std::fs::create_dir_all(&tmp_dir).unwrap();

        let input_path = tmp_dir.join("input.png");
        let img = make_test_image(64, 64);
        DynamicImage::ImageRgba8(img).save(&input_path).unwrap();

        let config = IconConfig::default();
        let result = generate_three_state(
            &input_path,
            None,
            &config,
            None,
            38,
        ).unwrap();

        assert_eq!(result.width, 114, "3 × 38 = 114");
        assert_eq!(result.height, 38, "38");

        let _ = std::fs::remove_dir_all(&tmp_dir);
    }

    #[test]
    fn file_mode_still_works_when_output_path_provided() {
        let tmp_dir = std::env::temp_dir().join("grove_test_file_mode");
        std::fs::create_dir_all(&tmp_dir).unwrap();

        let input_path = tmp_dir.join("input.png");
        let output_path = tmp_dir.join("output.png");
        let img = make_test_image(16, 16);
        DynamicImage::ImageRgba8(img).save(&input_path).unwrap();

        let config = IconConfig::default();
        let result = generate_three_state(
            &input_path,
            Some(&output_path),
            &config,
            None,
            16,
        ).unwrap();

        // File mode must have output_path, no preview_base64
        assert!(result.output_path.is_some(), "File mode must have output_path");
        assert!(result.preview_base64.is_none(), "File mode must not have base64");
        assert!(output_path.exists(), "Output file must exist on disk");

        let _ = std::fs::remove_dir_all(&tmp_dir);
    }
}
