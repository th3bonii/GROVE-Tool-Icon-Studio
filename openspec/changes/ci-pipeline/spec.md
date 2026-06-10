# CI/CD Pipeline Specification

## Purpose

Validate every PR to `main` via automated linting, type-checking, testing, and static analysis for both TypeScript and Rust layers of the Tauri v2 application.

## Requirements

| ID | Title | Strength | Description |
|----|-------|----------|-------------|
| R1 | PR Trigger | MUST | Run CI on every push and pull_request to `main` |
| R2 | Runner Matrix | MUST | Use `ubuntu-latest` with Node 20 and Rust stable |
| R3 | lint Job | SHOULD | Run `npm run lint` (ESLint) with `continue-on-error: true` |
| R4 | type-check Job | MUST | Run `npx tsc -b` — blocking |
| R5 | test-ts Job | MUST | Run `npx vitest run` — blocking |
| R6 | test-rust Job | MUST | Run `cargo test` in `src-tauri/` — blocking |
| R7 | clippy Job | SHOULD | Run `cargo clippy -- -D warnings` with `continue-on-error: true` |
| R8 | npm Cache | SHOULD | Cache `node_modules` via `actions/setup-node` |
| R9 | Cargo Cache | SHOULD | Cache `~/.cargo` and `target/` via `Swatinem/rust-cache` |
| R10 | Job Timeouts | MUST | Each job MUST timeout at 15 minutes |

### Scenario: Full green PR

- GIVEN a PR to `main` with valid TypeScript and Rust code
- WHEN CI triggers on `pull_request`
- THEN lint passes (or warns), type-check passes, test-ts passes, test-rust passes, clippy passes (or warns)

### Scenario: Failing TypeScript test

- GIVEN a PR to `main` with a failing vitest suite
- WHEN CI triggers
- THEN `test-ts` fails, `type-check` fails with `tsc -b` compilation error, pipeline status is failure

### Scenario: Rust compilation failure

- GIVEN a PR to `main` with broken Rust code
- WHEN CI triggers
- THEN `test-rust` fails at compile step (no binaries to test), pipeline status is failure

### Scenario: Non-blocking lint warning

- GIVEN a PR to `main` with ESLint warnings (e.g. unused variable)
- WHEN CI triggers
- THEN `lint` job shows warnings but does NOT fail the pipeline

### Scenario: Non-blocking clippy warning

- GIVEN a PR to `main` with clippy pedantic warnings
- WHEN CI triggers
- THEN `clippy` job shows warnings but does NOT fail the pipeline

### Scenario: Job timeout

- GIVEN a PR to `main` where `test-rust` hangs (>15 min)
- WHEN CI triggers
- THEN the job is aborted by the 15-minute timeout and pipeline status is failure

### Scenario: Push to main

- GIVEN a direct push to `main` (e.g. merge commit)
- WHEN CI triggers on `push`
- THEN the same pipeline runs with all checks, identical to PR behavior
