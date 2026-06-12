/**
 * Sitemap lastmod + per-page overrides + entry transform (signalxjs/ssg#38):
 * crawlers got no freshness signal — `lastmod: 'git' | 'mtime'` derives one
 * from each page's source file, per-page meta wins, and `sitemap.transform`
 * adjusts or drops entries programmatically.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gitLastModifiedMap, resolveLastmods } from '../lastmod';
import { pagesToSitemapEntries } from '../sitemap';
import type { PageBuildResult } from '../types';

function page(p: string, meta: Record<string, unknown> = {}, source?: string): PageBuildResult {
    return { path: p, file: `${p}/index.html`, time: 1, size: 1, meta, ...(source ? { source } : {}) };
}

let repo: string;

beforeAll(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'ssg-lastmod-'));
    const env = {
        ...process.env,
        GIT_AUTHOR_NAME: 't',
        GIT_AUTHOR_EMAIL: 't@t',
        GIT_COMMITTER_NAME: 't',
        GIT_COMMITTER_EMAIL: 't@t',
    };
    const git = (args: string[], extraEnv: Record<string, string> = {}) =>
        execFileSync('git', args, { cwd: repo, env: { ...env, ...extraEnv } });
    git(['init', '-q']);
    fs.mkdirSync(path.join(repo, 'src'));
    fs.writeFileSync(path.join(repo, 'src', 'old.mdx'), 'old');
    git(['add', '.']);
    git(['commit', '-q', '-m', 'first'], { GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z', GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z' });
    fs.writeFileSync(path.join(repo, 'src', 'fresh.mdx'), 'fresh');
    git(['add', '.']);
    git(['commit', '-q', '-m', 'second'], { GIT_COMMITTER_DATE: '2026-06-01T00:00:00Z', GIT_AUTHOR_DATE: '2026-06-01T00:00:00Z' });
});

afterAll(() => {
    fs.rmSync(repo, { recursive: true, force: true });
});

describe('gitLastModifiedMap (#38)', () => {
    it('maps each file to its last commit date with one git invocation', () => {
        const map = gitLastModifiedMap(repo);
        expect(map.get('src/old.mdx')).toContain('2026-01-01');
        expect(map.get('src/fresh.mdx')).toContain('2026-06-01');
    });

    it('preserves filenames with leading spaces (no trim corruption)', () => {
        const env = {
            ...process.env,
            GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t',
            GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
            GIT_COMMITTER_DATE: '2026-06-02T00:00:00Z', GIT_AUTHOR_DATE: '2026-06-02T00:00:00Z',
        };
        fs.writeFileSync(path.join(repo, ' padded.mdx'), 'x');
        execFileSync('git', ['add', '.'], { cwd: repo, env });
        execFileSync('git', ['commit', '-q', '-m', 'padded'], { cwd: repo, env });
        const map = gitLastModifiedMap(repo);
        expect(map.get(' padded.mdx')).toContain('2026-06-02');
    });

    it('returns an empty map outside a git repo', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssg-nogit-'));
        try {
            expect(gitLastModifiedMap(dir).size).toBe(0);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe('resolveLastmods (#38)', () => {
    it("mode 'git' resolves via the repo, keyed by page path", () => {
        const map = resolveLastmods(
            [page('/old', {}, path.join(repo, 'src', 'old.mdx'))],
            'git',
            repo
        );
        expect(map.get('/old')).toContain('2026-01-01');
    });

    it("mode 'mtime' falls back to the file's mtime", () => {
        const file = path.join(repo, 'src', 'fresh.mdx');
        const map = resolveLastmods([page('/fresh', {}, file)], 'mtime', repo);
        const expected = fs.statSync(file).mtime.toISOString().split('T')[0];
        expect(map.get('/fresh')).toContain(expected);
    });
});

describe('per-page sitemap meta + transform (#38)', () => {
    it('meta.lastmod/changefreq/priority override the defaults', () => {
        const entries = pagesToSitemapEntries(
            [page('/a', { lastmod: '2026-03-03', changefreq: 'daily', priority: 0.3 })],
            {}
        );
        expect(entries[0]).toMatchObject({ path: '/a', changefreq: 'daily', priority: 0.3, lastmod: '2026-03-03' });
    });

    it('lastmodByPath supplies derived dates without overriding meta', () => {
        const entries = pagesToSitemapEntries(
            [page('/derived'), page('/explicit', { lastmod: '2026-02-02' })],
            { lastmodByPath: new Map([['/derived', '2026-05-05'], ['/explicit', '2026-05-05']]) }
        );
        expect(entries.find((e) => e.path === '/derived')?.lastmod).toBe('2026-05-05');
        expect(entries.find((e) => e.path === '/explicit')?.lastmod).toBe('2026-02-02');
    });

    it('ignores malformed frontmatter overrides instead of throwing', () => {
        const entries = pagesToSitemapEntries(
            [page('/messy', { priority: '0.9', changefreq: 'sometimes', lastmod: 12345 } as never)],
            {}
        );
        // numeric-string priority coerced; bogus changefreq/lastmod ignored
        expect(entries[0].priority).toBe(0.9);
        expect(entries[0].changefreq).not.toBe('sometimes');
        expect(entries[0].lastmod).toBeUndefined();
    });

    it('transform adjusts entries and drops them by returning null', () => {
        const entries = pagesToSitemapEntries(
            [page('/keep'), page('/drop-me')],
            {
                transform: (entry, p) =>
                    p.path === '/drop-me' ? null : { ...entry, priority: 0.9 },
            }
        );
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({ path: '/keep', priority: 0.9 });
    });
});
