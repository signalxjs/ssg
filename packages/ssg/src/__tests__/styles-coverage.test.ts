/**
 * Stylesheet coverage (signalxjs/ssg#113): every interactive class the
 * shiki renderer emits must have rules in the shipped `@sigx/ssg/styles.css`
 * — the copy button shipped as markup with no styles and rendered as a raw
 * browser button.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.join(here, '..', '..', 'styles.css'), 'utf-8');

// Classes emitted by mdx/shiki.ts that users interact with or see as chrome.
const EMITTED_CLASSES = [
    'code-window',
    'code-window-header',
    'code-window-dots',
    'code-window-filename',
    'code-window-lang',
    'code-window-content',
    'code-window-tab',
    'code-window-tab-active',
    'code-window-try-live',
    'code-window-copy',
];

// Classes toggled by the client runtime.
const RUNTIME_CLASSES = ['code-window-copy-done'];

describe('styles.css covers the emitted code-window markup (#113)', () => {
    it.each([...EMITTED_CLASSES, ...RUNTIME_CLASSES])('has rules for .%s', (cls) => {
        expect(css).toMatch(new RegExp(`\\.${cls}[\\s,:{[]`));
    });
});
