# Changelog

All notable changes to `@sigx/ssg` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed

- Optional route segments `[[id]]` now parse to `:id?` instead of the garbage pattern `:[id]` (the plain `[id]` branch matched first), and expanding a dynamic route no longer leaks the `?` optional marker into output paths (`/users/x?`) or corrupts paths when one param name is a prefix of another (`:id` vs `:id2`) ([#50](https://github.com/signalxjs/ssg/issues/50)).
- `markdown.*` (Shiki themes/langs, `triggerLabel`, `defaultPackageManager`, `remarkPlugins`, `rehypePlugins`) and `toc.minLevel`/`maxLevel` from `ssg.config.ts` now actually reach the MDX pipeline — they were silently ignored because the MDX plugin captured its options at construction, before the config file was loaded. The pipeline is now built lazily on first transform from the resolved config, so the config file and `ssgPlugin()` arguments are one config surface ([#47](https://github.com/signalxjs/ssg/issues/47)).
- Canonical, `og:url`, and sitemap `<loc>` URLs now carry a trailing slash for folder routes (`/about` → `https://site/about/`), matching the `<path>/index.html` output layout that static hosts serve with 200 — previously every declared URL was a 301 ([#41](https://github.com/signalxjs/ssg/issues/41)). The root path and explicit `.html` routes are unchanged, and a per-page `meta.canonical` is never rewritten.
- Pages with `draft: true` frontmatter are now actually excluded from production builds and the sitemap, as documented — previously they were rendered, published, and advertised to crawlers (only sidebar navigation hid them). Use the new `--drafts` build flag (`BuildOptions.drafts`) to include them ([#48](https://github.com/signalxjs/ssg/issues/48)).

### Added

- `trailingSlash: 'always' | 'never'` config option (default `'always'`) controlling the policy above, and a `normalizePagePath` export implementing it ([#41](https://github.com/signalxjs/ssg/issues/41)).

## [0.6.0] - 2026-06-09

### Added

- Per-page custom `<head>` tags and JSON-LD structured-data injection API ([#36](https://github.com/signalxjs/ssg/issues/36)).
- Package-manager switcher on shell fences. `bash`/`shell`/`sh`/`zsh` fences whose lines are `npm`/`pnpm`/`yarn`/`bun` commands (`add`/`install`, `run`, `dlx`, `create`, `remove`, …) now render an npm/pnpm/yarn/bun tab strip with all four command variants generated server-side; the client switcher (auto-wired into the generated client entry; it registers a few cheap page-wide listeners and does no visible work when a page has no install fences) only toggles which variant is visible and persists the choice (localStorage, synced across blocks/tabs/pages). It never rewrites highlighted line text, so it can't race framework hydration. Configurable default via `markdown.shiki.defaultPackageManager` (default `'pnpm'`). Non-install lines (e.g. `sigx prebuild`) are left untouched. Replaces the docs-side DOM enhancer that broke on markup changes ([#40](https://github.com/signalxjs/ssg/issues/40)).

## [0.5.0] - 2026-06-08

### Added

- Configurable live-code "Try Live" trigger label via `markdown.shiki.triggerLabel`, with a per-fence `label="…"` override ([#29](https://github.com/signalxjs/ssg/issues/29)).

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
