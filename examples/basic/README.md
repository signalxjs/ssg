# @sigx/ssg basic example

The smallest realistic `@sigx/ssg` site, exercising the core feature set:

- **File-based routing** — `src/pages/index.mdx`, `src/pages/guide.mdx`
- **Dynamic route** — `src/pages/blog/[slug].tsx` with `getStaticPaths`; route params and per-path `props` arrive as component props (`props.params.slug`, `props.featured`)
- **Drafts** — `src/pages/drafts-demo.mdx` has `draft: true` and is excluded from production builds and the sitemap (include it with `--drafts` / `build({ drafts: true })`)
- **Custom layout** — `src/layouts/default.tsx` rendering `slots.default()`
- **Custom `index.html`** — the `/@ssg/client.tsx` + `<!--head-tags-->` / `<!--app-html-->` pattern
- **MDX** — frontmatter, GFM, Shiki highlighting, and an npm-install fence that renders the npm/pnpm/yarn/bun switcher

## Run it

From the repo root (installs workspace links):

```bash
pnpm install
pnpm build                                   # builds @sigx/ssg itself
pnpm --filter @sigx-examples/basic dev         # dev server
pnpm --filter @sigx-examples/basic build:site  # static build into dist/
pnpm --filter @sigx-examples/basic preview     # serve the build
```

`build:site` runs the programmatic API (`build()` from `@sigx/ssg/build`); in a
real project with `@sigx/cli` installed you would run `npx sigx ssg build`
instead.

This example doubles as the fixture for the end-to-end build test in
`packages/ssg/src/__tests__/example-e2e.test.ts` — if you change pages here,
that test's assertions may need to follow.
