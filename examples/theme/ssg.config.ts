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
    },

    collections: {
        docs: { path: '/docs', layout: 'docs' },
    },

    // Base styles for ssg-emitted markup. The Tailwind/daisyUI CSS lives in
    // src/styles/global.css, which the generated entry auto-imports.
    clientImports: ['@sigx/ssg/styles.css'],

    search: true,
});
