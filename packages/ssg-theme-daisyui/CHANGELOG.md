# Changelog

All notable changes to `@sigx/ssg-theme-daisyui` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed

- Sidebar active-item matching is now trailing-slash-insensitive, so highlighting works when a built site is served at `/about/` while nav hrefs are generated without the slash ([#41](https://github.com/signalxjs/ssg/issues/41)).

## [0.6.0] - 2026-06-09

### Changed

- Version bump in lockstep with `@sigx/ssg` 0.6.0. No functional changes.

## [0.5.0] - 2026-06-08

### Changed

- Version bump in lockstep with `@sigx/ssg` 0.5.0. No functional changes.

## [0.4.2] - 2026-05-10

### Changed

- First release published via GitHub Actions with npm provenance attestation. Functionally identical to `0.4.1`.

## [0.4.1] - 2026-05-10

### Added

- Initial release. daisyUI/Tailwind theme for `@sigx/ssg` with pre-built layouts (default, docs, blog) and components (Header, Sidebar, Footer, TOC).
