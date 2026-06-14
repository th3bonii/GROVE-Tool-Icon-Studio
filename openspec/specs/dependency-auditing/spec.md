# dependency-auditing Specification

## Purpose

Detect known vulnerabilities in npm and Cargo dependencies on every PR commit and on a weekly schedule, preventing vulnerable code from reaching production.

## Requirements

### Requirement: PR Dependency Audit

On every PR commit, the CI workflow MUST run `npm audit` and `cargo audit`. If either detects a vulnerability with severity above the configured threshold, the CI check MUST fail.

#### Scenario: No vulnerabilities — both pass

- GIVEN a PR has no vulnerable dependencies
- WHEN `npm audit` and `cargo audit` run
- THEN both commands MUST exit with code 0
- AND the CI check MUST pass

#### Scenario: Vulnerability detected — CI fails

- GIVEN a PR depends on a package with a known vulnerability
- WHEN `cargo audit` or `npm audit` runs
- THEN the audit command MUST exit with a non-zero code
- AND the CI check MUST report failure

### Requirement: Weekly Scheduled Audit

A separate cron-triggered workflow MUST run `npm audit` and `cargo audit` weekly. It SHOULD report results without blocking other workflows.

#### Scenario: Weekly cron triggers audit

- GIVEN the current day matches the cron schedule
- WHEN the weekly audit workflow runs
- THEN both `npm audit` and `cargo audit` execute
- AND results are reported in the Actions log

### Requirement: False Positive Management

Audit workflows SHOULD support `--ignore` flags for specific advisories. Ignored advisories MUST be documented with a comment explaining the justification.

#### Scenario: False positive ignored

- GIVEN a known false-positive advisory RUSTSEC-XXXX-XXXX
- WHEN the audit workflow runs with `--ignore RUSTSEC-XXXX-XXXX`
- THEN the audit passes despite the advisory
- AND the advisory and justification are documented in the workflow YAML
