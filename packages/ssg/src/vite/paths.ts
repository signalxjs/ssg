/**
 * Cross-platform path predicates for watcher/HMR handlers (#54).
 *
 * Vite hands handlers posix-normalized absolute paths, while `path.resolve`
 * produces backslashes on Windows — a bare `startsWith` comparison never
 * matches there, and without a boundary check `src/pages-archive` matches
 * `src/pages` on any OS.
 */

/** Normalize separators to forward slashes (stable map keys, URLs). */
export function toPosix(p: string): string {
    return p.replace(/\\/g, '/');
}

/** Whether `file` lives strictly inside `dir` (boundary-checked, both styles). */
export function isInsideDir(file: string, dir: string): boolean {
    const normalizedFile = toPosix(file);
    const normalizedDir = toPosix(dir).replace(/\/+$/, '');
    return normalizedFile.startsWith(normalizedDir + '/');
}
