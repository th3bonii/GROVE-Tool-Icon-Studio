import { z } from 'zod';
import { invoke } from '@tauri-apps/api/core';

// ── IPC Response Schemas ──────────────────────────────────────────────────────

// Matches Rust image_processor::CropArea
export const CropAreaSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

// Matches Rust image_processor::HsbAdjustment
export const HsbAdjustmentSchema = z.object({
  hue_shift: z.number(),
  sat_delta: z.number(),
  bri_delta: z.number(),
});

// Matches Rust image_processor::ProcessingOutput
export const ProcessingOutputSchema = z.object({
  width: z.number(),
  height: z.number(),
  output_path: z.string().nullable(),
  preview_base64: z.string().nullable(),
  suffix: z.string(),
});

// Matches Rust path_detector::DetectionMethod — 5 variants
export const DetectionMethodSchema = z.enum(['Native', 'Wine', 'Proton', 'Wsl', 'Manual']);

// Matches Rust path_detector::DetectionResult
export const DetectionResultSchema = z.object({
  path: z.string().nullable(),
  method: DetectionMethodSchema,
});

// ── Inferred Types ────────────────────────────────────────────────────────────

export type CropArea = z.infer<typeof CropAreaSchema>;
export type HsbAdjustment = z.infer<typeof HsbAdjustmentSchema>;
export type ProcessingOutput = z.infer<typeof ProcessingOutputSchema>;
export type DetectionResult = z.infer<typeof DetectionResultSchema>;

// ── IPC Validation Error ──────────────────────────────────────────────────────

export class IPCValidationError extends Error {
  constructor(
    message: string,
    public readonly data: unknown,
    public readonly issues: z.ZodIssue[],
  ) {
    super(message);
    this.name = 'IPCValidationError';
  }
}

// ── Safe Invoke Wrapper ───────────────────────────────────────────────────────

export async function safeInvoke<T>(
  cmd: string,
  params: Record<string, unknown>,
  schema: z.ZodType<T>,
): Promise<T> {
  const result = await invoke(cmd, params);
  try {
    return schema.parse(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw new IPCValidationError(
        `IPC response validation failed for '${cmd}': ${err.message}`,
        result,
        err.issues,
      );
    }
    throw err;
  }
}
