import { defineLibConfig } from '@sigx/vite/lib';

export default defineLibConfig({
    entry: {
        'index': 'src/index.ts',
        'server/index': 'src/server/index.ts',
        'client/index': 'src/client/index.ts'
    },
    external: ['sigx', /@sigx\/.*/, '@sigx/runtime-core', '@sigx/runtime-dom', '@sigx/reactivity', '@sigx/server-renderer']
});
