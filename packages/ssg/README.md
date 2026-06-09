# @sigx/ssg

Static site generator for [SignalX](https://github.com/signalxjs/core) with file-based routing, MDX, and pluggable themes.

## Features

- 🗂 **File-based routing** — `src/pages/` becomes routes automatically
- 📑 **Layout system** — wrap pages with reusable layouts
- 📝 **MDX** — write content with Markdown + SignalX components
- 🎨 **Pluggable themes** — install a theme package (e.g. `@sigx/ssg-theme-daisyui`) or build your own
- 🔥 **Vite HMR** — instant updates during development
- ⚡ **Fast builds** — parallel rendering with streaming
- 🚀 **Zero-config mode** — works out of the box with sensible defaults
- 🗺️ **Sitemap generation** — automatic `sitemap.xml` and `robots.txt`

## Installation

```bash
npm install @sigx/ssg sigx @sigx/router
npm install -D vite @sigx/vite
```

## Usage

`@sigx/ssg` ships as a [`@sigx/cli`](https://github.com/signalxjs/cli) plugin and a Vite plugin you can use directly. Drop a `ssg.config.ts` in your project root to opt in:

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

### Via `@sigx/cli`

```bash
npx sigx ssg dev      # start dev server
npx sigx ssg build    # build static site
npx sigx ssg preview  # preview the production build
```

### Via the Vite plugin

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import sigx from '@sigx/vite';
import ssg from '@sigx/ssg/vite';

export default defineConfig({
    plugins: [sigx(), ssg()],
});
```

## File-based routing

Pages in `src/pages/` are automatically converted to routes:

| File | Route |
|------|-------|
| `src/pages/index.tsx` | `/` |
| `src/pages/about.tsx` | `/about` |
| `src/pages/blog/index.tsx` | `/blog` |
| `src/pages/blog/[slug].tsx` | `/blog/:slug` |
| `src/pages/docs/[...path].tsx` | `/docs/*path` |

Dynamic routes export `getStaticPaths`:

```tsx
// src/pages/blog/[slug].tsx
import { component } from 'sigx';

export async function getStaticPaths() {
    const posts = await fetchBlogPosts();
    return posts.map(post => ({
        params: { slug: post.slug },
        props: { post },
    }));
}

export default component(({ props }) => () => (
    <article>
        <h1>{props.post.title}</h1>
    </article>
));
```

## Layouts

Create layouts in `src/layouts/`:

```tsx
// src/layouts/default.tsx
import { component } from 'sigx';

export default component(({ slots }) => () => (
    <div class="layout">
        <header><nav>My Site</nav></header>
        <main>{slots.default()}</main>
        <footer>©</footer>
    </div>
));
```

Specify the layout in frontmatter or by exporting it:

```mdx
---
title: My Page
layout: docs
---

# Content here
```

```tsx
export const layout = 'docs';
```

## MDX

```mdx
---
title: Hello World
date: 2026-05-10
---

# {frontmatter.title}

This is **markdown** with SignalX components mixed in:

<Counter initial={5} />
```

## Code blocks

Fenced code is highlighted with [Shiki](https://shiki.style) and wrapped in a
terminal-style `.code-window`.

**Package-manager switcher.** Shell fences (`bash`, `sh`, `zsh`) whose lines
are `npm`/`pnpm`/`yarn`/`bun` commands — `add`/`install`, plus `run`, `dlx`,
`create`, `remove`, … — automatically get an npm/pnpm/yarn/bun tab strip. All
four variants are rendered server-side and the client just toggles which is
visible — so the choice persists across reloads and syncs across blocks and tabs,
with no flash or hydration glitches. Lines that aren't package-manager commands
(e.g. `sigx prebuild`) are left untouched.

````mdx
```bash
pnpm add @sigx/lynx-video
```
````

The default manager (shown first) is `pnpm`; set
`markdown.shiki.defaultPackageManager` to change it. No MDX changes are needed.
The switcher is wired in automatically when you use the generated client entry;
if you supply a **custom** client entry, call `installPackageManagerSwitcher()`
from `@sigx/ssg/client` yourself (after hydration).

## Themes

Install a theme:

```bash
npm install @sigx/ssg-theme-daisyui
```

```ts
// ssg.config.ts
export default defineSSGConfig({
    theme: '@sigx/ssg-theme-daisyui',
});
```

A theme bundles layouts, components, and CSS so you don't have to.

## Islands hydration

`@sigx/ssg` works with [`@sigx/ssr-islands`](https://github.com/signalxjs/ssr-islands) for selective hydration via `client:*` directives. See the islands README for details.

## Configuration

Full options:

```ts
defineSSGConfig({
    pages: 'src/pages',
    layouts: 'src/layouts',
    content: 'src/content',
    outDir: 'dist',

    site: {
        title: 'My Site',
        description: 'Site description',
        url: 'https://example.com',
        lang: 'en',
        favicon: '/favicon.ico',
        fonts: ['Inter:wght@400;500;600;700'],
        ogImage: 'https://example.com/og.png',
        twitter: 'myhandle',
        themeColor: '#000000',
    },

    theme: '@sigx/ssg-theme-daisyui',
    defaultLayout: 'default',

    markdown: {
        shiki: {
            light: 'github-light',
            dark: 'github-dark',
            defaultPackageManager: 'pnpm', // npm/pnpm/yarn/bun shown first on install fences
        },
    },
});
```

## License

MIT © Andreas Ekdahl
