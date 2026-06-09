import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Server-rendered markup for an install fence (see `mdx/shiki.ts`): a
// `.code-window-pm` window with a tab strip and all four variants, non-default
// ones hidden inline.
function mountInstallWindow(defaultPm = 'pnpm'): void {
    const tab = (pm: string) =>
        `<button type="button" class="code-window-tab code-window-pm-tab${pm === defaultPm ? ' code-window-tab-active' : ''}" data-pm="${pm}" aria-selected="${pm === defaultPm}">${pm}</button>`;
    const variant = (pm: string, cmd: string) =>
        `<div class="code-window-content" data-pm-variant="${pm}"${pm === defaultPm ? '' : ' style="display:none"'}>${cmd}</div>`;

    document.body.innerHTML = `
        <div class="code-window code-window-pm" data-pm="${defaultPm}">
            <div class="code-window-header">
                <div class="code-window-tabs code-window-pm-tabs">
                    ${tab('pnpm')}${tab('npm')}${tab('yarn')}${tab('bun')}
                </div>
            </div>
            ${variant('pnpm', 'pnpm add foo')}
            ${variant('npm', 'npm install foo')}
            ${variant('yarn', 'yarn add foo')}
            ${variant('bun', 'bun add foo')}
        </div>`;
}

function variantDisplay(pm: string): string {
    const el = document.querySelector<HTMLElement>(`[data-pm-variant="${pm}"]`)!;
    return el.style.display;
}

let dispose: () => void = () => {};

async function install(): Promise<void> {
    // Fresh module each test so the one-shot install guard and load-time sync
    // run cleanly. The returned disposer is torn down in afterEach so a prior
    // test's MutationObserver can't mutate the next test's DOM.
    vi.resetModules();
    const { installPackageManagerSwitcher } = await import('../client');
    dispose = installPackageManagerSwitcher();
}

describe('installPackageManagerSwitcher', () => {
    beforeEach(() => {
        document.head.innerHTML = '';
        document.body.innerHTML = '';
        localStorage.clear();
    });

    afterEach(() => {
        dispose();
        dispose = () => {};
    });

    it('switches the visible variant + active tab on tab click', async () => {
        mountInstallWindow();
        await install();

        document.querySelector<HTMLElement>('.code-window-pm-tab[data-pm="npm"]')!.click();

        const win = document.querySelector<HTMLElement>('.code-window-pm')!;
        expect(win.dataset.pm).toBe('npm');
        expect(variantDisplay('npm')).toBe('');
        expect(variantDisplay('pnpm')).toBe('none');
        const npmTab = document.querySelector<HTMLElement>('.code-window-pm-tab[data-pm="npm"]')!;
        expect(npmTab.classList.contains('code-window-tab-active')).toBe(true);
        expect(npmTab.getAttribute('aria-selected')).toBe('true');
    });

    it('persists the choice to localStorage', async () => {
        mountInstallWindow();
        await install();
        document.querySelector<HTMLElement>('.code-window-pm-tab[data-pm="yarn"]')!.click();
        expect(localStorage.getItem('sigx-pm')).toBe('yarn');
    });

    it('restores a stored choice on load', async () => {
        localStorage.setItem('sigx-pm', 'bun');
        mountInstallWindow();
        await install();

        expect(document.querySelector<HTMLElement>('.code-window-pm')!.dataset.pm).toBe('bun');
        expect(variantDisplay('bun')).toBe('');
        expect(variantDisplay('pnpm')).toBe('none');
    });

    it('syncs across tabs via storage events', async () => {
        mountInstallWindow();
        await install();

        const evt = Object.assign(new Event('storage'), { key: 'sigx-pm', newValue: 'yarn' });
        window.dispatchEvent(evt);

        expect(document.querySelector<HTMLElement>('.code-window-pm')!.dataset.pm).toBe('yarn');
        expect(variantDisplay('yarn')).toBe('');
    });

    it('ignores clicks outside a PM tab', async () => {
        mountInstallWindow();
        await install();
        document.querySelector<HTMLElement>('.code-window-pm')!.click();
        expect(localStorage.getItem('sigx-pm')).toBeNull();
        expect(document.querySelector<HTMLElement>('.code-window-pm')!.dataset.pm).toBe('pnpm');
    });
});
