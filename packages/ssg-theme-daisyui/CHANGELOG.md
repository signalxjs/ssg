# Changelog

All notable changes to `@sigx/ssg-theme-daisyui` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
