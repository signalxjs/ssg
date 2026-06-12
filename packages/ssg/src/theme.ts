/**
 * Theme module loading + config contribution (signalxjs/ssg#60).
 *
 * A theme package can contribute more than layouts: markdown plugins, head
 * tags, CSS imports, and a default layout — declared on its exported
 * `config` (see ThemeConfig). `applyThemeConfig` folds those into the site
 * config with the site always winning:
 *
 * - markdown remark/rehype plugins: theme's run first, the site's after
 * - head tags: theme's are prepended (site tags and per-page meta override
 *   via the dedup in head.ts)
 * - css: prepended to `clientImports` (entries are import specifiers, e.g.
 *   '@my/theme/styles.css'), so site CSS can override theme CSS
 * - defaultLayout: used only when the site doesn't set its own
 */

import path from 'node:path';
import fs from 'node:fs';
import type { SSGConfig, ThemeModule } from './types';

/**
 * Load a theme package's module from the project's context. Throws when the
 * configured theme can't be resolved (a silently missing theme built broken
 * sites, #52).
 */
export async function loadThemeModule(themeName: string, root: string): Promise<ThemeModule> {
    const { createRequire } = await import('node:module');
    const { pathToFileURL } = await import('node:url');
    const require = createRequire(path.join(root, 'package.json'));

    const themePackageJson = require.resolve(`${themeName}/package.json`);
    const themeDir = path.dirname(themePackageJson);

    const packageJson = JSON.parse(fs.readFileSync(themePackageJson, 'utf-8'));
    // `exports` may be a string, a conditions object, or a subpath map whose
    // '.' entry is itself a string or conditions object.
    const exportsField = packageJson.exports;
    const dot = typeof exportsField === 'string' ? exportsField : exportsField?.['.'];
    const importCondition = typeof dot === 'string' ? dot : dot?.import;
    const mainFile =
        (typeof importCondition === 'string' ? importCondition : importCondition?.default) ||
        (typeof dot === 'string' ? dot : dot?.default) ||
        packageJson.main ||
        './dist/index.js';
    const themePath = path.resolve(themeDir, mainFile);

    return (await import(pathToFileURL(themePath).href)) as ThemeModule;
}

/**
 * Fold a theme's config contributions into the resolved SSG config.
 * Pure — returns a new config; the input is not mutated.
 */
export function applyThemeConfig(config: SSGConfig, theme: ThemeModule): SSGConfig {
    const contribution = theme.config;
    if (!contribution) return config;

    const merged: SSGConfig = { ...config };

    if (contribution.css?.length) {
        merged.clientImports = [...contribution.css, ...(config.clientImports ?? [])];
    }

    if (contribution.markdown?.remarkPlugins?.length || contribution.markdown?.rehypePlugins?.length) {
        merged.markdown = {
            ...config.markdown,
            remarkPlugins: [
                ...(contribution.markdown.remarkPlugins ?? []),
                ...(config.markdown?.remarkPlugins ?? []),
            ],
            rehypePlugins: [
                ...(contribution.markdown.rehypePlugins ?? []),
                ...(config.markdown?.rehypePlugins ?? []),
            ],
        };
    }

    if (contribution.head?.length) {
        merged.site = {
            ...config.site,
            head: [...contribution.head, ...(config.site?.head ?? [])],
        };
    }

    // Build hooks: the theme's run first, then the site's — transformHtml
    // chains its output through both (#60).
    if (contribution.hooks) {
        const themeHooks = contribution.hooks;
        const siteHooks = config.hooks;
        merged.hooks = {
            transformHtml: composeTransformHtml(themeHooks.transformHtml, siteHooks?.transformHtml),
            onPageRendered: composeSequential(themeHooks.onPageRendered, siteHooks?.onPageRendered),
            postBuild: composeSequential(themeHooks.postBuild, siteHooks?.postBuild),
        };
    }

    // 'default' is the defineSSGConfig default value, i.e. "not explicitly
    // set" — only an explicit site choice beats the theme's default layout.
    if (contribution.defaultLayout && (!config.defaultLayout || config.defaultLayout === 'default')) {
        merged.defaultLayout = contribution.defaultLayout;
    }

    return merged;
}

function composeTransformHtml<P>(
    first?: (html: string, page: P) => string | Promise<string>,
    second?: (html: string, page: P) => string | Promise<string>
): ((html: string, page: P) => Promise<string>) | undefined {
    if (!first && !second) return undefined;
    return async (html, page) => {
        let out = html;
        if (first) out = await first(out, page);
        if (second) out = await second(out, page);
        return out;
    };
}

function composeSequential<A extends unknown[]>(
    first?: (...args: A) => unknown,
    second?: (...args: A) => unknown
): ((...args: A) => Promise<void>) | undefined {
    if (!first && !second) return undefined;
    return async (...args) => {
        if (first) await first(...args);
        if (second) await second(...args);
    };
}

/**
 * Load the configured theme (if any) and fold its contributions in.
 * Resolves to the input config unchanged when no theme is configured.
 */
export async function resolveThemeConfig(config: SSGConfig, root: string): Promise<SSGConfig> {
    if (!config.theme) return config;
    const themeModule = await loadThemeModule(config.theme, root);
    return applyThemeConfig(config, themeModule);
}
