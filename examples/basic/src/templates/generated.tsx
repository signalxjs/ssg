/**
 * Programmatic-route template (#59): this page lives outside src/pages and
 * only exists because ssg.config.ts adds it via `routes`.
 */

import { component } from 'sigx';
import data from 'virtual:ssg-data';

export default component(() => {
    return () => (
        <article>
            <h1>Generated route</h1>
            <p>This page was added by config.routes, not the filesystem scan.</p>
            <p>Build info: {JSON.stringify(data.buildInfo)}</p>
        </article>
    );
});
