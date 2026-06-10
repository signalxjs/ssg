<div align="center">

# SignalX SSG

**Static site generation for [SignalX](https://sigx.dev/core/).**

[![npm @sigx/ssg](https://img.shields.io/npm/v/@sigx/ssg.svg?label=@sigx/ssg&color=blue)](https://www.npmjs.com/package/@sigx/ssg)
[![license](https://img.shields.io/npm/l/@sigx/ssg.svg)](./LICENSE)
[![ci](https://github.com/signalxjs/ssg/actions/workflows/ci.yml/badge.svg)](https://github.com/signalxjs/ssg/actions/workflows/ci.yml)

</div>

> 🚧 SignalX is in early public release (`0.4.x`). The API surface is small and stabilising — feedback is very welcome.

## 📚 Documentation

Full guides, API reference and live examples → **<https://sigx.dev/ssg/>**

## Packages

| Package | Description |
| --- | --- |
| [`@sigx/ssg`](packages/ssg) | Static site generator with file-based routing, MDX, and pluggable themes |
| [`@sigx/ssg-theme-daisyui`](packages/ssg-theme-daisyui) | daisyUI/Tailwind theme for `@sigx/ssg` |

## Install

```bash
npm install @sigx/ssg sigx
# optional
npm install @sigx/ssg-theme-daisyui
```

## Quick start — `@sigx/ssg`

`ssg.config.ts`:

```ts
import { defineConfig } from '@sigx/ssg';

export default defineConfig({
  pagesDir: 'src/pages',
  outDir: 'dist',
});
```

```bash
npx sigx-ssg dev    # dev server with HMR
npx sigx-ssg build  # static build
```

Drop `.tsx` or `.mdx` files in `src/pages/` and they become routes:

```
src/pages/
  index.tsx        →  /
  about.mdx        →  /about
  blog/[slug].mdx  →  /blog/:slug
```

## Features

- **File-based routing** with dynamic segments and catch-all routes.
- **MDX support** — first-class for docs and blogs, with frontmatter.
- **Pluggable themes** — `@sigx/ssg-theme-daisyui` ships layouts, header, sidebar, TOC.
- **Islands architecture** via [`@sigx/ssr-islands`](https://sigx.dev/ssg/) — `client:load`, `client:visible`, `client:idle` directives for partial hydration.
- **Streaming SSR** — render to a stream with async-component support.
- **Built on Vite 8 + Rolldown** — fast dev, fast builds.

## Companion repos

- [SignalX core](https://sigx.dev/core/) — `reactivity`, `runtime-core`, `runtime-dom`, `server-renderer`, `vite`, `sigx`
- [`@sigx/router`](https://sigx.dev/router/) — router (used by `@sigx/ssg`)
- [`@sigx/store`](https://sigx.dev/store/) — store
- [`@sigx/ssr-islands`](https://sigx.dev/ssg/) — islands architecture
- [`@sigx/cli`](https://sigx.dev/cli/) — sigx-cli plugin host
- [Lynx](https://sigx.dev/lynx/) — Lynx native runtime + modules
- [Documentation](https://sigx.dev/) — main SignalX documentation site

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). PRs welcome.

## License

MIT © Andreas Ekdahl
