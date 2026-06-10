# Design: CI Pipeline

## Technical Approach

Single `.github/workflows/ci.yml` with three parallel jobs (lint, test-ts, test-rust). npm cache via `setup-node` built-in, cargo cache via `actions/cache`. Tauri system deps only in test-rust job (clippy doesn't link). PR trigger, Ubuntu-only.

## Architecture Decisions

### Decision: Three-job parallel structure

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Single sequential job | Simple, but Rust compilation blocks all feedback | ❌ |
| 2 jobs (lint + test all) | test-rust needs system deps that lint doesn't | ❌ |
| **3 parallel jobs** | lint fast (no linking), test-ts fast (vitest only), test-rust isolates bottleneck | ✅ |

**Rationale**: clippy in the lint job does NOT link — installing 200MB of Tauri system libs there is wasted time. test-rust needs `webkit2gtk` etc. for `cargo test` linking. vitest needs nothing but Node. Tests are required status checks; lint has `continue-on-error: true` (warn-only per spec).

### Decision: dtolnay/rust-toolchain

**Choice**: `dtolnay/rust-toolchain` with `components: [clippy]`
**Alternatives**: `actions-rust-toolchain`, manual install
**Rationale**: Community standard, built-in `components` support, maintained by Rust team.

### Decision: Cargo cache keyed on Cargo.lock

**Choice**: `actions/cache@v4` for `~/.cargo/{registry,git}` + `src-tauri/target`
**Alternatives**: `Swatinem/rust-cache` (simpler, but less transparent)
**Rationale**: Cargo.lock hash invalidates only on dep changes. Target dir caching speeds both clippy and test runs significantly. Raw `actions/cache` for predictability and visibility.

### Decision: System deps only in test-rust

**Choice**: `apt install` Tauri deps in test-rust only
**Alternatives**: Install in all jobs; dedicated setup job
**Rationale**: clippy (lint) does not link. vitest (test-ts) is pure Node. Only `cargo test` needs system libraries. Saves ~30s per lint/test-ts run.

## Data Flow

```
PR push → ci.yml
├── lint (continue-on-error)
│   ├── setup-node → npm ci → npm run lint
│   └── dtolnay/rust → cargo clippy
├── test-ts (required)
│   └── setup-node → npm ci → npm run build → npx vitest run
└── test-rust (required)
    └── apt tauri deps → dtolnay/rust → cargo test
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `.github/workflows/ci.yml` | Create | Three-job PR validation workflow |

## Interfaces / Contracts

No new interfaces. The workflow consumes existing npm and cargo contracts:
- **npm run lint** — ESLint flat config (`eslint.config.js`, ignores `dist/ src-tauri/`)
- **npm run build** — `tsc -b && vite build` (type-check + production bundle)
- **npx vitest run** — jsdom unit tests via `@testing-library/react`
- **cargo test** — 93 existing Rust unit tests (inline `#[cfg(test)]` modules)
- **cargo clippy** — Rust lint, no linking needed

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Workflow integrity | Jobs run, cache restores, deps install correctly | Push branch, verify Actions logs on first PR run |
| Cache hit ratio | Subsequent runs reuse cached cargo/npm | Observe "Cache restored" / "Cache miss" in logs |
| System deps | Tauri linking succeeds | `cargo test` fails if webkit2gtk is missing — first run validates |
| Blocking status | test-ts + test-rust block merge | Set as required checks in branch protection post-merge |

## Migration / Rollout

1. Create `.github/workflows/ci.yml` on a feature branch
2. Push branch → observe first CI run (no cache, full cargo compile: ~5-8 min)
3. Fix any failures discovered (lint, type errors, test failures) in same PR
4. After merge to `main`: configure branch protection requiring `test-ts` + `test-rust` status checks

## Open Questions

- [ ] Does `cargo clippy` pass cleanly? First CI run will reveal required fixes.
- [ ] Does `npm run build` (`tsc -b`) pass in CI? Local env may differ in strictness from CI.
- [ ] Node version: 20 (LTS) or 22? Decision needed before writing workflow.
- [ ] Is `prettier --check` desired? Prettier is installed but no format script exists in `package.json`.
