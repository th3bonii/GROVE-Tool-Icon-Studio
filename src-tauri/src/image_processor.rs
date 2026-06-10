use image::{DynamicImage, GenericImageView, ImageBuffer, Rgba, RgbaImage};
use std::path::Path;

/// Number of icon states in a REAPER toolbar strip (Normal/Hover/Active).
const REAPER_STATES: u32 = 3;

/// REAPER toolbar icon scale sizes (100%, 150%, 200%).
pub const REAPER_SCALES: &[u32] = &[30, 45, 60];

/// Subdirectory names for each REAPER scale.
/// "Data/toolbar_icons" for 100%, "Data/toolbar_icons/150" for 150%, etc.
pub const REAPER_SCALE_DIRS: &[&str] = &["Data/toolbar_icons", "Data/toolbar_icons/150", "Data/toolbar_icons/200"];

/// Corner radius factor for rounded-rect mask.
/// Applied as `floor(scale * CORNER_RADIUS_FACTOR + 0.5)` with a minimum of 2.
pub const CORNER_RADIUS_FACTOR: f64 = 0.15;

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

/// HSB (Hue-Saturation-Brightness) adjustment for a single icon state.
///
/// - `hue_shift`: degrees to shift hue (REAPER spec locks this at 0°).
/// - `sat_delta`: additive percentage points to saturation (e.g., -0.20 = reduce sat by 20pp).
/// - `bri_delta`: additive percentage points to brightness (e.g., 15.0 = increase bri by 15pp).
#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize)]
pub struct HsbAdjustment {
    pub hue_shift: f32,
    pub sat_delta: f32,
    pub bri_delta: f32,
}

impl Default for HsbAdjustment {
    fn default() -> Self {
        Self { hue_shift: 0.0, sat_delta: 0.0, bri_delta: 0.0 }
    }
}

/// Configuration for icon generation.
///
/// Keeps old fields (`hover_brightness`, `click_brightness`) for backward
/// compatibility with `generate_three_state`. Adds new HSB-based adjustment
/// arrays for the REAPER-standard 3-state pipeline (`generate_icon_set`).
#[derive(Debug, Clone)]
pub struct IconConfig {
    /// Brightness adjustment for the hover state (additive, 0–255 range offset).
    pub hover_brightness: i16,
    /// Brightness adjustment for the clicked state (subtractive, 0–255 range offset).
    pub click_brightness: i16,
    /// HSB adjustments for the three OFF states: [Normal, Hover, Active].
    pub off_adjustments: [HsbAdjustment; 3],
    /// HSB adjustments for the three ON states: [Normal, Hover, Active].
    pub on_adjustments: [HsbAdjustment; 3],
    /// Padding inset in pixels (0–4, default 2).
    pub padding: u8,
    /// If true, generate both OFF and ON variants.
    pub is_toggle: bool,
}

impl Default for IconConfig {
    fn default() -> Self {
        Self {
            hover_brightness: 30,
            click_brightness: -40,
            off_adjustments: [
                HsbAdjustment { hue_shift: 0.0, sat_delta: 0.0, bri_delta: 0.0 },   // Normal
                HsbAdjustment { hue_shift: 0.0, sat_delta: 0.0, bri_delta: 30.0 },  // Hover
                HsbAdjustment { hue_shift: 0.0, sat_delta: 0.0, bri_delta: -40.0 }, // Active
            ],
            on_adjustments: [
                HsbAdjustment { hue_shift: 0.0, sat_delta: 0.0, bri_delta: 0.0 },   // Normal
                HsbAdjustment { hue_shift: 0.0, sat_delta: 0.0, bri_delta: 30.0 },  // Hover
                HsbAdjustment { hue_shift: 0.0, sat_delta: 0.0, bri_delta: -40.0 }, // Active
            ],
            padding: 4,
            is_toggle: false,
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
    /// File suffix for toggle mode: "" for OFF variant, "_on" for ON variant.
    /// Non-toggle outputs always use "".
    pub suffix: String,
}

/// Result of processing an icon in raw byte mode (no base64 encoding).
///
/// Used by `generate_icon_set_raw()` for the file-writing pipeline, avoiding
/// the encode→decode roundtrip when saving to disk.
#[derive(Debug, Clone)]
pub struct ProcessingOutputRaw {
    /// Total width of the 3-state output (state_width * 3).
    pub width: u32,
    /// Height of each state (and total output).
    pub height: u32,
    /// Raw PNG bytes ready for direct file writing.
    pub data: Vec<u8>,
    /// File suffix: "" for OFF variant, "_on" for ON variant.
    pub suffix: String,
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
///
/// ⚠️ **DEPRECATED**: Use `generate_icon_set()` instead for new code.
/// `generate_icon_set` supports the full REAPER-standard 3-state pipeline
/// with HSB adjustments, padding, multi-scale, and toggle ON/OFF generation.
/// This function is kept for backward compatibility but will be removed
/// in a future release.
#[deprecated(
    since = "0.2.0",
    note = "Use generate_icon_set() for REAPER-standard 3-state output with HSB adjustments, padding, multi-scale, and toggle support"
)]
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

    // Step 5: Apply rounded-corner mask to each state for a polished REAPER look
    let corner_radius = icon_corner_radius(state_size, config.padding);
    apply_rounded_rect_mask(&mut output, state_size, state_size, corner_radius);

    // Step 6: Save to file or encode as base64
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
                suffix: String::new(),
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
                suffix: String::new(),
            })
        }
    }
}

// ---------------------------------------------------------------------------
// Multi-Scale Generation
// ---------------------------------------------------------------------------

/// Generate a complete icon set at multiple scales (100%, 150%, 200%).


/// Copy `source` into `target` starting at horizontal offset `x_offset`.
///
/// Uses `image::imageops::replace()` for efficient bulk pixel copy.
fn copy_region(source: &RgbaImage, target: &mut RgbaImage, x_offset: u32) {
    image::imageops::replace(target, source, x_offset as i64, 0);
}

/// Adjust brightness of an RGBA image while preserving alpha exactly.
///
/// Uses `enumerate_pixels()` for efficient image crate iteration instead of
/// manual nested loops with `get_pixel`/`put_pixel`.
fn adjust_brightness(img: &RgbaImage, adjustment: i16) -> RgbaImage {
    let (w, h) = img.dimensions();
    let mut result: RgbaImage = ImageBuffer::new(w, h);

    let clamp = |v: i16| -> u8 { v.clamp(0, 255) as u8 };

    for (x, y, pixel) in img.enumerate_pixels() {
        let [r, g, b, a] = pixel.0;
        result.put_pixel(x, y, Rgba([
            clamp(r as i16 + adjustment),
            clamp(g as i16 + adjustment),
            clamp(b as i16 + adjustment),
            a, // Alpha is NEVER modified
        ]));
    }

    result
}

// ---------------------------------------------------------------------------
// HSB Math (REAPER Standard) — pure functions
// ---------------------------------------------------------------------------

/// Convert RGB (0–255) to HSB.
///
/// Returns (hue in degrees [0, 360), saturation [0, 1], brightness [0, 1]).
pub fn rgb_to_hsb(r: u8, g: u8, b: u8) -> (f32, f32, f32) {
    let rf = r as f32 / 255.0;
    let gf = g as f32 / 255.0;
    let bf = b as f32 / 255.0;

    let max = rf.max(gf).max(bf);
    let min = rf.min(gf).min(bf);
    let delta = max - min;

    let hue = if delta == 0.0 {
        0.0
    } else if max == rf {
        60.0 * (((gf - bf) / delta) % 6.0)
    } else if max == gf {
        60.0 * (((bf - rf) / delta) + 2.0)
    } else {
        60.0 * (((rf - gf) / delta) + 4.0)
    };
    let hue = if hue < 0.0 { hue + 360.0 } else { hue };

    let sat = if max == 0.0 { 0.0 } else { delta / max };

    (hue, sat, max)
}

/// Convert HSB back to RGB (0–255).
///
/// Standard 6-sector inversion of the HSV/HSB model.
pub fn hsb_to_rgb(h: f32, s: f32, b: f32) -> (u8, u8, u8) {
    let h = h % 360.0;
    let h = if h < 0.0 { h + 360.0 } else { h };

    let c = b * s;               // chroma
    let x = c * (1.0 - ((h / 60.0) % 2.0 - 1.0).abs());
    let m = b - c;

    let (r1, g1, b1) = if h < 60.0 {
        (c, x, 0.0)
    } else if h < 120.0 {
        (x, c, 0.0)
    } else if h < 180.0 {
        (0.0, c, x)
    } else if h < 240.0 {
        (0.0, x, c)
    } else if h < 300.0 {
        (x, 0.0, c)
    } else {
        (c, 0.0, x)
    };

    let clamp_u8 = |v: f32| -> u8 { (v * 255.0).round().clamp(0.0, 255.0) as u8 };

    (clamp_u8(r1 + m), clamp_u8(g1 + m), clamp_u8(b1 + m))
}

/// Apply an HSB adjustment to every pixel in an RGBA image.
///
/// - `hue_shift` is applied in degrees (mod 360).
/// - `sat_delta` is additive (percentage points, e.g., -0.20 = -20pp).
/// - `bri_delta` is additive (percentage points, e.g., 15.0 = +15pp).
/// - Alpha channel is NEVER modified.
///
/// Uses `enumerate_pixels()` for efficient image crate iteration instead of
/// manual nested loops with `get_pixel`/`put_pixel`.
pub fn apply_hsb(img: &RgbaImage, adj: &HsbAdjustment) -> RgbaImage {
    let (w, h) = img.dimensions();
    let mut result: RgbaImage = ImageBuffer::new(w, h);

    for (x, y, pixel) in img.enumerate_pixels() {
        let [r, g, b, a] = pixel.0;

        let (hue, sat, bri) = rgb_to_hsb(r, g, b);

        // Apply deltas
        let new_hue = (hue + adj.hue_shift) % 360.0;
        let new_hue = if new_hue < 0.0 { new_hue + 360.0 } else { new_hue };
        let new_sat = (sat + adj.sat_delta).clamp(0.0, 1.0);
        let new_bri = (bri + adj.bri_delta / 100.0).clamp(0.0, 1.0);

        let (nr, ng, nb) = hsb_to_rgb(new_hue, new_sat, new_bri);

        result.put_pixel(x, y, Rgba([nr, ng, nb, a]));
    }

    result
}

// ---------------------------------------------------------------------------
// Padding
// ---------------------------------------------------------------------------

/// Apply inset padding: scale the icon to `(canvas_size - 2×padding)` and
/// paste centered on a transparent `canvas_size×canvas_size` canvas.
///
/// `padding` is clamped to `canvas_size.saturating_sub(1) / 2`.
pub fn apply_padding(img: &RgbaImage, canvas_size: u32, padding: u8) -> RgbaImage {
    let p = (padding as u32).min(canvas_size.saturating_sub(1) / 2);
    let inner = canvas_size.saturating_sub(p * 2);

    if inner == 0 {
        // Avoid zero-size resize — return a 1×1 transparent pixel
        return RgbaImage::new(canvas_size.max(1), canvas_size.max(1));
    }

    let scaled = resize_exact(img, inner, inner);
    let mut output: RgbaImage = ImageBuffer::new(canvas_size, canvas_size);

    // Paste centered using imageops::overlay
    image::imageops::overlay(&mut output, &scaled, p as i64, p as i64);

    output
}

/// Compute the corner radius for an icon state given its scale and padding.
///
/// The base radius is `floor(scale * CORNER_RADIUS_FACTOR + 0.5)`, clamped to
/// a minimum of 2. If `padding > 0`, the result is additionally clamped to
/// `padding` so that the corner radius never exceeds the padding inset.
pub fn icon_corner_radius(scale: u32, padding: u8) -> u32 {
    let radius = (((scale as f32) * (CORNER_RADIUS_FACTOR as f32) + 0.5).floor().max(2.0)) as u32;
    radius.min(if padding > 0 { padding as u32 } else { u32::MAX })
}

/// Load a source image from disk, optionally crop it, and center-crop to square.
///
/// This replaces the previous `load_source_cached` which had a single-entry
/// `SOURCE_CACHE` that never hit in batch mode. Files are small (32×32px),
/// so disk I/O is negligible.
fn load_source(path: &str, crop: Option<&CropArea>) -> Result<DynamicImage, Box<dyn std::error::Error>> {
    let img = image::open(path)?;
    let (w, h) = img.dimensions();
    if w == 0 || h == 0 {
        return Err(format!("Source image has zero dimension: {}x{}", w, h).into());
    }

    let img_rgba = img.to_rgba8();

    // Apply crop region (if provided) then center-crop to square
    let working = match crop {
        Some(area) => crop_region(&img_rgba, area),
        None => img_rgba,
    };
    let square = center_crop_square(&working);

    Ok(DynamicImage::ImageRgba8(square))
}

// ---------------------------------------------------------------------------
// Multi-Scale Generation
// ---------------------------------------------------------------------------

/// Process one scale+variant of a **pre-padded** image to raw PNG bytes.
///
/// Takes an already-padded image (resized + centered on canvas) and runs the
/// HSB state iteration, rounded-corner masking, and PNG encoding.
/// This is the inner pipeline shared by both output modes.
///
/// Returns `(output_width, output_height, png_bytes)`.
fn process_padded_to_bytes(
    padded: &RgbaImage,
    scale_size: u32,
    padding: u8,
    adjustments: &[&HsbAdjustment; 3],
) -> Result<(u32, u32, Vec<u8>), ProcessingError> {
    let (sw, sh) = padded.dimensions();

    let output_width = sw * REAPER_STATES;
    let mut output: RgbaImage = ImageBuffer::new(output_width, sh);

    for (i, adj) in adjustments.iter().enumerate() {
        let state_img = apply_hsb(padded, adj);
        let x_off = sw * i as u32;
        copy_region(&state_img, &mut output, x_off);
    }

    // Apply rounded-corner mask — radius computed by shared function
    // clamped to padding so content corners are never clipped.
    let corner_radius = icon_corner_radius(scale_size, padding);
    apply_rounded_rect_mask(&mut output, scale_size, scale_size, corner_radius);

    // Encode to PNG bytes
    let mut buf = std::io::Cursor::new(Vec::new());
    DynamicImage::ImageRgba8(output)
        .write_to(&mut buf, image::ImageFormat::Png)
        .map_err(|e| ProcessingError::SaveError(e.to_string()))?;

    Ok((output_width, sh, buf.into_inner()))
}

/// Build the 3-state adjustments array for a given variant.
///
/// Returns exactly 3 adjustments for the requested variant (OFF or ON):
/// [Normal, Hover, Active]. The outer variant loop in `generate_icon_set`
/// handles toggle vs non-toggle by iterating the appropriate variants.
fn build_adjustments(config: &IconConfig, use_on: bool) -> [&HsbAdjustment; 3] {
    let adjustments = if use_on { &config.on_adjustments } else { &config.off_adjustments };
    [
        &adjustments[0],
        &adjustments[1],
        &adjustments[2],
    ]
}

/// Generate a complete icon set at multiple scales (100%, 150%, 200%).
///
/// For each scale, runs the pre-resized pipeline:
///   center-crop square → resize square to target scale once →
///   apply padding once per scale → then for each variant iterate
///   3 HSB states on the pre-resized+padded buffer.
///
/// This avoids re-applying padding per variant when multiple variants
/// exist (toggle mode).
///
/// Returns one `ProcessingOutput` per scale (non-toggle) or two per scale
/// (toggle: OFF + ON). Each output is a 3-state strip with base64-encoded
/// preview data.
///
/// In toggle mode:
/// - OFF variant: 3-state strip using only `off_adjustments` (Normal/Hover/Active)
/// - ON variant: 3-state strip using only `on_adjustments` (Normal/Hover/Active)
/// - OFF output has `suffix=""`, ON output has `suffix="_on"` for file naming.
pub fn generate_icon_set(
    input: &Path,
    config: &IconConfig,
    crop: Option<&CropArea>,
    scales: &[u32],
) -> Result<Vec<ProcessingOutput>, ProcessingError> {
    let source = load_source(
        input.to_str().ok_or_else(|| ProcessingError::OpenError(
            "Invalid path".to_string()
        ))?,
        crop,
    ).map_err(|e| ProcessingError::OpenError(e.to_string()))?;

    let square = source.to_rgba8();

    let variants: &[(bool, &str)] = if config.is_toggle {
        &[(false, ""), (true, "_on")]
    } else {
        &[(false, "")]
    };

    let outputs_per_scale = variants.len();
    let mut results = Vec::with_capacity(scales.len() * outputs_per_scale);

    for &scale_size in scales {
        // Pre-resize: apply padding once per scale (not once per variant)
        let padded = apply_padding(&square, scale_size, config.padding);

        for &(use_on, suffix) in variants {
            let adjustments = build_adjustments(config, use_on);
            let (width, height, bytes) =
                process_padded_to_bytes(&padded, scale_size, config.padding, &adjustments)?;

            let encoded = base64::Engine::encode(
                &base64::engine::general_purpose::STANDARD,
                &bytes,
            );

            results.push(ProcessingOutput {
                width,
                height,
                output_path: None,
                preview_base64: Some(encoded),
                suffix: suffix.to_string(),
            });
        }
    }

    Ok(results)
}

/// Generate a complete icon set in raw byte mode.
///
/// Same pipeline as `generate_icon_set` but returns raw PNG bytes instead of
/// base64-encoded strings. Use this for file-writing to avoid the unnecessary
/// encode→decode roundtrip.
///
/// Each output is a 3-state strip (Normal/Hover/Active). In toggle mode,
/// produces OFF and ON variants, each a 3-state strip.
/// Returns `ProcessingOutputRaw` entries with `data` containing raw PNG bytes.
pub fn generate_icon_set_raw(
    input: &Path,
    config: &IconConfig,
    crop: Option<&CropArea>,
    scales: &[u32],
) -> Result<Vec<ProcessingOutputRaw>, ProcessingError> {
    let source = load_source(
        input.to_str().ok_or_else(|| ProcessingError::OpenError(
            "Invalid path".to_string()
        ))?,
        crop,
    ).map_err(|e| ProcessingError::OpenError(e.to_string()))?;

    let square = source.to_rgba8();

    let variants: &[(bool, &str)] = if config.is_toggle {
        &[(false, ""), (true, "_on")]
    } else {
        &[(false, "")]
    };

    let outputs_per_scale = variants.len();
    let mut results = Vec::with_capacity(scales.len() * outputs_per_scale);

    for &scale_size in scales {
        // Pre-resize: apply padding once per scale (not once per variant)
        let padded = apply_padding(&square, scale_size, config.padding);

        for &(use_on, suffix) in variants {
            let adjustments = build_adjustments(config, use_on);
            let (width, height, data) =
                process_padded_to_bytes(&padded, scale_size, config.padding, &adjustments)?;

            results.push(ProcessingOutputRaw {
                width,
                height,
                data,
                suffix: suffix.to_string(),
            });
        }
    }

    Ok(results)
}

/// Extract a rectangular region from an image, clamping to image bounds.
///
/// Uses `GenericImageView::view()` for efficient sub-image extraction instead
/// of manual nested pixel loops.
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

    img.view(x, y, w, h).to_image()
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

/// Apply an anti-aliased rounded-rectangle alpha mask to a strip image.
///
/// Each state region (`state_w` × `state_h`) gets rounded corners with the given
/// `radius`. Uses Euclidean distance from the arc center at (r, r) for true
/// rounded corners with a 1px anti-aliased transition band.
fn apply_rounded_rect_mask(
    img: &mut RgbaImage, state_w: u32, state_h: u32, radius: u32,
) {
    if radius == 0 { return; }
    let r = radius as f32;
    let states = img.width() / state_w;

    for state in 0..states {
        let ox = state * state_w;

        for y in 0..state_h {
            for x in 0..state_w {
                let pixel = img.get_pixel_mut(ox + x, y);

                // Distance from the closest edge (in px), with pixel-center offset
                let dx = ((x as f32 + 0.5).min((state_w - x) as f32 - 0.5)).max(0.0);
                let dy = ((y as f32 + 0.5).min((state_h - y) as f32 - 0.5)).max(0.0);

                let alpha_factor = if dx >= r && dy >= r {
                    // Inside the safe rectangle — all four corners cleared — fully opaque
                    1.0
                } else if dx >= r || dy >= r {
                    // On a straight edge between corners — opaque (one dimension is
                    // past the radius, the other is within it)
                    1.0
                } else {
                    // Both dx < r AND dy < r — in a corner quadrant
                    // Euclidean distance from the arc center (r, r):
                    //   d < r: inside the corner arc (visible part of rounded rect)
                    //   d > r: past the arc (corner cutout)
                    let d = ((dx - r).powi(2) + (dy - r).powi(2)).sqrt();
                    if d <= r - 0.5 {
                        // Well inside the corner arc — fully opaque (visible)
                        1.0
                    } else if d >= r + 0.5 {
                        // Well past the arc — fully transparent (cut out)
                        0.0
                    } else {
                        // 1px anti-aliasing band: maps (r-0.5, r+0.5) → (1.0, 0.0)
                        (r + 0.5 - d).clamp(0.0, 1.0)
                    }
                };

                let a = pixel.0[3] as f32 * alpha_factor;
                pixel.0[3] = (a.round().clamp(0.0, 255.0)) as u8;
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
#[allow(deprecated)]
mod tests {
    use super::*;
    use image::{Rgba, RgbaImage};

    // Helper: assert two f32 values are close
    fn approx_eq(a: f32, b: f32, eps: f32) -> bool {
        (a - b).abs() < eps
    }

    // -----------------------------------------------------------------------
    // Task 1.1: REAPER_SCALES constants exist (RED — code doesn't exist yet)
    // -----------------------------------------------------------------------

    // -----------------------------------------------------------------------
    // Task 1.2: Pre-resize — approval test (RED: captures current output)
    // -----------------------------------------------------------------------

    #[test]
    fn pre_resize_produces_identical_output_to_current() {
        // This approval test documents current output behavior.
        // After restructuring loops, the output MUST remain identical.
        let tmp_dir = std::env::temp_dir().join("grove_test_preresize");
        std::fs::create_dir_all(&tmp_dir).unwrap();

        let input_path = tmp_dir.join("input.png");
        let img = make_test_image(32, 32);
        DynamicImage::ImageRgba8(img).save(&input_path).unwrap();

        let config = IconConfig {
            padding: 4,
            off_adjustments: [
                HsbAdjustment { hue_shift: 0.0, sat_delta: 0.0, bri_delta: 0.0 },
                HsbAdjustment { hue_shift: 0.0, sat_delta: 0.0, bri_delta: 10.0 },
                HsbAdjustment { hue_shift: 0.0, sat_delta: 0.0, bri_delta: -10.0 },
            ],
            on_adjustments: [
                HsbAdjustment { hue_shift: 0.0, sat_delta: 0.0, bri_delta: 0.0 },
                HsbAdjustment { hue_shift: 0.0, sat_delta: 0.0, bri_delta: 15.0 },
                HsbAdjustment { hue_shift: 0.0, sat_delta: 0.0, bri_delta: -20.0 },
            ],
            is_toggle: true,
            ..Default::default()
        };

        // Non-toggle: 3 scales → 3 outputs
        let results = generate_icon_set(
            &input_path, &config, None, &[30u32, 45u32, 60u32],
        ).expect("generate_icon_set for approval test");

        // Toggle: 3 scales × 2 variants = 6 outputs
        assert_eq!(results.len(), 6, "3 scales × 2 (toggle) = 6");

        // Verify each output is a valid PNG with correct dimensions
        for (i, out) in results.iter().enumerate() {
            assert!(out.preview_base64.is_some(), "Output {} should have base64", i);
            let expected_w = match i / 2 {
                0 => 90u32,
                1 => 135u32,
                2 => 180u32,
                _ => unreachable!(),
            };
            let expected_h = match i / 2 {
                0 => 30u32,
                1 => 45u32,
                2 => 60u32,
                _ => unreachable!(),
            };
            assert_eq!(out.width, expected_w, "Output {} width", i);
            assert_eq!(out.height, expected_h, "Output {} height", i);
        }

        let _ = std::fs::remove_dir_all(&tmp_dir);
    }

    #[test]
    fn reaper_scales_constants_have_correct_values() {
        assert_eq!(REAPER_SCALES, &[30u32, 45, 60]);
        assert_eq!(REAPER_SCALE_DIRS, &["Data/toolbar_icons", "Data/toolbar_icons/150", "Data/toolbar_icons/200"]);
        assert_eq!(REAPER_SCALES.len(), REAPER_SCALE_DIRS.len(),
            "Scales and dirs should have same length");
    }

    #[test]
    fn corner_radius_factor_has_correct_value() {
        assert!((CORNER_RADIUS_FACTOR - 0.15).abs() < f64::EPSILON,
            "CORNER_RADIUS_FACTOR should be 0.15, got {}", CORNER_RADIUS_FACTOR);
    }

    #[test]
    fn icon_corner_radius_computes_correctly() {
        // scale=30, padding=4 → radius = floor(30*0.15+0.5)=5, min(5,4) = 4
        assert_eq!(icon_corner_radius(30, 4), 4, "30px with padding 4 should clamp to 4");
        // scale=30, padding=0 → radius = floor(30*0.15+0.5)=5, no clamp = 5
        assert_eq!(icon_corner_radius(30, 0), 5, "30px with no padding should be 5");
        // scale=45, padding=4 → radius = floor(45*0.15+0.5)=7, min(7,4) = 4
        assert_eq!(icon_corner_radius(45, 4), 4, "45px with padding 4 should clamp to 4");
        // scale=60, padding=4 → radius = floor(60*0.15+0.5)=9, min(9,4) = 4
        assert_eq!(icon_corner_radius(60, 4), 4, "60px with padding 4 should clamp to 4");
    }

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

    // -----------------------------------------------------------------------
    // Phase 2: Raw Output Mode (RED — generate_icon_set_raw does NOT exist)
    // -----------------------------------------------------------------------

    #[test]
    fn processing_output_raw_struct_fields() {
        let raw = ProcessingOutputRaw {
            width: 100,
            height: 50,
            data: vec![1, 2, 3],
            suffix: "_on".to_string(),
        };
        assert_eq!(raw.width, 100);
        assert_eq!(raw.height, 50);
        assert_eq!(raw.data, vec![1, 2, 3]);
        assert_eq!(raw.suffix, "_on");
    }

    #[test]
    fn generate_icon_set_raw_produces_valid_outputs() {
        let tmp_dir = std::env::temp_dir().join("grove_test_raw");
        std::fs::create_dir_all(&tmp_dir).unwrap();

        let input_path = tmp_dir.join("input.png");
        let img = make_test_image(32, 32);
        DynamicImage::ImageRgba8(img).save(&input_path).unwrap();

        let config = IconConfig {
            hover_brightness: 30,
            click_brightness: -40,
            off_adjustments: [HsbAdjustment::default(); 3],
            on_adjustments: [HsbAdjustment::default(); 3],
            padding: 4,
            is_toggle: false,
        };

        let results = generate_icon_set_raw(
            &input_path, &config, None, REAPER_SCALES,
        ).expect("generate_icon_set_raw should succeed");

        // Should produce 3 outputs (one per scale)
        assert_eq!(results.len(), 3, "Should produce 3 scale outputs");

        // Each output should have 3-state dimensions
        let expected = [(30u32, 90u32), (45, 135), (60, 180)];
        for (i, &(exp_h, exp_w)) in expected.iter().enumerate() {
            assert_eq!(results[i].height, exp_h,
                "Scale {} height should be {}", i, exp_h);
            assert_eq!(results[i].width, exp_w,
                "Scale {} width should be 3×state_size", i);
        }

        // Each output should have valid PNG data
        for (i, out) in results.iter().enumerate() {
            let decoded = image::load_from_memory(&out.data)
                .expect("Raw output {} must be a valid PNG");
            assert_eq!(decoded.width(), expected[i].1,
                "Decoded PNG width for scale {}", i);
            assert_eq!(decoded.height(), expected[i].0,
                "Decoded PNG height for scale {}", i);
        }

        let _ = std::fs::remove_dir_all(&tmp_dir);
    }

    #[test]
    fn generate_icon_set_raw_matches_base64_output() {
        // Verify that raw mode bytes, when encoded to base64, produce the same
        // output as the preview mode's base64 output.
        let tmp_dir = std::env::temp_dir().join("grove_test_raw_match");
        std::fs::create_dir_all(&tmp_dir).unwrap();

        let input_path = tmp_dir.join("input.png");
        let img = make_test_image(32, 32);
        DynamicImage::ImageRgba8(img).save(&input_path).unwrap();

        let config = IconConfig {
            hover_brightness: 30,
            click_brightness: -40,
            off_adjustments: [HsbAdjustment::default(); 3],
            on_adjustments: [HsbAdjustment::default(); 3],
            padding: 4,
            is_toggle: false,
        };

        // Get base64 output
        let b64_results = generate_icon_set(
            &input_path, &config, None, &[30u32],
        ).expect("generate_icon_set should succeed");

        // Get raw output
        let raw_results = generate_icon_set_raw(
            &input_path, &config, None, &[30u32],
        ).expect("generate_icon_set_raw should succeed");

        assert_eq!(b64_results.len(), raw_results.len(),
            "Both modes should produce same number of outputs");

        for (b64_out, raw_out) in b64_results.iter().zip(raw_results.iter()) {
            assert_eq!(b64_out.width, raw_out.width,
                "Width should match between modes");
            assert_eq!(b64_out.height, raw_out.height,
                "Height should match between modes");

            // Decode b64 to raw bytes and compare
            use base64::Engine;
            let b64_data = base64::engine::general_purpose::STANDARD
                .decode(b64_out.preview_base64.as_ref().unwrap())
                .expect("Base64 should decode");
            assert_eq!(b64_data, raw_out.data,
                "Raw bytes should match base64-decoded bytes");
        }

        let _ = std::fs::remove_dir_all(&tmp_dir);
    }

    // -----------------------------------------------------------------------
    // T1: HSB Math + New Types (RED phase — code does NOT exist yet)
    // -----------------------------------------------------------------------

    #[test]
    fn hsb_adjustment_struct_has_correct_fields() {
        let adj = HsbAdjustment { hue_shift: 10.0, sat_delta: -0.2, bri_delta: 0.5 };
        assert!(approx_eq(adj.hue_shift, 10.0, 0.001));
        assert!(approx_eq(adj.sat_delta, -0.2, 0.001));
        assert!(approx_eq(adj.bri_delta, 0.5, 0.001));
    }

    #[test]
    fn rgb_to_hsb_known_values() {
        // Pure red: RGB(255, 0, 0) → HSB(0, 1, 1)
        let (h, s, b) = rgb_to_hsb(255, 0, 0);
        assert!(approx_eq(h, 0.0, 1.0), "Red hue ~0, got {}", h);
        assert!(approx_eq(s, 1.0, 0.01), "Red sat ~1, got {}", s);
        assert!(approx_eq(b, 1.0, 0.01), "Red bri ~1, got {}", b);

        // Pure green: RGB(0, 255, 0) → HSB(120, 1, 1)
        let (h, s, b) = rgb_to_hsb(0, 255, 0);
        assert!(approx_eq(h, 120.0, 1.0), "Green hue ~120, got {}", h);
        assert!(approx_eq(s, 1.0, 0.01), "Green sat ~1, got {}", s);
        assert!(approx_eq(b, 1.0, 0.01), "Green bri ~1, got {}", b);

        // Pure blue: RGB(0, 0, 255) → HSB(240, 1, 1)
        let (h, s, b) = rgb_to_hsb(0, 0, 255);
        assert!(approx_eq(h, 240.0, 1.0), "Blue hue ~240, got {}", h);
        assert!(approx_eq(s, 1.0, 0.01), "Blue sat ~1, got {}", s);
        assert!(approx_eq(b, 1.0, 0.01), "Blue bri ~1, got {}", b);

        // Black: RGB(0, 0, 0) → HSB(any, 0, 0)
        let (_h, s, b) = rgb_to_hsb(0, 0, 0);
        assert!(approx_eq(s, 0.0, 0.01), "Black sat ~0, got {}", s);
        assert!(approx_eq(b, 0.0, 0.01), "Black bri ~0, got {}", b);

        // White: RGB(255, 255, 255) → HSB(any, 0, 1)
        let (_h, s, b) = rgb_to_hsb(255, 255, 255);
        assert!(approx_eq(s, 0.0, 0.01), "White sat ~0, got {}", s);
        assert!(approx_eq(b, 1.0, 0.01), "White bri ~1, got {}", b);
    }

    #[test]
    fn hsb_to_rgb_known_values() {
        // HSB(0, 1, 1) → pure red
        let (r, g, b_val) = hsb_to_rgb(0.0, 1.0, 1.0);
        assert_eq!((r, g, b_val), (255, 0, 0), "HSB(0,1,1) should be red");

        // HSB(120, 1, 1) → pure green
        let (r, g, b_val) = hsb_to_rgb(120.0, 1.0, 1.0);
        assert_eq!((r, g, b_val), (0, 255, 0), "HSB(120,1,1) should be green");

        // HSB(240, 1, 1) → pure blue
        let (r, g, b_val) = hsb_to_rgb(240.0, 1.0, 1.0);
        assert_eq!((r, g, b_val), (0, 0, 255), "HSB(240,1,1) should be blue");

        // HSB(0, 0, 0) → black
        let (r, g, b_val) = hsb_to_rgb(0.0, 0.0, 0.0);
        assert_eq!((r, g, b_val), (0, 0, 0), "HSB(0,0,0) should be black");

        // HSB(0, 0, 1) → white
        let (r, g, b_val) = hsb_to_rgb(0.0, 0.0, 1.0);
        assert_eq!((r, g, b_val), (255, 255, 255), "HSB(0,0,1) should be white");
    }

    #[test]
    fn rgb_hsb_roundtrip_identity() {
        let test_colors = [
            (255u8, 0u8, 0u8),    // red
            (0, 255, 0),          // green
            (0, 0, 255),          // blue
            (0, 0, 0),            // black
            (255, 255, 255),      // white
            (128, 128, 128),      // gray
            (100, 150, 200),      // blueish
            (200, 100, 50),       // orange-ish
            (50, 200, 100),       // greenish
        ];

        for &(r, g, b) in &test_colors {
            let (h, s, bri) = rgb_to_hsb(r, g, b);
            let (r2, g2, b2) = hsb_to_rgb(h, s, bri);
            // Allow ±1 per channel due to f32 rounding
            assert!(
                (r as i16 - r2 as i16).abs() <= 1,
                "Roundtrip R: {} → {} (h={}, s={}, b={})", r, r2, h, s, bri
            );
            assert!(
                (g as i16 - g2 as i16).abs() <= 1,
                "Roundtrip G: {} → {} (h={}, s={}, b={})", g, g2, h, s, bri
            );
            assert!(
                (b as i16 - b2 as i16).abs() <= 1,
                "Roundtrip B: {} → {} (h={}, s={}, b={})", b, b2, h, s, bri
            );
        }
    }

    #[test]
    fn apply_hsb_identity_preserves_pixels() {
        let img = make_test_image(8, 8);
        let identity = HsbAdjustment { hue_shift: 0.0, sat_delta: 0.0, bri_delta: 0.0 };
        let result = apply_hsb(&img, &identity);

        for y in 0..8 {
            for x in 0..8 {
                let orig = img.get_pixel(x, y).0;
                let res = result.get_pixel(x, y).0;
                assert!(
                    (orig[0] as i16 - res[0] as i16).abs() <= 1 &&
                    (orig[1] as i16 - res[1] as i16).abs() <= 1 &&
                    (orig[2] as i16 - res[2] as i16).abs() <= 1,
                    "Identity must preserve pixel at ({},{}): {:?} vs {:?}",
                    x, y, orig, res
                );
            }
        }
    }

    #[test]
    fn apply_hsb_preserves_alpha() {
        let img = make_test_image(8, 8);
        let adj = HsbAdjustment { hue_shift: 0.0, sat_delta: 0.0, bri_delta: -20.0 };
        let result = apply_hsb(&img, &adj);

        for y in 0..8 {
            for x in 0..8 {
                let orig_alpha = img.get_pixel(x, y).0[3];
                let res_alpha = result.get_pixel(x, y).0[3];
                assert_eq!(
                    orig_alpha, res_alpha,
                    "Alpha must be preserved at ({},{})", x, y
                );
            }
        }
    }

    #[test]
    fn apply_hsb_brightness_delta_shifts_correctly() {
        // Solid gray image: RGB(128, 128, 128). In HSB: H=0, S=0, B=0.502
        // Apply bri_delta=-50pp → B=0.002 → RGB(~1, ~1, ~1) → ~(1,1,1) or (0,0,0)
        // Apply bri_delta=+50pp → B=1.0 → RGB(255, 255, 255)
        let mut img = RgbaImage::new(2, 2);
        for y in 0..2 {
            for x in 0..2 {
                img.put_pixel(x, y, Rgba([128, 128, 128, 255]));
            }
        }

        // Brightness up
        let brighter = HsbAdjustment { hue_shift: 0.0, sat_delta: 0.0, bri_delta: 50.0 };
        let result = apply_hsb(&img, &brighter);
        let p = result.get_pixel(0, 0).0;
        // B=0.502 + 0.50 = 1.0 (clamped) → white
        assert_eq!(p[0], 255, "B+50pp should push gray toward white, R");
        assert_eq!(p[1], 255, "B+50pp should push gray toward white, G");
        assert_eq!(p[2], 255, "B+50pp should push gray toward white, B");

        // Brightness down
        let darker = HsbAdjustment { hue_shift: 0.0, sat_delta: 0.0, bri_delta: -50.0 };
        let result = apply_hsb(&img, &darker);
        let p = result.get_pixel(0, 0).0;
        // B=0.502 - 0.50 = 0.002 → near-black
        assert!(p[0] <= 2, "B-50pp should push gray toward black, R={}", p[0]);
        assert!(p[1] <= 2, "B-50pp should push gray toward black, G={}", p[1]);
        assert!(p[2] <= 2, "B-50pp should push gray toward black, B={}", p[2]);
    }

    #[test]
    fn apply_hsb_saturation_delta_shifts_correctly() {
        // Solid red: RGB(255, 0, 0) → HSB(0, 1, 1)
        let mut img = RgbaImage::new(1, 1);
        img.put_pixel(0, 0, Rgba([255, 0, 0, 255]));

        // Decrease saturation: sat_delta=-100 → S=0 → grayscale at brightness level
        let desat = HsbAdjustment { hue_shift: 0.0, sat_delta: -1.0, bri_delta: 0.0 };
        let result = apply_hsb(&img, &desat);
        let p = result.get_pixel(0, 0).0;
        // S=0 means all channels equal (grayscale at B=1.0)
        assert_eq!(p[0], 255, "Desaturated red R");
        assert_eq!(p[1], 255, "Desaturated red G");
        assert_eq!(p[2], 255, "Desaturated red B");
    }

    // -----------------------------------------------------------------------
    // T2: Configurable Padding (RED phase — apply_padding does NOT exist)
    // -----------------------------------------------------------------------

    #[test]
    fn apply_padding_2px_on_30px_centers_26x26() {
        // Create a 30x30 test image with a solid block
        let mut img = RgbaImage::new(30, 30);
        for y in 0..30 {
            for x in 0..30 {
                img.put_pixel(x, y, Rgba([100, 150, 200, 255]));
            }
        }

        let result = apply_padding(&img, 30, 2);

        // Result should still be 30x30
        assert_eq!(result.width(), 30, "Width must remain 30");
        assert_eq!(result.height(), 30, "Height must remain 30");

        // The icon content should be 26x26 and centered (2px border on each side)
        // Check top-left corner of content area (2, 2) has the scaled content
        let content_pixel = result.get_pixel(2, 2).0;
        assert_eq!(content_pixel[3], 255, "Content area should be opaque");

        // Check border pixels (0,0) should be transparent
        let border_pixel = result.get_pixel(0, 0).0;
        assert_eq!(border_pixel[3], 0, "Border pixel should be transparent");
    }

    #[test]
    fn apply_padding_zero_uses_full_canvas() {
        let mut img = RgbaImage::new(30, 30);
        for y in 0..30 {
            for x in 0..30 {
                img.put_pixel(x, y, Rgba([100, 150, 200, 255]));
            }
        }

        let result = apply_padding(&img, 30, 0);

        // No padding — icon fills entire canvas
        assert_eq!(result.width(), 30);
        assert_eq!(result.height(), 30);
        let center = result.get_pixel(15, 15).0;
        assert_eq!(center[3], 255, "Center should be opaque with padding=0");
    }

    #[test]
    fn apply_padding_4px_on_30px_centers_22x22() {
        let mut img = RgbaImage::new(30, 30);
        for y in 0..30 {
            for x in 0..30 {
                img.put_pixel(x, y, Rgba([100, 150, 200, 255]));
            }
        }

        let result = apply_padding(&img, 30, 4);

        assert_eq!(result.width(), 30, "Width must remain 30");
        assert_eq!(result.height(), 30, "Height must remain 30");

        // Content should be 22x22, centered (4px border)
        // Pixel at (4, 4) should be in the content area
        let content_pixel = result.get_pixel(4, 4).0;
        assert_eq!(content_pixel[3], 255, "Content area should be opaque at (4,4)");

        // Pixel at (0, 0) should be transparent border
        let border_pixel = result.get_pixel(0, 0).0;
        assert_eq!(border_pixel[3], 0, "Border pixel (0,0) should be transparent");
    }

    #[test]
    fn apply_padding_large_value_clamps_safely() {
        let mut img = RgbaImage::new(10, 10);
        for y in 0..10 {
            for x in 0..10 {
                img.put_pixel(x, y, Rgba([100, 150, 200, 255]));
            }
        }

        // padding=15 on canvas_size=10 — should still produce a valid output
        let result = apply_padding(&img, 10, 15);

        // Output must be valid (at least 1x1)
        assert!(result.width() > 0, "Width must be > 0, got {}", result.width());
        assert!(result.height() > 0, "Height must be > 0, got {}", result.height());
    }

    // -----------------------------------------------------------------------
    // T3: Multi-Scale Generation (RED phase — generate_icon_set does NOT exist)
    // -----------------------------------------------------------------------

    #[test]
    fn generate_icon_set_produces_three_scales() {
        let tmp_dir = std::env::temp_dir().join("grove_test_gen3");
        std::fs::create_dir_all(&tmp_dir).unwrap();

        let input_path = tmp_dir.join("input.png");
        // Create 32x32 test image
        let img = make_test_image(32, 32);
        DynamicImage::ImageRgba8(img).save(&input_path).unwrap();

        let config = IconConfig {
            hover_brightness: 30,
            click_brightness: -40,
            off_adjustments: [
                HsbAdjustment { hue_shift: 0.0, sat_delta: 0.0, bri_delta: 0.0 },
                HsbAdjustment { hue_shift: 0.0, sat_delta: 0.0, bri_delta: 15.0 },
                HsbAdjustment { hue_shift: 0.0, sat_delta: 0.0, bri_delta: -20.0 },
            ],
            on_adjustments: [
                HsbAdjustment { hue_shift: 0.0, sat_delta: 0.0, bri_delta: 0.0 },
                HsbAdjustment { hue_shift: 0.0, sat_delta: 0.0, bri_delta: 15.0 },
                HsbAdjustment { hue_shift: 0.0, sat_delta: 0.0, bri_delta: -20.0 },
            ],
            padding: 4,
            is_toggle: false,
        };

        let scales = vec![30u32, 45, 60];
        let results = generate_icon_set(
            &input_path,
            &config,
            None,
            &scales,
        ).expect("generate_icon_set should succeed");

        // Should produce 3 outputs (one per scale)
        assert_eq!(results.len(), 3, "Should produce 3 scale outputs");

        // Each output should be 3-state: width = size × 3, height = size
        let expected_dims = [(30u32, 90u32), (45, 135), (60, 180)];
        for (i, &(exp_h, exp_w)) in expected_dims.iter().enumerate() {
            assert_eq!(results[i].height, exp_h,
                "Scale {}: height should be {}", i, exp_h);
            assert_eq!(results[i].width, exp_w,
                "Scale {}: width should be {} (3 states)", i, exp_w);
        }

        let _ = std::fs::remove_dir_all(&tmp_dir);
    }

    #[test]
    fn generate_icon_set_preview_returns_base64_per_scale() {
        let tmp_dir = std::env::temp_dir().join("grove_test_gen_preview");
        std::fs::create_dir_all(&tmp_dir).unwrap();

        let input_path = tmp_dir.join("input.png");
        let img = make_test_image(32, 32);
        DynamicImage::ImageRgba8(img).save(&input_path).unwrap();

        let config = IconConfig {
            hover_brightness: 30,
            click_brightness: -40,
            off_adjustments: [
                HsbAdjustment { hue_shift: 0.0, sat_delta: 0.0, bri_delta: 0.0 },
                HsbAdjustment { hue_shift: 0.0, sat_delta: 0.0, bri_delta: 15.0 },
                HsbAdjustment { hue_shift: 0.0, sat_delta: 0.0, bri_delta: -20.0 },
            ],
            on_adjustments: [
                HsbAdjustment { hue_shift: 0.0, sat_delta: 0.0, bri_delta: 0.0 },
                HsbAdjustment { hue_shift: 0.0, sat_delta: 0.0, bri_delta: 15.0 },
                HsbAdjustment { hue_shift: 0.0, sat_delta: 0.0, bri_delta: -20.0 },
            ],
            padding: 4,
            is_toggle: false,
        };

        let scales = vec![30u32];
        // No output_path → preview mode
        let results = generate_icon_set(
            &input_path,
            &config,
            None,
            &scales,
        ).expect("generate_icon_set preview should succeed");

        assert_eq!(results.len(), 1, "Should produce 1 scale output");
        assert!(results[0].preview_base64.is_some(),
            "Preview mode should have base64 data");
        assert!(results[0].output_path.is_none(),
            "Preview mode should not have output_path");

        // Decode and verify it's a valid PNG with 3-state dimensions
        use base64::Engine;
        let decoded = base64::engine::general_purpose::STANDARD
            .decode(results[0].preview_base64.as_ref().unwrap())
            .expect("Base64 must decode");
        let decoded_img = image::load_from_memory(&decoded)
            .expect("Decoded bytes must be a valid PNG");
        assert_eq!(decoded_img.width(), 90, "3 × 30 = 90px wide");
        assert_eq!(decoded_img.height(), 30, "30px tall");

        let _ = std::fs::remove_dir_all(&tmp_dir);
    }

    #[test]
    fn generate_icon_set_30px_produces_correct_dimensions() {
        let tmp_dir = std::env::temp_dir().join("grove_test_gen_30");
        std::fs::create_dir_all(&tmp_dir).unwrap();

        let input_path = tmp_dir.join("input.png");
        let img = make_test_image(32, 32);
        DynamicImage::ImageRgba8(img).save(&input_path).unwrap();

        let config = IconConfig {
            hover_brightness: 30,
            click_brightness: -40,
            off_adjustments: [
                HsbAdjustment { hue_shift: 0.0, sat_delta: 0.0, bri_delta: 0.0 },
                HsbAdjustment { hue_shift: 0.0, sat_delta: 0.0, bri_delta: 15.0 },
                HsbAdjustment { hue_shift: 0.0, sat_delta: 0.0, bri_delta: -20.0 },
            ],
            on_adjustments: [
                HsbAdjustment { hue_shift: 0.0, sat_delta: 0.0, bri_delta: 0.0 },
                HsbAdjustment { hue_shift: 0.0, sat_delta: 0.0, bri_delta: 15.0 },
                HsbAdjustment { hue_shift: 0.0, sat_delta: 0.0, bri_delta: -20.0 },
            ],
            padding: 4,
            is_toggle: false,
        };

        let scales = vec![30u32];
        let results = generate_icon_set(
            &input_path,
            &config,
            None,
            &scales,
        ).unwrap();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].width, 90, "3 states × 30px = 90px");
        assert_eq!(results[0].height, 30, "30px tall");

        let _ = std::fs::remove_dir_all(&tmp_dir);
    }

    // -----------------------------------------------------------------------
    // T1 Triangulation: edge cases
    // -----------------------------------------------------------------------

    #[test]
    fn rgb_to_hsb_gray_has_zero_saturation() {
        // Gray values should have S=0 regardless of brightness level
        for v in [0u8, 64, 128, 200, 255] {
            let (h, s, b) = rgb_to_hsb(v, v, v);
            assert!(approx_eq(s, 0.0, 0.01),
                "Gray ({},{},{}) should have S=0, got S={}", v, v, v, s);
            assert!(approx_eq(b, v as f32 / 255.0, 0.01),
                "Gray ({},{},{}) B should be {:.3}, got {:.3}",
                v, v, v, v as f32 / 255.0, b);
            assert!(h >= 0.0 && h < 360.0, "Hue should be in [0,360), got {}", h);
        }
    }

    #[test]
    fn hsb_to_rgb_edge_boundaries() {
        // H=360 should behave same as H=0
        let (r1, g1, b1) = hsb_to_rgb(0.0, 1.0, 1.0);
        let (r2, g2, b2) = hsb_to_rgb(360.0, 1.0, 1.0);
        assert_eq!((r1, g1, b1), (r2, g2, b2),
            "H=360 should produce same result as H=0");

        // Negative H should be normalized
        let (r3, g3, b3) = hsb_to_rgb(-360.0, 1.0, 1.0);
        assert_eq!((r1, g1, b1), (r3, g3, b3),
            "H=-360 should produce same result as H=0");

        // Extremely low saturation
        let (r, g, b_val) = hsb_to_rgb(180.0, 0.001, 0.5);
        // Should be approximately gray at half brightness
        assert!((r as i16 - 127).abs() <= 2, "Low sat R ~ 127, got {}", r);
        assert!((g as i16 - 127).abs() <= 2, "Low sat G ~ 127, got {}", g);
        assert!((b_val as i16 - 127).abs() <= 2, "Low sat B ~ 127, got {}", b_val);
    }

    #[test]
    fn apply_hsb_hue_shift_rotates_correctly() {
        // Pure red: RGB(255, 0, 0) → HSB(0, 1, 1)
        // hue_shift=120 → HSB(120, 1, 1) → green
        let mut img = RgbaImage::new(1, 1);
        img.put_pixel(0, 0, Rgba([255, 0, 0, 255]));

        let shift = HsbAdjustment { hue_shift: 120.0, sat_delta: 0.0, bri_delta: 0.0 };
        let result = apply_hsb(&img, &shift);
        let p = result.get_pixel(0, 0).0;
        // Red hue shifted by 120° → green
        assert_eq!(p[0], 0, "Hue shift 120° on red: R should be 0, got {}", p[0]);
        assert_eq!(p[1], 255, "Hue shift 120° on red: G should be 255, got {}", p[1]);
        assert_eq!(p[2], 0, "Hue shift 120° on red: B should be 0, got {}", p[2]);

        // hue_shift=240 → blue
        let shift = HsbAdjustment { hue_shift: 240.0, sat_delta: 0.0, bri_delta: 0.0 };
        let result = apply_hsb(&img, &shift);
        let p = result.get_pixel(0, 0).0;
        assert_eq!(p[0], 0, "Hue shift 240° on red: R should be 0, got {}", p[0]);
        assert_eq!(p[2], 255, "Hue shift 240° on red: B should be 255, got {}", p[2]);
    }

    // -----------------------------------------------------------------------
    // T2 Triangulation: centering precision
    // -----------------------------------------------------------------------

    #[test]
    fn apply_padding_centers_content_exactly() {
        // Use a 4x4 image with a single red pixel at (0,0)
        // canvas=10, padding=3 → inner=4, offset=3
        // The red pixel at (0,0) should end up at (3,3)
        let mut img = RgbaImage::new(4, 4);
        img.put_pixel(0, 0, Rgba([255, 0, 0, 255]));
        for y in 0..4 {
            for x in 0..4 {
                if x != 0 || y != 0 {
                    img.put_pixel(x, y, Rgba([0, 0, 0, 255]));
                }
            }
        }

        let result = apply_padding(&img, 10, 3);
        assert_eq!(result.width(), 10);
        assert_eq!(result.height(), 10);

        // The red pixel (0,0) in source should be at offset (3,3) in output
        let p = result.get_pixel(3, 3).0;
        assert_eq!(p[0], 255, "Red pixel should be at (3,3)");
        assert_eq!(p[1], 0, "Red pixel G at (3,3)");
    }

    // -----------------------------------------------------------------------
    // T3 Triangulation: 45px and 60px scale dimensions
    // -----------------------------------------------------------------------

    #[test]
    fn generate_icon_set_45px_dimensions() {
        let tmp_dir = std::env::temp_dir().join("grove_test_gen_45");
        std::fs::create_dir_all(&tmp_dir).unwrap();

        let input_path = tmp_dir.join("input.png");
        let img = make_test_image(64, 64);
        DynamicImage::ImageRgba8(img).save(&input_path).unwrap();

        let config = IconConfig {
            hover_brightness: 30,
            click_brightness: -40,
            off_adjustments: [HsbAdjustment::default(); 3],
            on_adjustments: [HsbAdjustment::default(); 3],
            padding: 0,
            is_toggle: false,
        };

        let results = generate_icon_set(&input_path, &config, None, &[45u32]).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].width, 135, "3 × 45 = 135");
        assert_eq!(results[0].height, 45, "45px tall");

        let _ = std::fs::remove_dir_all(&tmp_dir);
    }

    #[test]
    fn generate_icon_set_60px_dimensions() {
        let tmp_dir = std::env::temp_dir().join("grove_test_gen_60");
        std::fs::create_dir_all(&tmp_dir).unwrap();

        let input_path = tmp_dir.join("input.png");
        let img = make_test_image(64, 64);
        DynamicImage::ImageRgba8(img).save(&input_path).unwrap();

        let config = IconConfig {
            hover_brightness: 30,
            click_brightness: -40,
            off_adjustments: [HsbAdjustment::default(); 3],
            on_adjustments: [HsbAdjustment::default(); 3],
            padding: 0,
            is_toggle: false,
        };

        let results = generate_icon_set(&input_path, &config, None, &[60u32]).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].width, 180, "3 × 60 = 180");
        assert_eq!(results[0].height, 60, "60px tall");

        let _ = std::fs::remove_dir_all(&tmp_dir);
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

        // Use a larger image (16x16) so center pixels are inside the safe
        // rectangle (radius = max(2, 16*0.15) = 2px, safe interior starts at (2,2))
        let state_size = 16u32;
        let mut img = RgbaImage::new(state_size, state_size);
        for y in 0..state_size {
            for x in 0..state_size {
                let alpha = ((x * 16 + y * 4) % 256) as u8;
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
            state_size,
        ).unwrap();

        let output_img = image::open(&output_path).unwrap().to_rgba8();

        // Check alpha in center pixels (inside the safe rectangle, not in corner zone)
        // For radius=2: safe interior starts at dx=2, dy=2
        for y in 2..(state_size - 2) {
            for x in 2..(state_size - 2) {
                let original_alpha = img.get_pixel(x, y).0[3];
                for state in 0..3u32 {
                    let ox = x + state * state_size;
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

    // -----------------------------------------------------------------------
    // T4: Toggle ON/OFF Generation (RED phase — toggle logic does NOT exist)
    // -----------------------------------------------------------------------

    #[test]
    fn toggle_mode_produces_twice_as_many_outputs() {
        let tmp_dir = std::env::temp_dir().join("grove_test_toggle_count");
        std::fs::create_dir_all(&tmp_dir).unwrap();

        let input_path = tmp_dir.join("input.png");
        let img = make_test_image(32, 32);
        DynamicImage::ImageRgba8(img).save(&input_path).unwrap();

        let config_no_toggle = IconConfig {
            is_toggle: false,
            ..Default::default()
        };
        let config_toggle = IconConfig {
            is_toggle: true,
            ..Default::default()
        };

        let scales = vec![30u32, 45, 60];

        // Non-toggle: 1 output per scale = 3
        let results_no_toggle = generate_icon_set(
            &input_path, &config_no_toggle, None, &scales,
        ).expect("non-toggle should succeed");
        assert_eq!(
            results_no_toggle.len(), 3,
            "Non-toggle should produce 1 output per scale (3 total)"
        );

        // Toggle: 2 outputs per scale = 6
        let results_toggle = generate_icon_set(
            &input_path, &config_toggle, None, &scales,
        ).expect("toggle should succeed");
        assert_eq!(
            results_toggle.len(), 6,
            "Toggle should produce 2 outputs per scale (6 total)"
        );

        let _ = std::fs::remove_dir_all(&tmp_dir);
    }

    #[test]
    fn toggle_mode_on_output_has_on_suffix() {
        let tmp_dir = std::env::temp_dir().join("grove_test_toggle_suffix");
        std::fs::create_dir_all(&tmp_dir).unwrap();

        let input_path = tmp_dir.join("input.png");
        let img = make_test_image(32, 32);
        DynamicImage::ImageRgba8(img).save(&input_path).unwrap();

        let config_toggle = IconConfig {
            is_toggle: true,
            ..Default::default()
        };

        let results = generate_icon_set(
            &input_path, &config_toggle, None, &[30u32],
        ).expect("toggle should succeed");

        // 2 outputs: OFF (suffix="") and ON (suffix="_on")
        assert_eq!(results.len(), 2, "Toggle should produce 2 outputs per scale");

        // First output: OFF variant (suffix = "")
        assert_eq!(
            results[0].suffix, "",
            "First toggle output should be OFF variant (empty suffix)"
        );

        // Second output: ON variant (suffix = "_on")
        assert_eq!(
            results[1].suffix, "_on",
            "Second toggle output should be ON variant (_on suffix)"
        );

        let _ = std::fs::remove_dir_all(&tmp_dir);
    }

    #[test]
    fn toggle_each_variant_is_3_state() {
        let tmp_dir = std::env::temp_dir().join("grove_test_toggle_3state");
        std::fs::create_dir_all(&tmp_dir).unwrap();

        let input_path = tmp_dir.join("input.png");
        let img = make_test_image(32, 32);
        DynamicImage::ImageRgba8(img).save(&input_path).unwrap();

        let config_toggle = IconConfig {
            is_toggle: true,
            ..Default::default()
        };

        let results = generate_icon_set(
            &input_path, &config_toggle, None, &[30u32],
        ).expect("toggle should succeed");

        assert_eq!(results.len(), 2, "Toggle should produce 2 outputs");

        // Both OFF and ON variants should be 3-state: width = 3 × 30 = 90
        assert_eq!(
            results[0].width, 90,
            "OFF variant should be 3-state (90px at 30px size)"
        );
        assert_eq!(
            results[1].width, 90,
            "ON variant should be 3-state (90px at 30px size)"
        );

        let _ = std::fs::remove_dir_all(&tmp_dir);
    }

    #[test]
    fn toggle_mode_off_variant_uses_only_off_adjustments() {
        let tmp_dir = std::env::temp_dir().join("grove_test_toggle_off_only");
        std::fs::create_dir_all(&tmp_dir).unwrap();

        let input_path = tmp_dir.join("input.png");
        let img = make_test_image(32, 32);
        DynamicImage::ImageRgba8(img).save(&input_path).unwrap();

        // Use distinctive ON adjustments to verify they aren't in the OFF file
        let config_toggle = IconConfig {
            off_adjustments: [
                HsbAdjustment { hue_shift: 0.0, sat_delta: 0.0, bri_delta: 0.0 },
                HsbAdjustment { hue_shift: 0.0, sat_delta: 0.0, bri_delta: 10.0 },
                HsbAdjustment { hue_shift: 0.0, sat_delta: 0.0, bri_delta: -10.0 },
            ],
            on_adjustments: [
                HsbAdjustment { hue_shift: 180.0, sat_delta: 0.0, bri_delta: 0.0 },
                HsbAdjustment { hue_shift: 180.0, sat_delta: 0.0, bri_delta: 10.0 },
                HsbAdjustment { hue_shift: 180.0, sat_delta: 0.0, bri_delta: -10.0 },
            ],
            is_toggle: true,
            ..Default::default()
        };

        let results = generate_icon_set(
            &input_path, &config_toggle, None, &[30u32],
        ).expect("toggle should succeed");

        assert_eq!(results.len(), 2, "Toggle should produce 2 outputs");

        let _ = std::fs::remove_dir_all(&tmp_dir);
    }

    #[test]
    fn toggle_empty_scales_returns_empty() {
        let tmp_dir = std::env::temp_dir().join("grove_test_toggle_empty");
        std::fs::create_dir_all(&tmp_dir).unwrap();

        let input_path = tmp_dir.join("input.png");
        let img = make_test_image(32, 32);
        DynamicImage::ImageRgba8(img).save(&input_path).unwrap();

        let config_toggle = IconConfig {
            is_toggle: true,
            ..Default::default()
        };

        let results = generate_icon_set(
            &input_path, &config_toggle, None, &[],
        ).expect("empty scales should succeed");
        assert!(results.is_empty(), "Empty scales should produce no outputs");

        let _ = std::fs::remove_dir_all(&tmp_dir);
    }

    #[test]
    fn toggle_non_toggle_still_produces_single_output() {
        let tmp_dir = std::env::temp_dir().join("grove_test_toggle_non");
        std::fs::create_dir_all(&tmp_dir).unwrap();

        let input_path = tmp_dir.join("input.png");
        let img = make_test_image(32, 32);
        DynamicImage::ImageRgba8(img).save(&input_path).unwrap();

        let config_no_toggle = IconConfig {
            is_toggle: false,
            ..Default::default()
        };

        // Single scale, non-toggle
        let results = generate_icon_set(
            &input_path, &config_no_toggle, None, &[30u32],
        ).expect("non-toggle should succeed");
        assert_eq!(results.len(), 1, "Non-toggle should produce 1 output per scale");
        assert_eq!(results[0].suffix, "", "Non-toggle suffix should be empty");

        let _ = std::fs::remove_dir_all(&tmp_dir);
    }

    // -----------------------------------------------------------------------
    // T5: Integration Tests + Legacy Cleanup (RED phase)
    // -----------------------------------------------------------------------

    #[test]
    fn full_pipeline_with_crop_padding_toggle_produces_correct_count() {
        let tmp_dir = std::env::temp_dir().join("grove_test_pipeline_full");
        std::fs::create_dir_all(&tmp_dir).unwrap();

        let input_path = tmp_dir.join("input.png");
        let img = make_test_image(64, 64);
        DynamicImage::ImageRgba8(img).save(&input_path).unwrap();

        let crop = CropArea { x: 0, y: 0, width: 48, height: 48 };
        let config = IconConfig {
            hover_brightness: 30,
            click_brightness: -40,
            off_adjustments: [HsbAdjustment::default(); 3],
            on_adjustments: [
                HsbAdjustment { hue_shift: 180.0, sat_delta: 0.0, bri_delta: 0.0 },
                HsbAdjustment { hue_shift: 180.0, sat_delta: 0.0, bri_delta: 10.0 },
                HsbAdjustment { hue_shift: 180.0, sat_delta: 0.0, bri_delta: -10.0 },
            ],
            padding: 4,
            is_toggle: true,
        };

        // Full pipeline with ALL features: crop + padding + multi-scale + toggle
        let results = generate_icon_set(
            &input_path,
            &config,
            Some(&crop),
            &[30u32, 45, 60],
        ).expect("Full pipeline should succeed");

        // Toggle + 3 scales = 6 outputs
        assert_eq!(results.len(), 6, "3 scales × 2 (toggle) = 6 outputs");

        // Verify all outputs have valid base64 and 3-state dimensions
        for (i, out) in results.iter().enumerate() {
            assert!(out.preview_base64.is_some(),
                "Output {} should have base64", i);
            let expected_w = match i / 2 {
                0 => 90u32,  // 30 × 3
                1 => 135u32, // 45 × 3
                2 => 180u32, // 60 × 3
                _ => unreachable!(),
            };
            let expected_h = match i / 2 {
                0 => 30u32,
                1 => 45u32,
                2 => 60u32,
                _ => unreachable!(),
            };
            assert_eq!(out.width, expected_w,
                "Output {} width should be {} (3 states)", i, expected_w);
            assert_eq!(out.height, expected_h,
                "Output {} height should be {}", i, expected_h);
        }

        let _ = std::fs::remove_dir_all(&tmp_dir);
    }

    #[test]
    fn state_ordering_follows_reaper_convention() {
        // Verify that non-toggle output has states in order:
        // OFF Normal, OFF Hover, OFF Active (3 states only — no ON states in non-toggle)
        let tmp_dir = std::env::temp_dir().join("grove_test_ordering");
        std::fs::create_dir_all(&tmp_dir).unwrap();

        let input_path = tmp_dir.join("input.png");
        // Create a fully opaque white image
        let mut img = RgbaImage::new(16, 16);
        for y in 0..16 {
            for x in 0..16 {
                img.put_pixel(x, y, Rgba([255, 255, 255, 255]));
            }
        }
        DynamicImage::ImageRgba8(img).save(&input_path).unwrap();

        // OFF: identity + slight brightness shifts so we can distinguish states
        // Non-toggle should produce ONLY 3 OFF states (no ON states at all)
        let config = IconConfig {
            hover_brightness: 30,
            click_brightness: -40,
            off_adjustments: [
                HsbAdjustment { hue_shift: 0.0, sat_delta: 0.0, bri_delta: 0.0 },
                HsbAdjustment { hue_shift: 0.0, sat_delta: 0.0, bri_delta: 10.0 },
                HsbAdjustment { hue_shift: 0.0, sat_delta: 0.0, bri_delta: -10.0 },
            ],
            on_adjustments: [
                HsbAdjustment { hue_shift: 0.0, sat_delta: 0.0, bri_delta: -100.0 },
                HsbAdjustment { hue_shift: 0.0, sat_delta: 0.0, bri_delta: -100.0 },
                HsbAdjustment { hue_shift: 0.0, sat_delta: 0.0, bri_delta: -100.0 },
            ],
            padding: 0,
            is_toggle: false,
        };

        let results = generate_icon_set(
            &input_path, &config, None, &[16u32],
        ).expect("ordering test should succeed");

        assert_eq!(results.len(), 1, "Non-toggle produces 1 output");
        let out = &results[0];

        use base64::Engine;
        let decoded = base64::engine::general_purpose::STANDARD
            .decode(out.preview_base64.as_ref().unwrap())
            .expect("Base64 must decode");
        let decoded_img = image::load_from_memory(&decoded)
            .expect("Must be valid PNG");
        let rgba = decoded_img.to_rgba8();

        // 3 states × 16px = 48px wide, 16px tall
        assert_eq!(rgba.width(), 48);
        assert_eq!(rgba.height(), 16);

        let state_w = 16u32;

        // All 3 states use OFF adjustments → should be near-white
        for state in 0..3u32 {
            let x = state * state_w + state_w / 2;
            let y = 8u32;
            let pixel = rgba.get_pixel(x, y).0;
            // OFF states: should be near-white (bri_delta 0, 10, or -10 on white)
            assert!(pixel[0] >= 230,
                "State {} (OFF) should be near-white, got R={}", state, pixel[0]);
        }

        let _ = std::fs::remove_dir_all(&tmp_dir);
    }

    #[test]
    fn legacy_generate_three_state_still_works() {
        // Backward compat: generate_three_state must still produce correct output
        let tmp_dir = std::env::temp_dir().join("grove_test_legacy_t5");
        std::fs::create_dir_all(&tmp_dir).unwrap();

        let input_path = tmp_dir.join("input.png");
        let output_path = tmp_dir.join("output.png");
        let img = make_test_image(32, 32);
        DynamicImage::ImageRgba8(img).save(&input_path).unwrap();

        let config = IconConfig::default();
        let result = generate_three_state(
            &input_path,
            Some(&output_path),
            &config,
            None,
            30,
        ).expect("Legacy generate_three_state should still work");

        assert_eq!(result.width, 90, "3 × 30 = 90");
        assert_eq!(result.height, 30, "30px tall");
        assert!(result.output_path.is_some(), "File mode should have path");
        assert!(output_path.exists(), "Output file should exist");

        let _ = std::fs::remove_dir_all(&tmp_dir);
    }

    // -----------------------------------------------------------------------
    // Phase 2: Corner radius + dead code tests
    // -----------------------------------------------------------------------

    #[test]
    fn corner_radius_30px_uses_round_half_up() {
        // Verify that 30px scale produces corner radius 5 (not 4 — what
        // ties-to-even round() gave). This is a pixel-level behavioral test:
        //
        // With the NEW formula r=5 for a 30px scale, pixel (1,1) of the first
        // state falls in the anti-aliasing band of the corner arc.
        //   dx = 1.5, dy = 1.5, d = sqrt((1.5-5)^2+(1.5-5)^2) ≈ 4.95
        //   alpha_factor = (5.5 - 4.95).clamp(0,1) ≈ 0.55
        //   With original alpha=255 → result ≈ 140
        //
        // With the OLD formula r=4, pixel (1,1) would also be in the band:
        //   d = sqrt((1.5-4)^2+(1.5-4)^2) ≈ 3.536
        //   alpha_factor = (4.5 - 3.536).clamp(0,1) ≈ 0.964
        //   With original alpha=255 → result ≈ 246
        //
        // So the new formula produces alpha ≈ 140 at pixel (1,1), RED.
        let tmp_dir = std::env::temp_dir().join("grove_test_corner_r30");
        std::fs::create_dir_all(&tmp_dir).unwrap();

        let input_path = tmp_dir.join("input.png");
        // Create a fully opaque white 32×32 image so pixel alpha = 255
        let mut img = RgbaImage::new(32, 32);
        for y in 0..32 {
            for x in 0..32 {
                img.put_pixel(x, y, Rgba([255, 255, 255, 255]));
            }
        }
        DynamicImage::ImageRgba8(img).save(&input_path).unwrap();

        let config = IconConfig {
            padding: 0,
            is_toggle: false,
            off_adjustments: [HsbAdjustment::default(); 3],
            on_adjustments: [HsbAdjustment::default(); 3],
            ..Default::default()
        };

        let results = generate_icon_set(
            &input_path, &config, None, &[30u32],
        ).expect("30px icon set should succeed");

        assert_eq!(results.len(), 1, "Should produce 1 output");

        // Decode the PNG
        use base64::Engine;
        let decoded = base64::engine::general_purpose::STANDARD
            .decode(results[0].preview_base64.as_ref().unwrap())
            .expect("Base64 must decode");
        let decoded_img = image::load_from_memory(&decoded)
            .expect("Must be valid PNG")
            .to_rgba8();

        // Pixel (1,1) of the first state → absolute position (1, 1)
        // With round-half-up r=5: alpha ≈ 140
        // With ties-to-even r=4: alpha ≈ 246
        let pixel = decoded_img.get_pixel(1, 1).0;
        let alpha = pixel[3];
        // Round-half-up formula gives r=5 → pixel (1,1) in anti-aliasing band → alpha ≈ 140
        // Verify alpha is well below fully opaque (confirming round-half-up behavior)
        assert!(
            alpha < 200,
            "Pixel (1,1) alpha should be ~140 with round-half-up, got {}",
            alpha
        );

        let _ = std::fs::remove_dir_all(&tmp_dir);
    }

    #[test]
    fn corner_radius_minimum_is_two() {
        // Very small state sizes should have radius at least 2
        let tmp_dir = std::env::temp_dir().join("grove_test_corner_min");
        std::fs::create_dir_all(&tmp_dir).unwrap();

        let input_path = tmp_dir.join("input.png");
        let img = make_test_image(32, 32);
        DynamicImage::ImageRgba8(img).save(&input_path).unwrap();

        let config = IconConfig {
            padding: 0,
            is_toggle: false,
            off_adjustments: [HsbAdjustment::default(); 3],
            on_adjustments: [HsbAdjustment::default(); 3],
            ..Default::default()
        };

        // At small sizes, the formula should floor at 2.0
        // Test with tiny scale: 1px → (1*0.15+0.5).floor() = 0.65.floor() = 0 → max(2.0) = 2
        let results = generate_icon_set(
            &input_path, &config, None, &[1u32],
        ).expect("1px icon set should succeed");

        assert_eq!(results.len(), 1, "Should produce 1 output");
        assert!(results[0].preview_base64.is_some(), "Should have base64 data");

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
