# Changelog

All notable changes to `@sigx/ssg-theme-daisyui` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- **Aligned to SignalX core 0.15** ([#215](https://github.com/signalxjs/ssg/issues/215)): layouts now call `slots.default?.()` — core 0.15 types every slot as possibly-undefined (`SlotsObject` makes `default` optional regardless of the declared slots interface), so the previous unguarded `slots.default()` no longer compiles. Runtime behavior is unchanged when a fill is present; a layout rendered with no page content now renders nothing in that position instead of throwing.

## [0.20.0] - 2026-08-03

### Changed

- **Version bump only**, keeping lockstep with `@sigx/ssg` 0.20.0 (the `workspace:^` peer publishes as `^0.20.0`). No changes in this package; see the `@sigx/ssg` changelog for what 0.20.0 ships (TSX `export const meta` at build time, per-page OG overrides, opt-in auto JSON-LD).

## [0.19.0] - 2026-07-31

### Changed

- **Aligned to SignalX core 0.14**, matching `@sigx/ssg` 0.19.0 — the published
  `sigx` and `@sigx/router` peer ranges move to core 0.14 / router 0.11 (#199).
  In the source tree both read `"catalog:"`; pnpm substitutes the concrete
  ranges from `pnpm-workspace.yaml` on publish. Breaking for consumers on core
  0.13; no API change here.

## [0.18.0] - 2026-07-23

### Changed

- **Retargeted the `@sigx/*` catalog from the 0.12 core line to 0.13** ([#195](https://github.com/signalxjs/ssg/issues/195), completing [#194](https://github.com/signalxjs/ssg/pull/194)). In the source tree, `sigx` and `@sigx/router` peers/devDeps stay `"catalog:"` refs; pnpm rewrites them on `pnpm pack`/publish so the effective published peer ranges become `sigx` `^0.12.0` → `^0.13.0` and `@sigx/router` `^0.9.0` → `^0.10.0` (the `@sigx/ssg` peer is `workspace:^` in-tree, rewritten to the concrete `^0.18.0` on publish; `daisyui`/`tailwindcss` peers unchanged). Keeps the theme installable alongside `@sigx/ssg` on core 0.13 without pulling a second copy of the SignalX core. No code or API change.

## [0.17.0] - 2026-07-18

### Changed

- **Aligned `@sigx/*` dependency pins with the 0.12 core line and moved core/router pins into a pnpm catalog** ([#187](https://github.com/signalxjs/ssg/issues/187)). In the source tree, `sigx` and `@sigx/router` peers/devDeps are now `"catalog:"` refs (resolved from the shared catalog in `pnpm-workspace.yaml`); pnpm rewrites them on `pnpm pack`/publish so the effective published peer ranges become `sigx` `>=0.10.0 <0.11.0` → `^0.12.0` and `@sigx/router` `>=0.8.0 <0.9.0` → `^0.9.0` (`@sigx/ssg` peer stays `workspace:^`; `daisyui`/`tailwindcss` peers unchanged). Keeps the theme installable alongside `@sigx/ssg` on core 0.12 without pulling a second copy of the SignalX core. No code or API change.

## [0.16.0] - 2026-07-16

### Changed

- **Aligned `@sigx/*` dependency pins with the 0.10 core line** ([#182](https://github.com/signalxjs/ssg/issues/182)). Peer ranges: `sigx` `>=0.7.0 <0.8.0` → `>=0.10.0 <0.11.0`, `@sigx/router` `>=0.7.0 <0.8.0` → `>=0.8.0 <0.9.0` (`@sigx/ssg` peer stays `workspace:^`; `daisyui`/`tailwindcss` peers unchanged). devDependencies bumped to match (`sigx` → `^0.10.0`, `@sigx/router` → `^0.8.0`). Keeps the theme installable alongside `@sigx/ssg` on the 0.10 core without pulling a second copy of the SignalX core. No code or API change.

## [0.15.0] - 2026-07-13

No changes — version aligned with `@sigx/ssg` 0.15.0.

## [0.14.0] - 2026-06-16

No changes — version aligned with `@sigx/ssg` 0.14.0.

## [0.13.0] - 2026-06-16

No changes — version aligned with `@sigx/ssg` 0.13.0.

## [0.12.0] - 2026-06-15

### Changed

- **Aligned `@sigx/*` dependency pins with the 0.7 core line** ([#152](https://github.com/signalxjs/ssg/issues/152)): the `@sigx/router` and `sigx` peer ranges moved from `>=0.6.0 <0.7.0` to `>=0.7.0 <0.8.0` (development pins bumped to `^0.7.0`); the `@sigx/ssg` peer stays `workspace:^`. Keeps the theme on the consumer app's single copy of the SignalX core, now that 0.7 is published.

## [0.11.1] - 2026-06-13

No changes — version aligned with `@sigx/ssg` 0.11.1.

## [0.11.0] - 2026-06-12

### Changed

- **Aligned `@sigx/*` dependency pins with the 0.6 core line** ([#135](https://github.com/signalxjs/ssg/issues/135)): `@sigx/router` and `@sigx/ssg` moved from `dependencies` to `peerDependencies` (`@sigx/router` at `>=0.6.0 <0.7.0`), and the `sigx` peer range widened from `^0.4.3` to `>=0.6.0 <0.7.0` — the theme now always shares the consumer app's copies of the router, the SSG, and the SignalX core. Consumers must depend on `@sigx/router` and `@sigx/ssg` themselves (most package managers auto-install peers; every `@sigx/ssg` site already depends on both).

## [0.10.0] - 2026-06-12

### Added

- Per-page chrome ([#65](https://github.com/signalxjs/ssg/issues/65)): `AnnouncementBar` (dismissible, `site.announcement`, rendered by all three layouts), `Breadcrumbs` (collection sidebar trail, docs layout), and `PageFooter` (edit-this-page from `site.editBase` + `meta.sourceFile`, last-updated from frontmatter `updated`/`date`) — all config-driven, no site code needed.

### Fixed

- Blog layout author line renders under SSR (worked around the renderer dropping an expression adjacent to literal text).

## [0.9.0] - 2026-06-12

No changes — version aligned with `@sigx/ssg` 0.9.0.

## [0.8.1] - 2026-06-12

### Added

- The built-in layouts forward `site.search` to the Header, so the ⌘K command palette can be enabled from config alone (`site: { search: true }`) without composing a custom layout ([#116](https://github.com/signalxjs/ssg/issues/116)).

## [0.8.0] - 2026-06-11

### Added

- `CommandPalette` component ([#62](https://github.com/signalxjs/ssg/issues/62)): ⌘K / Ctrl+K search over the build-time index (`search: true` in ssg.config.ts) — lazy index load, keyboard navigation (arrows/Enter/Escape), heading deep-links. Opt in via the new `Header` prop `search` (`true` or `{ base }` for subpath deploys), or compose `components.CommandPalette` directly.
- `PrevNext` component ([#65](https://github.com/signalxjs/ssg/issues/65)): previous/next page links in sidebar reading order (from `virtual:ssg-navigation`), rendered by the docs layout under the article.
- No-FOUC theme init ([#65](https://github.com/signalxjs/ssg/issues/65)): the theme contributes an inline head script that applies the persisted (or OS-preferred) light/dark theme before first paint.
- Collapsible sidebar section groups (native `<details>`, open by default).
- `TOC` options ([#65](https://github.com/signalxjs/ssg/issues/65)): `minLevel`/`maxLevel` props, per-page `toc: false` and `toc.minLevel/maxLevel` frontmatter via the new `meta` prop (the docs layout passes it), and `data-toc-ignore` to skip individual headings.

### Fixed

- The header theme toggle now persists the choice and respects `prefers-color-scheme` — it used to default to light on every load ([#65](https://github.com/signalxjs/ssg/issues/65)).
- Docs layout no longer renders a duplicate `<h1>` when the page's title comes from its leading `# Heading` ([#65](https://github.com/signalxjs/ssg/issues/65)).

## [0.7.1] - 2026-06-11

### Changed

- No functional changes; version aligned with `@sigx/ssg` 0.7.1.

## [0.7.0] - 2026-06-11

### Changed

- Header and Footer no longer hardcode SignalX branding ([#60](https://github.com/signalxjs/ssg/issues/60)): the brand is `site.title` (+ optional `site.logo`), the nav renders `site.nav`, and the repository link appears only when `site.repo` is set — all flowing in via the new `LayoutProps.site`. Sites other than sigx.dev can finally use the theme as-is.

### Fixed

- Sidebar active-item matching is now trailing-slash-insensitive, so highlighting works when a built site is served at `/about/` while nav hrefs are generated without the slash ([#41](https://github.com/signalxjs/ssg/issues/41)).
- TOC items no longer show a trailing `#` — heading text is extracted excluding the appended autolink anchor (new exported helper `extractHeadingText`) ([#55](https://github.com/signalxjs/ssg/issues/55)).

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
