# Proposal: Fix All Issues — Rust Backend & React Frontend Refactor

## Intent

Eliminate code waste, performance anti-patterns, and maintainability debt across the Rust backend (6 issues) and React frontend (6 issues). No UI or output format changes — purely technical cleanup.

## Scope

### In Scope
- **Rust**: encode→decode waste, pixel-loop SIMD/bulk ops, hardcoded scales consolidation, O(n²) dedup → HashSet, partial install rollback, dead code removal
- **Frontend**: App.tsx → hooks extraction, inline styles → CSS modules, ImageCropper a11y, preview error display, ErrorBoundary, dead CSS removal

### Out of Scope
- New features or user-facing capabilities
- Adding JS/TS test framework or coverage tooling
- Output format or pipeline behavioral changes

## Capabilities

### New Capabilities
None — purely a refactor, no new spec domains.

### Modified Capabilities
- `icon-processing-pipeline` — `generate_icon_set` SHALL support optional raw byte output (skipping base64 encode) so `process_icon` avoids decode. `ProcessingError::EmptyError` SHALL be removed.
- `visual-editor` — Root SHALL be wrapped in ErrorBoundary. ImageCropper SHALL support keyboard nudge + ARIA. Preview errors SHALL surface to user.

## Approach

**Rust**: Add raw output mode to `generate_icon_set` (return bytes when no base64 needed). Replace pixel loops with `image` crate bulk operations (`imageops::overlay`, `enumerate_pixels_mut`). Consolidate scale list into a single `const SCALES`. Replace `Vec::contains` with `HashSet` in `list_installed_icons`. Wrap `install_icon_set` body in temp-dir writes + atomic `rename`. Remove `ProcessingError::EmptyError`.

**Frontend**: Extract `useReaperPath`, `useIconPreview`, `useIconProcessing`, `useIconInstall` hooks from App.tsx. Migrate inline `style={}` props to CSS modules in `InstallPanel.tsx` and `StatePreview.tsx`. Add `onKeyDown` arrow handlers + `role`/`aria-label` to ImageCropper. Surface preview catch as error state. Wrap `<App />` in `<ErrorBoundary>`. Strip dead CSS.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src-tauri/src/image_processor.rs` | Modified | bulk ops, raw mode, dead enum |
| `src-tauri/src/installer.rs` | Modified | HashSet, atomic rollback |
| `src-tauri/src/lib.rs` | Modified | scales const, decode removal |
| `src/App.tsx` | Modified | hooks, ErrorBoundary, error surfacing |
| `src/ImageCropper.tsx` | Modified | keyboard, ARIA, touch |
| `src/StatePreview.tsx` | Modified | CSS modules |
| `src/InstallPanel.tsx` | Modified | CSS modules |
| `src/App.css` | Modified | dead CSS removal |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Pixel output differs after bulk op refactor | Low | Existing tests + visual diff |
| Rollback logic adds complexity | Low | Wrapped in existing install flow |
| CSS module migration breaks layout | Low | Visual check per component |

## Rollback Plan

Revert the PR. All changes are code-only (no schema, migrations, or data). Each issue is independently revertible per file if selective rollback is needed.

## Dependencies

None — pure refactor of existing code.

## Success Criteria

- [ ] `cargo test` passes in full (existing + any new tests)
- [ ] `npm run build` succeeds
- [ ] App launches and crop→preview→install flow works end-to-end
- [ ] Identical pixel output on known input (base64 match before/after)
- [ ] `ProcessingError::EmptyError` no longer exists
- [ ] Scales defined in exactly 1 location
- [ ] `list_installed_icons` uses `HashSet` for dedup
- [ ] App renders ErrorBoundary fallback on simulated crash
- [ ] `<dl>`/`<dt>`/`<dd>` styles removed from `App.css`
