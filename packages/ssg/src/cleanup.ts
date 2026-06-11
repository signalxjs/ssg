/**
 * Process-signal cleanup (internal module).
 *
 * The build overwrites the user's index.html and writes temp entry files,
 * restoring them in a `finally` — but a SIGINT/SIGTERM mid-build skipped
 * that, leaving the project corrupted (#52). These handlers make the
 * restoration run on signals too.
 */

type ExitFn = (code: number) => void;

const SIGNALS = [
    ['SIGINT', 130],
    ['SIGTERM', 143],
] as const;

/**
 * Run `cleanup` (then exit) when the process receives SIGINT/SIGTERM.
 * Returns an unregister function — call it once the normal `finally`
 * cleanup path has taken over.
 */
export function registerProcessCleanup(
    cleanup: () => void,
    exit: ExitFn = (code) => process.exit(code)
): () => void {
    const handlers = SIGNALS.map(([signal, code]) => {
        const handler = () => {
            try {
                cleanup();
            } finally {
                exit(code);
            }
        };
        process.once(signal, handler);
        return [signal, handler] as const;
    });

    return () => {
        for (const [signal, handler] of handlers) {
            process.off(signal, handler);
        }
    };
}
