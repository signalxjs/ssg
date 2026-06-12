# @sigx-examples/theme

A site built **entirely on `@sigx/ssg-theme-daisyui`** — zero layout code of
its own. This is the live demo surface (and e2e fixture,
`packages/ssg/src/__tests__/example-theme-e2e.test.ts`) for everything the
theme ships:

- **Layouts** — `default` for the landing page, `docs` for the collection
- **Header chrome** — branding/nav/repo from `site` config, the light/dark
  toggle (persisted, OS-aware, no-FOUC head script)
- **⌘K command palette** — enabled with `site: { search: true }` (pair with
  the top-level `search: true` that emits the index)
- **Docs shell** — collapsible sidebar, table of contents, prev/next links
- **Code windows** — copy buttons + the npm/pnpm/yarn/bun switcher
- **Per-page chrome** — announcement bar, breadcrumbs, edit-this-page, last-updated
- **Blog layout** — frontmatter-driven hero (tags/author/date)
- **Per-collection `sectionOrder`** — explicit category order for the docs sidebar
- **Tailwind v4 + daisyUI v5** — see `src/styles/global.css`; note the
  explicit `@source` file glob pointing at the theme package (Tailwind's
  directory form skips `dist` directories)

Run it:

```sh
pnpm --filter @sigx-examples/theme dev          # dev server
pnpm --filter @sigx-examples/theme build:site   # production build into dist/
```

If you change its pages or config, keep the e2e assertions in sync.
