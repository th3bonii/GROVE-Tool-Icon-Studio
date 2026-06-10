# Design: store-migration-tests-polish

## Technical Approach

Four independent, revertible improvements for the icon generator: unit-test the `useLocalStorage` hook (vitest + jsdom), add debug logging to the Rust backend for install path tracing, surface the computed REAPER toolbar_icons path in the UI, and defer supersampling (corner-radius AA already fixed). No new Rust crates, no architectural changes.

## Architecture Decisions

### Decision 1: Test Infrastructure for useLocalStorage

| Option | Tradeoff |
|--------|----------|
| Mock `localStorage` via vitest spies | Extra setup/teardown per test, masks real jsdom behavior |
| Use jsdom native `localStorage` | Zero mocking for 8/9 scenarios; temporarily shadow `Storage.prototype.setItem` for "storage full" edge case |

**Choice**: jsdom native `localStorage` + targeted shadow for the storage-full test.

**Rationale**: jsdom provides a fully functional `Storage` API — no mock needed for happy paths. All 6 existing hook tests in `src/hooks/__tests__/` use `renderHook` + `act` without localStorage mocking, so this follows the established pattern. For the "storage full → silent fail" scenario, a single `beforeEach`/`afterEach` shadow of `Storage.prototype.setItem` suffices.

**Consequences**: 9 scenarios in `src/hooks/__tests__/useLocalStorage.test.ts` — basic set/get, overwrite, functional update, missing key → default, JSON parse error → default, version mismatch → default, storage full → silent fail, multiple keys, mount/unmount edge case.

### Decision 2: Debug Logging — `eprintln!`

| Option | Pros | Cons |
|--------|------|------|
| `log` crate + `env_logger` | Structured levels, Tauri ecosystem standard | New dependency, needs init call |
| `eprintln!` | Zero new crates, visible in `cargo tauri dev` console | No levels, stderr-only |
| `tracing` | Spans, async-friendly | Heavier, overkill for sync code |

**Choice**: `eprintln!` with descriptive prefixes (`[installer]`, `[path_detector]`).

**Rationale**: The proposal explicitly states "No new Rust crates needed". The `log` crate is absent from `Cargo.toml`. `eprintln!` goes to stderr, visible in the Tauri dev console and terminal. The backend paths are single-threaded and linear — structured logging adds no value at this scale.

**Consequences**: 4–6 `eprintln!` calls across `installer.rs` (`install_icon_set_raw`: log target path before write, file count) and `path_detector.rs` (`detect()`: log resolved method and path, each candidate checked). No filesystem or config changes.

### Decision 3: Path Display in UI

| Option | Tradeoff |
|--------|----------|
| Status bar | Overengineered for a single value, needs layout changes |
| InstallPanel header | Only visible after installing — too late for discovery |
| `#reaper-path-section` (existing) | Already shows detected path; natural place for derived install path |

**Choice**: Add `→ ./Data/toolbar_icons/` as a muted secondary line below the detected path in `#reaper-path-section`.

**Rationale**: The section already shows `reaperPath.path` and detection method. Appending the computed install subdirectory is one line in `src/App.tsx` (<~10 lines JSX). InstallPanel is conditionally rendered (only when a path exists) but focuses on file operations, not path verification. Status bar would require new CSS and layout structure.

**Consequences**: Modify `src/App.tsx` lines ~146–169. New `<p>` with muted styling below the `<code>` element showing the derived path. No new components.

### Decision 4: Supersampling — DEFERRED

**Choice**: Skip supersampling in this change.

**Rationale**: The corner-radius formula was already fixed to `((s * 0.15) + 0.5).floor().max(2.0)` (round-half-up) in a prior session, which resolved the primary source of banding at small scales. Supersampling at 2× with Lanczos3 downscale would add ~50 lines of Rust to `image_processor.rs` around `process_variant_to_bytes()`, modify the `corner_radius_30px_uses_round_half_up` golden test output, and add processing latency. The proposal marks it SHOULD — address when visible banding is reported.

**Consequences**: Tracked in Open Questions. When revisited: render rounded-rect mask at 2× scale, apply, downscale via Lanczos3 in the `apply_rounded_rect_mask` call site.

## Data Flow

```
[Frontend: App.tsx]                    [Rust Backend]
       │                                      │
       ├─ useLocalStorage ──→ localStorage    │ (no IPC needed)
       │   (9 test scenarios)                 │
       │                                      │
       ├─ #reaper-path-section                ├─ path_detector.rs::detect()
       │   shows detected path                │   eprintln!("[path_detector] ...")
       │   + derived install path             │
       │                                      │
       └─ InstallPanel                        ├─ installer.rs::install_icon_set_raw()
           uses path from reaperPath           │   eprintln!("[installer] write to {path}")
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/hooks/__tests__/useLocalStorage.test.ts` | Create | 9 test scenarios for useLocalStorage hook |
| `src-tauri/src/installer.rs` | Modify | Add `eprintln!` at file write points in `install_icon_set_raw` |
| `src-tauri/src/path_detector.rs` | Modify | Add `eprintln!` at path resolution in `detect()` and each candidate check |
| `src/App.tsx` | Modify | Show derived `{path}/Data/toolbar_icons/` below existing path display |

## Interfaces / Contracts

No new interfaces or IPC contracts. Existing `DetectionResult.path` + `Data/toolbar_icons` concatenation is a UI-only derivation.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (JS) | `useLocalStorage` hook: 9 scenarios | `renderHook` + `act` + vitest with jsdom |
| Unit (Rust) | Existing tests unaffected | `cargo test` — no new Rust tests in this change |

## Migration / Rollout

No migration required. All changes are additive (new test file, `eprintln!` calls, new JSX line). Supersampling deferred.

## Open Questions

- [ ] Supersampling: monitor for visible banding at 30px scale after the round-half-up fix. If reported, create separate SDD change for 2× supersampling in `image_processor.rs`.
- [ ] Storage quota: Chrome's default localStorage quota is ~5 MB (~4 KB per settings entry) — does `grove-reaperPath` exceed reasonable limits? (Likely not, but verify if issues surface.)
