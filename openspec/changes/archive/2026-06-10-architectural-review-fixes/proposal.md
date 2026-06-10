# Proposal: Architectural Review Fixes

## Intent

Fix 5 architectural defects from a systematic review: double image processing, duplicated Rust config construction, ineffective single-entry cache, stale closure in batch processing, and duplicated corner radius logic. These degrade correctness and maintainability.

## Scope

### In Scope
- Remove redundant `handleGenerate` → `handleAutoInstall` double processing in App.tsx
- Extract shared `IconConfig` builder in lib.rs for 3 commands
- Remove `SOURCE_CACHE` (single-entry, never hits in batch)
- Fix stale `files.length` capture in `useBatchProcessing`
- Extract shared corner radius constant (Rust + TS)

### Out of Scope
- App.tsx decomposition (~400 line refactor, deferred)
- CI/CD pipeline (GitHub Actions — independent)
- Runtime type validation (cross-cutting, deferred)
- ImageCropper tests (pure test gap)

## Capabilities

### New Capabilities
None — all changes are refactoring and bug fixes with no new behavior.

### Modified Capabilities
None — no spec-level requirements change. All fixes preserve existing behavior.

## Approach

| Issue | Fix |
|-------|-----|
| Double processing | Remove redundant `installIconSet` from `handleGenerate`. Batch install already handles install separately. |
| Config duplication | Extract `build_icon_config(...)` in lib.rs. Call from `process_icon`, `preview_icon`, `install_icon_set`. |
| SOURCE_CACHE | Remove entirely. Files are 32×32px — I/O cost is negligible for batch. |
| Stale closure | Capture `files.length` locally inside `processAll` at call time. |
| Corner radius | Define one `CORNER_RADIUS_FACTOR` const in Rust; export via IPC or bundle constant for TS import. |

### Phasing
In-scope items land as a single PR (~150 lines). Deferred items are autonomous future changes:
1. **App.tsx decomposition**: split into hooks + component modules (~400 lines)
2. **CI/CD pipeline**: GitHub Actions for build/test/release (~200 lines)
3. **Runtime validation**: shared types or codegen (~300 lines)

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/App.tsx` | Modified | Remove redundant install call |
| `src/hooks/useBatchProcessing.ts` | Modified | Fix stale closure |
| `src/StatePreview.tsx` | Modified | Import shared corner radius |
| `src-tauri/src/lib.rs` | Modified | Extract `build_icon_config` helper |
| `src-tauri/src/image_processor.rs` | Modified | Remove cache, export corner radius const |
| `src/api.ts` | Modified | Add corner radius IPC command (if needed) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Removing double processing breaks install flow | Low | Verify `handleGenerate` callers; batch has separate install |
| Corner radius desync between Rust/TS | Low | Single source of truth (Rust), TS imports via IPC |
| Stale closure fix introduces regression | Low | Existing batch tests cover sequential processing |

## Rollback Plan

Each fix is independently revertible via `git revert`. All changes are small and scoped per file. No migration or data changes.

## Dependencies

None — all changes are self-contained.

## Success Criteria

- [ ] No redundant `install_icon_set` call in `handleGenerate`
- [ ] All 3 Rust commands (`process_icon`, `preview_icon`, `install_icon_set`) use shared `build_icon_config`
- [ ] `SOURCE_CACHE` removed, no perf regression in batch
- [ ] `useBatchProcessing` does not capture stale `files.length`
- [ ] Corner radius computed from one shared constant (Rust source → TS import)
- [ ] All existing tests pass (`cargo test` + `npx vitest run`)
