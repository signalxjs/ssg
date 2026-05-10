/**
 * Client hydration directive types.
 *
 * These directives control selective hydration behavior for SSR components.
 * Moved from @sigx/server-renderer — owned by the islands package.
 */

export interface ClientDirectives {
    'client:load'?: boolean;
    'client:idle'?: boolean;
    'client:visible'?: boolean;
    'client:media'?: string;
    'client:only'?: boolean;
}

// Augment types in runtime-core for island-specific client:* directives.
// SSRHelper and ComponentSetupContext SSR fields are owned by @sigx/server-renderer.
declare module '@sigx/runtime-core' {
    interface ComponentAttributeExtensions extends ClientDirectives { }
}
