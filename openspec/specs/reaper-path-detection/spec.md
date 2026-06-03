# reaper-path-detection Specification

## Purpose

Detection of REAPER installation directories, including hybrid Wine/Proton setups on Linux.

## Requirements

### Requirement: Native Path Detection

The system MUST detect standard native REAPER resource paths.

#### Scenario: Native installation

- GIVEN REAPER is installed natively on the host OS
- WHEN the path detection routine runs
- THEN it MUST return the correct native resource path

### Requirement: Hybrid Path Detection

The system MUST detect REAPER installations running under Wine or Proton on Linux.

#### Scenario: Wine/Proton installation on Linux

- GIVEN the OS is Linux and REAPER is installed via Wine or Proton
- WHEN the path detection routine runs
- THEN it MUST return the translated path to the Wine/Proton prefix

### Requirement: Manual Fallback

The system SHOULD allow manual path selection if automatic detection fails.

#### Scenario: Manual path fallback

- GIVEN automatic detection cannot find REAPER
- WHEN the user is prompted
- THEN they MUST be able to manually select the resource directory via the UI
