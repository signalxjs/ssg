/**
 * Programmatic production build. With `@sigx/cli` installed you can run
 * `npx sigx ssg build` instead — this script exists so the example (and the
 * e2e test in packages/ssg) needs no CLI dependency.
 */
import { build } from '@sigx/ssg/build';

await build({});
