# Changelog

All notable changes to `@sigx/ssg` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.4.8] - 2026-05-14

### Fixed

- Moved `@mdx-js/rollup` from `devDependencies` to `dependencies`. It is dynamically imported at runtime by the MDX Vite plugin, so it must be installed in consumer projects. Previously, building a project that used `@sigx/ssg` would fail with `ERR_MODULE_NOT_FOUND: '@mdx-js/rollup'`.

## [0.4.2] - 2026-05-10

### Changed

- First release published via GitHub Actions with npm provenance attestation. Functionally identical to `0.4.1`.

## [0.4.1] - 2026-05-10

### Changed

- First release from the dedicated [`signalxjs/ssg`](https://github.com/signalxjs/ssg) repo. Source extracted from the SignalX incubation repo with no API changes.
- `@sigx/cli` moved from `dependencies` to optional `peerDependencies`. Standalone vite-plugin usage no longer pulls in `@sigx/cli`. Consumers using the sigx-cli plugin path install `@sigx/cli` themselves.
- `repository`, `homepage`, and `bugs` fields now point at `signalxjs/ssg`.
