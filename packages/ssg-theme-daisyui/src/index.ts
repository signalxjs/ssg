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
import CommandPalette from './components/CommandPalette.js';
import PrevNext from './components/PrevNext.js';
import { AnnouncementBar, Breadcrumbs, PageFooter } from './components/PageChrome.js';
import { themeInitScript } from './lib/theme-init.js';

// Re-export component types
export type { HeaderProps } from './components/Header.js';
export type { SidebarProps } from './components/Sidebar.js';
export type { TOCProps } from './components/TOC.js';
export type { CommandPaletteProps } from './components/CommandPalette.js';

/**
 * Theme configuration
 * 
 * Note: With DaisyUI v5 and Tailwind v4, CSS is handled via @plugin directive
 * in the user's CSS file, not through theme exports.
 */
export const config: ThemeConfig = {
    defaultLayout: 'default',
    // No-FOUC: apply the persisted/OS light-dark theme before first paint —
    // the Header toggle reads and writes the same storage key (#65).
    head: [
        {
            tag: 'script',
            children: themeInitScript(),
        },
    ],
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
    CommandPalette,
    PrevNext,
    AnnouncementBar,
    Breadcrumbs,
    PageFooter,
};

/**
 * Full theme export
 */
export default {
    layouts,
    components,
    config,
};
