# Changelog

All notable changes to `@sigx/ssg` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Package-manager switcher on shell install fences. ` ```bash `/`sh`/`zsh` fences whose lines are `npm`/`pnpm`/`yarn`/`bun` install commands now render an npm/pnpm/yarn/bun tab strip with all four command variants generated server-side; the client switcher (auto-wired into the generated client entry; it registers a few cheap page-wide listeners and does no visible work when a page has no install fences) only toggles which variant is visible and persists the choice (localStorage, synced across blocks/tabs/pages). It never rewrites highlighted line text, so it can't race framework hydration. Configurable default via `markdown.shiki.defaultPackageManager` (default `'pnpm'`). Non-install lines (e.g. `sigx prebuild`) are left untouched. Replaces the docs-side DOM enhancer that broke on markup changes ([#40](https://github.com/signalxjs/ssg/issues/40)).

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
