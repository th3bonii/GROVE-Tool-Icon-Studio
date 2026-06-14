# release-pipeline Specification

## Purpose

Automate building and publishing Tauri desktop bundles (.deb, .AppImage, .dmg) to GitHub Releases when a version tag is pushed.

## Requirements

### Requirement: Tag-Triggered Release Build

A GitHub Actions workflow MUST trigger on git tag push matching `v*`, build Tauri bundles via `cargo tauri build`, and create a GitHub Release with the built artifacts.

#### Scenario: Tag push creates release

- GIVEN a git tag matching `v*` is pushed (e.g., `v1.2.3`)
- WHEN the release workflow runs
- THEN `cargo tauri build` compiles the application
- AND a GitHub Release is created with the tag name
- AND the Release includes `.deb`, `.AppImage`, and `.dmg` artifacts

#### Scenario: Non-matching tag is ignored

- GIVEN a tag that does not match `v*` (e.g., `beta-1`)
- WHEN the tag is pushed
- THEN the release workflow MUST NOT run

#### Scenario: Build failure aborts release

- GIVEN a tag push triggers the workflow
- WHEN `cargo tauri build` fails
- THEN no GitHub Release MUST be published
- AND the workflow MUST report failure
