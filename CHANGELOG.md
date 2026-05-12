# Changelog

All notable changes to Mode Manager are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] — 2026-05-11

First public release.

### Added

- **Seven new built-in modes**: Local Bus, Trolleybus, Light Rail, Aerial Gondola, Funicular, High-Speed Rail, and Maglev — bringing the bundled total to 11 transit modes.
- **Cross-mode track sharing**: bus modes can use each other's roads; trams can run on light-rail tracks and trolleybus overhead-wire infrastructure.
- **In-game mode editor**: create new modes or edit existing ones via a form-based UI with section grouping, validation, and per-field error highlighting. Optional sections (Track Geometry, Maintenance Costs, Elevation Multipliers) collapse by default.
- **Mode actions in the Library tab**: per-row Edit (✏️), Duplicate (⎘), and Copy JSON (📋) buttons; bottom-of-list **Explore**, **Export**, **Create**, and **Remove Modes** buttons.
- **Auto-computed defaults** in the editor: blank fields show `auto: N` or `default: N` placeholders; on Save, station lengths derive from car count × car length, deceleration from acceleration + 0.1, and optional stats fall back to sensible defaults.
- **10% tolerance buffer** on auto-computed `maxStationLength` so placed stations comfortably fit the longest train without engine rounding rejecting them.
- **Mod-aware detection**: the This Save tab lists transit modes registered by other mods with a 📦 icon and "Managed by another mod" tooltip.
- **Import-failure recovery**: a failed import opens the editor pre-filled with whatever parsed, highlighting the specific validation issue inline.
- **Project copyright attribution**: explicit copyright header in `LICENSE` and `SPDX-License-Identifier` declaration in source.

### Changed

- **Library tab restructured** with **Saved Modes**, **Available defaults**, and **Import a Mode** sections.
- **Toolbar panel widened** to 480 px to accommodate the editor's two-column form; the panel also scrolls vertically inside the viewport.
- **Friendly editor labels**: stats display as Title Case (e.g., `maxLateralAcceleration` → "Max Lateral Acceleration (optional)").
- **Source-tag subtitles removed** from the Library — built-ins and imports are functionally identical from 1.0.4 onward.
- **README** rewritten with feature cards, screenshots, and a curated mode showcase.

### Fixed

- **Parallel and quad track build modes** no longer crash on custom modes — added the missing geometry stats (`parallelTrackSpacing`, `trackClearance`, `minTurnRadius`, `minStationTurnRadius`, `maxLateralAcceleration`, `maxSlopePercentage`, `stopTimeSeconds`, etc.) to BUILTINS and the auto-default layer.
- **Workflows on private repos**: `actions/checkout` failures resolved by declaring `contents: read` permission in `repo-setup.yml` and `labels-sync.yml`.

### Removed

- Verbose route-shape debug log that fired on every save load.

## [1.0.0] — 2026-05-10

Initial internal release.

### Added

- Per-save transit mode selection for Subway Builder.
- Four built-in modes: Tram, Bus Rapid Transit, Monorail, and People Mover.
- Library tab with import-from-JSON capability.
- This Save tab listing committed modes with lock/remove controls.
- Auto-reload of the mod after add/remove via `api.reloadMods()`.
- Snapshot-at-commit: each save pins its own copy of every mode definition, isolating saves from library changes.

[Unreleased]: https://github.com/Mpfk/subway-builder-mode-manager/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/Mpfk/subway-builder-mode-manager/releases/tag/v1.1.0
[1.0.0]: https://github.com/Mpfk/subway-builder-mode-manager/releases/tag/v1.0.0
