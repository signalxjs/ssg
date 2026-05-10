# Changelog

All notable changes to packages in this repo. Each package may also keep its own `packages/<name>/CHANGELOG.md`.

## [Unreleased]

## 0.4.2 — 2026-05-10

- `@sigx/ssr-islands` extracted to its own repo at [`signalxjs/ssr-islands`](https://github.com/signalxjs/ssr-islands). It is no longer published from this repo.
- First release published via GitHub Actions with npm provenance attestation.

## 0.4.1 — 2026-05-10

- Initial release of `signalxjs/ssg`. Packages extracted from the `viewti/lynx` incubation repo:
  - `@sigx/ssg` 0.3.2 → 0.4.1
  - `@sigx/ssg-theme-daisyui` (first publish at 0.4.1)
- `@sigx/ssg`: `@sigx/cli` moved from `dependencies` to optional `peerDependencies`. Standalone vite-plugin usage no longer pulls in `@sigx/cli`. Consumers using the sigx-cli plugin path install `@sigx/cli` themselves.
- `@sigx/router` is now in [`signalxjs/router`](https://github.com/signalxjs/router); `@sigx/store` is in [`signalxjs/store`](https://github.com/signalxjs/store). Both are consumed via npm.
