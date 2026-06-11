/**
 * Public package-manager API (signalxjs/ssg#63): the switcher's selection
 * was DOM/localStorage internals only — the docs site keeps a 200-line
 * parser duplicate and a DOM-poking bridge (`pm-sync.ts`) to stay in sync.
 * `getPackageManager`/`setPackageManager`/`onPackageManagerChange` make the
 * selection programmable, and the parser is exported as public API.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    getPackageManager,
    setPackageManager,
    onPackageManagerChange,
    installPackageManagerSwitcher,
    parsePackageManagerCommand,
    translatePackageManagerCommand,
} from '../client';

function pmWindow(defaultPm = 'pnpm'): HTMLElement {
    const win = document.createElement('div');
    win.className = 'code-window code-window-pm';
    win.dataset.pm = defaultPm;
    win.innerHTML = ['pnpm', 'npm', 'yarn', 'bun']
        .map(
            (pm) =>
                `<button type="button" class="code-window-tab code-window-pm-tab${pm === defaultPm ? ' code-window-tab-active' : ''}" data-pm="${pm}" aria-selected="${pm === defaultPm}">${pm}</button>` +
                `<div class="code-window-content" data-pm-variant="${pm}"${pm === defaultPm ? '' : ' style="display:none"'}>${pm} variant</div>`
        )
        .join('');
    document.body.appendChild(win);
    return win;
}

beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
});

describe('get/setPackageManager (#63)', () => {
    it('setPackageManager updates every window, persists, and getPackageManager reflects it', () => {
        const win = pmWindow();
        setPackageManager('yarn');

        expect(getPackageManager()).toBe('yarn');
        expect(win.dataset.pm).toBe('yarn');
        expect(win.querySelector<HTMLElement>('[data-pm-variant="yarn"]')!.style.display).toBe('');
        expect(win.querySelector<HTMLElement>('[data-pm-variant="pnpm"]')!.style.display).toBe('none');
        expect(localStorage.getItem('sigx-pm')).toBe('yarn');
    });

    it('rejects invalid managers', () => {
        expect(() => setPackageManager('cargo' as never)).toThrow(/cargo/);
    });

    it('getPackageManager falls back to the persisted value, then the default', async () => {
        // Fresh module instances — the fallback chain only matters before
        // anything in the page has selected a PM.
        vi.resetModules();
        localStorage.setItem('sigx-pm', 'bun');
        let fresh = await import('../client');
        expect(fresh.getPackageManager()).toBe('bun');

        vi.resetModules();
        localStorage.clear();
        fresh = await import('../client');
        expect(fresh.getPackageManager()).toBe('pnpm');
    });
});

describe('onPackageManagerChange (#63)', () => {
    it('notifies subscribers on programmatic change and supports unsubscribe', () => {
        const cb = vi.fn();
        const off = onPackageManagerChange(cb);

        setPackageManager('npm');
        expect(cb).toHaveBeenCalledWith('npm');

        off();
        setPackageManager('yarn');
        expect(cb).toHaveBeenCalledTimes(1);
    });

    it('notifies when the user clicks a switcher tab', () => {
        const dispose = installPackageManagerSwitcher();
        const win = pmWindow();
        const cb = vi.fn();
        const off = onPackageManagerChange(cb);

        win.querySelector<HTMLElement>('.code-window-pm-tab[data-pm="bun"]')!
            .dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(cb).toHaveBeenCalledWith('bun');
        expect(getPackageManager()).toBe('bun');

        off();
        dispose();
    });
});

describe('review hardening (#63)', () => {
    it('a throwing subscriber does not block later subscribers', () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const bad = vi.fn(() => {
            throw new Error('boom');
        });
        const good = vi.fn();
        const offBad = onPackageManagerChange(bad);
        const offGood = onPackageManagerChange(good);

        expect(() => setPackageManager('npm')).not.toThrow();
        expect(good).toHaveBeenCalledWith('npm');

        offBad();
        offGood();
        errSpy.mockRestore();
    });

    it('setPackageManager is safe without a DOM', () => {
        vi.stubGlobal('document', undefined);
        try {
            expect(() => setPackageManager('bun')).not.toThrow();
            expect(getPackageManager()).toBe('bun');
        } finally {
            vi.unstubAllGlobals();
        }
    });

    it('getPackageManager seeds from the persisted value, so a later storage wipe cannot flip it', async () => {
        vi.resetModules();
        localStorage.setItem('sigx-pm', 'yarn');
        const fresh = await import('../client');
        expect(fresh.getPackageManager()).toBe('yarn');
        localStorage.clear();
        expect(fresh.getPackageManager()).toBe('yarn');
    });
});

describe('parser re-exports (#63)', () => {
    it('parse and translate are public client API', () => {
        expect(parsePackageManagerCommand('pnpm add foo')).toMatchObject({ action: 'add', args: 'foo' });
        expect(translatePackageManagerCommand('npm install foo', 'yarn')).toBe('yarn add foo');
    });
});
