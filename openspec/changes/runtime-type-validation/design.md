# Design: Runtime Type Validation for IPC Responses

## Technical Approach

Add Zod schemas + a generic `safeInvoke<T>` wrapper that validates every Tauri IPC response at the boundary. One schema per Rust response struct, matching serde's exact JSON output. Schemas go in `src/validation.ts`; `api.ts` functions get retrofitted through the wrapper.

## Key Discovery

**TS `DetectionResult.method` is missing `'Wsl'`**. The Rust enum has 5 variants (`Native | Wine | Proton | Wsl | Manual`) but `api.ts` only lists 4. The Zod schema will include it — the TS interface must also be updated.

## Architecture Decisions

### Decision: Wrapper Strategy

| Option | Tradeoff | Verdict |
|--------|----------|---------|
| A: Wrap each api.ts fn | Duplicate `.parse()` per fn, easy to forget | ❌ |
| B: Generic `safeInvoke<T>` | One wrapper, schema is a param, can't bypass | ✅ |
| C: Validate at hook/component | Consumer must remember, unreliable | ❌ |

**Choice**: Option B — `safeInvoke<T>(cmd, params, schema)`. Forces validation at the IPC boundary. No consumer can accidentally skip it.

### Decision: null vs undefined for Option<T>

Rust `Option<T>` with serde_json always serializes `None` as JSON `null` — the structs don't use `skip_serializing_if`. **Use `.nullable()`**, never `.optional()`.

### Decision: Error Handling

**Choice**: Custom `IPCValidationError` with `command` + `issues`. Log to console, then rethrow. Hard fail — validation errors mean a contract bug that MUST be fixed, not silently degraded.

**Alternatives**: Return gracefully degraded result (hides bugs), toast notification (wrong audience — validation bugs are dev-facing).

### Decision: Adoption Pattern

All IPC functions at once — 5 schemas, ~80 lines total. The wrapper is generic; incremental adoption adds no value here.

## Data Flow

```
Component → safeInvoke('cmd', params, schema)
                │
                ├─→ invoke('cmd', params)  ──→ Rust #[tauri::command]
                │                                   │
                │                              Result<T, String>
                │                                   │
                ├─← Response (unknown JSON)  ←──────┘
                │
                ├─→ schema.parse(response)
                │      │
                │   ok?──yes──→ return T
                │      │
                │      no
                │      │
                └─→ throw IPCValidationError
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/validation.ts` | Create | Zod schemas + `safeInvoke` wrapper |
| `src/api.ts` | Modify | Replace `invoke()` calls with `safeInvoke()`, fix `DetectionResult.method` |
| `src/__tests__/validation.test.ts` | Create | Schema unit tests + mocked IPC error test |

## Interfaces / Contracts

```typescript
// src/validation.ts

import { z } from 'zod';

export const DetectionMethodSchema = z.enum([
  'Native', 'Wine', 'Proton', 'Wsl', 'Manual'
]);

export const DetectionResultSchema = z.object({
  path: z.string().nullable(),
  method: DetectionMethodSchema,
});

export const CropAreaSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

export const HsbAdjustmentSchema = z.object({
  hue_shift: z.number(),
  sat_delta: z.number(),
  bri_delta: z.number(),
});

export const ProcessingOutputSchema = z.object({
  width: z.number(),
  height: z.number(),
  output_path: z.string().nullable(),
  preview_base64: z.string().nullable(),
  suffix: z.string(),
});
```

```typescript
export class IPCValidationError extends Error {
  constructor(
    public readonly command: string,
    public readonly issues: z.ZodIssue[],
  ) {
    super(`IPC validation failed for '${command}': ${issues[0]?.message}`);
    this.name = 'IPCValidationError';
  }
}

export async function safeInvoke<T>(
  command: string,
  params?: Record<string, unknown>,
  schema?: z.ZodType<T>,
): Promise<T> {
  const result = await invoke(command, params);
  if (schema) return schema.parse(result);
  return result as T;
}
```

Functions returning `string`, `string[]`, or `void` skip the schema — no meaningful structure to validate.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | Each schema parses valid / rejects invalid data | `.parse()` valid fixture, `.safeParse()` invalid fixture |
| Unit | `safeInvoke` passes through valid, throws on invalid | Mock `invoke()`, verify error type + message |
| Sync | Schemas match Rust types | Doc comments in `validation.ts` reference the Rust struct path |

## Migration / Rollout

No migration needed. The wrapper throws on invalid data — if the Rust side is already producing correct output (which tests prove), validation is purely additive.

### Anti-regression guard

All existing IPC calls already return correct data (proven by existing Rust tests and app usage). Adding `.parse()` will not change behavior for well-formed responses — it only catches new drift.

## Open Questions

- [ ] Should `safeInvoke` include an `onValidationError` hook for test injection? Currently not needed — tests mock `invoke()` directly.
- [ ] Should the `'Wsl'` fix in `DetectionResult.method` be a separate PR or bundled here? Recommend bundling — it's a 1-line change in the same file.
