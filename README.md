<div align="center">

# SignalX SSG

**Static site generation for [SignalX](https://github.com/signalxjs/core).**

[![npm @sigx/ssg](https://img.shields.io/npm/v/@sigx/ssg.svg?label=@sigx/ssg&color=blue)](https://www.npmjs.com/package/@sigx/ssg)
[![license](https://img.shields.io/npm/l/@sigx/ssg.svg)](./LICENSE)
[![ci](https://github.com/signalxjs/ssg/actions/workflows/ci.yml/badge.svg)](https://github.com/signalxjs/ssg/actions/workflows/ci.yml)

</div>

> 🚧 SignalX is in early public release (`0.4.x`). The API surface is small and stabilising — feedback is very welcome.

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
- **Islands architecture** via [`@sigx/ssr-islands`](https://github.com/signalxjs/ssr-islands) — `client:load`, `client:visible`, `client:idle` directives for partial hydration.
- **Streaming SSR** — render to a stream with async-component support.
- **Built on Vite 8 + Rolldown** — fast dev, fast builds.

## Companion repos

- [`signalxjs/core`](https://github.com/signalxjs/core) — `reactivity`, `runtime-core`, `runtime-dom`, `server-renderer`, `vite`, `sigx`
- [`signalxjs/router`](https://github.com/signalxjs/router) — `@sigx/router` (used by `@sigx/ssg`)
- [`signalxjs/store`](https://github.com/signalxjs/store) — `@sigx/store`
- [`signalxjs/ssr-islands`](https://github.com/signalxjs/ssr-islands) — `@sigx/ssr-islands`
- [`signalxjs/cli`](https://github.com/signalxjs/cli) — `@sigx/cli` (sigx-cli plugin host)
- [`signalxjs/lynx`](https://github.com/signalxjs/lynx) — Lynx native runtime + modules
- [`signalxjs/docs`](https://github.com/signalxjs/docs) — Docs site (consumes this repo's `@sigx/ssg`)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). PRs welcome.

## License

MIT © Andreas Ekdahl
