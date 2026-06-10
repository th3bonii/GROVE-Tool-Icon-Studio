# IPC Type Validation Specification

## Purpose

Runtime validation for all Tauri IPC responses using Zod, ensuring Rust↔TS type alignment with typed parse failures.

## Requirements

### Zod Schema Definitions

The system MUST define Zod schemas in `src/validation.ts` for every IPC response type.

| Schema | Shape | Key Fields |
|--------|-------|------------|
| `CropAreaSchema` | `z.object` | `x`/`y`/`width`/`height`: `z.number()` |
| `HsbAdjustmentSchema` | `z.object` | `hue_shift`/`sat_delta`/`bri_delta`: `z.number()` |
| `DetectionResultSchema` | `z.object` | `path`: `z.string().nullable()`, `method`: `z.enum([...])` with 5 variants |
| `ProcessingOutputSchema` | `z.object` | `width`/`height`: `z.number()`, `output_path`/`preview_base64`: `z.string().nullable()`, `suffix`: `z.string()` |
| `IconConfigSchema` | `z.object` | `padding`: `z.number()`, `is_toggle`: `z.boolean()`, `off_adjustments`/`on_adjustments`: `z.tuple([...])` of 3 HsbAdjustments |

The `DetectionMethod` enum MUST include all 5 Rust variants: `Native`, `Wine`, `Proton`, `Wsl`, `Manual`. The existing TS interface omits `Wsl` — this MUST be added.

#### Scenario: Valid IPC response passes through unchanged

- GIVEN a Tauri invoke returns data matching the expected schema
- WHEN `.parse()` is called
- THEN the typed data is returned unmodified

#### Scenario: Invalid response throws ValidationError

- GIVEN IPC returns data missing a required field (e.g., `width` omitted from `ProcessingOutput`)
- WHEN `.parse()` is called
- THEN a `ValidationError` is thrown with the original data and ZodError `.issues`

#### Scenario: Null optional fields accepted

- GIVEN IPC returns `null` for `output_path` or `preview_base64`
- WHEN `.parse()` validates the nullable field
- THEN `null` is accepted and preserved

#### Scenario: Array responses validate every element

- GIVEN `processIcon()` returns 6 `ProcessingOutput` items
- WHEN validated via `z.array(ProcessingOutputSchema).parse()`
- THEN all 6 elements are checked; a single bad element fails the entire parse

### Response Validation in api.ts

Every `invoke()` call in `src/api.ts` MUST validate its response via `.parse()`.

| Function | Schema | Return Type |
|----------|--------|-------------|
| `detectReaperPath` | `DetectionResultSchema` | `DetectionResult` |
| `processIcon` / `previewIcon` | `z.array(ProcessingOutputSchema)` | `ProcessingOutput[]` |
| `installIconSet` / `listInstalledIcons` | `z.array(z.string())` | `string[]` |
| `installIcon` / `getIconStrip` | `z.string()` | `string` |
| `deleteIcon` / `writeFile` | `z.void()` | `void` |

#### Scenario: Error propagates through api.ts with typed details

- GIVEN IPC returns malformed data
- WHEN the api.ts function validates and `.parse()` throws
- THEN the caller's `.catch()` receives a `ValidationError` with `.data` and `.issues`

### ValidationError Type

The system MUST export a `ValidationError` class extending `Error`.

- **`data`**: raw unvalidated IPC response
- **`issues`**: `ZodIssue[]` from the parse failure
- **`message`**: human-readable description of the first issue

#### Scenario: ValidationError contains original data for debugging

- GIVEN a parse failure
- WHEN caught in a `.catch()` handler
- THEN `error.data` exposes the raw response for diagnostic logging

### Input Validation (SHOULD)

The system SHOULD export input-parameter schemas (`CropArea`, `HsbAdjustment`, `IconConfig`) for validating user-provided values before IPC dispatch.

#### Scenario: Input validation rejects bad crop parameters

- GIVEN user passes `{ x: -1, y: 0, width: 0, height: 0 }`
- WHEN validated against `CropAreaSchema`
- THEN parse fails, preventing an unnecessary IPC call

#### Scenario: Input validation catches out-of-range padding

- GIVEN user passes `padding: 10` (valid range: 0–4)
- WHEN validated against `IconConfigSchema`
- THEN parse fails with a descriptive issue

### Pre-existing Type Mismatch

The Rust `DetectionMethod` includes `Wsl` which was missing from the TS interface. The Zod schema MUST include all 5 variants. The TS interface SHOULD be updated to match.

#### Scenario: Wsl detection method is validated

- GIVEN IPC returns `{ path: "/mnt/c/...", method: "Wsl" }`
- WHEN validated against `DetectionResultSchema`
- THEN `"Wsl"` is accepted as a valid method value
