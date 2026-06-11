/**
 * HTML template injection (internal module).
 *
 * String.replace with a string pattern interprets `$&`, "$`", "$'", `$n` in
 * the replacement — page content containing them (likely in code-heavy docs)
 * was corrupted (#52). Replacer functions are immune.
 */

export function injectIntoTemplate(template: string, appHtml: string, headTags: string): string {
    return template
        .replace('<!--app-html-->', () => appHtml)
        .replace('<!--head-tags-->', () => headTags);
}
