## Exploration: Layout, Preview Size, and Performance Fixes

### Current State

The application is a Tauri v2 + React + Rust desktop tool for generating REAPER 3-state toolbar icons. The current layout is a single-column vertical flow with sections stacked in this order:

1. **Header** (~80px) — title + subtitle
2. **REAPER Resource Path** (~100px) — path display + badge
3. **Source Icon** (~80px without image, +300px with ImageCropper) — file selector + optional crop
4. **Crop & Preview** (visible only when file selected) — StatePreview (~200-400px) + padding slider (~80px) + toggle (~50px) + HSB panels (3-6 panels, ~150-400px depending on toggle)
5. **Install to REAPER** (visible when reaper path detected) — filename input + scale targets + **installed icons list (variable — grows unbounded)** + preview strip + install button (~200px + icons list)
6. **Generate** (~120px) — generate button + success/error messages

Window is 800×600, container max-width is 640px. With no file selected the content fits. Once a file is selected and HSB panels + installed icons are shown, the page can easily exceed 2500px vertical.

### Affected Areas

- `src/InstallPanel.tsx` — renders the installed icons list with no limit
- `src/StatePreview.tsx` — computes display scaling that blows up previews 3-4.5× above actual REAPER toolbar size
- `src-tauri/src/lib.rs` — all IPC commands are synchronous `fn`, not `async fn`; `list_installed_icons` does full FS scan; `preview_icon` re-reads source image on every call
- `src-tauri/src/image_processor.rs` — `generate_icon_set` processes all scales including expensive Lanczos3 downsample from potentially large source each time
- `src/hooks/useReaperPath.ts` — fetches installed icons on mount (unbounded list)
- `src-tauri/src/installer.rs` — `list_installed_icons` scans 6 directories (3 current + 3 legacy) for all .png files
- `src-tauri/tauri.conf.json` — window size 800×600
- `src/App.tsx` — layout ordering; install section renders before generate button
- `src/App.css` — `.container` max-width 640px

---

### 1. Installed Icons List Overflows

**Root cause:** `installer.rs::list_installed_icons()` scans 6 directories (Data/toolbar_icons, Data/toolbar_icons/150, Data/toolbar_icons/200 + legacy variants) and returns ALL unique .png stem names in a sorted BTreeSet. With hundreds of icons on the user's WSL-mounted Windows drive, this produces an unbounded list.

In `InstallPanel.tsx` (line 163), the icons render as `.install-installed-tags` with `flex-wrap`. Each icon gets a tag + delete + export button (≈80px wide × ~30px tall per item). At 300+ icons, this section is **>600px tall alone**, pushing the Generate button far down the page.

The list is fetched on mount via `useReaperPath.ts` (line 26-29) and refreshed after every install/delete.

**Severity:** High — directly hurts usability; the generate button becomes unreachable.

### 2. Preview Size Mismatch with REAPER

**Root cause:** `StatePreview.tsx` `getDisplayScale()` computes a display multiplier based on `MAX_STATE_DISPLAY (150) / scale`. The result is clamped to [1, 3]:
- 30px scale → floor(150/30)=5 → clamped to **3** → displayed at **90×90px** (3× actual size)
- 45px scale → floor(150/45)=3 → clamped to **3** → displayed at **135×135px** (3× actual size)  
- 60px scale → floor(150/60)=2 → clamped to **2** → displayed at **120×120px** (2× actual size)

Meanwhile, REAPER toolbar icons are generated at 30×30 (100%) and REAPER displays them at their native pixel size (20-30px depending on toolbar config). The preview should show icons at approximately **1:1 or at most 2×** so the user can evaluate actual appearance.

The strip view `getStripScale()` uses `MAX_STRIP_DISPLAY (500) / (scale * 6)`:
- 30px: 500/(180) ≈ 2.7 → clamped to max 1.5 → displayed at 45px wide (but strip width is 180px at 30px → displayed at 270px)
- This is still 1.5× larger than actual

**Severity:** Medium — users can't accurately judge how the icon will look in REAPER.

### 3. App Freezes on Image Load

**Root cause: Multiple factors stack:**

**a) All Rust IPC commands are synchronous (`fn`, not `async fn`):**
In Tauri v2, sync commands run on a thread pool (not main thread), but:
- The JS `invoke()` call blocks the calling async context until the Rust side completes
- Heavy CPU work (Lanczos3 resize × 3, per-pixel HSB × 6 states × 3 scales, PNG encode × 3-6 outputs) is all on one sync command
- Source image is opened from disk on EVERY call (no caching)

**b) `preview_icon` re-processes on every crop change:**
`useIconPreview.ts` fires a new IPC call every time the debounced crop changes (300ms debounce). Each call:
1. Re-opens the source image from disk (possibly large, on WSL mount)
2. Center-crops to square (at full resolution)
3. For each of 3 scales: Lanczos3 downscale → apply_padding → 6× per-pixel HSB → rounded corners → PNG encode → base64 encode

If the source image is large (e.g., 1024×1024), each Lanczos3 to 26×26 is expensive and done per scale. That's 3 costly resizes per preview call.

**c) `listInstalledIcons` scans 6 directories on mount:**
With hundreds of files on a WSL/CIFS mount (Windows path), `std::fs::read_dir` on each directory + file stat is slow. On WSL, accessing `/mnt/c/...` has significant per-operation overhead.

**d) Base64 overhead:**
Each `ProcessingOutput` carries base64-encoded PNG data. For 3 scales (non-toggle), that's 3 base64 strings sent over IPC. With toggle: 6. The total data across IPC can be 50-200KB depending on icon complexity and scale.

**Severity:** High — the app becomes unresponsive during processing.

### 4. Window Size and Layout

**Current:** 800×600. Container max-width: 640px.

**Section-by-section height estimates (with file selected, max panels shown):**

| Section | Height (approx) |
|---|---|
| Header | 80px |
| REAPER Path | 100px |
| Source Icon (button + ImageCropper) | 350px |
| StatePreview (3 scales × 1-2 rows) | 400px |
| Padding slider | 80px |
| Toggle control | 50px |
| HSB panels (6 panels in grid) | 200px |
| Install (input + targets + icons + buttons) | 200px + icons_list |
| Installed icons (300 items) | 600px |
| Generate section | 120px |
| **Total** | **~2180px + icons** |

**Minimum scroll-free layout would require:**
- Without icons list: ~1580px window height (leaves no room for productive workspace)
- With some icons: impossible without limiting the list

A better approach: limit installed icons display and use a more compact layout.

---

### Approaches

#### Fix 1: Installed Icons List — Limit Display

1. **Virtualize / limit with "Show more"** — Show first 20-30 icons, add "+N more" expandable link
   - Pros: Simple, no new deps, immediate fix
   - Cons: Two-state UI (collapsed/expanded)
   - Effort: **Small**

2. **Search + filter** — Add a text input to filter icons, always collapsed
   - Pros: More useful for users with many icons
   - Cons: Slightly more UI work, keyboard handling
   - Effort: **Small**

3. **Overflow container with max-height + scroll** — Wrap in `<div>` with `max-height: 200px; overflow-y: auto`
   - Pros: Dead simple CSS-only fix, all icons viewable
   - Cons: Scroll within a scroll, but functional
   - Effort: **Trivial** — ~1 line of CSS

**Recommendation for this fix:** Option 3 (CSS scroll) as immediate fix + Option 1 (first 30 + "Show N more") for polish.

#### Fix 2: Preview Size

1. **Show 1:1 preview with pixel grid** — Display at actual pixel size (30×30 etc.) with a grid background showing individual pixels
   - Pros: Most accurate representation
   - Cons: 30px is very small on modern screens; hard to evaluate
   - Effort: **Small**

2. **Cap at 2× and show actual size annotation** — Use `getDisplayScale` max of 2 instead of 3, and show "Actual size: 30×30px" label
   - Pros: Still zoomed enough to see detail, not misleading
   - Cons: Still larger than real REAPER size
   - Effort: **Trivial** — change a single constant

3. **Show both: 1:1 thumbnail + 2× zoomed view** — Small 1:1 indicator next to the 2× preview
   - Pros: Best of both worlds
   - Cons: More layout space
   - Effort: **Small**

**Recommendation:** Option 2 (cap at 2×, add actual size label) — simplest, most informative compromise.

#### Fix 3: Freeze on Image Load

1. **Make IPC commands `async fn` + `tokio::task::spawn_blocking`**
   - Move heavy work to blocking threads with `tokio::task::spawn_blocking`
   - This keeps the Tauri IPC thread pool responsive
   - Rust side: change `fn` to `async fn`, wrap heavy sections in `spawn_blocking`
   - Effort: **Medium**

2. **Cache source image in Rust (once per session)**
   - Keep the last-opened source image bytes in a `OnceCell` or `Arc<Mutex>`
   - Skip re-reading from disk on every preview call if the path hasn't changed
   - Effort: **Small**

3. **Pre-generate a single square at target scales, reuse across states**
   - Currently `process_variant_to_bytes` resizes each time from the full square
   - Pre-resize the source to each target scale ONCE, cache the scaled image, then run HSB/padding/corners from the cached resize
   - Effort: **Small-Medium** — refactor `process_variant_to_bytes` to accept pre-scaled input

4. **Stream processing or show progress** — For the generate/install flow, show progress per scale instead of blocking until all 3-6 outputs are done
   - Effort: **Medium**

**Recommendation:** Options 1+2+3 together. The biggest wins are: avoid re-reading the source image on every crop change, and avoid redundant Lanczos3 resizes.

#### Fix 4: Window Size / Layout

1. **Increase minimum window to 800×800** — Simple config change
   - Pros: Zero code changes
   - Cons: Still not enough with many icons; larger than user might want
   - Effort: **Trivial**

2. **Reorder sections: Generate button FIRST, install section collapsible**
   - Move the Generate button above the install section
   - Make installed icons collapsible
   - Pros: Generate is always visible, install section expandable on demand
   - Cons: Larger refactor of layout
   - Effort: **Medium**

3. **Two-column layout for wider screens** — Put controls on left, preview + output on right
   - Pros: Better use of horizontal space
   - Cons: Major layout rework, CSS complexity
   - Effort: **Large**

**Recommendation:** Option 1 (800×800 default) + make installed icons scrollable (Fix 1 Option 3). The CSS scroll is the highest-ROI fix.

---

### Dependencies Between Fixes

- **Fix 1 (icons limit)** → has the biggest impact on layout. Without it, no window size is sufficient.
- **Fix 4 (window size)** → depends on Fix 1 being done first (otherwise just adds whitespace).
- **Fix 2 (preview size)** → independent.
- **Fix 3 (freeze)** → independent, but should be prioritized alongside the others.

### Recommended Order

1. **Fix 1** (icons list: CSS scroll + limit) — immediate layout fix
2. **Fix 2** (preview size: cap at 2×) — quick UX improvement  
3. **Fix 3** (freeze: source cache + async commands) — performance
4. **Fix 4** (window: increase to 800×800) — final polish

### Specific File Changes

**Fix 1 — Installed icons list:**
- `src/InstallPanel.tsx` line 163: wrap `.install-installed-tags` in a `<div>` with max-height + overflow-y: auto
- `src/App.css`: add CSS class for the scroll container
- Optional: add JavaScript to limit visible count with expand

**Fix 2 — Preview size:**
- `src/StatePreview.tsx` line 14: change `MAX_STATE_DISPLAY` from `150` to `60` (or change `getDisplayScale` cap from 3 to 2)
- Add actual-size annotation label

**Fix 3 — Freeze:**
- `src-tauri/src/lib.rs`: change `fn process_icon`, `fn preview_icon`, `fn list_installed_icons` to `async fn`
- `src-tauri/src/image_processor.rs`: refactor to accept cached source, add `lazy_static`/`OnceLock` cache for source image
- `src-tauri/src/lib.rs`: wrap heavy processing in `tokio::task::spawn_blocking`
- May need to add `tokio` feature to tauri in `Cargo.toml`

**Fix 4 — Window/layout:**
- `src-tauri/tauri.conf.json`: change `"height": 600` to `"height": 800`
- `src/App.css`: adjust container max-width if needed

### Risks

- Adding `async` to Tauri commands may require restructuring error handling if existing code assumes synchronous behavior
- Source image caching introduces a `OnceLock` or `Mutex` — must handle cache invalidation when user selects a new file
- CSS-only scroll for icons may not be discoverable; some users might not know they can scroll
- Preview size change from 3× to 2× might feel "smaller" — need to ensure it still looks good

### Ready for Proposal
**Yes** — all four issues have clear root causes and concrete fix options with effort estimates. The proposal phase can define scope and approach for each.

---

### Effort Summary

| Fix | Effort | Risk | Impact |
|-----|--------|------|--------|
| 1. Icons list overflow | Trivial-Small | Low | High |
| 2. Preview size accuracy | Trivial | None | Medium |
| 3. Freeze on image load | Medium | Medium | High |
| 4. Window size/layout | Trivial-Medium | Low | Medium |
