import { defineSSGConfig } from '@sigx/ssg';

export default defineSSGConfig({
    // Everything visual comes from the theme: layouts (default/docs/blog),
    // header/footer chrome, sidebar, TOC, prev/next, the ⌘K palette.
    theme: '@sigx/ssg-theme-daisyui',

    site: {
        title: 'Theme Example',
        description: 'A site built on @sigx/ssg-theme-daisyui',
        url: 'https://theme.example',
        nav: [{ title: 'Docs', href: '/docs/getting-started' }],
        repo: 'https://github.com/signalxjs/ssg',
        // Show the theme's ⌘K palette (works because `search: true` below
        // emits the index it queries).
        search: true,
        // Edit-this-page links: editBase + the page's source path (#65).
        editBase: 'https://github.com/signalxjs/ssg/edit/main/examples/theme/',
        // Dismissible announcement bar above the header (#65).
        announcement: {
            id: 'showcase-v1',
            text: 'This entire site is @sigx/ssg-theme-daisyui — zero layout code.',
            href: '/docs/getting-started',
        },
    },

    collections: {
        docs: {
            path: '/docs',
            layout: 'docs',
            // Per-collection category order (#100): explicit list, listed first.
            sectionOrder: ['Guide', 'Reference'],
        },
        blog: { path: '/blog', layout: 'blog' },
    },

    // Base styles for ssg-emitted markup. The Tailwind/daisyUI CSS lives in
    // src/styles/global.css, which the generated entry auto-imports.
    clientImports: ['@sigx/ssg/styles.css'],

    search: true,

    // Internal link validation (#99): fail the build on dead hrefs/anchors.
    linkCheck: 'error',
});
