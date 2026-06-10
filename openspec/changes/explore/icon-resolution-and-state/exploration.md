## Exploration: Icon Resolution & State Persistence

### Current State

**Icon Handling**: The app generates REAPER 3-state toolbar icons at 30/45/60px scales using a full HSB pipeline with configurable padding (0–4px), toggle ON/OFF support, rounded corners, and multi-scale output to `toolbar_icons/`, `toolbar_icons/150/`, `toolbar_icons/200/`. The preview component (`StatePreview.tsx`) supports both per-state and full-strip views, with display scaling capped at `MAX_STATE_DISPLAY=150px` per state.

**State Management**: ALL state is volatile — 11 `useState` calls in `App.tsx`, plus 7 hooks each with internal state. No localStorage, no persistence, no store. HSB adjustments (6 panels × 3 sliders each), padding, toggle mode, crop area, icon name, REAPER path selection — all lost on page refresh.

### Affected Areas

- `src/App.tsx` — 387 lines, 11 inline `useState` calls, no persistence wrapper
- `src/StatePreview.tsx` — Preview rendering with display scaling; 60px overflow behavior
- `src-tauri/src/image_processor.rs` — `apply_rounded_rect_mask` at lines 637–688, corner anti-aliasing
- `src/hooks/useHsbAdjustments.ts` — HSB state shape (6 `HsbAdjustment` objects) for persistence
- `src/hooks/useReaperPath.ts` — REAPER path detection; manual override not persisted
- `src/hooks/*.ts` — All hooks hold volatile state
- `src-tauri/src/path_detector.rs` — Auto-detection logic; no user override persistence
- `src/App.css` — Container max-width 640px, no overflow handling in preview sections

---

### Topic A: Icon Resolution & Handling

#### Findings

**1. Preview 60×60 Overflow**

The current `StatePreview.tsx` caps display size via `MAX_STATE_DISPLAY = 150`:

| Scale | `getDisplayScale()` | Display size | Strip view scale |
|-------|---------------------|-------------|------------------|
| 30px  | `min(3, floor(150/30)=5) = 3` | 90×90px | 1.5 (270×45) |
| 45px  | `min(3, floor(150/45)=3) = 3` | 135×135px | 1.1 (297×49.5) |
| 60px  | `min(3, floor(150/60)=2) = 2` | **120×120px** | 0.8 (288×48) |

**120×120px per state × 3 states = 360px** — fits within the 640px container. The strip view uses `max-width: 100%` on the `<img>` element, so it won't overflow.

However, three issues remain:
- **No `overflow-x: auto` or `overflow: hidden`** on `.state-preview` or `.state-preview-scale` — if a larger image or edge-case scale factor exceeds the container, it will overflow
- **The strip view scale (`getStripScale`)** has a `1.5` upper cap, meaning at most 50% enlargement. For 30px: strip width = 180, display = 270px. Fine.
- **The previously reported overflow** may have been before `MAX_STATE_DISPLAY` was introduced (the SDD cycles added this fix). Still, the CSS lacks defensive overflow guards.

**Risk**: When toggle mode is ON (6 states instead of 3), the strip view shows the full 6-state image. For 30px: `180 * 1.5 = 270px` fine. For 60px: `360 * 0.8 = 288px` fine. No overflow expected, but **no CSS guard exists if the calculation changes**.

**2. Corner Artifacts in `apply_rounded_rect_mask`**

The function (lines 637–688) uses Euclidean distance from arc center `(r, r)` with a 1px anti-aliased band (r-0.5 to r+0.5). Issues found:

- **Dead code branch**: `dx <= 0.0 || dy <= 0.0` → `0.0` is never reached because the `0.5` pixel-center offset makes `dx` always ≥ 0.5 for valid pixel coordinates
- **Corner radius by scale**: `(scale * 0.15).round().max(2)`:
  - 30px: 30×0.15=4.5 → `round()`=4 (ties-to-even in Rust) → radius=4
  - 45px: 45×0.15=6.75→ `round()`=7 → radius=7
  - 60px: 60×0.15=9.0→ `round()`=9 → radius=9
- **Anti-aliasing precision at small scales**: A 1px transition band on a 4px radius (30px state) means the corner arc blends over ~25% of the radius. This is significant and can produce visible stair-stepping or soft edges
- **The mask is applied AFTER the 6-state strip is assembled** (lines 450–452 in `process_variant_to_bytes`). The same mask is applied across the entire strip width, treating each `state_w × state_h` region independently. This is correct but means corners are only masked on the first and last state's outer edges — the interior boundaries between states are NOT masked (they are internal to the strip), which is correct REAPER behavior
- **Interaction with padding**: The padding step (lines 404–405) creates transparent borders BEFORE the mask. If padding > 0, the corner masking happens on the padded image, which includes transparent pixels at the edges. The mask then further modifies alpha in corners — this double-transparency should be benign

**Likely cause of reported corner artifacts**: The 1px AA band at very small scales (especially 30px with radius=4) creates visible artifacts when:
  - The source image has high-contrast edges near corners
  - Lanczos3 resampling creates ringing artifacts that interact with the alpha mask
  - HSB adjustments change pixel colors near the AA boundary, making alpha blending more visible against different backgrounds

**3. REAPER Reference Icons**

The user's path (`C:\Users\OGzuz\AppData\Roaming\REAPER\Data\toolbar_icons`) has "Data" in it — this is REAPER's resource path. The standard auto-detection returns `{config_dir}/REAPER`, which resolves to `C:\Users\{user}\AppData\Roaming\REAPER` (no "Data" segment). The installer then creates `toolbar_icons/` inside it.

This means:
- **Standard path**: `%APPDATA%/REAPER/toolbar_icons/`
- **User's path**: `%APPDATA%/REAPER/Data/toolbar_icons/`

The "Data" subdirectory suggests the user may have a portable REAPER install or a non-standard config. The app currently doesn't handle this case — it writes to `{detected_path}/toolbar_icons/` where detected_path could be `%APPDATA%/REAPER` (Native) or a Wine prefix.

Key REAPER icon format details:
- Files are **horizontal strips** of 3 states each (Normal / Hover / Active)
- Each state is a square: 30×30, 45×45, or 60×60
- Strips are 90×30, 135×45, or 180×60 for 3-state; 180×30, 270×45, 360×60 for 6-state (toggle)
- File naming: `iconname.png` (OFF), `iconname_on.png` (ON for toggles)
- Corner radius: REAPER applies its own rounded corners in the theme — exact radius varies. ~15% of state size is standard
- REAPER uses straight (non-premultiplied) alpha, which the code correctly handles
- There is NO color model requirement — REAPER accepts sRGB PNGs

**4. Default Install Path**

The current `useReaperPath` hook auto-detects on mount and stores the result in React state. The user can override via folder dialog (`handleSelectReaperDir`), but the override is NOT persisted.

Options:
- **A. Save last user-selected path** — Store the manual override in localStorage/Tauri store so on next launch it's recalled
- **B. Support path override in settings** — Add a dedicated settings field to always use a custom path over auto-detection
- **C. Support "Data" path variant** — The user's path includes `/Data/`. The auto-detector could check both `REAPER/toolbar_icons/` and `REAPER/Data/toolbar_icons/`

**5. Scale Handling**

All 3 scales are generated correctly. The mapping matches REAPER standard:
- 30px → `toolbar_icons/{name}.png`
- 45px → `toolbar_icons/150/{name}.png`
- 60px → `toolbar_icons/200/{name}.png`

No naming or structural issues found. REAPER expects icons in these exact directories with these exact dimensions.

#### Approaches

**Approach A: Defensive overflow CSS + corner AA refinement**
- Add `overflow-x: auto` and/or `overflow: hidden` to `.state-preview` and `.state-preview-scale`
- Fix the dead code branch in `apply_rounded_rect_mask` (remove unreachable `dx<=0 || dy<=0` check)
- Add bias-aware rounding for corner radius (use `round()` with explicit tie-handling, or `ceil()` to ensure minimum radius)
- Consider using a 2px AA band for larger scales (45px, 60px) where the radius is larger
- **Pros**: Simple CSS fix, low-risk Rust changes, directly addresses the reported issues
- **Cons**: Won't eliminate all AA artifacts at 30px scale; corner quality is inherently limited at tiny sizes
- **Effort**: Low

**Approach B: Supersample the corner mask**
- Generate the rounded corner mask at 2× resolution and downscale to target size
- This gives smoother AA at 30px scale
- **Pros**: Better visual quality at all scales, especially 30px
- **Cons**: More complex, slightly slower (negligible for single icon processing)
- **Effort**: Medium

**Approach C: REAPER path persistence + "Data" variant support**
- Save user-selected REAPER path to localStorage/Tauri store
- Add "Data" directory as an additional detection target in `path_detector.rs`
- Show a "Use as default" checkbox in the path selection UI
- **Pros**: Solves the user's actual workflow problem
- **Cons**: Requires persistence mechanism (see Topic B)
- **Effort**: Medium

---

### Topic B: State Persistence

#### Findings

**Current state inventory** — all volatile, all in `App.tsx` or hooks:

| State | Location | Type | Persist Priority | Notes |
|-------|----------|------|-----------------|-------|
| `selectedFile` | App.tsx | `string \| null` | None | File picker result, can't persist |
| `imageSrc` | App.tsx | `string \| null` | None | Derived from file, can't persist |
| `crop` | App.tsx | `CropArea \| null` | Low | Depends on loaded image |
| `padding` | App.tsx | `number` (2) | Medium | Simple number, low churn |
| `isToggle` | App.tsx | `boolean` (false) | Medium | Simple boolean |
| `viewMode` | App.tsx | `'states' \| 'strips'` | Low | User preference |
| `batchMode` | App.tsx | `boolean` (false) | Low | Session-specific |
| `offAdjustments` | `useHsbAdjustments` | `[HsbAdjustment; 3]` | **HIGH** | 9 slider values, most painful to lose |
| `onAdjustments` | `useHsbAdjustments` | `[HsbAdjustment; 3]` | **HIGH** | Same — 9 slider values |
| `reaperPath` | `useReaperPath` | `DetectionResult \| null` | **HIGH** | Manual override must persist |
| `iconName` | `useIconInstall` | `string` | Medium | User types this |
| `installEnabled` | `useIconInstall` | `boolean` (false) | Medium | User preference |
| `batchFiles` | `useBatchProcessing` | `BatchFile[]` | None | Session-only |
| `processing` / `processResults` | `useIconProcessing` | various | None | Session-only |

**Total state to persist**: ~8–10 values, totaling ~1KB of JSON. Straightforward.

**Available mechanism options**:

1. **`localStorage` (via custom hook)**
   - Zero new dependencies
   - `useLocalStorage<T>(key, initialValue)` pattern
   - Survives page refreshes in Tauri's webview
   - ~50 lines of hook code
   - Risk: Tauri webview config may clear storage; no obvious indication of this
   - Risk: Synchronous API blocks briefly on large payloads (irrelevant at ~1KB)

2. **`@tauri-apps/plugin-store` (Tauri store plugin)**
   - File-based JSON on disk
   - Async API (`store.get()`, `store.set()`)
   - Survives app reinstall and updates
   - Requires: `cargo add tauri-plugin-store` + npm `@tauri-apps/plugin-store`
   - More robust for important data like REAPER path
   - Overkill for simple preferences like viewMode

3. **Hybrid: localStorage for settings + Tauri store for REAPER path**
   - localStorage for slider values, toggles, preferences (fast, synchronous)
   - Tauri store for REAPER path (important, needs to survive updates)
   - Same hook interface for both (abstract storage behind `getValue`/`setValue`)

**Schema design**:

```typescript
interface PersistedState {
  version: 1;
  hsb: {
    off: [HsbAdjustment, HsbAdjustment, HsbAdjustment];
    on: [HsbAdjustment, HsbAdjustment, HsbAdjustment];
  };
  padding: number;
  isToggle: boolean;
  viewMode: 'states' | 'strips';
  reaperPath: string | null;     // User manual override only
  iconName: string;
  installEnabled: boolean;
}
```

**When to save**:
- On every change (debounced, 500ms) — "always synced" model
- On explicit "Save Settings" button — less frequent, but requires user action
- **Recommendation**: Debounced auto-save on change. HSB adjustments already have a 300ms debounce for preview — piggyback persistence on the same debounce. For other controls (padding, toggle), save on change.

**When to restore**:
- On app mount (initial render)
- Read from storage before first useState initialization
- Show a "restored from previous session" indicator for transparency

#### Approaches

1. **`useLocalStorage` custom hook** — Wrap state with localStorage persistence
   - Pros: Zero deps, ~50 lines, immediate, works for most values
   - Cons: Synchronous, no schema migration built-in, Tauri webview could theoretically clear it
   - Effort: Low

2. **Tauri Store Plugin** — Add `tauri-plugin-store`, use async `@tauri-apps/plugin-store`
   - Pros: File-based, survives reinstall, async API, migration support
   - Cons: Adds Rust dependency, npm dependency, more boilerplate for simple values
   - Effort: Medium

3. **Hybrid** — `useLocalStorage` for HSB/padding/toggle/viewMode + Tauri store for REAPER path
   - Pros: Appropriate persistence level per data type
   - Cons: Two storage mechanisms to maintain
   - Effort: Medium

4. **Abstraction over storage** — Create a `usePersistedState<T>` hook that abstracts the backend
   - Pros: Single hook API, swap storage backend later
   - Cons: Slightly more initial code
   - Effort: Medium

---

### Recommendation

**For Topic A (Icon Resolution)**:
1. Add defensive CSS overflow guards to `.state-preview` and all preview containers (`overflow-x: auto`, `overflow-y: auto`)
2. Fix the dead code branch in `apply_rounded_rect_mask` (remove unreachable `dx <= 0 || dy <= 0` check)
3. Change the corner radius rounding from `(r).round()` to `(r).ceil()` or add 0.5 bias to ensure the radius never rounds down — `(scale * 0.15 + 0.5).floor()` guarantees at least the intended coverage. For 30px: 4.5+0.5=5.0, radius=5 (instead of 4). This slightly larger radius will reduce stair-stepping
4. Add `Data/toolbar_icons` as an additional detection target when the primary path doesn't exist (for users with portable REAPER installs)

**For Topic B (State Persistence)**:
Start with **Approach 1 (useLocalStorage)** for Phase 1 — it solves the immediate pain point (losing HSB adjustments) with zero new dependencies and minimal code. The key hook pattern:

```
usePersistedState<T>(key, defaultValue) → [value, setValue]
```

Where:
- On init: read from localStorage, fall back to defaultValue
- On set: update React state + write to localStorage (debounced)
- Schema version field for future migrations
- Try/catch around localStorage access to handle private browsing/quota errors gracefully

The REAPER path persistence can be handled in the same hook once established; no need for Tauri store in this phase.

---

### Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| Corner AA artifacts persist at 30px despite radius change | Visual quality below expectations | Medium | Consider supersampling (Approach B) if simple radius change isn't enough |
| localStorage cleared by Tauri webview | Settings lost, users frustrated | Low-Medium | Test in Tauri v2 webview; fall back gracefully with defaults; consider Tauri store as Phase 2 |
| HSB persistence conflicts with debounced preview | Race condition between persistence and preview | Low | Persist the non-debounced value; preview already uses debounced values |
| Schema changes in future | Stale localStorage data causes errors | Low | Version field with migration; discard unknown versions |
| "Data" subdirectory detection produces false positives | Wrong install path | Very Low | Check both `REAPER/toolbar_icons` and `REAPER/Data/toolbar_icons`; prefer the one with existing icons, or let user choose |

### Ready for Proposal

**Yes** — both topics are well-understood. The proposal should cover:
1. Two separate change sets: `fix-icon-preview` and `state-persistence`
2. `fix-icon-preview`: CSS overflow guards + corner radius refinement + "Data" path support
3. `state-persistence`: `usePersistedState` hook + schema + HSB/padding/toggle/path persistence
4. Each is independently implementable and testable
