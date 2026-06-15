import { describe, it, expect } from 'vitest';
import { highlightCode, rehypeShiki } from '../shiki';

const LIVE_CODE = `render(<App />, '#sandbox');`;

/** Decode the JSON carried in a live-preview island's `data-island-props`. */
function islandProps(html: string): Record<string, any> {
    const match = html.match(/data-island-props="([^"]*)"/);
    if (!match) throw new Error('no data-island-props found in island markup');
    // The attribute value is HTML-escaped; reverse the escapes the emitter applies.
    const json = match[1]
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
    return JSON.parse(json);
}

describe('highlightCode — live trigger label', () => {
    it('defaults the trigger button to "⚡ Try Live"', async () => {
        const html = await highlightCode(LIVE_CODE, 'tsx', undefined, { live: true });
        expect(html).toContain('class="code-window-try-live"');
        expect(html).toContain('>⚡ Try Live</button>');
    });

    it('honors a global shiki.triggerLabel config', async () => {
        const html = await highlightCode(LIVE_CODE, 'tsx', { triggerLabel: '⚡ Run' }, { live: true });
        expect(html).toContain('>⚡ Run</button>');
        expect(html).not.toContain('Try Live');
    });

    it('lets a per-block label override the global config', async () => {
        const html = await highlightCode(LIVE_CODE, 'tsx', { triggerLabel: '⚡ Run' }, {
            live: true,
            triggerLabel: 'Open',
        });
        expect(html).toContain('>Open</button>');
        expect(html).not.toContain('Run</button>');
    });

    it('carries the resolved label in the island props (the SSR button is gone)', async () => {
        const html = await highlightCode(LIVE_CODE, 'tsx', { triggerLabel: '⚡ Run' }, {
            live: true,
            tabs: ['preview', 'code'],
        });
        expect(html).toContain('class="live-preview-island"');
        // No SSR chrome at all — the label rides in data-island-props, not a button.
        expect(html).not.toContain('<button');
        expect(islandProps(html).triggerLabel).toBe('⚡ Run');
    });

    it('omits triggerLabel from the island props when the block is not live', async () => {
        const html = await highlightCode(LIVE_CODE, 'tsx', { triggerLabel: '⚡ Run' }, {
            live: false,
            tabs: ['preview', 'code'],
        });
        expect(html).toContain('class="live-preview-island"');
        expect(html).not.toContain('code-window-try-live');
        const props = islandProps(html);
        expect(props.live).toBe(false);
        expect(props.triggerLabel).toBeUndefined();
    });

    it('escapes a configured label', async () => {
        const html = await highlightCode(LIVE_CODE, 'tsx', { triggerLabel: 'Run <now>' }, { live: true });
        expect(html).toContain('Run &lt;now&gt;</button>');
    });

    it('omits the trigger button entirely for non-live blocks', async () => {
        const html = await highlightCode(LIVE_CODE, 'tsx', { triggerLabel: '⚡ Run' }, { live: false });
        expect(html).not.toContain('code-window-try-live');
    });
});

/** Build a minimal HAST tree for a fenced code block with a meta string. */
function codeTree(meta: string, code = LIVE_CODE) {
    const codeNode = {
        type: 'element',
        tagName: 'code',
        properties: { className: ['language-tsx'] },
        data: { meta },
        children: [{ type: 'text', value: code }],
    };
    const pre = { type: 'element', tagName: 'pre', properties: {}, children: [codeNode] };
    return { type: 'root', children: [pre] };
}

/** Find the first element whose class list includes `className`. */
function findByClass(node: any, className: string): any {
    const classes = node?.properties?.className;
    if (Array.isArray(classes) && classes.includes(className)) return node;
    for (const child of node?.children ?? []) {
        const found = findByClass(child, className);
        if (found) return found;
    }
    return null;
}

/** Run the transformer over a single fence and return the rendered trigger label. */
async function triggerLabelFor(meta: string, config?: Parameters<typeof rehypeShiki>[0]): Promise<string | null> {
    const { toString } = await import('hast-util-to-string');
    const tree = codeTree(meta);
    await rehypeShiki(config)(tree);
    const btn = findByClass(tree, 'code-window-try-live');
    return btn ? toString(btn) : null;
}

/** Strip Shiki span markup to recover the plain text of a rendered window. */
function plainText(html: string): string {
    return html.replace(/<[^>]+>/g, '');
}

describe('highlightCode — package-manager install fences', () => {
    it('renders a tab strip + all four variants for a shell install fence', async () => {
        const html = await highlightCode('pnpm add @sigx/lynx-video', 'bash');

        expect(html).toContain('class="code-window code-window-pm"');
        expect(html).toContain('class="code-window-tabs code-window-pm-tabs"');
        // ARIA tab semantics for the strip: a tablist, four tabs, four panels,
        // each tab wired to its panel via aria-controls.
        expect(html).toContain('role="tablist"');
        expect((html.match(/role="tab"/g) ?? []).length).toBe(4);
        expect((html.match(/role="tabpanel"/g) ?? []).length).toBe(4);
        expect(html).toMatch(/role="tab"[^>]*aria-controls="pm-window-\d+-panel-pnpm"/);
        expect(html).toMatch(/role="tabpanel"[^>]*aria-labelledby="pm-window-\d+-tab-pnpm"/);
        for (const pm of ['pnpm', 'npm', 'yarn', 'bun']) {
            expect(html).toContain(`data-pm="${pm}"`);
            expect(html).toContain(`data-pm-variant="${pm}"`);
        }
    });

    it('renders the correct command per manager, with no doubling', async () => {
        // Reproduces issue #40's input. The old client enhancer produced
        // "pnpmpnpm add … add …"; server rendering yields one clean command each.
        const html = await highlightCode('pnpm add @sigx/lynx-video', 'bash');
        const text = plainText(html);

        expect(text).toContain('pnpm add @sigx/lynx-video');
        expect(text).toContain('npm install @sigx/lynx-video');
        expect(text).toContain('yarn add @sigx/lynx-video');
        expect(text).toContain('bun add @sigx/lynx-video');
        expect(text).not.toContain('pnpmpnpm');
    });

    it('defaults to pnpm and hides the other variants inline', async () => {
        const html = await highlightCode('pnpm add foo', 'bash');
        // Container default + active tab on pnpm.
        expect(html).toContain('class="code-window code-window-pm" data-pm="pnpm"');
        expect(html).toMatch(/data-pm="pnpm"[^>]*aria-selected="true"/);
        // Non-default variants hidden; the default one is not.
        expect(html).toContain('data-pm-variant="npm" style="display:none"');
        expect(html).not.toContain('data-pm-variant="pnpm" style="display:none"');
    });

    it('honors shiki.defaultPackageManager', async () => {
        const html = await highlightCode('pnpm add foo', 'bash', { defaultPackageManager: 'npm' });
        expect(html).toContain('class="code-window code-window-pm" data-pm="npm"');
        expect(html).toContain('data-pm-variant="pnpm" style="display:none"');
        expect(html).not.toContain('data-pm-variant="npm" style="display:none"');
    });

    it('translates only the install line, leaving other lines identical', async () => {
        const html = await highlightCode('pnpm add foo\nsigx prebuild', 'bash');
        // The non-install line is preserved verbatim in every variant.
        const prebuildCount = plainText(html).split('sigx prebuild').length - 1;
        expect(prebuildCount).toBe(4);
        expect(plainText(html)).toContain('npm install foo');
    });

    it('preserves leading indentation of translated lines', async () => {
        const html = await highlightCode('  pnpm add foo', 'bash');
        const text = plainText(html);
        // The indent survives in every variant (default and translated).
        expect(text).toContain('  pnpm add foo');
        expect(text).toContain('  npm install foo');
    });

    it('leaves a shell fence with no install command untouched', async () => {
        const html = await highlightCode('sigx prebuild', 'bash');
        expect(html).not.toContain('code-window-pm');
        expect(html).not.toContain('data-pm-variant');
        expect(html).toContain('class="code-window"');
    });

    it('does not touch non-shell fences', async () => {
        const html = await highlightCode("import * as Video from '@sigx/lynx-video';", 'tsx');
        expect(html).not.toContain('code-window-pm');
    });

    it('also handles `sh`/`zsh` fences (not in the default loaded langs)', async () => {
        for (const lang of ['sh', 'zsh']) {
            const html = await highlightCode('pnpm add foo', lang);
            expect(html, lang).toContain('class="code-window code-window-pm"');
            expect(plainText(html), lang).toContain('npm install foo');
            // Header label is derived from the resolved shell grammar (bash →
            // "Terminal"), not the collapsed `text` lang, so it isn't blank.
            expect(html, lang).toContain('<span class="code-window-lang">Terminal</span>');
        }
    });
});

describe('rehypeShiki — per-fence label meta', () => {
    it('reads a quoted label with spaces from the fence meta', async () => {
        expect(await triggerLabelFor('live label="⚡ Run"')).toBe('⚡ Run');
    });

    it('falls back to the global config when no per-fence label is set', async () => {
        expect(await triggerLabelFor('live', { triggerLabel: '▶ Run' })).toBe('▶ Run');
    });

    it('defaults when neither per-fence nor config label is set', async () => {
        expect(await triggerLabelFor('live')).toBe('⚡ Try Live');
    });

    it('does not match the label key as a substring of another token', async () => {
        // `data-label="x"` must not be read as `label`; falls back to the default.
        expect(await triggerLabelFor('live data-label="x"')).toBe('⚡ Try Live');
    });
});

describe('highlightCode — language aliases (#55)', () => {
    it('highlights `ts` fences via the typescript grammar', async () => {
        const html = await highlightCode('const x: number = 1;', 'ts');
        expect(html).toContain('shiki');
        expect(html).toContain('<span style');
        expect(html).toContain('>TypeScript</span>');
    });

    it('highlights `js` fences via the javascript grammar', async () => {
        const html = await highlightCode('const x = 1;', 'js');
        expect(html).toContain('<span style');
        expect(html).toContain('>JavaScript</span>');
    });

    it('loads bundled languages outside the default list on demand', async () => {
        const html = await highlightCode('def f():\n    return 1', 'python');
        expect(html).toContain('<span style');
        expect(html).toContain('>Python</span>');
    });

    it('still falls back to text for unknown languages', async () => {
        const html = await highlightCode('whatever', 'not-a-language');
        expect(html).toContain('code-window');
    });
});

describe('LivePreview island — content-free placeholder (#149)', () => {
    it('emits the island wrapper with no code-window chrome inside', async () => {
        const html = await highlightCode(LIVE_CODE, 'tsx', undefined, {
            live: true,
            tabs: ['preview', 'code'],
        });
        expect(html).toContain('class="live-preview-island"');
        expect(html).toContain('data-island="LivePreview"');
        // The whole point: nothing for client hydration to structurally diverge
        // from. No chrome, no spinner, no nested code-window, no buttons.
        expect(html).not.toContain('code-window');
        expect(html).not.toContain('code-window-preview-loading');
        expect(html).not.toContain('Loading preview');
        expect(html).not.toContain('<button');
    });

    it('still ships the code (base64 + highlighted) in data-island-props', async () => {
        const html = await highlightCode(LIVE_CODE, 'tsx', undefined, {
            live: true,
            tabs: ['preview', 'code'],
        });
        const props = islandProps(html);
        expect(typeof props.code).toBe('string');
        expect(props.code.length).toBeGreaterThan(0);
        expect(props.highlightedCode).toContain('<pre');
        expect(props.tabs).toEqual(['preview', 'code']);
        expect(props.live).toBe(true);
    });
});

describe('LivePreview island — SPA opt-out (#95)', () => {
    it('the island wrapper carries data-no-spa so preview links never hijack navigation', async () => {
        const html = await highlightCode(LIVE_CODE, 'tsx', undefined, { tabs: ['preview', 'code'] });
        expect(html).toMatch(/class="live-preview-island"[^>]*data-no-spa/s);
    });
});

describe('shiki.transformers pass-through (#64)', () => {
    it('runs configured transformers on every highlighted block', async () => {
        const html = await highlightCode('const x = 1;', 'ts', {
            transformers: [
                {
                    pre(node: any) {
                        node.properties['data-transformed'] = 'yes';
                    },
                },
            ],
        });
        expect(html).toContain('data-transformed="yes"');
    });

    it('exposes the raw fence meta to transformers (meta.__raw)', async () => {
        // @shikijs/transformers' meta-highlight ({1,3-5}) reads options.meta.__raw —
        // assert the plumbing with a minimal transformer doing the same.
        const seen: string[] = [];
        const tree = codeTree('{1,3-5} filename="x.tsx"');
        await rehypeShiki({
            transformers: [
                {
                    pre(node: any) {
                        seen.push((this as any).options?.meta?.__raw ?? '');
                        return node;
                    },
                },
            ],
        })(tree);
        expect(seen.some((raw) => raw.includes('{1,3-5}'))).toBe(true);
    });

    it('applies transformers to all package-manager variants', async () => {
        const html = await highlightCode('pnpm add foo', 'bash', {
            transformers: [
                {
                    pre(node: any) {
                        node.properties['data-transformed'] = 'yes';
                    },
                },
            ],
        });
        expect((html.match(/data-transformed="yes"/g) ?? []).length).toBe(4);
    });
});

describe('shiki.skipLanguages escape hatch (#64)', () => {
    it('leaves fences in skipLanguages untouched for downstream plugins', async () => {
        const codeNode = {
            type: 'element',
            tagName: 'code',
            properties: { className: ['language-mermaid'] },
            children: [{ type: 'text', value: 'graph TD; A-->B;' }],
        };
        const pre = { type: 'element', tagName: 'pre', properties: {}, children: [codeNode] };
        const tree: any = { type: 'root', children: [pre] };

        await rehypeShiki({ skipLanguages: ['mermaid'] })(tree);

        // The raw pre>code survives — a mermaid rehype plugin/island can claim it.
        expect(tree.children[0]).toBe(pre);
        expect(tree.children[0].children[0].children[0].value).toBe('graph TD; A-->B;');
    });

    it('still highlights languages not in skipLanguages', async () => {
        const tree: any = codeTree('');
        await rehypeShiki({ skipLanguages: ['mermaid'] })(tree);
        expect(tree.children[0].tagName).not.toBe('pre');
        expect(findByClass(tree, 'code-window')).toBeTruthy();
    });
});

describe('copy-code button (#65)', () => {
    it('emits a copy button in the plain code-window header', async () => {
        const html = await highlightCode('const x = 1;', 'ts');
        expect(html).toContain('class="code-window-copy"');
        expect(html).toContain('aria-label="Copy code"');
    });

    it('emits a single copy button on package-manager windows', async () => {
        const html = await highlightCode('pnpm add foo', 'bash');
        expect((html.match(/code-window-copy"/g) ?? []).length).toBe(1);
    });
});
