import { defineConfig } from 'vite';
import sigx from '@sigx/vite';
import tailwindcss from '@tailwindcss/vite';
import { ssgPlugin } from '@sigx/ssg/vite';

export default defineConfig({
    plugins: [sigx(), tailwindcss(), ssgPlugin()],
    oxc: {
        jsx: {
            runtime: 'automatic',
            importSource: 'sigx',
        },
    },
});
