/**
 * Footer Component
 *
 * Site footer with navigation and copyright — branding comes from site
 * config (#60), with neutral fallbacks.
 */

import { component } from 'sigx';
import type { SiteConfig } from '@sigx/ssg';
import { siteBrand, siteNavItems, siteRepoUrl } from '../lib/site.js';

export interface FooterProps {
    /** Site config for branding (title/nav/repo) — see #60. */
    site?: SiteConfig;
}

export default component<FooterProps>(({ props }) => {
    const currentYear = new Date().getFullYear();

    return () => {
        const repo = siteRepoUrl(props.site);
        const nav = siteNavItems(props.site);

        return (
            <footer class="footer footer-center p-10 bg-base-200 text-base-content border-t border-base-300">
                {nav.length > 0 && (
                    <nav class="grid grid-flow-col gap-4">
                        {nav.map((item) => (
                            <a href={item.href ?? '#'} class="link link-hover">{item.title}</a>
                        ))}
                    </nav>
                )}

                <aside>
                    <p>
                        {siteBrand(props.site)} • © {currentYear}
                        {repo ? (
                            <>
                                {' '}•{' '}
                                <a href={repo} class="link" target="_blank" rel="noopener noreferrer">
                                    Repository
                                </a>
                            </>
                        ) : null}
                    </p>
                </aside>
            </footer>
        );
    };
});
