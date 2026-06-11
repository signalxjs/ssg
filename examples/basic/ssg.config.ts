import { defineSSGConfig } from '@sigx/ssg';

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
    // Build pipeline hooks (#58): transform every page's HTML, observe each
    // rendered page, and run once after the build — the extension points for
    // search indexing, OG images, link checking, redirects, …
    hooks: {
        transformHtml(html) {
            return html.replace(
                '</head>',
                '    <meta name="generator" content="@sigx/ssg">\n</head>'
            );
        },
        async postBuild(result, ctx) {
            const { writeFile } = await import('node:fs/promises');
            const { join } = await import('node:path');
            const manifest = {
                pages: result.pages.map((page) => ({ path: page.path, size: page.size })),
            };
            await writeFile(join(ctx.outDir, 'build-manifest.json'), JSON.stringify(manifest, null, 2));
        },
    },
});
