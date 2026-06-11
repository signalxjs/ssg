import { defineSSGConfig } from '@sigx/ssg';

export default defineSSGConfig({
    site: {
        title: 'SSG Basic Example',
        description: 'A minimal site built with @sigx/ssg',
        url: 'https://basic.example',
    },
    collections: {
        blog: { path: '/blog' },
    },
    // Base styles for ssg-emitted markup (code windows, pm switcher tabs,
    // heading anchors). Site typography lives in src/styles/global.css,
    // which zero-config mode auto-imports.
    clientImports: ['@sigx/ssg/styles.css'],
});
