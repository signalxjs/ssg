/**
 * Layout resolver
 *
 * Resolves layouts from local layouts directory or theme packages.
 * Layouts wrap page content and provide consistent structure.
 */

import fg from 'fast-glob';
import path from 'node:path';
import fs from 'node:fs';
import type { SSGConfig, LayoutModule, ThemeModule } from '../types';

/**
 * Discovered layout information
 */
export interface LayoutInfo {
    /**
     * Layout name (e.g., 'default', 'docs', 'blog')
     */
    name: string;

    /**
     * Absolute file path to the layout component
     */
    file: string;

    /**
     * Source: 'local' or theme package name
     */
    source: string;
}

/**
 * Layout extensions to search for
 */
const LAYOUT_EXTENSIONS = ['.tsx', '.jsx'];

/**
 * Scan local layouts directory
 */
export async function scanLocalLayouts(config: SSGConfig, root: string): Promise<LayoutInfo[]> {
    const layoutsDir = path.resolve(root, config.layouts || 'src/layouts');

    if (!fs.existsSync(layoutsDir)) {
        return [];
    }

    const patterns = LAYOUT_EXTENSIONS.map((ext) => `*${ext}`);
    const files = await fg(patterns, {
        cwd: layoutsDir,
        onlyFiles: true,
        absolute: false,
    });

    return files.map((file) => {
        const ext = path.extname(file);
        const name = file.slice(0, -ext.length);

        return {
            name,
            file: path.join(layoutsDir, file),
            source: 'local',
        };
    });
}

/**
 * Load layouts from a theme package
 */
export async function loadThemeLayouts(themeName: string, root: string): Promise<LayoutInfo[]> {
    try {
        const { loadThemeModule } = await import('../theme');
        const themeModule = await loadThemeModule(themeName, root);

        if (!themeModule.layouts) {
            return [];
        }

        // Theme layouts are already loaded as components
        // We need to create virtual files for them
        return Object.keys(themeModule.layouts).map((name) => ({
            name,
            file: `${themeName}/layouts/${name}`,
            source: themeName,
        }));
    } catch (err) {
        // An explicitly configured theme that can't be loaded must fail
        // loudly — a silent warn built the site without any theme layouts (#52).
        const { SSGError, ErrorCodes } = await import('../errors');
        throw new SSGError(`Theme package "${themeName}" could not be loaded`, {
            code: ErrorCodes.CONFIG_THEME_NOT_FOUND,
            suggestion:
                `Install the theme package (npm install ${themeName}) or remove ` +
                `the \`theme\` field from your ssg.config.`,
            cause: err instanceof Error ? err : new Error(String(err)),
        });
    }
}

/**
 * Discover all available layouts
 *
 * Priority order:
 * 1. Local layouts (can override theme)
 * 2. Theme layouts
 */
export async function discoverLayouts(config: SSGConfig, root: string): Promise<LayoutInfo[]> {
    const layouts: Map<string, LayoutInfo> = new Map();

    // Load theme layouts first (can be overridden)
    if (config.theme) {
        const themeLayouts = await loadThemeLayouts(config.theme, root);
        for (const layout of themeLayouts) {
            layouts.set(layout.name, layout);
        }
    }

    // Load local layouts (override theme)
    const localLayouts = await scanLocalLayouts(config, root);
    for (const layout of localLayouts) {
        layouts.set(layout.name, layout);
    }

    return Array.from(layouts.values());
}

/**
 * Get the default layout
 */
export function getDefaultLayout(layouts: LayoutInfo[], config: SSGConfig): LayoutInfo | null {
    const defaultName = config.defaultLayout || 'default';
    return layouts.find((l) => l.name === defaultName) || layouts[0] || null;
}

/**
 * Find a layout by name
 */
export function findLayout(layouts: LayoutInfo[], name: string): LayoutInfo | null {
    return layouts.find((l) => l.name === name) || null;
}
