import { describe, it, expect } from 'vitest';
import { highlightCode, rehypeShiki } from '../shiki';

const LIVE_CODE = `render(<App />, '#sandbox');`;

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

    it('applies the label to the LivePreview island SSR fallback too', async () => {
        const html = await highlightCode(LIVE_CODE, 'tsx', { triggerLabel: '⚡ Run' }, {
            live: true,
            tabs: ['preview', 'code'],
        });
        expect(html).toContain('class="live-preview-island"');
        expect(html).toContain('>⚡ Run</button>');
    });

    it('omits the island SSR trigger button when the block is not live', async () => {
        const html = await highlightCode(LIVE_CODE, 'tsx', { triggerLabel: '⚡ Run' }, {
            live: false,
            tabs: ['preview', 'code'],
        });
        expect(html).toContain('class="live-preview-island"');
        expect(html).not.toContain('code-window-try-live');
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
