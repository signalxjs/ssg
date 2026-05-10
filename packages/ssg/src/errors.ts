/**
 * SSG Error Classes and Utilities
 *
 * Provides structured error messages with file locations and suggestions
 * for common issues encountered during development and build.
 */

import path from 'node:path';

/**
 * Base SSG error with enhanced formatting
 */
export class SSGError extends Error {
    readonly code: string;
    readonly file?: string;
    readonly line?: number;
    readonly suggestion?: string;

    constructor(
        message: string,
        options: {
            code: string;
            file?: string;
            line?: number;
            suggestion?: string;
            cause?: Error;
        }
    ) {
        super(message);
        this.name = 'SSGError';
        this.code = options.code;
        this.file = options.file;
        this.line = options.line;
        this.suggestion = options.suggestion;
        this.cause = options.cause;
    }

    /**
     * Format error for console output with colors
     */
    format(root?: string): string {
        const lines: string[] = [];
        
        // Header with error code
        lines.push(`\n❌ ${this.code}: ${this.message}\n`);
        
        // File location
        if (this.file) {
            const displayPath = root ? path.relative(root, this.file) : this.file;
            if (this.line) {
                lines.push(`   📁 ${displayPath}:${this.line}`);
            } else {
                lines.push(`   📁 ${displayPath}`);
            }
        }
        
        // Suggestion
        if (this.suggestion) {
            lines.push(`\n   💡 ${this.suggestion}`);
        }
        
        lines.push('');
        return lines.join('\n');
    }
}

/**
 * Error codes for categorization
 */
export const ErrorCodes = {
    // Config errors
    CONFIG_NOT_FOUND: 'SSG001',
    CONFIG_INVALID: 'SSG002',
    CONFIG_THEME_NOT_FOUND: 'SSG003',
    
    // Route/Page errors
    PAGE_NOT_FOUND: 'SSG100',
    PAGE_INVALID_EXPORT: 'SSG101',
    DYNAMIC_ROUTE_NO_PATHS: 'SSG102',
    LAYOUT_NOT_FOUND: 'SSG103',
    
    // Build errors
    BUILD_RENDER_FAILED: 'SSG300',
    BUILD_VITE_FAILED: 'SSG301',
    
    // MDX errors
    MDX_PARSE_ERROR: 'SSG400',
    MDX_FRONTMATTER_ERROR: 'SSG401',
} as const;

// ============================================================================
// Config Errors
// ============================================================================

export function configNotFoundError(searchedPaths: string[]): SSGError {
    return new SSGError(
        'No SSG configuration file found',
        {
            code: ErrorCodes.CONFIG_NOT_FOUND,
            suggestion: `Create ssg.config.ts in your project root:\n\n` +
                `   import { defineSSGConfig } from '@sigx/ssg';\n` +
                `   export default defineSSGConfig({ site: { title: 'My Site' } });`,
        }
    );
}

export function themeNotFoundError(themeName: string): SSGError {
    return new SSGError(
        `Theme package "${themeName}" not found`,
        {
            code: ErrorCodes.CONFIG_THEME_NOT_FOUND,
            suggestion: `Install the theme package:\n\n   npm install ${themeName}`,
        }
    );
}

// ============================================================================
// Route/Page Errors
// ============================================================================

export function layoutNotFoundError(layoutName: string, pagePath: string, availableLayouts: string[]): SSGError {
    const available = availableLayouts.length > 0
        ? `Available layouts: ${availableLayouts.join(', ')}`
        : 'No layouts found. Create one in src/layouts/';
    
    return new SSGError(
        `Layout "${layoutName}" not found`,
        {
            code: ErrorCodes.LAYOUT_NOT_FOUND,
            file: pagePath,
            suggestion: `${available}\n\n   To use a layout, set it in frontmatter:\n   ---\n   layout: default\n   ---`,
        }
    );
}

export function dynamicRouteNoPaths(filePath: string, routePath: string): SSGError {
    return new SSGError(
        `Dynamic route has no getStaticPaths export`,
        {
            code: ErrorCodes.DYNAMIC_ROUTE_NO_PATHS,
            file: filePath,
            suggestion: `Dynamic routes like "${routePath}" require a getStaticPaths export:\n\n` +
                `   export async function getStaticPaths() {\n` +
                `       return [{ params: { slug: 'example' } }];\n` +
                `   }`,
        }
    );
}

export function pageInvalidExport(filePath: string): SSGError {
    return new SSGError(
        `Page file has no default export`,
        {
            code: ErrorCodes.PAGE_INVALID_EXPORT,
            file: filePath,
            suggestion: `Pages must export a default component:\n\n` +
                `   export default component(() => {\n` +
                `       return () => <div>Page content</div>;\n` +
                `   });`,
        }
    );
}

// ============================================================================
// Build Errors
// ============================================================================

export function buildRenderError(path: string, error: Error): SSGError {
    return new SSGError(
        `Failed to render page: ${path}`,
        {
            code: ErrorCodes.BUILD_RENDER_FAILED,
            suggestion: `Check the error details below. Common causes:\n` +
                `   - Runtime error in component code\n` +
                `   - Missing dependencies during SSR\n` +
                `   - Browser APIs used during server render`,
            cause: error,
        }
    );
}

// ============================================================================
// MDX Errors
// ============================================================================

export function mdxParseError(file: string, error: Error, line?: number): SSGError {
    return new SSGError(
        `Failed to parse MDX file`,
        {
            code: ErrorCodes.MDX_PARSE_ERROR,
            file,
            line,
            suggestion: `Check the MDX syntax. Common issues:\n` +
                `   - Unclosed JSX tags\n` +
                `   - Invalid JavaScript expressions\n` +
                `   - Mixing HTML with JSX incorrectly`,
            cause: error,
        }
    );
}

// ============================================================================
// Error Handler
// ============================================================================

/**
 * Format and log an SSG error with full context
 */
export function handleError(error: unknown, root?: string): never {
    if (error instanceof SSGError) {
        console.error(error.format(root));
        if (error.cause) {
            console.error('   Caused by:', error.cause);
        }
    } else if (error instanceof Error) {
        console.error(`\n❌ ${error.name}: ${error.message}\n`);
        if (error.stack) {
            console.error(error.stack);
        }
    } else {
        console.error('\n❌ Unknown error:', error);
    }
    
    process.exit(1);
}

/**
 * Wrap an async function with error handling
 */
export function withErrorHandling<T>(
    fn: () => Promise<T>,
    root?: string
): Promise<T> {
    return fn().catch((error) => {
        handleError(error, root);
    });
}
