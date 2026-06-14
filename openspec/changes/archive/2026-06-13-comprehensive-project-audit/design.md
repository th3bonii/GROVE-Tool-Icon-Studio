# Design: Comprehensive Project Audit — Fix Found Issues

## Technical Approach

Nine independent fixes across the Rust backend and TypeScript frontend, each a single-revert commit. Critical fixes change `apply_hsb` sat_delta behavior and `process_icon` error propagation. High/Medium fixes eliminate duplicated constants, dead code, and subtle bugs. Every change gated by `cargo test` and `vitest`.

---

## Architecture Decisions

| Option | Tradeoffs | Decision |
|--------|-----------|----------|
| **sat_delta scaling** — divide sat_delta by 100.0 in `apply_hsb` | Matches bri_delta pattern; changes visual output for non-zero sat_delta inputs | **Divide by 100.0** — consistency trumps. Existing tests use -1.0 (full desat) which still works (1.0 - 1.0/100 = 0.99 ≈ 0 after clamp) |
| **Write error propagation** — return `Err` vs collect partial failures | Returning Err lets frontend show feedback vs silent missing files | **Return `Err`** — swallow is never correct for a write pipeline |
| **Dynamic import → static** — top-level import | Module is a static dep; dynamic import() adds latency and complicates bundling | **Static import** — no async boundary needed |
| **REAPER_SCALE_DIRS dedup** — derive subdirs from constant | `REAPER_SCALE_DIRS` already has the full paths; `lib.rs` needs just the suffix | **Extract dir suffix via iterator**: map `dir.strip_prefix("Data/toolbar_icons/")` or failing that use `""` |
| **bri_delta default alignment** — Rust -40 vs TS -15 | Rust `IconConfig::default()` has Active bri_delta = -40.0; TS `useHsbAdjustments` has -15 | **Align TS to Rust: -40** — Rust is schema source of truth |
| **Installer rollback** — document gap vs implement tracking | Rename failures on file N+ leave N already-renamed files in place. Full rollback tracking adds complexity | **Document the gap** — risk is low (rename on same FS is atomic, failure is OS-level) |
| **Integer division guards** — runtime check vs assert_eq! | outputs.len() / scales.len() truncates silently if counts mismatch | **Runtime check** returning `Err` — safer than panic in production |
| **scaleX for Y-coordinate** — shared scale variable | Canvas preserves aspect ratio so scaleX === scaleY, but code is misleading | **Use shared `scale` variable** — future-proof, cleaner |
| **Dead `IconConfig` type** — remove vs wire in | Interface is unused by any function; no consumer depends on it | **Remove** — dead code has no value |

---

## Data Flow

```
Frontend (api.ts) ──invoke──→ process_icon (lib.rs)
                                    │
                                    ├─ generate_icon_set_raw() ──→ apply_hsb() ←─ fix #1: sat_delta/100
                                    │
                                    ├─ std::fs::write() ──→ fix #2: return Err on failure
                                    │
                                    └─ scale_subdirs[] ──→ fix #4: derive from REAPER_SCALE_DIRS
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src-tauri/src/image_processor.rs` | Modify | Fix #1: `sat_delta / 100.0` in `apply_hsb` (L366) |
| `src-tauri/src/lib.rs` | Modify | Fix #2: Return `Err` on write failure (L88–91); Fix #4: derive subdirs from `REAPER_SCALE_DIRS` (L68); Fix #7: integer division guard |
| `src/validation.ts` | Modify | Fix #3: Static `import { invoke }` instead of `await import()` (L65) |
| `src/hooks/useHsbAdjustments.ts` | Modify | Fix #5: Change Active `bri_delta` from `-15` to `-40` (L7) |
| `src-tauri/src/installer.rs` | Modify | Fix #6: Document rename rollback gap; Fix #7: integer division guard |
| `src/api.ts` | Modify | Fix #9: Remove unused `IconConfig` interface (L14–23) |
| `src/ImageCropper.tsx` | Modify | Fix #8: Use shared `scale` instead of `scaleX` for Y calculation (L155) |
| `src-tauri/tauri.conf.json` | Modify | Fix #10: Enable CSP |

## Interfaces / Contracts

**No new interfaces.** Only internal API changes:
- `process_icon` now returns `Err` on write failure instead of `Ok` with missing files
- `HsbAdjustment.sat_delta` now behaves linearly for intermediate values (±50, ±25)
- `HsbAdjustment.bri_delta` default for Active: aligned to -40 across Rust and TS

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | sat_delta linearity | Add test with intermediate values (-50, -25, 25, 50) |
| Unit | apply_hsb sat_delta/100 | Verify gray (S=0) stays unchanged with any sat_delta |
| Unit | process_icon write err | Inject write failure → verify Err returned |
| Unit | Integer division | Test with mismatched counts → verify Err |
| Integration | process_icon | No change needed (all paths still work) |
| E2E | TS defaults match Rust | Verify test output consistency |

## Migration / Rollout

No migration required. Each fix is independently revertible. The sat_delta scaling change alters visual output for non-zero saturation adjustments — this is the desired behavioral fix (currently the saturation slider acts as a boolean).

## Open Questions

- [ ] Does the ESLint config file exist? Config.yaml says `eslint.config.js (present)` — verify during apply.
