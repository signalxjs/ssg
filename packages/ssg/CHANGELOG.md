# Changelog

All notable changes to `@sigx/ssg` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.19.0] - 2026-07-31

### Changed

- **Aligned to SignalX core 0.14.** `peerDependencies` move from `sigx` /
  `@sigx/server-renderer` `^0.13.0` to `^0.14.0`, and `@sigx/router` from
  `^0.10.0` to `^0.11.0` (#199).

  This is a **breaking change for consumers still on core 0.13** — hence the
  minor. Core keeps reactive state in module-local variables, so two physical
  copies of `@sigx/reactivity` silently split it; move your app to core 0.14 in
  the same step rather than letting both resolve. After upgrading, check
  `pnpm why -r @sigx/reactivity` reports exactly one version.

  No API change in this package. Verified against a built site driven in
  Chromium: it hydrates, and client-side navigation updates the path, heading
  and docs sidebar on core 0.14 / router 0.11.

## [0.18.0] - 2026-07-23

### Changed

- **Retargeted the `@sigx/*` catalog from the 0.12 core line to 0.13** ([#195](https://github.com/signalxjs/ssg/issues/195), completing [#194](https://github.com/signalxjs/ssg/pull/194)). Effective (published) peer/dev ranges: `sigx` and `@sigx/server-renderer` `^0.12.0` → `^0.13.0`, `@sigx/router` `^0.9.0` → `^0.10.0` (`@sigx/router@0.10.0` is the release aligned to core 0.13 — it peers `sigx@^0.13.0`). In the source tree these stay `"catalog:"` refs and only resolve to the concrete ranges when pnpm rewrites them on `pnpm pack`/publish; the catalog block in `pnpm-workspace.yaml` now pins `sigx`/`@sigx/server-renderer`/`@sigx/vite` at `^0.13.0` and `@sigx/router` at `^0.10.0`. Pinning to a single minor via one catalog guarantees exactly one `@sigx/reactivity` copy across the workspace — two copies break reactivity. `@sigx/cli` peer (`>=0.4.0`) and the `vite` peer are unchanged.
- **Dev-toolchain pins moved to the 0.13-era releases**: `@sigx/cli` `^0.6.0` → `^0.7.0` and `@sigx/args` `^0.8.0` → `^0.9.0` in devDependencies. These are a separate tooling train (peering `@sigx/args`/`@sigx/terminal`, not core); `@sigx/cli@0.7.0` is the toolchain build aligned to core 0.13 (it devDepends `@sigx/vite@^0.13.0`), and `@sigx/args@0.9.0` is core-agnostic. The pre-0.13 `^0.6.0`/`^0.8.0` pins from [#194](https://github.com/signalxjs/ssg/pull/194) would have resolved the older core-0.12-era cli into the build toolchain.
- **No API migration.** `@sigx/ssg` consumes only stable surfaces from core/router/server-renderer/vite — none of core's 0.13 changes touch this repo (router 0.10 has no public API change). Verified against the published 0.13 packages: `pnpm verify:catalog`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test`, and `pnpm verify:pack` all pass, resolving a single copy of `sigx@0.13.0` / `@sigx/router@0.10.0` across every workspace.

## [0.17.0] - 2026-07-18

### Changed

- **Aligned `@sigx/*` dependency pins with the 0.12 core line and moved the core/router pins into a pnpm catalog** ([#187](https://github.com/signalxjs/ssg/issues/187)). Effective (published) peer ranges: `sigx` and `@sigx/server-renderer` `>=0.10.0 <0.11.0` → `^0.12.0`, `@sigx/router` `>=0.8.0 <0.9.0` → `^0.9.0` (`@sigx/router@0.9.0` is the release aligned to core 0.12 — it peers `sigx@^0.12.0`). In the source tree these peers are written as `"catalog:"` refs and only resolve to those concrete ranges when pnpm rewrites them on `pnpm pack`/publish (see below). `@sigx/cli` peer (`>=0.4.0`) and the `vite` peer are unchanged. `@sigx/cli` (`^0.4.2`) / `@sigx/args` (`^0.6.1`) dev deps are left as-is: they are a separate tooling train (peering `@sigx/args`/`@sigx/terminal`, not core), and `@sigx/cli@0.5.1` still peers `@sigx/args@^0.6.0`. The core packages (`sigx`, `@sigx/server-renderer`, `@sigx/vite`) and `@sigx/router` now live in a `catalog:` block in `pnpm-workspace.yaml` and are referenced as `"catalog:"` in dependencies/devDependencies/peerDependencies (both packages and both example apps); pnpm rewrites these to the concrete ranges (`^0.12.0` / `^0.9.0`) on `pnpm pack`/publish, so published manifests are unchanged in shape. Pinning to a single minor via one catalog guarantees exactly one `@sigx/reactivity` copy across the workspace — two copies break reactivity. `scripts/verify-pack.js` scratch-app peers were updated to `^0.12.0` / `^0.9.0` to match. Mirrors the 0.10 alignment ([#183](https://github.com/signalxjs/ssg/pull/183)).
- **No API migration.** `@sigx/ssg` consumes only stable surfaces (`component`/`signal`/`watch`/`onUnmounted`/`defineApp`/`jsx`/`ComponentFactory` from core, `renderToString`/`ssrClientPlugin` from `@sigx/server-renderer`, the router's `createRouter`/`createWebHistory`/`createMemoryHistory`/`useRoute`/`RouterLink`, and `@sigx/vite`'s `defineLibConfig`/`registerHMRModule`) — none of core's 0.11/0.12 changes touch this repo (0.11's namespace-agnostic renderer refactor affects only custom DOM-like renderers; 0.12 ships no breaking changes; router 0.9 has no public API change). Verified against the published 0.12 packages: `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test` (46 files, 498 tests — includes both example-site e2e builds covering hydration + SPA nav), and `pnpm verify:pack` all pass, resolving a single copy of `sigx@0.12.0` / `@sigx/router@0.9.0` across every workspace.

## [0.16.0] - 2026-07-16

### Changed

- **Aligned `@sigx/*` dependency pins with the 0.10 core line** ([#182](https://github.com/signalxjs/ssg/issues/182)). Peer ranges: `sigx` and `@sigx/server-renderer` `>=0.7.0 <0.8.0` → `>=0.10.0 <0.11.0`, `@sigx/router` `>=0.7.0 <0.8.0` → `>=0.8.0 <0.9.0` (`@sigx/router@0.8.0` is the release aligned to core 0.10; the router no longer mirrors core's minor). `@sigx/cli` peer (`>=0.4.0`) and the `vite` peer are unchanged. devDependencies bumped to match (`@sigx/server-renderer`, `@sigx/vite`, `sigx` → `^0.10.0`; `@sigx/router` → `^0.8.0`). Without this, a consumer on core 0.10 could not satisfy the old peers and was forced onto a second, older copy of the SignalX core — the duplicate-reactivity-engine hazard. Mirrors the 0.6→0.7 alignment ([#153](https://github.com/signalxjs/ssg/pull/153)).
- **No API migration.** `@sigx/ssg` consumes only stable surfaces (`component`/`signal`/`watch`/`onUnmounted`/`defineApp`/`jsx`/`ComponentFactory` from core, `renderToString`/`ssrClientPlugin` from `@sigx/server-renderer`, the router's `createRouter`/`useRoute`/etc., and `@sigx/vite`'s `defineLibConfig`/`sigxPlugin`/`registerHMRModule`) — none of core's 0.8/0.9/0.10 breaking removals touch this repo. Verified against the published 0.10 packages: `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test` (46 files, 498 tests — includes both example-site e2e builds covering hydration + SPA nav), and `pnpm verify:pack` all pass, resolving a single copy of `sigx@0.10.0` / `@sigx/router@0.8.0` across every workspace.

## [0.15.0] - 2026-07-13

### Added

- **LLM-friendly output — `llms` config option** ([#176](https://github.com/signalxjs/ssg/issues/176)): `llms: true` (or an options object) emits the [llms.txt convention](https://llmstxt.org/) at build time — an `llms.txt` index over the pages (sections as `##` H2s, one per collection in sidebar order, or curated via `sections`), an `llms-full.txt` concatenation of the pages' markdown renditions (with `include`/`exclude` globs), a cleaned `.md` rendition next to every `.md`/`.mdx`-sourced page's HTML (route `/docs/guide/` → `dist/docs/guide.md`), and per-area sub-indexes (`areas: { '/docs': {} }` → `/docs/llms.txt`). Renditions strip MDX ESM/JSX/expressions with a fence-aware scanner that never touches code-fence contents, substitute `{frontmatter.x}`, and normalize fence info strings to the bare language; a `transform(md, page)` hook adjusts or drops (null) individual pages. Visibility matches the sitemap (drafts, `noindex`, 404 excluded) plus `exclude` globs and per-page frontmatter `llms: false`; a user-shipped `public/llms.txt` is never overwritten. Exported helpers: `prepareLlmsPages`, `buildLlmsIndex`, `buildLlmsFullText`, `renderPageMarkdown`, `getMarkdownPath`, `writeLlmsOutputs`. Internally, the sitemap's `exclude` glob matching moved to a shared helper (behavior unchanged).

## [0.14.0] - 2026-06-16

### Fixed

- **SPA navigation now honours `trailingSlash`** ([#163](https://github.com/signalxjs/ssg/issues/163)): `installSpaNavigation` pushed the clicked anchor's pathname verbatim — usually slash-less — so under `trailingSlash: 'always'` (the default) a click landed the address bar on `/x` while a hard load was 301'd to the canonical `/x/`, giving the same page two URLs depending on how it was reached. The pushed path is now normalised to the configured policy (via the same `normalizePagePath` used for canonical/sitemap URLs), so SPA-navigated URLs match the hard-load / 301 form. Paths whose last segment has a file extension (e.g. `/sitemap.xml`, `/font.woff`) are pushed verbatim, since appending a slash to those 404s. `installSpaNavigation` takes a new `trailingSlash` option (default `'always'`), wired automatically from config in the generated client entry. Removes the need for sites to shim `history.pushState`/`replaceState` client-side.

## [0.13.0] - 2026-06-16

### Fixed

- **CLI plugin ported to `@sigx/args` fluent builders** ([#158](https://github.com/signalxjs/ssg/issues/158)): the `dev`/`build`/`preview` command args were declared as plain `ArgDef` objects (`{ type: 'string', … }`), which `@sigx/cli` ≥ 0.4 can no longer register — its `.args()` normalizer reads each entry's internal `~def`, so plain objects crashed the whole CLI at startup with `Cannot use 'in' operator to search for 'required' in undefined`. The args are now built with `a.string()`/`a.boolean()` (re-exported from `@sigx/cli/plugin`), and the `@sigx/cli` peer range moved from `*` to `>=0.4.0` so the incompatibility is declared rather than a runtime crash.

## [0.12.0] - 2026-06-15

### Changed

- **Aligned `@sigx/*` dependency pins with the 0.7 core line** ([#152](https://github.com/signalxjs/ssg/issues/152)): the `@sigx/router`, `@sigx/server-renderer`, and `sigx` peer ranges moved from `>=0.6.0 <0.7.0` to `>=0.7.0 <0.8.0` (development pins and the example sites likewise bumped to `^0.7.0`). The 0.7 SignalX core is now published, and pinning the 0.6 line forced consumers onto a second, older copy of the core — the duplicate-reactivity-engine hazard [#135](https://github.com/signalxjs/ssg/issues/135) fixed. `@sigx/cli` stays `*` and the `vite` peer is unchanged.

### Fixed

- LivePreview blocks are now progressively enhanced ([#149](https://github.com/signalxjs/ssg/issues/149)): the SSR HTML carries the full, highlighted code window and the client enhances it in place instead of rendering an island over it. This removes the structural mismatch that, under core 0.6+, caused page hydration to self-heal-remount the widget (duplicated preview + stuck "Loading preview…") and keeps the code in the HTML for SEO, AI agents, and no-JS. The markup drops `data-island*` markers in favour of `data-live-preview`/`data-live-code` delegation hooks.

## [0.11.1] - 2026-06-13

### Fixed

- Nested collection paths no longer cross-contaminate navigation ([#143](https://github.com/signalxjs/ssg/issues/143)): when one collection's `path` was a string prefix of another's (e.g. `/modules/updates` and `/modules/updates-ui`), the shorter collection absorbed the longer one's pages because matching used a raw `startsWith`. Pages are now assigned on a path-segment boundary and to the longest matching collection only, so `/modules/updates-ui/*` belongs to `updates-ui-docs` alone. Affects generated sidebars (`navigation[collection].sidebar`) and `detectCollection`.

## [0.11.0] - 2026-06-12

### Changed

- **Aligned `@sigx/*` dependency pins with the 0.6 core line** ([#135](https://github.com/signalxjs/ssg/issues/135)): `@sigx/router` and `@sigx/server-renderer` moved from `dependencies` to `peerDependencies` with range `>=0.6.0 <0.7.0`, and the `sigx` peer range widened from `^0.4.3` to `>=0.6.0 <0.7.0`. Companion packages now share the consumer app's single copy of the SignalX core, so duplicate reactivity engines (with untracked cross-copy signals) are structurally impossible. Consumers must depend on `@sigx/router` and `@sigx/server-renderer` themselves (most package managers auto-install peers).

### Added

- Sitemap freshness signals ([#38](https://github.com/signalxjs/ssg/issues/38)): `sitemap.lastmod: 'git' | 'mtime'` derives `<lastmod>` from each page's source file (`'git'` = last commit date via one repo-wide log walk — use `fetch-depth: 0` in CI; `'mtime'` = filesystem). Per-page frontmatter `lastmod`/`changefreq`/`priority` override the defaults, and the new `sitemap.transform(entry, page)` adjusts or drops entries programmatically (return `null` to drop).

## [0.10.0] - 2026-06-12

### Added

- `meta.sourceFile` ([#60](https://github.com/signalxjs/ssg/issues/60)): every page's root-relative source path is embedded into its route meta by the generated routes module — with the new `site.editBase`, themes render edit-this-page links (`editBase + sourceFile`).
- `site.announcement` ([#65](https://github.com/signalxjs/ssg/issues/65)): site-wide announcement bar config (`{ text, href?, id? }`) — rendered by the theme, `id` keys the visitor's dismissal.
- Theme-contributed build hooks ([#60](https://github.com/signalxjs/ssg/issues/60)): `ThemeConfig.hooks` composes with the site's — the theme's run first, `transformHtml` chains through both.
- Default `404.html` ([#65](https://github.com/signalxjs/ssg/issues/65)): emitted when the site has no `/404` page of its own (the #57 convention takes precedence) — GitHub Pages/Netlify/Cloudflare serve it for unknown URLs.

## [0.9.0] - 2026-06-12

### Added

- Internal link & anchor validation ([#99](https://github.com/signalxjs/ssg/issues/99)): after rendering, every internal `<a href>` is checked — the path must resolve to an emitted page (or redirect source / on-disk asset, `base`-aware, trailing-slash/query insensitive) and any `#fragment` must match an element id on the target page. `linkCheck: 'warn'` (default) reports `page → href` findings; `'error'` fails the build for CI gating; `'off'` disables. Checker exported as `checkLinks`/`formatLinkCheckReport`.
- Configurable sidebar category order ([#100](https://github.com/signalxjs/ssg/issues/100)): `navigation.sectionOrder` now also accepts an explicit list (`['Getting Started', 'Components', …]` — listed categories first in list order, unlisted follow the built-in defaults), and collections can override with their own `sectionOrder`. Removes the "edit the published package to reorder your own nav" cliff for custom category names.

### Fixed

- Running `ssg build` twice into the same `outDir` no longer fails when `redirects` are configured ([#120](https://github.com/signalxjs/ssg/issues/120)): the overwrite guard now checks against the pages rendered *this* run instead of the filesystem, so it can't trip on the previous build's own redirect artifacts (outDir isn't cleaned between builds — the HTML template lives there).

## [0.8.1] - 2026-06-12

### Added

- `SiteConfig.search` ([#116](https://github.com/signalxjs/ssg/issues/116)): ask the theme to show its search UI (the daisyui ⌘K palette) — a pure pass-through to layouts via `LayoutProps.site`; pair with the top-level `search: true`.

### Fixed

- `LayoutProps.site` now reaches layouts on **every** render path ([#116](https://github.com/signalxjs/ssg/issues/116)): four of the generated layout-router branches (cached components, loaded lazy components, the hydration placeholder) dropped it, so theme headers lost their branding/nav/repo in production SSR output — invisible until a theme-using site existed.

## [0.8.0] - 2026-06-11

### Fixed

- The copy-code button now ships styled ([#113](https://github.com/signalxjs/ssg/issues/113)): a ghost icon button matching the code-window chrome, revealed on hover/focus, with a ✓ success state — it previously rendered as a raw browser button. A stylesheet-coverage test now asserts every emitted interactive class has rules.

### Added

- Built-in search ([#62](https://github.com/signalxjs/ssg/issues/62)): `search: true` emits a `search-index.json` over the rendered pages at build time — one entry per page with title, description, headings (deep-linkable by `#id`), and visible text (`<main>`-scoped; `noindex` pages and the 404 page excluded like the sitemap). `@sigx/ssg/client` gains `loadSearchIndex()` and `searchPages()` (pure, dependency-free ranking: title > heading > description > body, AND semantics across terms). `SearchOptions` controls the filename and per-page text cap.
- Copy-code buttons ([#65](https://github.com/signalxjs/ssg/issues/65)): every code window (plain and package-manager) gets a copy button in its header; `installCodeCopy()` from `@sigx/ssg/client` wires them with one delegated listener (auto-installed by the generated client entry). Package-manager windows copy only the visible variant.
- `meta.titleFromContent` ([#65](https://github.com/signalxjs/ssg/issues/65)): when a page's title is derived from its first `# H1` (no frontmatter `title`), the meta is marked so layouts that render their own `<h1>{title}</h1>` can skip it instead of doubling the heading.

- Programmatic routes ([#59](https://github.com/signalxjs/ssg/issues/59)): `routes: (ctx) => [{ path, file, layout?, meta? }]` in the config adds pages that don't come from the filesystem scan — CMS-backed pages, tag archives, generated docs. Merged with scanned routes everywhere (dev, build, navigation); collisions with scanned pages and missing component files fail loudly.
- Build-time data loaders ([#59](https://github.com/signalxjs/ssg/issues/59)): `data: { versions: async () => … }` runs each loader once per build (and per dev-server start) and exposes the results via `virtual:ssg-data` (one named export per key + default). Values must be JSON-serializable; failures name the loader. Replaces fetch-data-before-build scripts and their cron rebuild glue.
- `redirects` config (`{ '/old': '/new/' }`): each entry emits a static meta-refresh page at the old path (canonical → target, `noindex`, fallback link) plus a `_redirects` file (Netlify/Cloudflare format) for hosts that answer with real 301s. Relative targets are `base`-prefixed; absolute URLs pass through; a redirect that would overwrite a real rendered page fails the build ([#61](https://github.com/signalxjs/ssg/issues/61)).
- Public package-manager client API ([#63](https://github.com/signalxjs/ssg/issues/63)): `getPackageManager()` / `setPackageManager(pm)` / `onPackageManagerChange(listener)` in `@sigx/ssg/client` expose the install-fence switcher's selection programmatically (tab clicks, programmatic sets, and cross-tab sync all notify subscribers), and the command parser ships as public API — `parsePackageManagerCommand`, `renderPackageManagerCommand`, `translatePackageManagerCommand`, `PACKAGE_MANAGERS`, `DEFAULT_PACKAGE_MANAGER`, and the `Pm` / `ParsedPackageManagerCommand` types.
- `shiki.transformers` ([#64](https://github.com/signalxjs/ssg/issues/64)): Shiki transformers are passed through to every highlighted block (including each package-manager variant), with the raw fence meta exposed as `options.meta.__raw` — `@shikijs/transformers` line highlighting `{1,3-5}`, diff, focus, and word highlight work without core changes.
- `shiki.skipLanguages` ([#64](https://github.com/signalxjs/ssg/issues/64)): fence languages the highlighter leaves untouched (the raw `<pre><code class="language-…">` survives), so a downstream rehype plugin or island can claim them — the mermaid/math escape hatch.

## [0.7.1] - 2026-06-11

### Fixed

- `data-no-spa` now opts out an anchor **or any ancestor container** from SPA navigation, and LivePreview islands carry it by default — links inside rendered example previews can no longer hijack navigation ([#95](https://github.com/signalxjs/ssg/issues/95)).
- `ssg.config.ts` files importing relative `.ts` helpers (and non-erasable TS syntax like enums) now load on every supported Node version — the config loader bundles the config with esbuild (packages external) instead of only type-stripping it, which silently required Node ≥22.18 native type stripping ([#96](https://github.com/signalxjs/ssg/issues/96), root cause of signalxjs.github.io#37).

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
