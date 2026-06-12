# Changelog

> **Changelogs are kept per package** — see
> [`packages/ssg/CHANGELOG.md`](packages/ssg/CHANGELOG.md) and
> [`packages/ssg-theme-daisyui/CHANGELOG.md`](packages/ssg-theme-daisyui/CHANGELOG.md).
> The entries below predate that convention (≤ 0.4.x) and are kept for history.


All notable changes to packages in this repo. Each package may also keep its own `packages/<name>/CHANGELOG.md`.

## [Unreleased]

- `@sigx/ssg`: **Feature** — per-page custom `<head>` + JSON-LD injection API ([#36](https://github.com/signalxjs/ssg/issues/36)). `PageMeta` gains `jsonLd`, `head`, `robots`, `canonical`, and `keywords`; `SiteConfig` gains site-wide `jsonLd` and `head`. JSON-LD is emitted as `<script type="application/ld+json">` (one per object, with `<` escaped to prevent `</script>` breakout); custom tags are injected after the auto-generated tags and deduped against them (an overridden `canonical`/`description` is not double-emitted). Output is unchanged when none of the new fields are set. Head generation moved to a dedicated `head.ts` module.

## 0.4.6 — 2026-05-12

- `@sigx/ssg`: **Fix** — generated client entry now calls `createWebHistory({ base })` instead of `createWebHistory(base)`. `@sigx/router` 0.4.x takes an options object; the old positional-string call silently passed `base = undefined`, so the router never stripped the base prefix from `window.location.pathname`. The result was that any deployment with a non-root `base` (e.g. GitHub Pages at `/docs/`) failed to match any routes — `LayoutRouter` rendered `null`, no page components hydrated, all `onMounted` hooks (typewriter, scroll-reveal, theme init, etc.) never fired, and the start page appeared "broken" (SSR HTML visible, but no interactivity). Verified end-to-end against signalxjs/docs.

## 0.4.5 — 2026-05-12

- `@sigx/ssg`: bump `@sigx/router` to `^0.4.5`, `@sigx/server-renderer` to `^0.4.3`, `sigx` peer to `^0.4.3`, `shiki` to `^4.0.2`, `esbuild` to `^0.28.0`.
- `@sigx/ssg-theme-daisyui`: bump `@sigx/router` to `^0.4.5`, `sigx` peer to `^0.4.3`.
- Repo: added `verify-pack` smoke test mirroring `signalxjs/core` (`pnpm verify:pack`) and ruleset-based branch protection on `main` requiring it.

## 0.4.3 — 2026-05-10

- `@sigx/ssg`: fix root index resolution, virtual types entry, and Vite base inheritance.

## 0.4.4 — 2026-05-10

- `@sigx/ssg`: pass router base into the virtual SSR entry.

## 0.4.2 — 2026-05-10

- `@sigx/ssr-islands` extracted to its own repo at [`signalxjs/ssr-islands`](https://github.com/signalxjs/ssr-islands). It is no longer published from this repo.
- First release published via GitHub Actions with npm provenance attestation.

## 0.4.1 — 2026-05-10

- Initial release of `signalxjs/ssg`. Packages extracted from the `viewti/lynx` incubation repo:
  - `@sigx/ssg` 0.3.2 → 0.4.1
  - `@sigx/ssg-theme-daisyui` (first publish at 0.4.1)
- `@sigx/ssg`: `@sigx/cli` moved from `dependencies` to optional `peerDependencies`. Standalone vite-plugin usage no longer pulls in `@sigx/cli`. Consumers using the sigx-cli plugin path install `@sigx/cli` themselves.
- `@sigx/router` is now in [`signalxjs/router`](https://github.com/signalxjs/router); `@sigx/store` is in [`signalxjs/store`](https://github.com/signalxjs/store). Both are consumed via npm.
