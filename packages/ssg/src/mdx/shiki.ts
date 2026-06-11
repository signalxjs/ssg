/**
 * Shiki syntax highlighting integration
 *
 * Provides code block highlighting for Markdown/MDX content.
 */

import { createHighlighter, bundledLanguages, type Highlighter, type BundledLanguage, type BundledTheme } from 'shiki';
import type { ShikiConfig } from '../types';
import { type Pm, PMS, DEFAULT_PM, parse, render } from './package-manager';

/**
 * Cached highlighter instance
 */
let highlighterPromise: Promise<Highlighter> | null = null;

/**
 * Default Shiki configuration
 */
const DEFAULT_CONFIG: Required<ShikiConfig> = {
    light: 'github-light',
    dark: 'github-dark',
    langs: ['javascript', 'typescript', 'jsx', 'tsx', 'json', 'css', 'html', 'markdown', 'bash', 'shell'],
    triggerLabel: '⚡ Try Live',
    defaultPackageManager: DEFAULT_PM,
    transformers: [],
    skipLanguages: [],
};

/** Shell-ish languages whose fences may carry package-manager install commands. */
const SHELL_LANGS = new Set(['bash', 'shell', 'sh', 'zsh']);

/**
 * Monotonic counter for per-window unique ids on the package-manager tab strip
 * (wires `aria-controls`/`aria-labelledby` between tabs and panels). Only needs
 * to be unique within a rendered page; ids are server-only markup the client
 * never regenerates, so the running count is harmless.
 */
let pmWindowSeq = 0;

/**
 * Initialize or get the Shiki highlighter
 */
export async function getHighlighter(config?: ShikiConfig): Promise<Highlighter> {
    if (!highlighterPromise) {
        const mergedConfig = { ...DEFAULT_CONFIG, ...config };

        highlighterPromise = createHighlighter({
            themes: [mergedConfig.light as BundledTheme, mergedConfig.dark as BundledTheme],
            langs: mergedConfig.langs as BundledLanguage[],
        });
    }

    return highlighterPromise;
}

/**
 * Tab types for preview blocks
 */
export type TabType = 'preview' | 'code' | 'console';

/**
 * Highlight code with Shiki
 */
export async function highlightCode(
    code: string,
    lang: string,
    config?: ShikiConfig,
    meta?: { filename?: string; live?: boolean; tabs?: TabType[]; triggerLabel?: string; metaRaw?: string }
): Promise<string> {
    const highlighter = await getHighlighter(config);
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };

    // Resolve the fence language: already loaded (canonical names and their
    // aliases both appear in getLoadedLanguages), else load any other bundled
    // grammar on demand (`python`, `rust`, … — #55), else fall back to text.
    const loadedLangs = highlighter.getLoadedLanguages();
    let effectiveLang = lang;
    if (!loadedLangs.includes(lang as BundledLanguage)) {
        if (Object.hasOwn(bundledLanguages, lang)) {
            try {
                await highlighter.loadLanguage(lang as BundledLanguage);
            } catch {
                effectiveLang = 'text';
            }
        } else {
            effectiveLang = 'text';
        }
    }

    // Highlight `src` with both themes (CSS picks light/dark). A helper rather
    // than an eager `codeHtml`, so the package-manager path — which re-highlights
    // each manager variant — doesn't pay for an unused highlight of the original.
    const highlight = (src: string, language: BundledLanguage): string =>
        highlighter.codeToHtml(src, {
            lang: language,
            themes: {
                light: mergedConfig.light as BundledTheme,
                dark: mergedConfig.dark as BundledTheme,
            },
            transformers: mergedConfig.transformers,
            // Raw fence meta for meta-driven transformers ({1,3-5}, diff, …).
            meta: meta?.metaRaw ? { __raw: meta.metaRaw } : undefined,
        });

    // Wrap in code-window structure
    const filename = meta?.filename ?? '';
    const isLive = meta?.live ?? false;
    const tabs = meta?.tabs;  // undefined means no tabbed view, just code
    const hasTabs = tabs && tabs.length > 0;

    // Per-block `label="…"` overrides the global `shiki.triggerLabel` config.
    const triggerLabel = escapeHtml(meta?.triggerLabel ?? mergedConfig.triggerLabel);
    
    const filenameHtml = filename 
        ? `<span class="code-window-filename">${escapeHtml(filename)}</span>`
        : `<span class="code-window-lang">${getLanguageLabel(effectiveLang)}</span>`;

    // For preview blocks (has tabs), render a LivePreview island component
    if (hasTabs) {
        const base64Code = encodeBase64(code);
        const codeHtml = highlight(code, effectiveLang as BundledLanguage);

        // Generate tab buttons HTML based on tabs array
        const firstTab = tabs[0];
        const tabButtonsHtml = tabs.map((tab, i) => {
            const label = tab.charAt(0).toUpperCase() + tab.slice(1);
            const isActive = i === 0;
            return `<button class="code-window-tab${isActive ? ' code-window-tab-active' : ''}">${label}</button>`;
        }).join('\n                ');
        
        // Return an island marker that will be hydrated on the client
        // Use code-window styling for consistency with the nice terminal look
        const html = `<div 
    class="live-preview-island" 
    data-no-spa
    data-island="LivePreview" 
    data-island-strategy="visible"
    data-island-props="${escapeHtml(JSON.stringify({
        code: base64Code,
        highlightedCode: codeHtml,
        language: effectiveLang,
        filename: filename,
        tabs: tabs,
        live: isLive
    }))}"
>
    <div class="code-window code-window-live code-window-preview">
        <div class="code-window-header">
            <div class="code-window-header-left">
                <div class="code-window-dots">
                    <span class="code-window-dot dot-red"></span>
                    <span class="code-window-dot dot-yellow"></span>
                    <span class="code-window-dot dot-green"></span>
                </div>
                ${filenameHtml}
            </div>
            <div class="code-window-tabs">
                ${tabButtonsHtml}
            </div>
            ${isLive ? `<button class="code-window-try-live" disabled>${triggerLabel}</button>` : ''}
        </div>
        <div class="code-window-preview-pane"${firstTab !== 'preview' ? ' style="display:none;"' : ''}>
            <div class="code-window-preview-loading">
                <span class="code-window-spinner"></span>
                Loading preview...
            </div>
        </div>
        <div class="code-window-console-pane"${firstTab !== 'console' ? ' style="display:none;"' : ''}>
            <div class="code-window-console-empty">No console output</div>
        </div>
        <div class="code-window-content"${firstTab !== 'code' ? ' style="display:none;"' : ''}>
            ${codeHtml}
        </div>
    </div>
</div>`;
        return html;
    }

    // Shell install fences (`pnpm add …`, `npm i …`, etc.) get an
    // npm/pnpm/yarn/bun tab strip with all four variants pre-rendered. Only
    // lines that parse as a package-manager command are translated; everything
    // else (e.g. `sigx prebuild`, comments, blanks) is preserved verbatim. The
    // client switcher only toggles which `[data-pm-variant]` is visible — it
    // never rewrites line text, so it can't fight framework hydration.
    // Detect on the *raw* lang, not `effectiveLang`: `sh`/`zsh` aren't in the
    // default loaded Shiki languages, so they collapse to `text` above — but
    // they're still shell install fences. Variants are highlighted as a loaded
    // shell grammar (the resolved one if it's already a shell lang, else
    // `bash`) so `sh`/`zsh` fences get the tabs and proper highlighting too.
    const isShellFence = SHELL_LANGS.has(lang.toLowerCase()) || SHELL_LANGS.has(effectiveLang);
    if (!hasTabs && isShellFence) {
        // Split on CRLF or LF so a trailing `\r` doesn't defeat `parse()` on
        // Windows-authored fences (`pnpm add foo\r`).
        const codeLines = code.split(/\r?\n/);
        // Parse each line once and reuse the result across all four variants.
        const parsedLines = codeLines.map((line) => parse(line));
        if (parsedLines.some((parsed) => parsed !== null)) {
            const defaultPm: Pm = PMS.includes(mergedConfig.defaultPackageManager as Pm)
                ? (mergedConfig.defaultPackageManager as Pm)
                : DEFAULT_PM;

            const pmLang: BundledLanguage = (SHELL_LANGS.has(effectiveLang)
                ? effectiveLang
                : loadedLangs.includes('bash' as BundledLanguage)
                  ? 'bash'
                  : effectiveLang) as BundledLanguage;

            // Derive the header label from `pmLang`, not `effectiveLang` — the
            // latter is `text` for `sh`/`zsh` and would render a blank label.
            const pmFilenameHtml = filename
                ? `<span class="code-window-filename">${escapeHtml(filename)}</span>`
                : `<span class="code-window-lang">${getLanguageLabel(pmLang)}</span>`;

            const highlightFor = (pm: Pm): string => {
                const variantCode = codeLines
                    .map((line, i) => {
                        const parsed = parsedLines[i];
                        if (!parsed) return line;
                        // `render()` returns a trimmed command; re-apply the
                        // line's original leading indentation so indented script
                        // blocks keep their shape across variants.
                        const indent = line.match(/^\s*/)?.[0] ?? '';
                        return indent + render(parsed, pm);
                    })
                    .join('\n');
                return highlight(variantCode, pmLang);
            };

            // Unique id base so tabs and panels can reference each other (ARIA
            // tab pattern). `tab-<pm>` / `panel-<pm>` ids are paired below.
            const uid = `pm-window-${pmWindowSeq++}`;

            const tabButtonsHtml = PMS.map(
                (pm) =>
                    `<button type="button" role="tab" id="${uid}-tab-${pm}" aria-controls="${uid}-panel-${pm}" class="code-window-tab code-window-pm-tab${pm === defaultPm ? ' code-window-tab-active' : ''}" data-pm="${pm}" aria-selected="${pm === defaultPm}">${pm}</button>`,
            ).join('\n                ');

            // Non-default variants are hidden with an inline style (beats theme
            // rules without `!important`, and shows the right one on first paint
            // before any JS runs). The client switcher flips `style.display`.
            // Each is a `tabpanel` linked back to its tab for assistive tech.
            const variantsHtml = PMS.map(
                (pm) =>
                    `<div class="code-window-content" role="tabpanel" id="${uid}-panel-${pm}" aria-labelledby="${uid}-tab-${pm}" data-pm-variant="${pm}"${pm === defaultPm ? '' : ' style="display:none"'}>${highlightFor(pm)}</div>`,
            ).join('\n        ');

            return `<div class="code-window code-window-pm" data-pm="${defaultPm}">
        <div class="code-window-header">
            <div class="code-window-header-left">
                <div class="code-window-dots">
                    <span class="code-window-dot dot-red"></span>
                    <span class="code-window-dot dot-yellow"></span>
                    <span class="code-window-dot dot-green"></span>
                </div>
                ${pmFilenameHtml}
            </div>
            <div class="code-window-tabs code-window-pm-tabs" role="tablist" aria-label="Package manager">
                ${tabButtonsHtml}
            </div>
        </div>
        ${variantsHtml}
    </div>`;
        }
    }

    // Add "Try Live" button for live code blocks
    const tryLiveButton = isLive
        ? `<button class="code-window-try-live" data-live-code="${escapeHtml(encodeBase64(code))}" data-lang="${effectiveLang}" data-filename="${escapeHtml(filename)}" title="Open in Live Playground">${triggerLabel}</button>`
        : '';

    const codeHtml = highlight(code, effectiveLang as BundledLanguage);

    const html = `<div class="code-window${isLive ? ' code-window-live' : ''}">
        <div class="code-window-header">
            <div class="code-window-header-left">
                <div class="code-window-dots">
                    <span class="code-window-dot dot-red"></span>
                    <span class="code-window-dot dot-yellow"></span>
                    <span class="code-window-dot dot-green"></span>
                </div>
                ${filenameHtml}
            </div>
            ${tryLiveButton}
        </div>
        <div class="code-window-content">
            ${codeHtml}
        </div>
    </div>`;

    return html;
}

/**
 * Encode string to base64 (works in both Node.js and browser)
 */
function encodeBase64(str: string): string {
    // Use Buffer in Node.js
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(str, 'utf-8').toString('base64');
    }
    // Fallback for browser (shouldn't be needed during SSG build)
    return btoa(unescape(encodeURIComponent(str)));
}

/**
 * Get a display label for a language
 */
function getLanguageLabel(lang: string): string {
    const labels: Record<string, string> = {
        'tsx': 'TSX',
        'jsx': 'JSX',
        'ts': 'TypeScript',
        'typescript': 'TypeScript',
        'js': 'JavaScript',
        'javascript': 'JavaScript',
        'css': 'CSS',
        'html': 'HTML',
        'json': 'JSON',
        'bash': 'Terminal',
        'shell': 'Terminal',
        'sh': 'Terminal',
        'zsh': 'Terminal',
        'md': 'Markdown',
        'markdown': 'Markdown',
        'python': 'Python',
        'py': 'Python',
        'rust': 'Rust',
        'go': 'Go',
        'text': '',
    };
    return labels[lang.toLowerCase()] ?? lang.toUpperCase();
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Create a rehype plugin for Shiki
 */
export function rehypeShiki(config?: ShikiConfig) {
    return async (tree: any) => {
        const { visit } = await import('unist-util-visit');
        const { fromHtml } = await import('hast-util-from-html');

        const skipLanguages = new Set((config?.skipLanguages ?? []).map((l) => l.toLowerCase()));

        const nodesToProcess: Array<{ node: any; parent: any; index: number }> = [];

        visit(tree, 'element', (node: any, index: number | undefined, parent: any) => {
            // Look for <pre><code> elements
            if (
                node.tagName === 'pre' &&
                node.children?.[0]?.tagName === 'code'
            ) {
                nodesToProcess.push({ node, parent, index: index ?? 0 });
            }
        });

        // Process nodes in parallel
        await Promise.all(
            nodesToProcess.map(async ({ node, parent, index }) => {
                const codeNode = node.children[0];

                // Extract language from class (e.g., "language-typescript")
                const className = codeNode.properties?.className?.[0] || '';
                const lang = className.replace(/^language-/, '') || 'text';

                // Escape hatch (#64): leave skipped languages as raw pre>code
                // for a downstream plugin/island (mermaid, math, …).
                if (skipLanguages.has(lang.toLowerCase())) return;

                // Extract filename from meta string if present
                // Supports: ```tsx filename="Counter.tsx" or ```tsx title="Counter.tsx"
                const metaString = codeNode.data?.meta || codeNode.properties?.metastring || '';
                const filename = extractMeta(metaString, 'filename') || extractMeta(metaString, 'title') || '';

                // Per-block override for the live trigger label: ```tsx live label="Run"
                const triggerLabel = extractMeta(metaString, 'label') || undefined;

                // Check for "live" flag in meta string (e.g., ```tsx live)
                const isLive = /\blive\b/i.test(metaString);
                
                // Parse tabs from meta string - order determines tab order
                // Supported keywords: preview, code, console
                // Example: ```tsx code preview console live -> tabs: [code, preview, console], with live button
                const tabKeywords = ['preview', 'code', 'console'] as const;
                const tabs: TabType[] = [];
                
                // Find all tab keywords and their positions
                const tabPositions: Array<{ tab: TabType; index: number }> = [];
                for (const keyword of tabKeywords) {
                    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
                    const match = metaString.match(regex);
                    if (match && match.index !== undefined) {
                        tabPositions.push({ tab: keyword, index: match.index });
                    }
                }
                
                // Sort by position (order of appearance in meta string)
                tabPositions.sort((a, b) => a.index - b.index);
                
                // Extract just the tab names in order
                for (const { tab } of tabPositions) {
                    tabs.push(tab);
                }

                // Get raw code content
                const code = getTextContent(codeNode);

                // Highlight with Shiki (with meta info)
                // Only pass tabs if at least one tab keyword was found
                const html = await highlightCode(code.trim(), lang, config, {
                    filename,
                    live: isLive,
                    tabs: tabs.length > 0 ? tabs : undefined,
                    triggerLabel,
                    metaRaw: metaString || undefined,
                });

                // Parse the HTML string into HAST nodes
                const fragment = fromHtml(html, { fragment: true });
                
                // Replace node with the parsed HAST fragment's children
                if (parent && typeof index === 'number' && fragment.children.length > 0) {
                    // Use the first element from the fragment (should be the code-window div)
                    parent.children[index] = fragment.children[0];
                }
            })
        );
    };
}

/**
 * Extract a meta value from a meta string
 * Supports: filename="value" or filename='value' or filename=value
 */
function extractMeta(metaString: string, key: string): string | null {
    if (!metaString) return null;

    // Match: key="value with spaces" or key='value' or key=value (single token).
    // Quoted forms preserve internal spaces (e.g. label="⚡ Run", filename="My File.tsx").
    // The leading (^|\s) anchors the key so it can't match a substring of another
    // token (e.g. `data-label="x"` must not be read as `label`). `key` is escaped
    // so any regex metacharacters in it are treated literally.
    const safeKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|\\s)${safeKey}=(?:"([^"]*)"|'([^']*)'|(\\S+))`, 'i');
    const match = metaString.match(regex);
    if (!match) return null;
    return match[1] ?? match[2] ?? match[3] ?? null;
}

/**
 * Extract text content from an AST node
 */
function getTextContent(node: any): string {
    if (node.type === 'text') {
        return node.value;
    }

    if (node.children) {
        return node.children.map(getTextContent).join('');
    }

    return '';
}

/**
 * Load additional language on demand
 */
export async function loadLanguage(lang: string): Promise<void> {
    const highlighter = await getHighlighter();
    const loadedLangs = highlighter.getLoadedLanguages();

    if (!loadedLangs.includes(lang as BundledLanguage)) {
        try {
            await highlighter.loadLanguage(lang as BundledLanguage);
        } catch {
            console.warn(`Shiki: Language "${lang}" not available, using plain text`);
        }
    }
}
