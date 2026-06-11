/**
 * Redirects emission (signalxjs/ssg#61).
 *
 * `redirects: { '/old': '/new/' }` in the config emits, per entry:
 * - a static page at the old path with `<meta http-equiv="refresh">`,
 *   a canonical pointing at the target, `noindex`, and a fallback link —
 *   works on any static host;
 * - one line in a `_redirects` file (Netlify/Cloudflare Pages format) so
 *   hosts that support it answer with a real 301 before HTML is involved.
 *
 * Relative targets are prefixed with the configured `base`; absolute URLs
 * pass through untouched.
 */

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import type { SSGConfig } from './types';
import { getOutputPath } from './collect-paths';
import { escapeHtml } from './head';

function isAbsoluteUrl(target: string): boolean {
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(target);
}

/** Apply the configured base to a relative target path. */
function withBase(target: string, config: SSGConfig): string {
    if (isAbsoluteUrl(target)) return target;
    const base = config.base && config.base !== '/' ? config.base.replace(/\/+$/, '') : '';
    return base + target;
}

/** The static redirect page emitted at the old path. */
export function generateRedirectHtml(target: string, config: SSGConfig): string {
    const url = withBase(target, config);
    const siteUrl = config.site?.url?.replace(/\/$/, '');
    const canonical = isAbsoluteUrl(url) ? url : siteUrl ? `${siteUrl}${url}` : null;

    return `<!DOCTYPE html>
<html lang="${escapeHtml(config.site?.lang || 'en')}">
<head>
    <meta charset="UTF-8">
    <title>Redirecting…</title>
    <meta http-equiv="refresh" content="0; url=${escapeHtml(url)}">
    <meta name="robots" content="noindex">${canonical ? `
    <link rel="canonical" href="${escapeHtml(canonical)}">` : ''}
</head>
<body>
    <p>This page has moved to <a href="${escapeHtml(url)}">${escapeHtml(url)}</a>.</p>
</body>
</html>
`;
}

/** Netlify/Cloudflare Pages `_redirects` file content. */
export function generateRedirectsFile(redirects: Record<string, string>, config: SSGConfig): string {
    return (
        Object.entries(redirects)
            .map(([from, to]) => `${withBase(from, config)} ${withBase(to, config)} 301`)
            .join('\n') + '\n'
    );
}

/**
 * Write all redirect pages and the `_redirects` file into `outDir`.
 * Refuses to overwrite an existing file — a redirect shadowing a real
 * rendered page is a config error, not something to clobber silently.
 */
export async function writeRedirects(
    redirects: Record<string, string>,
    config: SSGConfig,
    outDir: string
): Promise<void> {
    for (const [from, to] of Object.entries(redirects)) {
        const outputPath = getOutputPath(from, outDir);
        if (fsSync.existsSync(outputPath)) {
            throw new Error(
                `redirects: "${from}" would overwrite an existing page (${path.relative(outDir, outputPath)}). ` +
                `Remove the page or the redirect.`
            );
        }
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, generateRedirectHtml(to, config), 'utf-8');
    }

    await fs.writeFile(path.join(outDir, '_redirects'), generateRedirectsFile(redirects, config), 'utf-8');
}
