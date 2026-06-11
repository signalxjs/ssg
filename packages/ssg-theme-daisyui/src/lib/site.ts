/**
 * Site-branding helpers (signalxjs/ssg#60).
 *
 * The theme previously hardcoded "SignalX", `/docs`/`/blog`/`/examples` nav,
 * and the signalxjs/core GitHub URL — unusable for any other site. Branding
 * now comes from `site` config (reaching layouts via `LayoutProps.site`),
 * with neutral fallbacks.
 */

import type { SiteConfig, NavItem } from '@sigx/ssg';

/** Header/footer brand text: the site title, or a neutral fallback. */
export function siteBrand(site?: SiteConfig): string {
    return site?.title || 'Site';
}

/** Main navigation items: `site.nav`, or none. */
export function siteNavItems(site?: SiteConfig): NavItem[] {
    return site?.nav ?? [];
}

/** Repository URL for header/footer GitHub links, or null to omit them. */
export function siteRepoUrl(site?: SiteConfig): string | null {
    return site?.repo || null;
}
