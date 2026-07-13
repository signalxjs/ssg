/**
 * Per-page markdown rendition for the llms outputs (#176).
 *
 * Source-based: for `.md`/`.mdx`-sourced pages the raw source is already
 * markdown, so no HTML→markdown conversion is needed — only a cleanup of the
 * MDX-specific syntax (ESM imports/exports, JSX components, `{…}`
 * expressions) that an LLM reading the file couldn't resolve.
 *
 * The cleaner is a fence-aware line scanner, deliberately NOT a parser:
 * content inside ``` / ~~~ fences is never touched (docs pages are full of
 * `import { signal } from 'sigx'` inside fences), and pathological inputs
 * (braces inside string literals of multi-line expressions, JSX fragments
 * `<>`) may mis-scan. It is a best-effort cleaner; `llms.transform` is the
 * per-page escape hatch when it gets something wrong.
 */

import { parseFrontmatter } from './mdx/frontmatter';
import type { PageMeta } from './types';

export interface RenderPageMarkdownOptions {
    /** Absolute HTML URL of the page, embedded in the header block. */
    url: string;
    /** Route meta — title/description for the header block. */
    meta?: PageMeta;
    /**
     * Source filename; a `.mdx` extension enables the MDX-specific cleaning
     * rules (plain `.md` prose starting with "import …" must survive).
     */
    sourceFile?: string;
}

/**
 * Render a page's `.md`/`.mdx` source to its markdown rendition: the
 * frontmatter is replaced with a minimal `---\nurl/title/description\n---`
 * header, MDX syntax is stripped (fence contents untouched), and fence info
 * strings are normalized to the bare language. Pure.
 */
export function renderPageMarkdown(source: string, options: RenderPageMarkdownOptions): string {
    const { data, content } = parseFrontmatter(source);
    const isMdx = options.sourceFile?.toLowerCase().endsWith('.mdx') ?? false;

    const header = ['---', `url: ${yamlValue(options.url)}`];
    const title = options.meta?.title ?? data.title;
    const description = options.meta?.description ?? data.description;
    if (typeof title === 'string' && title) header.push(`title: ${yamlValue(title)}`);
    if (typeof description === 'string' && description) {
        header.push(`description: ${yamlValue(description)}`);
    }
    header.push('---');

    // Normalize to LF first: `.` and `$` in the scanner's regexes treat
    // `\r` as a line terminator, and the rendition is a derived artifact —
    // LF-only output keeps it identical across platforms. Blank-run
    // collapsing happens inside the scanner, which knows fence state —
    // a global regex here would mutate intentional spacing in fences.
    const body = cleanBody(content.replace(/\r\n?/g, '\n'), isMdx, data)
        .replace(/^\n+/, '')
        .replace(/\n*$/, '\n');

    return `${header.join('\n')}\n\n${body}`;
}

/**
 * Quote a header value only when YAML would misread it bare (mapping
 * indicator `: `, comment `#`, leading indicator char, quotes, newlines,
 * or surrounding whitespace). Best-effort — this header is for LLMs.
 */
function yamlValue(value: string): string {
    return /: |#|["'\n]|^[\s\-?:,[\]{}>|&*!%@`]|^\s|\s$/.test(value)
        ? JSON.stringify(value)
        : value;
}

const FENCE_OPEN = /^( {0,3})(`{3,}|~{3,})(.*)$/;
/** Fence info strings reduced to their first token when it looks like a language. */
const FENCE_LANG = /^[\w+#.-]+$/;

type State = 'text' | 'fence' | 'esm' | 'jsx-tag-open' | 'expr';

function cleanBody(content: string, isMdx: boolean, frontmatter: PageMeta): string {
    const out: string[] = [];
    let state: State = 'text';

    // Outside fences, dropped blocks leave blank-line gaps — never emit two
    // consecutive blank lines. Fence content bypasses this (pushed directly):
    // spacing inside examples is intentional.
    let lastBlank = true; // also swallows leading blanks
    const emit = (line: string) => {
        const blank = line.trim() === '';
        if (blank && lastBlank) return;
        out.push(line);
        lastBlank = blank;
    };

    // fence bookkeeping — close requires the same marker char, at least the
    // open run's length (` ``` ` never closes `~~~`); unclosed fences keep
    // the rest of the file verbatim, same posture as extractTitleFromContent.
    let fenceChar = '';
    let fenceLen = 0;

    // multi-line `<Tag …` whose closing `>` hasn't been seen yet
    let pendingTag = '';
    // open paired capitalized tags — their children are emitted, tags dropped
    const jsxStack: string[] = [];

    // multi-line `{…}` expression bookkeeping
    let exprDepth = 0;
    let exprIsComment = false;

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        if (state === 'fence') {
            out.push(line); // verbatim — no blank collapsing inside fences
            lastBlank = false;
            const close = line.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
            if (close && close[1][0] === fenceChar && close[1].length >= fenceLen) {
                state = 'text';
            }
            continue;
        }

        if (state === 'esm') {
            // An MDX ESM block runs to the next blank line — its own grammar,
            // so multi-line imports/exports need no brace counting.
            if (line.trim() === '') {
                emit(line);
                state = 'text';
            }
            continue;
        }

        if (state === 'jsx-tag-open') {
            const gt = line.indexOf('>');
            if (gt === -1) continue; // still inside the attribute list
            if (!line.slice(0, gt).trimEnd().endsWith('/')) jsxStack.push(pendingTag);
            state = 'text';
            line = line.slice(gt + 1);
            if (line.trim() === '') continue;
            // fall through: text after the `>` re-enters the text rules
        }

        if (state === 'expr') {
            if (exprIsComment) {
                if (line.includes('*/')) {
                    exprIsComment = false;
                    exprDepth = 0;
                    state = 'text';
                }
                continue;
            }
            exprDepth += braceDelta(line);
            if (exprDepth <= 0) state = 'text';
            continue;
        }

        // ---- text state ----

        const fence = line.match(FENCE_OPEN);
        if (fence) {
            const info = fence[3].trim();
            const lang = info.split(/\s+/)[0] ?? '';
            // ` ```tsx code console live ` → ` ```tsx ` (drops live-code /
            // code-window tokens and shiki meta); unrecognizable info → bare.
            emit(fence[1] + fence[2] + (FENCE_LANG.test(lang) ? lang : ''));
            fenceChar = fence[2][0];
            fenceLen = fence[2].length;
            state = 'fence';
            continue;
        }

        // Indented code blocks: verbatim, no rules.
        if (/^ {4,}/.test(line) && line.trim() !== '') {
            emit(line);
            continue;
        }

        if (!isMdx) {
            emit(line);
            continue;
        }

        // `{frontmatter.x}` → the value, before the expression rules so a
        // line that IS only `{frontmatter.version}` becomes the value
        // rather than being dropped.
        line = line.replace(/\{\s*frontmatter\.(\w+)\s*\}/g, (_, key: string) =>
            String((frontmatter as Record<string, unknown>)[key] ?? '')
        );

        // Inline JSX resolvable within the line: self-closing tags dropped,
        // same-line pairs keep their children. Backtick spans are content.
        const hadContent = line.trim() !== '';
        line = stripInlineJsx(line);
        const trimmed = line.trim();
        if (hadContent && trimmed === '') continue; // line was only tags

        // MDX ESM must be flush-left, so prose can't false-positive.
        if (/^(import|export)\b/.test(line)) {
            state = 'esm';
            continue;
        }

        // Multi-line JSX: capitalized tags only — lowercase HTML passes
        // through. Anything still tag-shaped here spans lines.
        if (/^ {0,3}<\/?[A-Z]/.test(line)) {
            // Lone closing tag of a paired component.
            const close = trimmed.match(/^<\/([A-Z][\w.]*)>$/);
            if (close) {
                const idx = jsxStack.lastIndexOf(close[1]);
                if (idx !== -1) jsxStack.splice(idx, 1);
                continue;
            }

            // `<Tag` whose attribute list spans lines (no `>` yet).
            const unterminated = trimmed.match(/^<([A-Z][\w.]*)(\s.*)?$/);
            if (unterminated && !trimmed.includes('>')) {
                pendingTag = unterminated[1];
                state = 'jsx-tag-open';
                continue;
            }

            // `<Tag …>` opened here, closed on a later line — drop the tag,
            // keep whatever follows it (the children re-enter these rules).
            const open = trimmed.match(/^<([A-Z][\w.]*)(\s[^>]*?)?>(.*)$/);
            if (open) {
                jsxStack.push(open[1]);
                if (open[3].trim() !== '') emit(open[3]);
                continue;
            }

            emit(line);
            continue;
        }

        // Top-level `{…}` expressions.
        if (/^ {0,3}\{/.test(line)) {
            if (trimmed.startsWith('{/*')) {
                if (!line.includes('*/')) {
                    state = 'expr';
                    exprIsComment = true;
                }
                continue; // comment (or its opening line) — dropped either way
            }
            const delta = braceDelta(line);
            if (delta > 0) {
                state = 'expr';
                exprDepth = delta;
                continue;
            }
            if (isWholeLineExpression(trimmed)) continue;
            // `{x} and prose` / `{a} between {b}` — leave it alone.
        }

        emit(line);
    }

    return out.join('\n');
}

/**
 * Strip capitalized JSX resolvable within one line — self-closing tags
 * dropped, same-line pairs replaced by their children — leaving inline
 * code spans untouched (`` `<Demo />` `` in prose is content, not JSX).
 */
function stripInlineJsx(line: string): string {
    return line
        .split(/(`[^`]*`)/)
        .map((segment, i) => {
            if (i % 2 === 1) return segment; // backtick code span
            let prev: string;
            do {
                prev = segment;
                segment = segment
                    .replace(/<[A-Z][\w.]*(\s[^>]*?)?\/>/g, '')
                    .replace(/<([A-Z][\w.]*)(\s[^>]*?)?>(.*?)<\/\1>/g, '$3');
            } while (segment !== prev);
            return segment;
        })
        .join('');
}

/** Net `{`/`}` count of a line — naive, good enough for a cleaner. */
function braceDelta(line: string): number {
    let depth = 0;
    for (const ch of line) {
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
    }
    return depth;
}

/**
 * True when the trimmed line is ONE balanced `{…}` expression — the opening
 * brace's match is the final character. `{a} between {b}` is prose, not an
 * expression: its depth returns to 0 mid-line.
 */
function isWholeLineExpression(trimmed: string): boolean {
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return false;
    let depth = 0;
    for (let i = 0; i < trimmed.length; i++) {
        const ch = trimmed[i];
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
        if (depth === 0) return i === trimmed.length - 1;
    }
    return false;
}
