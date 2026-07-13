/**
 * Route-glob matching, shared by the exclude/include options of the
 * sitemap (#38) and llms (#176) outputs.
 *
 * A pattern without glob tokens is an exact match. With tokens, regex
 * metacharacters are escaped first so e.g. the `.` in `/docs/v1.0/*` stays
 * literal, then `*` expands to any run of characters and `?` to one.
 */

/** Compile route globs into a matcher. No patterns → matches nothing. */
export function createGlobMatcher(patterns: string[]): (path: string) => boolean {
    const exact = new Set<string>();
    const regexes: RegExp[] = [];

    for (const pattern of patterns) {
        if (pattern.includes('*') || pattern.includes('?')) {
            regexes.push(
                new RegExp(
                    '^' +
                        pattern
                            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
                            .replace(/\*/g, '.*')
                            .replace(/\?/g, '.') +
                        '$'
                )
            );
        } else {
            exact.add(pattern);
        }
    }

    return (path: string) => exact.has(path) || regexes.some((re) => re.test(path));
}
