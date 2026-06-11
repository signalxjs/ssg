/**
 * Header Component
 *
 * Site header with navigation and theme toggle.
 */

import { component } from 'sigx';
import type { SiteConfig } from '@sigx/ssg';
import { siteBrand, siteNavItems, siteRepoUrl } from '../lib/site.js';
import CommandPalette from './CommandPalette.js';

export interface HeaderProps {
    onMenuClick?: () => void;
    /** Site config for branding (title/logo/nav/repo) — see #60. */
    site?: SiteConfig;
    /**
     * Show the ⌘K search palette (#62). Requires the site to build with
     * `search: true`. Pass the deploy base for subpath deploys.
     */
    search?: boolean | { base?: string; url?: string };
}

export default component<HeaderProps>(({ props, signal }) => {
    const state = signal({
        theme: 'light',
    });

    const toggleTheme = () => {
        state.theme = state.theme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', state.theme);
    };

    return () => (
        <header class="navbar bg-base-100 border-b border-base-300 sticky top-0 z-50">
            <div class="container mx-auto">
                {/* Mobile menu button */}
                <div class="flex-none lg:hidden">
                    <button
                        class="btn btn-square btn-ghost"
                        onClick={props.onMenuClick}
                        aria-label="Open menu"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            class="inline-block w-6 h-6 stroke-current"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M4 6h16M4 12h16M4 18h16"
                            />
                        </svg>
                    </button>
                </div>

                {/* Brand */}
                <div class="flex-1">
                    <a href="/" class="btn btn-ghost text-xl">
                        {props.site?.logo ? <img src={props.site.logo} alt="" class="w-6 h-6" /> : null}
                        {siteBrand(props.site)}
                    </a>
                </div>

                {/* Desktop navigation (from site.nav) */}
                <div class="flex-none hidden lg:block">
                    <ul class="menu menu-horizontal px-1">
                        {siteNavItems(props.site)
                            .filter((item) => item.href)
                            .map((item) => (
                                <li><a href={item.href}>{item.title}</a></li>
                            ))}
                    </ul>
                </div>

                {/* Search palette (#62, opt-in) */}
                {props.search && (
                    <div class="flex-none">
                        <CommandPalette
                            base={typeof props.search === 'object' ? props.search.base : undefined}
                            url={typeof props.search === 'object' ? props.search.url : undefined}
                        />
                    </div>
                )}

                {/* Theme toggle */}
                <div class="flex-none">
                    <button
                        class="btn btn-square btn-ghost"
                        onClick={toggleTheme}
                        aria-label="Toggle theme"
                    >
                        {state.theme === 'light' ? (
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                class="w-6 h-6 stroke-current"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                                />
                            </svg>
                        ) : (
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                class="w-6 h-6 stroke-current"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                                />
                            </svg>
                        )}
                    </button>
                </div>

                {/* Repository link (only when configured) */}
                {siteRepoUrl(props.site) && (
                <div class="flex-none">
                    <a
                        href={siteRepoUrl(props.site)!}
                        class="btn btn-square btn-ghost"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Repository"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            class="w-6 h-6 fill-current"
                        >
                            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                        </svg>
                    </a>
                </div>
                )}
            </div>
        </header>
    );
});
