/**
 * MDX module exports
 */

export { parseFrontmatter, extractTitleFromContent, serializeFrontmatter } from './frontmatter';
export type { FrontmatterResult } from './frontmatter';

export { getHighlighter, highlightCode, rehypeShiki, loadLanguage } from './shiki';

export { mdxPlugin, markdownPlugin } from './plugin';
export type { MDXPluginOptions } from './plugin';
