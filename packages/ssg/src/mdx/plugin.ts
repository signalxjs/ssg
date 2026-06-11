/**
 * MDX Vite plugin
 *
 * Transforms MDX files into SignalX components with:
 * - Frontmatter extraction
 * - Shiki syntax highlighting
 * - SignalX JSX runtime integration
 */

import type { Plugin, ResolvedConfig } from 'vite';
import type { SSGConfig, MarkdownConfig, PageMeta, TocHeading } from '../types';
import { parseFrontmatter, extractTitleFromContent } from './frontmatter';
import { rehypeShiki } from './shiki';
import { rehypeExtractHeadings } from './rehype-headings';

/**
 * MDX plugin options
 */
export interface MDXPluginOptions {
    /**
     * Markdown configuration
     */
    markdown?: MarkdownConfig;

    /**
     * SSG configuration (for layout resolution)
     */
    ssgConfig?: SSGConfig;
}

/**
 * Create the MDX Vite plugin
 *
 * `options` is read lazily (on first transform, after every plugin's
 * configResolved has run), so ssgPlugin can fill in the SSG config loaded
 * from ssg.config.ts after construction — see #47. Do not destructure
 * `options` at construction time.
 */
export function mdxPlugin(options: MDXPluginOptions = {}): Plugin {
    let mdxRollupPromise: Promise<any> | null = null;
    let viteConfig: ResolvedConfig;

    return {
        name: 'sigx-ssg-mdx',
        enforce: 'pre',

        configResolved(config) {
            viteConfig = config;
        },

        async transform(code, id) {
            // Only process MDX and MD files
            if (!/\.mdx?$/.test(id)) {
                return null;
            }

            // Parse frontmatter first
            const { data: frontmatter, content } = parseFrontmatter(code);

            // Extract title from content if not in frontmatter
            if (!frontmatter.title) {
                const extractedTitle = extractTitleFromContent(content);
                if (extractedTitle) {
                    frontmatter.title = extractedTitle;
                }
            }

            // Build the MDX pipeline on first use (memoized)
            if (!mdxRollupPromise) {
                mdxRollupPromise = createMdxRollup(options);
            }
            const mdxRollup = await mdxRollupPromise;

            const result = await mdxRollup.transform(code, id);

            if (!result) {
                return null;
            }

            // Extract headings from the file data (set by rehype-extract-headings)
            // Note: We need to process the content to get headings
            const headings = await extractHeadingsFromContent(content, options);

            // Create module ID for HMR tracking (normalize path separators)
            const moduleId = id.replace(/\\/g, '/');

            // Inject frontmatter export and wrap in SignalX component
            const transformedCode = wrapMDXComponent(
                result.code,
                frontmatter,
                headings,
                moduleId,
                viteConfig.command === 'serve'
            );

            return {
                code: transformedCode,
                map: result.map,
            };
        },
    };
}

/**
 * Build the @mdx-js/rollup instance with the remark/rehype chain derived from
 * the (by now fully resolved) plugin options.
 */
async function createMdxRollup(options: MDXPluginOptions): Promise<any> {
    const markdown = options.markdown ?? {};

    // Dynamically import @mdx-js/rollup
    const mdxModule = await import('@mdx-js/rollup');
    const remarkFrontmatter = (await import('remark-frontmatter')).default;
    const remarkMdxFrontmatter = (await import('remark-mdx-frontmatter')).default;
    const remarkGfm = (await import('remark-gfm')).default;
    const rehypeSlug = (await import('rehype-slug')).default;
    const rehypeAutolinkHeadings = (await import('rehype-autolink-headings')).default;

    // Get TOC config from SSG config
    const tocConfig = options.ssgConfig?.toc || { minLevel: 2, maxLevel: 3 };

    // Build rehype plugins array
    const rehypePlugins: any[] = [];

    // Add rehype-slug first to generate heading IDs
    rehypePlugins.push(rehypeSlug);

    // Add autolink headings (clickable anchor links)
    rehypePlugins.push([rehypeAutolinkHeadings, {
        behavior: 'append',
        properties: {
            class: 'heading-anchor',
            ariaHidden: true,
            tabIndex: -1,
        },
        content: {
            type: 'element',
            tagName: 'span',
            properties: { class: 'heading-anchor-icon' },
            children: [{ type: 'text', value: '#' }],
        },
    }]);

    // Add heading extraction for TOC
    rehypePlugins.push([rehypeExtractHeadings, tocConfig]);

    // Add Shiki if enabled
    if (markdown.shiki !== false) {
        const shikiConfig = typeof markdown.shiki === 'object' ? markdown.shiki : undefined;
        rehypePlugins.push([rehypeShiki, shikiConfig]);
    }

    // Add custom rehype plugins
    if (markdown.rehypePlugins) {
        rehypePlugins.push(...markdown.rehypePlugins);
    }

    // Build remark plugins array
    const remarkPlugins: any[] = [
        remarkFrontmatter,
        [remarkMdxFrontmatter, { name: 'frontmatter' }],
        remarkGfm,
    ];

    // Add custom remark plugins
    if (markdown.remarkPlugins) {
        remarkPlugins.push(...markdown.remarkPlugins);
    }

    // Create MDX plugin
    // Use jsx: false to output function calls instead of JSX syntax
    // This avoids needing esbuild to process .mdx files as JSX
    return mdxModule.default({
        jsx: false,
        jsxImportSource: 'sigx',
        remarkPlugins,
        rehypePlugins,
        providerImportSource: undefined,
    });
}

/**
 * Wrap MDX output in a SignalX component
 *
 * Note: remark-mdx-frontmatter already exports `frontmatter`, so we only add the layout export
 * 
 * In dev mode, we:
 * 1. Wrap MDXContent in a sigx component() for proper HMR tracking
 * 2. Inject HMR registration code so the component updates live
 */
function wrapMDXComponent(
    code: string,
    frontmatter: PageMeta,
    headings: TocHeading[],
    moduleId: string,
    isDev: boolean
): string {
    // The MDX output already includes frontmatter export from remark-mdx-frontmatter
    // We need to add the layout export for the SSG routing system
    
    // In dev mode, wrap in sigx component for HMR support
    if (isDev) {
        // Generate a component name from the file path for debugging
        const fileName = moduleId.split('/').pop()?.replace(/\.mdx?$/, '') || 'MDXPage';
        const componentName = fileName.charAt(0).toUpperCase() + fileName.slice(1).replace(/[^a-zA-Z0-9]/g, '') + 'Page';
        
        // The MDX output has "export default function MDXContent(...)" 
        // We need to:
        // 1. Remove the "export default" from MDXContent to avoid duplicate exports
        // 2. Wrap it in a sigx component for HMR
        // 3. Export the wrapped component as default
        const modifiedCode = code
            .replace(/export\s+default\s+function\s+MDXContent/g, 'function _MDXContent')
            .replace(/export\s+{\s*MDXContent\s+as\s+default\s*}/g, '');
        
        return `
import { registerHMRModule } from '@sigx/vite/hmr';
import { component as __component } from 'sigx';
registerHMRModule('${moduleId}');

${modifiedCode}

// Export layout from frontmatter for SSG routing
export const layout = ${frontmatter.layout ? JSON.stringify(frontmatter.layout) : 'undefined'};

// Export headings for table of contents
export const headings = ${JSON.stringify(headings)};

// Wrap MDXContent in a sigx component for HMR support
const MDXPage = __component(() => {
    return () => _MDXContent({});
}, { name: '${componentName}' });

export default MDXPage;

if (import.meta.hot) {
    // Accept HMR updates with a callback to trigger re-render after module is updated
    import.meta.hot.accept((newModule) => {
        if (newModule) {
            // Notify LayoutRouter to clear its cache and re-render with new module
            window.dispatchEvent(new CustomEvent('sigx:mdx-hmr', { 
                detail: { moduleId: '${moduleId}', newModule } 
            }));
        }
    });
}
`;
    }
    
    // Production: just add exports without HMR wrapper
    return `
${code}

// Export layout from frontmatter for SSG routing
export const layout = ${frontmatter.layout ? JSON.stringify(frontmatter.layout) : 'undefined'};

// Export headings for table of contents
export const headings = ${JSON.stringify(headings)};
`;
}

/**
 * Extract headings from markdown/MDX content
 */
async function extractHeadingsFromContent(
    content: string,
    options: MDXPluginOptions
): Promise<TocHeading[]> {
    const { unified } = await import('unified');
    const remarkParse = (await import('remark-parse')).default;
    const remarkRehype = (await import('remark-rehype')).default;
    const rehypeSlug = (await import('rehype-slug')).default;
    const rehypeStringify = (await import('rehype-stringify')).default;

    // Get TOC config
    const tocConfig = options.ssgConfig?.toc || { minLevel: 2, maxLevel: 3 };

    // Process markdown to extract headings
    // Note: rehype-stringify is required for unified to have a compiler
    const processor = unified()
        .use(remarkParse)
        .use(remarkRehype)
        .use(rehypeSlug)
        .use(rehypeExtractHeadings, tocConfig)
        .use(rehypeStringify);

    const file = await processor.process(content);
    return (file.data as any).headings || [];
}

/**
 * Create a simple markdown-only plugin (no MDX features)
 */
export function markdownPlugin(options: MDXPluginOptions = {}): Plugin {
    return {
        name: 'sigx-ssg-markdown',
        enforce: 'pre',

        async transform(code, id) {
            // Only process .md files (not .mdx)
            if (!/\.md$/.test(id) || /\.mdx$/.test(id)) {
                return null;
            }

            // Parse frontmatter
            const { data: frontmatter, content } = parseFrontmatter(code);

            // Extract title if not in frontmatter
            if (!frontmatter.title) {
                const extractedTitle = extractTitleFromContent(content);
                if (extractedTitle) {
                    frontmatter.title = extractedTitle;
                }
            }

            // Convert markdown to simple HTML using a lightweight parser
            // For full MD support, the MDX plugin should be used
            const html = await simpleMarkdownToHtml(content, options);
            
            // Extract headings for TOC
            const headings = await extractHeadingsFromContent(content, options);
            
            const frontmatterJSON = JSON.stringify(frontmatter);
            const headingsJSON = JSON.stringify(headings);

            return {
                code: `
import { jsx as _jsx } from 'sigx/jsx-runtime';

export const frontmatter = ${frontmatterJSON};
export const layout = ${frontmatter.layout ? JSON.stringify(frontmatter.layout) : 'undefined'};
export const headings = ${headingsJSON};

export default function MDContent(props) {
    return _jsx('div', {
        class: 'markdown-content',
        dangerouslySetInnerHTML: { __html: ${JSON.stringify(html)} }
    });
}
`,
                map: null,
            };
        },
    };
}

/**
 * Simple markdown to HTML conversion
 * For basic markdown without custom components
 */
async function simpleMarkdownToHtml(markdown: string, options: MDXPluginOptions = {}): Promise<string> {
    // Use unified for basic markdown processing
    const { unified } = await import('unified');
    const remarkParse = (await import('remark-parse')).default;
    const remarkRehype = (await import('remark-rehype')).default;
    const rehypeSlug = (await import('rehype-slug')).default;
    const rehypeStringify = (await import('rehype-stringify')).default;

    const result = await unified()
        .use(remarkParse)
        .use(remarkRehype)
        .use(rehypeSlug)  // Add IDs to headings
        .use(rehypeStringify)
        .process(markdown);

    return String(result);
}
