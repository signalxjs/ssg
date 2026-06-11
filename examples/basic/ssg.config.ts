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
});
