import { defineConfig } from 'vite';
import sigx from '@sigx/vite';
import { ssgPlugin } from '@sigx/ssg/vite';

export default defineConfig({
    plugins: [sigx(), ssgPlugin()],
    oxc: {
        jsx: {
            runtime: 'automatic',
            importSource: 'sigx',
        },
    },
});
