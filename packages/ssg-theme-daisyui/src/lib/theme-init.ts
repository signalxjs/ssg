/**
 * Light/dark theme persistence + no-FOUC init (signalxjs/ssg#65).
 *
 * The toggle used to default to light, never persist, and ignore the OS
 * preference — and the chosen theme only applied after hydration (flash of
 * wrong theme). `themeInitScript()` ships in the theme's head contribution
 * so `data-theme` is set before first paint from the same storage key the
 * Header toggle writes.
 */

export const THEME_STORAGE_KEY = 'sigx-theme';

export type ThemeName = 'light' | 'dark';

/** The theme to apply on load: persisted choice, else OS preference. */
export function resolveInitialTheme(stored: string | null, prefersDark: boolean): ThemeName {
    if (stored === 'light' || stored === 'dark') return stored;
    return prefersDark ? 'dark' : 'light';
}

/** Read + apply the initial theme in the browser (used by the Header). */
export function applyInitialTheme(): ThemeName {
    let stored: string | null = null;
    try {
        stored = localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
        /* storage unavailable */
    }
    const theme = resolveInitialTheme(
        stored,
        typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches
    );
    document.documentElement.setAttribute('data-theme', theme);
    return theme;
}

/** Persist a theme choice (the Header toggle). */
export function persistTheme(theme: ThemeName): void {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
        /* storage unavailable — applies for this session only */
    }
}

/**
 * Inline no-FOUC script for the document head — same resolution as
 * {@link resolveInitialTheme}, executed before first paint.
 */
export function themeInitScript(): string {
    // Storage and matchMedia are guarded separately: a throwing
    // localStorage (private mode, blocked storage) must not skip the OS
    // fallback — that would reintroduce FOUC exactly where storage fails.
    return (
        `(function(){var t=null;` +
        `try{t=localStorage.getItem('${THEME_STORAGE_KEY}');}catch(e){}` +
        `if(t!=='light'&&t!=='dark'){` +
        `try{t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}catch(e){t='light';}}` +
        `document.documentElement.setAttribute('data-theme',t);})();`
    );
}
