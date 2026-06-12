/**
 * Per-page chrome (signalxjs/ssg#65): AnnouncementBar, Breadcrumbs,
 * EditThisPage, and LastUpdated — all driven by `site` config and page
 * meta, no site-side code needed.
 */

import { component } from 'sigx';
import { useRoute } from '@sigx/router';
import type { PageMeta, SiteConfig } from '@sigx/ssg';
import { editUrl, breadcrumbs, lastUpdated, announcementKey } from '../lib/page-chrome.js';

let generatedNavigation: Record<string, { sidebar: never[] }> = {};
let detectCollection: (path: string) => string | undefined = () => undefined;

try {
    // @ts-ignore - Virtual module exists only inside an ssg build
    const navModule = await import('virtual:ssg-navigation');
    generatedNavigation = navModule.navigation || {};
    detectCollection = navModule.detectCollection || (() => undefined);
} catch {
    /* outside an ssg build */
}

export interface AnnouncementBarProps {
    site?: SiteConfig;
}

/** Dismissible site-wide announcement above the header (#65). */
export const AnnouncementBar = component<AnnouncementBarProps>(({ props, signal, onMounted }) => {
    // Rendered at SSR (most visitors haven't dismissed); the mount check
    // hides it for those who have.
    const state = signal({ dismissed: false });

    const announcement = () => props.site?.announcement;

    onMounted(() => {
        const a = announcement();
        if (!a) return;
        try {
            state.dismissed = localStorage.getItem(announcementKey(a)) === '1';
        } catch {
            state.dismissed = false;
        }
    });

    const dismiss = () => {
        const a = announcement();
        if (!a) return;
        state.dismissed = true;
        try {
            localStorage.setItem(announcementKey(a), '1');
        } catch {
            /* session-only dismissal */
        }
    };

    return () => {
        const a = announcement();
        if (!a || state.dismissed) return null;
        return (
            <div class="announcement-bar bg-primary text-primary-content text-sm px-4 py-2 flex items-center justify-center gap-3">
                {a.href ? (
                    <a href={a.href} class="link link-hover font-medium">
                        {a.text}
                    </a>
                ) : (
                    <span>{a.text}</span>
                )}
                <button type="button" class="btn btn-ghost btn-xs" aria-label="Dismiss announcement" onClick={dismiss}>
                    ✕
                </button>
            </div>
        );
    };
});

export interface BreadcrumbsProps {
    /** Trailing-slash-insensitive current path comes from the router. */
    collection?: string;
}

/** Breadcrumb trail from the collection sidebar (#65). */
export const Breadcrumbs = component<BreadcrumbsProps>(({ props }) => {
    const route = useRoute();

    return () => {
        const collection = props.collection || detectCollection(route.path);
        const sections = collection ? (generatedNavigation[collection]?.sidebar ?? []) : [];
        const crumbs = breadcrumbs(sections, route.path);
        if (crumbs.length < 2) return null;

        return (
            <nav class="breadcrumbs text-sm" aria-label="Breadcrumb">
                <ul>
                    {crumbs.map((crumb, i) => (
                        <li>
                            {crumb.href && i < crumbs.length - 1 ? (
                                <a href={crumb.href}>{crumb.title}</a>
                            ) : (
                                <span>{crumb.title}</span>
                            )}
                        </li>
                    ))}
                </ul>
            </nav>
        );
    };
});

export interface PageFooterProps {
    site?: SiteConfig;
    meta?: PageMeta;
}

/** Edit-this-page link + last-updated line under the article (#65). */
export const PageFooter = component<PageFooterProps>(({ props }) => {
    return () => {
        const edit = editUrl(props.site, props.meta);
        const updated = lastUpdated(props.meta);
        if (!edit && !updated) return null;

        return (
            <div class="page-footer flex items-center justify-between gap-4 mt-8 pt-4 border-t border-base-300 text-sm text-base-content/60">
                {edit ? (
                    <a href={edit} class="link link-hover" target="_blank" rel="noopener noreferrer">
                        Edit this page
                    </a>
                ) : (
                    <span />
                )}
                {updated && (
                    <span>
                        <span>Last updated </span>
                        <time dateTime={updated.toISOString()}>
                            {updated.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </time>
                    </span>
                )}
            </div>
        );
    };
});
