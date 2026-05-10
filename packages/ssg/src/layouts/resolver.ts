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
        // Import theme package from the project's context
        // Use createRequire to resolve from the project root
        const { createRequire } = await import('node:module');
        const { pathToFileURL } = await import('node:url');
        const require = createRequire(path.join(root, 'package.json'));
        
        // Resolve the theme package directory from the project
        // Use require.resolve with the package.json to get the package directory
        const themePackageJson = require.resolve(`${themeName}/package.json`);
        const themeDir = path.dirname(themePackageJson);
        
        // Read the package.json to find the main export
        const packageJson = JSON.parse(fs.readFileSync(themePackageJson, 'utf-8'));
        const mainFile = packageJson.exports?.['.']?.import || packageJson.main || './dist/index.js';
        const themePath = path.resolve(themeDir, mainFile);
        
        const themeModule = (await import(pathToFileURL(themePath).href)) as ThemeModule;

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
        console.warn(`Failed to load theme ${themeName}:`, err);
        return [];
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
