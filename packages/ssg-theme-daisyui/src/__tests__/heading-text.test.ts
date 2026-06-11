/**
 * Regression coverage for signalxjs/ssg#55: the TOC read heading text via
 * textContent, which includes the appended autolink anchor ("My Heading#").
 */

import { describe, it, expect } from 'vitest';
import { extractHeadingText } from '../components/TOC';

describe('extractHeadingText (#55)', () => {
    it('strips the appended autolink anchor', () => {
        const h2 = document.createElement('h2');
        h2.innerHTML = 'My Heading<a class="heading-anchor" href="#my-heading"><span class="heading-anchor-icon">#</span></a>';
        expect(extractHeadingText(h2)).toBe('My Heading');
    });

    it('returns plain text unchanged', () => {
        const h2 = document.createElement('h2');
        h2.textContent = 'Plain';
        expect(extractHeadingText(h2)).toBe('Plain');
    });

    it('keeps inline code content', () => {
        const h2 = document.createElement('h2');
        h2.innerHTML = 'Use <code>build()</code><a class="heading-anchor">#</a>';
        expect(extractHeadingText(h2)).toBe('Use build()');
    });
});
