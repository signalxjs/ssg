/**
 * @sigx/ssg-theme-daisyui
 *
 * DaisyUI theme for SignalX SSG with pre-built layouts and components.
 */

import type { ThemeConfig } from '@sigx/ssg';

// Layouts
import DefaultLayout from './layouts/default.js';
import DocsLayout from './layouts/docs.js';
import BlogLayout from './layouts/blog.js';

// Components
import Header from './components/Header.js';
import Footer from './components/Footer.js';
import Sidebar from './components/Sidebar.js';
import TOC from './components/TOC.js';

// Re-export component types
export type { HeaderProps } from './components/Header.js';
export type { SidebarProps } from './components/Sidebar.js';
export type { TOCProps } from './components/TOC.js';

/**
 * Theme configuration
 * 
 * Note: With DaisyUI v5 and Tailwind v4, CSS is handled via @plugin directive
 * in the user's CSS file, not through theme exports.
 */
export const config: ThemeConfig = {
    defaultLayout: 'default',
};

/**
 * Available layouts
 */
export const layouts = {
    default: DefaultLayout,
    docs: DocsLayout,
    blog: BlogLayout,
};

/**
 * Available components
 */
export const components = {
    Header,
    Footer,
    Sidebar,
    TOC,
};

/**
 * Full theme export
 */
export default {
    layouts,
    components,
    config,
};
