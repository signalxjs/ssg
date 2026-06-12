import { defineSSGConfig } from '@sigx/ssg';

// Collected by the onPageRendered hook below, emitted into the manifest.
const renderedPaths: string[] = [];

export default defineSSGConfig({
    site: {
        title: 'SSG Basic Example',
        description: 'A minimal site built with @sigx/ssg',
        url: 'https://basic.example',
    },
    collections: {
        // Pages under /docs get the `docs` layout automatically and an
        // auto-generated sidebar from their `category`/`order` frontmatter.
        docs: { path: '/docs', layout: 'docs' },
        blog: { path: '/blog' },
    },
    // Base styles for ssg-emitted markup (code windows, pm switcher tabs,
    // heading anchors). Site typography lives in src/styles/global.css,
    // which zero-config mode auto-imports.
    clientImports: ['@sigx/ssg/styles.css'],
    // Static redirects (#61): old URLs keep working after content moves.
    // Built-in search (#62): emits search-index.json over the rendered pages.
    search: true,

    // Sitemap freshness (#38): derive <lastmod> from source files. 'mtime'
    // here for CI determinism; real sites usually want 'git' (with full
    // history checked out). The transform bumps the guide's priority —
    // return null from it to drop an entry entirely.
    sitemap: {
        lastmod: 'mtime',
        transform: (entry) => (entry.path === '/guide' ? { ...entry, priority: 0.9 } : entry),
    },

    // Internal link validation (#99): fail the build on dead hrefs/anchors.
    linkCheck: 'error',
    // Programmatic routes (#59): pages that don't come from src/pages.
    routes: () => [
        {
            path: '/generated',
            file: 'src/templates/generated.tsx',
            meta: { title: 'Generated route', description: 'Added via config.routes' },
        },
    ],

    // Build-time data loaders (#59): exposed via virtual:ssg-data.
    data: {
        buildInfo: () => ({ generator: '@sigx/ssg', demo: 'data-loaders' }),
    },

    redirects: {
        '/old-guide': '/guide/',
    },
    // Build pipeline hooks (#58): transform every page's HTML, observe each
    // rendered page, and run once after the build — the extension points for
    // search indexing, OG images, link checking, redirects, …
    hooks: {
        transformHtml(html) {
            // Replacer-function form: a string replacement would corrupt
            // pages containing `$&`-style patterns.
            return html.replace('</head>', () => '    <meta name="generator" content="@sigx/ssg">\n</head>');
        },
        // Per-page observation (may run concurrently — append-only here)
        onPageRendered(page) {
            renderedPaths.push(page.path);
        },
        async postBuild(result, ctx) {
            const { writeFile } = await import('node:fs/promises');
            const { join } = await import('node:path');
            const manifest = {
                pages: result.pages.map((page) => ({ path: page.path, size: page.size })),
                rendered: renderedPaths.sort(),
            };
            await writeFile(join(ctx.outDir, 'build-manifest.json'), JSON.stringify(manifest, null, 2));
        },
    },
});
