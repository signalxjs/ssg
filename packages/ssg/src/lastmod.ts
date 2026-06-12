/**
 * Source-file freshness for sitemap `<lastmod>` (signalxjs/ssg#38).
 *
 * `sitemap.lastmod: 'git'` uses each page's last commit date — one
 * `git log` walk for the whole repo, not one process per file (sigx.dev has
 * ~1900 pages). Needs full history in CI (`fetch-depth: 0`); files absent
 * from a shallow clone's log simply get no `<lastmod>`. `'mtime'` uses the
 * filesystem instead — simple, but checkout time in fresh CI clones.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { PageBuildResult } from './types';

/**
 * Last commit date per repo-relative posix path, from a single
 * `git log --name-only` walk (newest first — the first time a file appears
 * is its most recent change). Empty map when git/history is unavailable.
 */
export function gitLastModifiedMap(root: string): Map<string, string> {
    const map = new Map<string, string>();
    let output: string;
    try {
        output = execFileSync('git', ['log', '--name-only', '--format=%x00%cI'], {
            cwd: root,
            encoding: 'utf-8',
            maxBuffer: 256 * 1024 * 1024,
        });
    } catch {
        return map; // not a git repo / git missing
    }

    let currentDate = '';
    for (const line of output.split('\n')) {
        if (line.startsWith('\x00')) {
            currentDate = line.slice(1).trim(); // commit marker line (%x00%cI)
        } else {
            // Strip only a Windows \r — paths may legitimately start or end
            // with spaces, and trimming would corrupt the lookup key.
            const file = line.endsWith('\r') ? line.slice(0, -1) : line;
            if (file && currentDate && !map.has(file)) {
                map.set(file, currentDate);
            }
        }
    }
    return map;
}

/**
 * `lastmod` (ISO date) per page path for pages that carry a `source` file.
 */
export function resolveLastmods(
    pages: PageBuildResult[],
    mode: 'git' | 'mtime',
    root: string
): Map<string, string> {
    const result = new Map<string, string>();
    const gitMap = mode === 'git' ? gitLastModifiedMap(root) : null;

    for (const page of pages) {
        if (!page.source) continue;
        if (gitMap) {
            const rel = path.relative(root, page.source).replace(/\\/g, '/');
            const date = gitMap.get(rel);
            if (date) result.set(page.path, date);
        } else {
            try {
                result.set(page.path, fs.statSync(page.source).mtime.toISOString());
            } catch {
                /* source missing — no lastmod for this page */
            }
        }
    }
    return result;
}
