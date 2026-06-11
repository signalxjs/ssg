/**
 * Pure helpers for the command palette (signalxjs/ssg#62) — kept out of the
 * component so selection movement and link building are unit-testable.
 */

/** Move the selected index by `delta`, wrapping around `count` items. */
export function movePaletteSelection(current: number, delta: number, count: number): number {
    if (count <= 0) return -1;
    return (((current + delta) % count) + count) % count;
}

/** Href for a search result: base-prefixed path plus the heading anchor. */
export function paletteHref(base: string, result: { path: string; anchor?: string }): string {
    const prefix = base && base !== '/' ? base.replace(/\/+$/, '') : '';
    return prefix + result.path + (result.anchor ?? '');
}

/** True when the event is the palette hotkey (⌘K on macOS, Ctrl+K elsewhere). */
export function isPaletteHotkey(e: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey'>): boolean {
    return (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
}
