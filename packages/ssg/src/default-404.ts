/**
 * Default 404 page (signalxjs/ssg#65).
 *
 * Emitted as `404.html` when the site has no `/404` page of its own —
 * GitHub Pages, Netlify, and Cloudflare Pages all serve that file for
 * unknown URLs. Sites wanting a themed page just add `src/pages/404.mdx`
 * (or `.tsx`), which takes precedence (#57).
 */

import type { SSGConfig } from './types';
import { escapeHtml } from './head';

export function generateDefault404(config: SSGConfig): string {
    const title = config.site?.title ? escapeHtml(config.site.title) : 'this site';
    const home = config.base && config.base !== '/' ? config.base.replace(/\/+$/, '') + '/' : '/';

    return `<!DOCTYPE html>
<html lang="${escapeHtml(config.site?.lang || 'en')}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex">
    <title>404 — Page not found</title>
    <style>
        body { font-family: system-ui, sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0; }
        main { text-align: center; padding: 2rem; }
        h1 { font-size: 4rem; margin: 0; }
        a { color: inherit; }
    </style>
</head>
<body>
    <main>
        <h1>404</h1>
        <p>This page doesn't exist on ${title}.</p>
        <p><a href="${home}">Back to the homepage</a></p>
    </main>
</body>
</html>
`;
}
