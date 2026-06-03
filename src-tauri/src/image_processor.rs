use image::{DynamicImage, GenericImageView, ImageBuffer, RgbaImage};
use std::path::Path;

/// Errors that can occur during icon processing.
#[derive(Debug, thiserror::Error)]
pub enum ProcessingError {
    #[error("Failed to open image: {0}")]
    OpenError(String),
    #[error("Failed to save image: {0}")]
    SaveError(String),
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

/// Generate a 3-state REAPER toolbar icon from a single source image.
///
/// The output is a single PNG where:
/// - Left third: **normal** state (original image, unchanged)
/// - Middle third: **hover** state (slightly brighter)
/// - Right third: **clicked** state (slightly darker)
///
/// Output dimensions: `(W * 3, H)` where `(W, H)` are the input dimensions.
/// Alpha channel is strictly preserved across all three states.
pub fn generate_three_state(
    input_path: &Path,
    output_path: &Path,
    config: &IconConfig,
) -> Result<OutputInfo, ProcessingError> {
    let source = image::open(input_path)
        .map_err(|e| ProcessingError::OpenError(e.to_string()))?;

    let (w, h) = source.dimensions();
    if w == 0 || h == 0 {
        return Err(ProcessingError::DimensionError(
            format!("Source image has zero dimension: {}x{}", w, h),
        ));
    }

    let source_rgba = source.to_rgba8();
    let output_width = w * 3;

    let mut output: RgbaImage = ImageBuffer::new(output_width, h);

    // --- State 1: Normal (left third) — copy as-is ---
    copy_region(&source_rgba, &mut output, 0);

    // --- State 2: Hover (middle third) — brighten ---
    let hover = adjust_brightness(&source_rgba, config.hover_brightness);
    copy_region(&hover, &mut output, w);

    // --- State 3: Clicked (right third) — darken ---
    let clicked = adjust_brightness(&source_rgba, config.click_brightness);
    copy_region(&clicked, &mut output, w * 2);

    // Save
    DynamicImage::ImageRgba8(output)
        .save(output_path)
        .map_err(|e| ProcessingError::SaveError(e.to_string()))?;

    Ok(OutputInfo {
        width: output_width,
        height: h,
        output_path: output_path.to_path_buf(),
    })
}

/// Information about a successfully generated icon.
#[derive(Debug, Clone, serde::Serialize)]
pub struct OutputInfo {
    pub width: u32,
    pub height: u32,
    pub output_path: std::path::PathBuf,
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
        let info = generate_three_state(&input_path, &output_path, &config).unwrap();

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
        generate_three_state(&input_path, &output_path, &config).unwrap();

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
}
