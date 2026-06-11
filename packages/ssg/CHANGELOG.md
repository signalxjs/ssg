# Changelog

All notable changes to `@sigx/ssg` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed

- `data-no-spa` now opts out an anchor **or any ancestor container** from SPA navigation, and LivePreview islands carry it by default — links inside rendered example previews can no longer hijack navigation ([#95](https://github.com/signalxjs/ssg/issues/95)).

## [0.7.0] - 2026-06-11

### Fixed

- Optional route segments `[[id]]` now parse to `:id?` instead of the garbage pattern `:[id]` (the plain `[id]` branch matched first), and expanding a dynamic route no longer leaks the `?` optional marker into output paths (`/users/x?`) or corrupts paths when one param name is a prefix of another (`:id` vs `:id2`) ([#50](https://github.com/signalxjs/ssg/issues/50)).
- `markdown.*` (Shiki themes/langs, `triggerLabel`, `defaultPackageManager`, `remarkPlugins`, `rehypePlugins`) and `toc.minLevel`/`maxLevel` from `ssg.config.ts` now actually reach the MDX pipeline — they were silently ignored because the MDX plugin captured its options at construction, before the config file was loaded. The pipeline is now built lazily on first transform from the resolved config, so the config file and `ssgPlugin()` arguments are one config surface ([#47](https://github.com/signalxjs/ssg/issues/47)).
- Canonical, `og:url`, and sitemap `<loc>` URLs now carry a trailing slash for folder routes (`/about` → `https://site/about/`), matching the `<path>/index.html` output layout that static hosts serve with 200 — previously every declared URL was a 301 ([#41](https://github.com/signalxjs/ssg/issues/41)). The root path and explicit `.html` routes are unchanged, and a per-page `meta.canonical` is never rewritten.
- Pages with `draft: true` frontmatter are now actually excluded from production builds and the sitemap, as documented — previously they were rendered, published, and advertised to crawlers (only sidebar navigation hid them). Use the new `--drafts` build flag (`BuildOptions.drafts`) to include them ([#48](https://github.com/signalxjs/ssg/issues/48)).
- `base` set in `ssg.config.ts` is now passed to both production Vite builds, so asset URLs in built HTML carry the prefix on subpath deploys — previously it only reached the router and sitemap, breaking every script/stylesheet unless `base` was duplicated in `vite.config.ts` ([#49](https://github.com/signalxjs/ssg/issues/49)).
- Dynamic routes (`[slug]`, `[...path]`) now actually build. `getStaticPaths` was loaded by `import()`ing the raw `.tsx`/`.mdx` source — which Node cannot do — and the resulting error was swallowed into a warning, so every dynamic route was silently skipped with a 0 exit code. The build now resolves `getStaticPaths` from the built SSR bundle (the generated server entry exports `getStaticPathsForRoute`), and a `getStaticPaths` that throws fails the build instead of being skipped ([#46](https://github.com/signalxjs/ssg/issues/46)).
- Dev server: editing a layout file now triggers a reload (the virtual layouts module was invalidated but the browser was never told, showing stale UI until manual refresh), and the first frontmatter edit per file after server start is no longer dropped (the hash cache is seeded at route scan, and unseeded files are treated as changed) ([#53](https://github.com/signalxjs/ssg/issues/53)).
- MDX/TOC correctness batch ([#55](https://github.com/signalxjs/ssg/issues/55)):
  - The exported `headings` now come from the same rehype pass that renders the document (collected per-file from `rehypeExtractHeadings`), so TOC anchor ids always match the rendered `id`s — previously a divergent plain-remark re-parse produced ids that didn't exist for headings containing MDX expressions or inline code edge cases.
  - Heading extraction runs before the autolink plugin and skips `heading-anchor` elements, so extracted heading text no longer carries a trailing `#`.
  - Pages titled only by a leading `# Heading` (no frontmatter `title`) now get that H1 as `<title>`/`og:title` — the fallback existed but never reached head generation. Fenced ```` ``` ```` blocks are ignored when looking for the H1.
  - Code fences in any bundled Shiki language now highlight — grammars outside the configured `langs` list (e.g. `python`, `rust`) are loaded on demand instead of collapsing to plain text.
  - The package-manager switcher no longer renders wrong commands: lines with manager-specific flags (`--legacy-peer-deps`, `--frozen-lockfile`, …) or compound commands (`&&`, `;`, `|`) are left untranslated, and `dlx`/`create`/`run` arguments (including their flags) are preserved verbatim instead of having `-D`/`-g` stripped.
- Build robustness batch ([#52](https://github.com/signalxjs/ssg/issues/52)):
  - Failed page renders now **fail the build** (structured `SSG300` error listing every failed page) instead of exiting 0 with pages missing — including pages whose component threw during SSR and was swallowed into an `<!--ssr-error-->` marker by the renderer.
  - A syntax/runtime error in `ssg.config.ts` and a configured `theme` package that fails to load are now hard errors instead of silently falling back to defaults / building without the theme.
  - Page HTML containing `String.replace` patterns (`` $` ``, `$'`, `$&`, `$1`) is no longer corrupted when spliced into the template.
  - The user's `index.html` is restored and `.ssg-temp-*` entry files are removed on SIGINT/SIGTERM too, not just on normal completion.
  - `ssg build` now works zero-config: without a `vite.config`, the build injects the same plugin set (`@sigx/vite`, optional Tailwind, the SSG plugins, oxc JSX) the zero-config dev server uses — previously the virtual entries could never resolve. `vite.config.mts` is now also detected (dev mode previously double-registered plugins for `.mts` users).
- Route params and `getStaticPaths` `props` now reach page components as documented (`props.params.slug`, plus per-path props spread at the top level) — previously the generated LayoutRouter rendered every page with empty props and the server entry dropped the render context, so the documented pattern SSR'd to an error ([#73](https://github.com/signalxjs/ssg/issues/73)). Props are registered per path in the generated layouts module (`setPageProps`), the build embeds a `window.__SSG_PROPS__` payload (XSS-hardened) so hydration uses the same props the server rendered with, and `params` always flows from the matched route — including after client-side navigation. The dead duplicate `generateThemeLayoutsModule` codegen was removed.

- Windows: watcher and HMR handlers now match page/layout files (dir prefix checks compared backslash `path.resolve` results against Vite's posix-normalized paths and never matched), prefix matching is path-boundary-safe on every OS (`src/pages-archive` no longer matches `src/pages`), and the production HTML template's `<script src>` no longer contains backslashes ([#54](https://github.com/signalxjs/ssg/issues/54)).
- Sitemap/robots plumbing ([#56](https://github.com/signalxjs/ssg/issues/56)): pages with `robots: noindex` and the `/404` page are no longer advertised in sitemap.xml; a user-supplied `public/robots.txt` is no longer overwritten; without `site.url` the sitemap is skipped with a warning instead of emitting spec-invalid relative `<loc>` URLs; and frontmatter `date` now becomes `<lastmod>` (a first freshness signal toward [#38](https://github.com/signalxjs/ssg/issues/38)).
- 404 story ([#57](https://github.com/signalxjs/ssg/issues/57)): a `src/pages/404.*` page is now emitted as a ROOT `404.html` — the not-found convention GitHub Pages / Netlify / Cloudflare actually serve — instead of `404/index.html`; and the dev server returns an honest **404 status** for URLs that match no route (it previously served the SPA shell with 200 for any extension-less URL, so typos looked like blank successful pages).
- Dead config options audit ([#51](https://github.com/signalxjs/ssg/issues/51)):
  - `clientEntry`, `serverEntry`, and `htmlTemplate` now actually work — explicit config paths win over convention detection, `htmlTemplate: false` forces the generated template, and a configured path that doesn't exist is a hard error. Previously `detectCustomEntries` ignored its config parameter entirely.
  - `CollectionConfig.layout` now provides the fallback layout for pages under that collection's path (frontmatter/`export const layout` still wins), matching the documented precedence.
  - `BuildOptions.concurrency` JSDoc corrected to the real default (20) and exposed as `--concurrency` on `sigx ssg build`.

### Removed

- The never-read `SSGConfig.vite`, `SSGConfig.autoEntries`, and `ThemeConfig.css` options (silent no-ops since introduction). Theme-contributed CSS is part of the Theme API v2 design ([#60](https://github.com/signalxjs/ssg/issues/60)) ([#51](https://github.com/signalxjs/ssg/issues/51)).


### Added

- Build pipeline hooks ([#58](https://github.com/signalxjs/ssg/issues/58)): `hooks.transformHtml(html, page)` (per page, before write), `hooks.onPageRendered(page & { html })` (per page, after write), and `hooks.postBuild(result, { outDir, config })` (once, after sitemap) in `ssg.config`. The extension points for search indexing, OG-image generation, link checking, redirects emission, HTML post-processing. A hook that throws fails the build.
- Theme API v2, first slice ([#60](https://github.com/signalxjs/ssg/issues/60)): a theme's exported `config` can now contribute `markdown.remarkPlugins`/`rehypePlugins` (run before the site's own), `head` tags (prepended to `site.head`), `css` import specifiers (prepended to `clientImports`), and a `defaultLayout` (used when the site doesn't set one) — merged via the new `applyThemeConfig`/`resolveThemeConfig`/`loadThemeModule` exports. `SiteConfig` gains `nav`/`logo`/`repo` branding fields, and layouts now receive the whole site config as `LayoutProps.site` (embedded in the generated layouts module), so themes can render branding without hardcoding it. `navigation.sectionOrder` makes category ordering configurable (merged over the built-in defaults) instead of baking SignalX category names into core.
- SPA navigation for internal links ([#35](https://github.com/signalxjs/ssg/issues/35)): the client runtime now routes same-origin anchor clicks — including bare `<a>` links from MDX content and layout markup — through the router instead of full page reloads. One delegated listener; the browser keeps handling modified clicks, external/`mailto:` links, `target`/`download` anchors, same-page `#hash` scrolls, and anything that already called `preventDefault()` (RouterLink). Base-aware on subpath deploys. Exported as `installSpaNavigation(router, { base? })` from `@sigx/ssg/client`, wired automatically into the generated client entry; opt out per link with `data-no-spa` or globally with the new `spaNavigation: false` config. Replaces the docs site's `spaLinks.ts` workaround.

- `@sigx/ssg/styles.css` — a base stylesheet for the markup ssg emits (code-window chrome, npm/pnpm/yarn/bun switcher tabs, heading anchors, dual-theme Shiki switching via `prefers-color-scheme` or a `.dark`/`[data-theme="dark"]` toggle). CSS-variable driven (`--ssg-*`) so themes restyle without selector overrides; page typography is deliberately left to the site. Import once (e.g. `clientImports: ['@sigx/ssg/styles.css']`). Previously every consumer styled `.code-window*` from scratch — the docs site carries ~500 lines for this (part of [#64](https://github.com/signalxjs/ssg/issues/64); transformers/mermaid remain there).

- `sitemap` config option carrying `SitemapOptions` (`exclude`, `additionalUrls`, `defaultChangefreq`, `defaultPriority` — previously dead API with no way to reach `writeSitemap`), or `sitemap: false` to disable generation. `PageBuildResult` now carries the page's `meta`, so build consumers (feeds, audits) can act on frontmatter ([#56](https://github.com/signalxjs/ssg/issues/56)).

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
