/**
 * Command palette helpers (signalxjs/ssg#62) — selection movement, link
 * building, and hotkey detection for the theme's ⌘K palette.
 */

import { describe, it, expect } from 'vitest';
import { movePaletteSelection, paletteHref, isPaletteHotkey } from '../lib/palette';

describe('movePaletteSelection (#62)', () => {
    it('moves down and up within bounds', () => {
        expect(movePaletteSelection(0, 1, 3)).toBe(1);
        expect(movePaletteSelection(2, -1, 3)).toBe(1);
    });

    it('wraps around both ends', () => {
        expect(movePaletteSelection(2, 1, 3)).toBe(0);
        expect(movePaletteSelection(0, -1, 3)).toBe(2);
    });

    it('returns -1 when there are no items', () => {
        expect(movePaletteSelection(0, 1, 0)).toBe(-1);
    });
});

describe('paletteHref (#62)', () => {
    it('joins base, path, and anchor', () => {
        expect(paletteHref('/', { path: '/guide' })).toBe('/guide');
        expect(paletteHref('/sub/', { path: '/guide', anchor: '#install' })).toBe('/sub/guide#install');
        expect(paletteHref('', { path: '/guide' })).toBe('/guide');
    });
});

describe('isPaletteHotkey (#62)', () => {
    it('matches ⌘K and Ctrl+K, case-insensitively', () => {
        expect(isPaletteHotkey({ key: 'k', metaKey: true, ctrlKey: false })).toBe(true);
        expect(isPaletteHotkey({ key: 'K', metaKey: false, ctrlKey: true })).toBe(true);
    });

    it('rejects bare K and other combos', () => {
        expect(isPaletteHotkey({ key: 'k', metaKey: false, ctrlKey: false })).toBe(false);
        expect(isPaletteHotkey({ key: 'p', metaKey: true, ctrlKey: false })).toBe(false);
    });
});
