/**
 * Copy-code button (signalxjs/ssg#65): shiki emits a copy button in every
 * code-window header; `installCodeCopy()` from `@sigx/ssg/client` wires it
 * with one delegated listener. For package-manager windows only the visible
 * variant is copied.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { installCodeCopy } from '../client';

function codeWindow(text: string): HTMLElement {
    const win = document.createElement('div');
    win.className = 'code-window';
    win.innerHTML =
        `<div class="code-window-header"><button type="button" class="code-window-copy" aria-label="Copy code">c</button></div>` +
        `<div class="code-window-content"><pre><code>${text}</code></pre></div>`;
    document.body.appendChild(win);
    return win;
}

function pmWindow(): HTMLElement {
    const win = document.createElement('div');
    win.className = 'code-window code-window-pm';
    win.innerHTML =
        `<div class="code-window-header"><button type="button" class="code-window-copy" aria-label="Copy code">c</button></div>` +
        `<div class="code-window-content" data-pm-variant="pnpm">pnpm add foo</div>` +
        `<div class="code-window-content" data-pm-variant="npm" style="display:none">npm install foo</div>`;
    document.body.appendChild(win);
    return win;
}

let writeText: ReturnType<typeof vi.fn>;
let dispose: (() => void) | undefined;

beforeEach(() => {
    document.body.innerHTML = '';
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

afterEach(() => {
    dispose?.();
    dispose = undefined;
});

describe('installCodeCopy (#65)', () => {
    it('copies the code window content on click', async () => {
        dispose = installCodeCopy();
        const win = codeWindow('const x = 1;');

        win.querySelector<HTMLElement>('.code-window-copy')!.click();
        await Promise.resolve();

        expect(writeText).toHaveBeenCalledWith('const x = 1;');
    });

    it('copies only the visible variant of a package-manager window', async () => {
        dispose = installCodeCopy();
        const win = pmWindow();

        win.querySelector<HTMLElement>('.code-window-copy')!.click();
        await Promise.resolve();

        expect(writeText).toHaveBeenCalledTimes(1);
        expect(writeText).toHaveBeenCalledWith('pnpm add foo');
    });

    it('marks the button copied, then reverts', async () => {
        vi.useFakeTimers();
        try {
            dispose = installCodeCopy();
            const btn = codeWindow('x').querySelector<HTMLElement>('.code-window-copy')!;

            btn.click();
            await Promise.resolve();
            await Promise.resolve();
            expect(btn.classList.contains('code-window-copy-done')).toBe(true);

            vi.runAllTimers();
            expect(btn.classList.contains('code-window-copy-done')).toBe(false);
        } finally {
            vi.useRealTimers();
        }
    });

    it('stops handling clicks after dispose', async () => {
        const off = installCodeCopy();
        off();
        codeWindow('x').querySelector<HTMLElement>('.code-window-copy')!.click();
        await Promise.resolve();
        expect(writeText).not.toHaveBeenCalled();
    });
});
