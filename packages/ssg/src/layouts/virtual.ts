/**
 * Virtual module generator for layouts
 *
 * Generates the virtual:generated-layouts module that provides
 * layout components and the setupLayouts function.
 * 
 * IMPORTANT: Layouts are designed to persist across navigation.
 * Instead of wrapping each route with a layout component (which causes
 * full re-renders on navigation), we use a shared LayoutRouter component
 * that maintains the layout and only updates the page content reactively.
 */

import type { SSGConfig, SSGRoute } from '../types';
import type { LayoutInfo } from './resolver';
import { discoverLayouts } from './resolver';

// Note: The generated virtual module imports component from sigx

/**
 * Virtual module ID for generated layouts
 */
export const VIRTUAL_LAYOUTS_ID = 'virtual:generated-layouts';
export const RESOLVED_VIRTUAL_LAYOUTS_ID = '\0virtual:generated-layouts';

/**
 * Normalize file path to use forward slashes (for ES module imports)
 */
function normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/');
}

/**
 * Generate the virtual layouts module code
 */
export function generateLayoutsModule(layouts: LayoutInfo[], config: SSGConfig): string {
    const imports: string[] = [];
    const layoutEntries: string[] = [];

    for (let i = 0; i < layouts.length; i++) {
        const layout = layouts[i];
        const importName = `Layout${i}`;

        // Handle theme vs local layouts differently
        if (layout.source === 'local') {
            const normalizedFile = normalizePath(layout.file);
            imports.push(`import ${importName} from '${normalizedFile}';`);
        } else {
            // Theme layout - import from theme package
            imports.push(`import { layouts as themeLayouts${i} } from '${layout.source}';`);
            imports.push(`const ${importName} = themeLayouts${i}['${layout.name}'];`);
        }

        layoutEntries.push(`    '${layout.name}': ${importName}.default || ${importName}`);
    }

    return `
import { component, signal, jsx } from 'sigx';
import { useRoute } from '@sigx/router';
${imports.join('\n')}

/**
 * All available layouts
 */
export const layouts = {
${layoutEntries.join(',\n')}
};

/**
 * Default layout name
 */
export const defaultLayout = '${config.defaultLayout || 'default'}';

/**
 * Check if a component is marked as lazy (created by lazy())
 */
function isMarkedLazy(component) {
    return component && component.__lazy === true;
}

/**
 * Check if a value is a Promise/thenable
 */
function isPromise(value) {
    return value && typeof value.then === 'function';
}

/**
 * Track hydration state - we're hydrating if the app container has SSR content
 */
let isHydrating = typeof window !== 'undefined' && 
    document.getElementById('app')?.innerHTML?.trim().length > 0;

// After first render, we're no longer hydrating
if (typeof window !== 'undefined') {
    const markHydrationComplete = () => { isHydrating = false; };
    if ('requestIdleCallback' in window) {
        window.requestIdleCallback(markHydrationComplete);
    } else {
        setTimeout(markHydrationComplete, 0);
    }
}

/**
 * Placeholder component that preserves existing DOM during hydration.
 */
const HydrationPlaceholder = component(() => {
    return () => null;
}, { name: 'HydrationPlaceholder' });

/**
 * Layout router component that preserves layouts across navigation.
 * 
 * This component renders the current route's layout and page content reactively.
 * When navigating between routes with the same layout, only the page content
 * updates - the layout (Navbar, Sidebar, Footer) persists without re-rendering.
 */
export const LayoutRouter = component((ctx) => {
    const route = useRoute();
    
    // Track loaded lazy components to avoid reloading
    const loadedComponents = {};
    
    // Track if this is the initial hydration render
    let initialRender = true;
    
    // HMR support: Listen for MDX updates and clear the component cache
    if (typeof window !== 'undefined' && import.meta.hot) {
        // Listen for sigx:mdx-hmr events dispatched by MDX files after they accept HMR
        const handleMdxHmr = (event) => {
            const { moduleId, newModule } = event.detail || {};
            
            // Clear all cached components to force reload with new module
            for (const key in loadedComponents) {
                delete loadedComponents[key];
            }
            
            // If we have the new module directly from HMR, cache it for the matching route
            if (newModule?.default) {
                const currentPath = route.path;
                loadedComponents[currentPath] = newModule.default;
            }
            
            // Force re-render
            ctx.update();
        };
        
        window.addEventListener('sigx:mdx-hmr', handleMdxHmr);
        
        ctx.onUnmounted(() => {
            window.removeEventListener('sigx:mdx-hmr', handleMdxHmr);
        });
    }
    
    return () => {
        const matched = route.matched;
        if (!matched || matched.length === 0) return null;
        
        const match = matched[0];
        if (!match) return null;
        
        // Get layout name from route meta or use default
        const layoutName = match.layout || match.meta?.layout || defaultLayout;
        const Layout = layouts[layoutName];
        
        if (!Layout) {
            console.warn(\`Layout "\${layoutName}" not found for route \${route.path}\`);
            return null;
        }
        
        // Get the original (unwrapped) component
        const rawComponent = match.originalComponent || match.component;
        const routePath = route.path;
        
        // Handle lazy/dynamic import components
        if (isMarkedLazy(rawComponent) || (typeof rawComponent === 'function' && !rawComponent.__setup)) {
            // Check if already loaded
            if (loadedComponents[routePath]) {
                const PageComponent = loadedComponents[routePath];
                initialRender = false;
                return jsx(Layout, { 
                    meta: match.meta, 
                    path: routePath, 
                    key: layoutName,  // Key by layout to preserve layout across pages
                    children: PageComponent({}) 
                });
            }
            
            // Load the component
            const loadState = signal({ value: null, loading: true, error: null });
            
            try {
                const result = rawComponent();
                if (isPromise(result)) {
                    result.then(module => {
                        const Component = module.default || module;
                        loadedComponents[routePath] = Component;
                        loadState.value = Component;
                        loadState.loading = false;
                    }).catch(err => {
                        console.error('Failed to load component for route:', routePath, err);
                        loadState.error = err;
                        loadState.loading = false;
                    });
                } else {
                    // Not a promise, use directly
                    loadedComponents[routePath] = rawComponent;
                    loadState.value = rawComponent;
                    loadState.loading = false;
                }
            } catch (err) {
                loadState.error = err;
                loadState.loading = false;
            }
            
            // During hydration, preserve existing SSR content instead of showing loading state
            if (loadState.loading) {
                if (isHydrating && initialRender) {
                    return jsx(Layout, { 
                        meta: match.meta, 
                        path: routePath, 
                        key: layoutName,
                        children: jsx(HydrationPlaceholder, {})
                    });
                }
                return jsx(Layout, { 
                    meta: match.meta, 
                    path: routePath, 
                    key: layoutName,
                    children: null 
                });
            }
            
            if (loadState.error || !loadState.value) {
                return jsx(Layout, { 
                    meta: match.meta, 
                    path: routePath, 
                    key: layoutName,
                    children: null 
                });
            }
            
            const PageComponent = loadState.value;
            initialRender = false;
            return jsx(Layout, { 
                meta: match.meta, 
                path: routePath, 
                key: layoutName,
                children: PageComponent({}) 
            });
        }
        
        // Eager component (has __setup)
        // Check cache first for HMR-updated components
        if (loadedComponents[routePath]) {
            const PageComponent = loadedComponents[routePath];
            initialRender = false;
            return jsx(Layout, { 
                meta: match.meta, 
                path: routePath, 
                key: layoutName,
                children: PageComponent({}) 
            });
        }
        
        initialRender = false;
        return jsx(Layout, { 
            meta: match.meta, 
            path: routePath, 
            key: layoutName,
            children: rawComponent({}) 
        });
    };
}, { name: 'LayoutRouter' });

/**
 * Setup layouts for routes
 *
 * This function now simply annotates routes with their layout information.
 * The actual layout wrapping is handled by LayoutRouter, which preserves
 * layouts across navigation.
 */
export function setupLayouts(routes) {
    const availableLayoutNames = Object.keys(layouts);
    
    return routes.map(route => {
        const layoutName = route.layout || route.meta?.layout || defaultLayout;
        const Layout = layouts[layoutName];

        if (!Layout) {
            console.error(
                \`❌ SSG103: Layout "\${layoutName}" not found for route \${route.path}\\n\` +
                \`   📁 \${route.file || 'unknown'}\\n\` +
                \`   💡 Available layouts: \${availableLayoutNames.join(', ') || 'none'}\\n\` +
                \`      Create src/layouts/\${layoutName}.tsx or set a valid layout in frontmatter.\`
            );
            return route;
        }

        // Store layout info on the route, but don't wrap the component
        // LayoutRouter will handle layout rendering
        return {
            ...route,
            layout: layoutName,
            originalComponent: route.component,
            meta: {
                ...route.meta,
                layout: layoutName,
            },
        };
    });
}

export default layouts;
`;
}

/**
 * Generate a simpler layouts module for theme-only setups
 */
export function generateThemeLayoutsModule(themeName: string, config: SSGConfig): string {
    return `
import { component, signal, jsx } from 'sigx';
import { useRoute } from '@sigx/router';
import { layouts as themeLayouts, config as themeConfig } from '${themeName}';

export const layouts = themeLayouts || {};
export const defaultLayout = '${config.defaultLayout}' || themeConfig?.defaultLayout || 'default';

/**
 * Check if a component is marked as lazy (created by lazy())
 */
function isMarkedLazy(component) {
    return component && component.__lazy === true;
}

/**
 * Check if a value is a Promise/thenable
 */
function isPromise(value) {
    return value && typeof value.then === 'function';
}

/**
 * Layout router component that preserves layouts across navigation.
 */
export const LayoutRouter = component((ctx) => {
    const route = useRoute();
    const loadedComponents = {};
    
    // HMR support: Listen for MDX updates and clear the component cache
    if (typeof window !== 'undefined' && import.meta.hot) {
        const handleMdxHmr = (event) => {
            for (const key in loadedComponents) {
                delete loadedComponents[key];
            }
            ctx.update();
        };
        
        window.addEventListener('sigx:mdx-hmr', handleMdxHmr);
        
        import.meta.hot.on('vite:beforeUpdate', (payload) => {
            const hasMdxUpdate = payload.updates?.some(update => 
                update.path?.endsWith('.mdx') || update.path?.endsWith('.md')
            );
            if (hasMdxUpdate) {
                for (const key in loadedComponents) {
                    delete loadedComponents[key];
                }
            }
        });
        
        ctx.onUnmounted(() => {
            window.removeEventListener('sigx:mdx-hmr', handleMdxHmr);
        });
    }
    
    return () => {
        const matched = route.matched;
        if (!matched || matched.length === 0) return null;
        
        const match = matched[0];
        if (!match) return null;
        
        const layoutName = match.layout || match.meta?.layout || defaultLayout;
        const Layout = layouts[layoutName];
        
        if (!Layout) {
            console.warn(\`Layout "\${layoutName}" not found for route \${route.path}\`);
            return null;
        }
        
        const rawComponent = match.originalComponent || match.component;
        const routePath = route.path;
        
        // Handle lazy/dynamic import components
        if (isMarkedLazy(rawComponent) || (typeof rawComponent === 'function' && !rawComponent.__setup)) {
            if (loadedComponents[routePath]) {
                const PageComponent = loadedComponents[routePath];
                return jsx(Layout, { 
                    meta: match.meta, 
                    path: routePath, 
                    key: layoutName,
                    children: PageComponent({}) 
                });
            }
            
            const loadState = signal({ value: null, loading: true, error: null });
            
            try {
                const result = rawComponent();
                if (isPromise(result)) {
                    result.then(module => {
                        const Component = module.default || module;
                        loadedComponents[routePath] = Component;
                        loadState.value = Component;
                        loadState.loading = false;
                    }).catch(err => {
                        console.error('Failed to load component:', routePath, err);
                        loadState.error = err;
                        loadState.loading = false;
                    });
                } else {
                    loadedComponents[routePath] = rawComponent;
                    loadState.value = rawComponent;
                    loadState.loading = false;
                }
            } catch (err) {
                loadState.error = err;
                loadState.loading = false;
            }
            
            if (loadState.loading) {
                return jsx(Layout, { meta: match.meta, path: routePath, key: layoutName, children: null });
            }
            if (loadState.error || !loadState.value) {
                return jsx(Layout, { meta: match.meta, path: routePath, key: layoutName, children: null });
            }
            
            return jsx(Layout, { 
                meta: match.meta, 
                path: routePath, 
                key: layoutName,
                children: loadState.value({}) 
            });
        }
        
        return jsx(Layout, { 
            meta: match.meta, 
            path: routePath, 
            key: layoutName,
            children: rawComponent({}) 
        });
    };
}, { name: 'LayoutRouter' });

export function setupLayouts(routes) {
    return routes.map(route => {
        const layoutName = route.layout || route.meta?.layout || defaultLayout;
        const Layout = layouts[layoutName];

        if (!Layout) {
            console.warn(\`Layout "\${layoutName}" not found for route \${route.path}\`);
            return route;
        }

        return {
            ...route,
            layout: layoutName,
            originalComponent: route.component,
            meta: {
                ...route.meta,
                layout: layoutName,
            },
        };
    });
}

export default layouts;
`;
}

/**
 * Load and generate the layouts module
 */
export async function loadLayoutsModule(
    config: SSGConfig,
    root: string
): Promise<{ layouts: LayoutInfo[]; code: string }> {
    const layouts = await discoverLayouts(config, root);
    const code = generateLayoutsModule(layouts, config);

    return { layouts, code };
}
