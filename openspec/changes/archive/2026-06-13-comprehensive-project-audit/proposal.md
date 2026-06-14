# Proposal: Comprehensive Project Audit — Fix Found Issues

## Intent

Act on the findings from the exhaustive codebase audit (exploration completed). Fix 2 critical bugs that break functionality, resolve 5 high-severity issues, and address medium/low findings opportunistically. All changes gated by existing test suite.

## Scope

### In Scope
- **CRITICAL**: Fix `sat_delta` not divided by 100 in `apply_hsb` (saturation slider is a boolean)
- **CRITICAL**: Fix silent write failure in `process_icon` (reports success with missing files)
- **HIGH**: Replace dynamic `import()` with static import in `validation.ts`
- **HIGH**: Reuse `REAPER_SCALE_DIRS` constant instead of hardcoded array in `lib.rs`
- **HIGH**: Align TypeScript/Rust default `bri_delta` for active state
- **HIGH**: Document/add rollback tracking in installer rename operations
- **HIGH**: Add integer division validation in `process_icon` and `install_icon_set`
- **MEDIUM**: Remove dead `IconConfig` type or wire it into parameter pipeline
- **MEDIUM**: Fix `scaleX` reused for Y-coordinate in `ImageCropper.tsx`
- **MEDIUM**: Verify `eslint.config.js` exists or fix lint script
- **LOW**: CSP hardening in `tauri.conf.json`

### Out of Scope
- New features or UI changes
- Performance benchmarking
- Dependency upgrades
- CI/CD pipeline changes

## Capabilities

> No new capabilities — bug fixes and tech debt cleanup only.

### New Capabilities

None.

### Modified Capabilities

- `icon-processing-pipeline`: Fix sat_delta scaling in apply_hsb (behavior change for saturation adjustment)
- `icon-processing-pipeline`: Fix silent write failure propagation

## Approach

| Phase | Scope |
|-------|-------|
| 1. Rust fixes | Fix sat_delta (image_processor.rs), write error propagation (lib.rs), REAPER_SCALE_DIRS dedup, integer division guards |
| 2. Frontend fixes | Static import (validation.ts), bri_delta default alignment, remove dead IconConfig type, fix scaleX/scaleY in ImageCropper |
| 3. Installer & config | Rollback documentation, eslint config check, CSP hardening |
| 4. Test & verify | Run full suite after each fix, verify no regressions |

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src-tauri/src/image_processor.rs` | Fix | sat_delta scaling (÷100), test for intermediate values |
| `src-tauri/src/lib.rs` | Fix | Write error propagation, REAPER_SCALE_DIRS reuse, integer division guard |
| `src-tauri/src/installer.rs` | Fix | Rollback documentation, integer division guard |
| `src/validation.ts` | Fix | Static import instead of dynamic |
| `src/hooks/useHsbAdjustments.ts` | Fix | Default bri_delta alignment |
| `src/api.ts` | Fix | Remove dead IconConfig type |
| `src/ImageCropper.tsx` | Fix | scaleX→scaleY or shared scale variable |
| `src-tauri/tauri.conf.json` | Fix | Enable CSP |
| `package.json` | Fix | eslint config check |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| sat_delta fix changes visual output | Low | Existing tests + add intermediate value test |
| Write error propagation may break callers | Low | All callers handle Err already via ? |
| src/__tests__/ may catch fewer regressions | Med | Run cargo test + vitest after each change |

## Rollback Plan

Each fix is a separate revertible commit. No structural refactors. `cargo test` + `npx vitest run` gate every change. Revert individual commits if any fix causes regression.

## Dependencies

- `cargo test` green before/after each change
- `npx vitest run` green before/after each change
- `npx tsc -b` clean before/after

## Success Criteria

- [ ] sat_delta behaves linearly for intermediate values (test with -50, -25, 25, 50)
- [ ] process_icon returns Err on write failure instead of silent Ok
- [ ] No dynamic import() in validation.ts
- [ ] No hardcoded scale subdirs in lib.rs
- [ ] TypeScript and Rust default bri_delta match for active state
- [ ] Full test suite passes: cargo test + vitest
- [ ] tsc -b passes with no errors
