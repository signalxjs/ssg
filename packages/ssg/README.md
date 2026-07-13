# @sigx/ssg

Static site generator for [SignalX](https://sigx.dev/core/) with file-based routing, MDX, and pluggable themes.

[![npm @sigx/ssg](https://img.shields.io/npm/v/@sigx/ssg.svg?label=@sigx/ssg&color=blue)](https://www.npmjs.com/package/@sigx/ssg)
[![license](https://img.shields.io/npm/l/@sigx/ssg.svg)](../../LICENSE)

> 🚧 SignalX is in early public release. The API surface is small and stabilising — feedback is very welcome.

## 📚 Documentation

Full guides, API reference and live examples → **<https://sigx.dev/ssg/>**

## What is it?

`@sigx/ssg` turns a `src/pages/` directory into a fully static site: drop in `.tsx`
or `.mdx` files and they become routes, complete with dynamic and catch-all
segments, layouts, MDX with frontmatter, and an automatic `sitemap.xml`. It runs as
a [`@sigx/cli`](https://sigx.dev/cli/) plugin and as a plain Vite plugin, so it
fits straight into an existing Vite project. Themes (like
[`@sigx/ssg-theme-daisyui`](https://sigx.dev/daisyui/)) bundle layouts, components
and CSS so you can ship a polished docs/blog site with zero config — fast dev via
Vite HMR, fast streaming builds on top of Vite 8 + Rolldown.

## A taste

```ts
// ssg.config.ts
import { defineSSGConfig } from '@sigx/ssg';

export default defineSSGConfig({
    site: {
        title: 'My Site',
        description: 'Built with SignalX SSG',
        url: 'https://example.com',
    },
});
```

```bash
npx sigx ssg dev      # dev server with HMR
npx sigx ssg build    # build the static site
npx sigx ssg preview  # preview the production build
```

Everything else — routing rules, layouts, MDX, the package-manager code-fence
switcher, theming, islands hydration and the full config reference — lives in the
docs: **<https://sigx.dev/ssg/>**.

## LLM-friendly output (llms.txt)

`llms: true` emits the [llms.txt convention](https://llmstxt.org/) at build time,
so LLMs can ingest your site without scraping HTML: an `llms.txt` index (one `##`
section per collection, in sidebar order), an `llms-full.txt` concatenation, and a
cleaned `.md` rendition next to every markdown page's HTML (`/docs/guide/` →
`dist/docs/guide.md`). MDX imports, components and expressions are stripped from
the renditions; code-fence contents are never touched.

```ts
llms: {
    intro: 'Read /llms-full.txt for everything in one file.',
    exclude: ['/internal/**'],          // globs excluded from all outputs
    areas: { '/docs': {} },             // also emit a scoped /docs/llms.txt
    transform: (md, page) => md,        // per-page escape hatch; null drops the page
},
```

Visibility follows the sitemap (drafts, `noindex` and the 404 page are excluded);
frontmatter `llms: false` opts a page out. `.tsx` pages have no markdown source —
list them via `sections[].links` if wanted. A `public/llms.txt` you ship yourself
is never overwritten. Build-time only; the dev server doesn't serve these files.

## Part of SignalX

- [SignalX core](https://sigx.dev/core/) — `reactivity`, `runtime-core`, `runtime-dom`, `server-renderer`, `vite`, `sigx`
- [`@sigx/router`](https://sigx.dev/router/) — router used by `@sigx/ssg`
- [`@sigx/ssr-islands`](https://sigx.dev/ssg/) — selective `client:*` hydration
- [`@sigx/ssg-theme-daisyui`](https://sigx.dev/daisyui/) — daisyUI/Tailwind theme
- [`@sigx/cli`](https://sigx.dev/cli/) — sigx-cli plugin host

## License

MIT © Andreas Ekdahl
