# Proposal: store-migration-tests-polish

## Intent

Improve code quality, debuggability, and visual polish for the icon generator. Add unit tests for the core `useLocalStorage` hook, add debug logging to diagnose icon install path issues, surface the resolved install path in the UI, and optionally add supersampling for smoother corner AA.

## Scope

### In Scope
- JS unit tests for `useLocalStorage` (9 scenarios: CRUD, version check, JSON errors, storage full)
- Debug logging in `installer.rs` and `path_detector.rs` to trace file write destinations
- UI: show the computed REAPER install path so the user can verify where icons land
- Supersampling for corner AA (SHOULD — only if visible banding remains after the current round-half-up formula)

### Out of Scope
- `tauri-plugin-store` migration (async complexity not justified for ~1 KB of settings)
- Any architectural changes (state management, IPC restructuring)
- Batch re-processing, unrelated UX changes

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `icon-processing-pipeline`: SHOULD produce smoother corner AA via supersampling (currently uses `((s*0.15)+0.5).floor().max(2.0)`)
- `app-shell`: SHOULD display the target REAPER install path so the user can verify the destination before installing

## Approach

1. **Tests**: Create `src/hooks/__tests__/useLocalStorage.test.ts` following existing hook test patterns (vitest + jsdom). Cover 9 scenarios: basic set/get, overwrite, functional update, missing key → default, JSON parse error → default, version mismatch → default, storage full → silent fail, multiple keys, mount/unmount edge cases.
2. **Debug logging**: Add `log` / `tracing` emits at key write points in `installer.rs` and `path_detector.rs` showing the resolved path before file operations.
3. **Path display**: Frontend shows `{detected_reaper_path}/Data/toolbar_icons/` in the install panel or a status bar section.
4. **Supersampling**: If visible banding at small scales, add 2× supersampling pass in `image_processor.rs` before the corner rounding formula (~50 lines Rust).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/hooks/__tests__/useLocalStorage.test.ts` | New | 9 test scenarios |
| `src-tauri/src/installer.rs` | Modified | Debug log on file write |
| `src-tauri/src/path_detector.rs` | Modified | Debug log on path resolution |
| `src/App.tsx` | Modified | Show resolved install path |
| `src-tauri/src/image_processor.rs` | Modified | Optional supersampling pass |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Vitest config diverges from existing test patterns | Low | 15 test files exist — follow same patterns |
| Supersampling adds latency at 2× resolution | Low | Only corner pixels; 38×38 area is negligible |
| Path display shows wrong path and confuses user | Med | Informational only, not actionable; pairs with debug logging for diagnosis |

## Rollback Plan

Each area is independently revertible via `git revert <commit>` per area. No architectural coupling between tests, logging, path display, and supersampling.

## Dependencies

- None beyond existing toolchain (vitest 4.1.8, @testing-library/react, jsdom)
- No new Rust crates needed

## Success Criteria

- [ ] `npx vitest run src/hooks/__tests__/useLocalStorage.test.ts` passes all 9 scenarios
- [ ] `cargo build` succeeds after logging additions
- [ ] Frontend shows the resolved `{path}/Data/toolbar_icons/` destination
- [ ] Supersampling (if done): visibly smoother corner AA in generated icons at small sizes
