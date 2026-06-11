/**
 * Command Palette (signalxjs/ssg#62)
 *
 * ⌘K / Ctrl+K search over the build-time index (`search: true` in
 * ssg.config.ts). Loads `search-index.json` lazily on first open and ranks
 * with `searchPages` from `@sigx/ssg/client`. Rendered as a search button
 * in the header plus a modal; results are plain anchors, so SPA navigation
 * (when installed) intercepts them like any other internal link.
 */

import { component, onUnmounted } from 'sigx';
import { loadSearchIndex, searchPages, type SearchIndexEntry, type SearchResult } from '@sigx/ssg/client';
import { movePaletteSelection, paletteHref, isPaletteHotkey } from '../lib/palette.js';

export interface CommandPaletteProps {
    /** Deploy base when the site lives under a subpath (default `/`). */
    base?: string;
    /** Explicit index URL — for a custom `SearchOptions.output` filename. */
    url?: string;
    /** Max results shown (default 10). */
    limit?: number;
}

export default component<CommandPaletteProps>(({ props, signal, onMounted }) => {
    const state = signal<{
        open: boolean;
        query: string;
        results: SearchResult[];
        selected: number;
        error: string | null;
    }>({ open: false, query: '', results: [], selected: 0, error: null });

    let entries: SearchIndexEntry[] | null = null;
    let loading: Promise<void> | null = null;

    const ensureIndex = (): Promise<void> => {
        if (entries) return Promise.resolve();
        if (loading) return loading;
        const pending = loadSearchIndex({ base: props.base ?? '/', url: props.url })
            .then((loaded) => {
                entries = loaded;
                state.error = null;
            })
            .catch((err: unknown) => {
                // Surface the real failure (offline, wrong base/url, …) —
                // loadSearchIndex's own message already explains the 404 /
                // missing-index case.
                state.error = err instanceof Error ? err.message : 'Search is not available.';
            })
            .finally(() => {
                loading = null;
            });
        loading = pending;
        return pending;
    };

    const runQuery = (query: string) => {
        state.query = query;
        state.results = entries ? searchPages(entries, query, { limit: props.limit ?? 10 }) : [];
        state.selected = 0;
    };

    const open = () => {
        state.open = true;
        void ensureIndex().then(() => runQuery(state.query));
        // Focus once the modal is in the DOM.
        setTimeout(() => {
            document.querySelector<HTMLInputElement>('.command-palette-input')?.focus();
        }, 0);
    };

    const close = () => {
        state.open = false;
    };

    const navigateTo = (result: SearchResult) => {
        close();
        // A real anchor click so SPA navigation can intercept it.
        const a = document.createElement('a');
        a.href = paletteHref(props.base ?? '/', result);
        document.body.appendChild(a);
        a.click();
        a.remove();
    };

    const onKeydown = (e: KeyboardEvent) => {
        if (isPaletteHotkey(e)) {
            e.preventDefault();
            if (state.open) {
                close();
            } else {
                open();
            }
            return;
        }
        if (!state.open) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            close();
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            state.selected = movePaletteSelection(
                state.selected,
                e.key === 'ArrowDown' ? 1 : -1,
                state.results.length
            );
        } else if (e.key === 'Enter') {
            const result = state.results[state.selected];
            if (result) {
                e.preventDefault();
                navigateTo(result);
            }
        }
    };

    onMounted(() => {
        document.addEventListener('keydown', onKeydown);
    });

    onUnmounted(() => {
        document.removeEventListener('keydown', onKeydown);
    });

    return () => (
        <div class="command-palette">
            <button
                type="button"
                class="btn btn-ghost btn-sm gap-2"
                aria-label="Search"
                onClick={open}
            >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
                </svg>
                <kbd class="kbd kbd-sm hidden sm:inline-flex">⌘K</kbd>
            </button>
            {state.open && (
                <div class="modal modal-open" role="dialog" aria-label="Search" onClick={(e: MouseEvent) => e.target === e.currentTarget && close()}>
                    <div class="modal-box max-w-xl p-0">
                        <input
                            type="search"
                            class="command-palette-input input input-bordered w-full rounded-b-none"
                            placeholder="Search pages…"
                            value={state.query}
                            onInput={(e: Event) => runQuery((e.target as HTMLInputElement).value)}
                        />
                        {state.error ? (
                            <p class="p-4 text-sm opacity-70">{state.error}</p>
                        ) : (
                            <ul class="menu max-h-80 overflow-y-auto flex-nowrap" role="listbox">
                                {state.results.map((result, i) => (
                                    <li role="option" aria-selected={i === state.selected}>
                                        <a
                                            class={i === state.selected ? 'active' : ''}
                                            href={paletteHref(props.base ?? '/', result)}
                                            onClick={close}
                                        >
                                            <span class="flex flex-col items-start gap-0.5">
                                                <span class="font-medium">{result.title}</span>
                                                {result.excerpt && (
                                                    <span class="text-xs opacity-60 line-clamp-1">{result.excerpt}</span>
                                                )}
                                            </span>
                                        </a>
                                    </li>
                                ))}
                                {state.query.trim() && state.results.length === 0 && (
                                    <li class="p-4 text-sm opacity-70">No results for “{state.query}”</li>
                                )}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
});
