/**
 * Package-manager command translation (server-side).
 *
 * `parse` reduces a written install command to a manager-agnostic shape;
 * `render` emits it for a target manager. Package arguments are never
 * translated — only the command prefix changes — and `parse` is total over
 * `render`'s output, so managers round-trip cleanly.
 *
 * Used by the Shiki transformer (`shiki.ts`) to pre-render every npm / pnpm /
 * yarn / bun variant of an install fence at build time. The client switcher
 * only toggles which pre-rendered variant is visible, so it needs none of
 * this — keeping these functions free of any browser/runtime dependency.
 *
 * Ported from the docs repo's `src/lib/package-manager.ts` (minus the reactive
 * `pm` signal + persistence, which now live in the client switcher).
 */

export type Pm = 'pnpm' | 'npm' | 'yarn' | 'bun';

export const PMS: Pm[] = ['pnpm', 'npm', 'yarn', 'bun'];
export const DEFAULT_PM: Pm = 'pnpm';

/** A package-manager invocation reduced to a manager-agnostic shape. */
export interface Parsed {
    action: 'add' | 'install' | 'remove' | 'dlx' | 'create' | 'run';
    dev: boolean;
    global: boolean;
    /** Packages / target / script — verbatim, never translated. */
    args: string;
    /** Trailing ` # …` comment, preserved verbatim (incl. leading space). */
    comment: string;
}

const DEV_FLAGS = new Set(['-D', '--save-dev', '--dev', '-d']);
const GLOBAL_FLAGS = new Set(['-g', '--global']);

/** Pull dev/global flags out of an argument token list. */
function stripFlags(tokens: string[]): { dev: boolean; global: boolean; args: string[] } {
    let dev = false;
    let global = false;
    const args = tokens.filter((t) => {
        if (DEV_FLAGS.has(t)) return (dev = true), false;
        if (GLOBAL_FLAGS.has(t)) return (global = true), false;
        return true;
    });
    return { dev, global, args };
}

function finalize(
    action: Parsed['action'],
    tokens: string[],
    comment: string,
    globalFromSub = false,
): Parsed {
    const { dev, global, args } = stripFlags(tokens);
    return { action, dev, global: global || globalFromSub, args: args.join(' '), comment };
}

/**
 * Parse one command line into a manager-agnostic shape, or null when the
 * line is not a recognized package-manager command.
 */
export function parse(raw: string): Parsed | null {
    // A trailing comment starts at the first whitespace-then-`#` (space or tab),
    // so `pnpm add foo\t# note` is handled too; a bare `#` inside an argument
    // (no preceding whitespace) is not treated as a comment.
    const hashMatch = raw.match(/\s#/);
    const hashIdx = hashMatch?.index ?? -1;
    const comment = hashIdx === -1 ? '' : raw.slice(hashIdx);
    const body = (hashIdx === -1 ? raw : raw.slice(0, hashIdx)).trim();
    if (!body) return null;

    const tokens = body.split(/\s+/);
    const pmTok = tokens[0];

    // Bare one-off executors map straight to `dlx`.
    if (pmTok === 'npx' || pmTok === 'bunx') {
        return finalize('dlx', tokens.slice(1), comment);
    }
    if (!PMS.includes(pmTok as Pm)) return null;

    let sub = tokens[1] ?? '';
    let rest = tokens.slice(2);

    // `bun x` is bun's dlx.
    if (pmTok === 'bun' && sub === 'x') return finalize('dlx', rest, comment);

    // `yarn global add …` — global is a prefix sub-command in yarn classic.
    let global = false;
    if (pmTok === 'yarn' && sub === 'global') {
        global = true;
        sub = rest[0] ?? '';
        rest = rest.slice(1);
    }

    switch (sub) {
        case 'add':
            return finalize('add', rest, comment, global);
        case 'install':
        case 'i':
            // `<pm> install <pkgs>` is an add; bare `<pm> install` installs all.
            return finalize(
                stripFlags(rest).args.length ? 'add' : 'install',
                rest,
                comment,
                global,
            );
        case 'uninstall':
        case 'remove':
        case 'rm':
            // Carry the yarn-classic `global` prefix through so global removals
            // round-trip (`-g` removals are picked up from flags by stripFlags).
            return finalize('remove', rest, comment, global);
        case 'dlx':
            return finalize('dlx', rest, comment);
        case 'create':
        case 'init':
            return finalize('create', rest, comment);
        case 'run':
            return finalize('run', rest, comment);
        case '':
            // `yarn` on its own installs all dependencies.
            return { action: 'install', dev: false, global: false, args: '', comment };
        default:
            return null;
    }
}

/** Render a parsed command for a target manager. */
export function render(p: Parsed, target: Pm): string {
    const { action, dev, global, args, comment } = p;
    let cmd: string;

    switch (action) {
        case 'add': {
            if (global && target === 'yarn') {
                cmd = `yarn global add ${args}`;
                break;
            }
            const verb = target === 'npm' ? 'install' : 'add';
            const flags = [dev ? '-D' : '', global ? '-g' : ''].filter(Boolean).join(' ');
            cmd = `${target} ${verb}${flags ? ` ${flags}` : ''} ${args}`;
            break;
        }
        case 'install':
            cmd = `${target} install`;
            break;
        case 'remove': {
            if (global && target === 'yarn') {
                cmd = `yarn global remove ${args}`;
                break;
            }
            const verb = target === 'npm' ? 'uninstall' : 'remove';
            cmd = `${target} ${verb}${global ? ' -g' : ''} ${args}`;
            break;
        }
        case 'dlx':
            cmd =
                target === 'npm' ? `npx ${args}`
                : target === 'bun' ? `bunx ${args}`
                : `${target} dlx ${args}`;
            break;
        case 'create':
            cmd = `${target} create ${args}`;
            break;
        case 'run':
            cmd = `${target} run ${args}`;
            break;
    }

    return cmd.replace(/\s+/g, ' ').trim() + comment;
}

/** Translate a written command to the target manager, or return it unchanged. */
export function translate(raw: string, target: Pm): string {
    const parsed = parse(raw);
    return parsed ? render(parsed, target) : raw;
}
