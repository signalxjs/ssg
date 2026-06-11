import { component } from 'sigx';
import type { LayoutProps, LayoutSlots } from '@sigx/ssg';

export default component<LayoutProps, unknown, LayoutSlots>(({ slots }) => {
    return () => (
        <div class="site">
            <header>
                <a href="/">SSG Basic Example</a>
            </header>
            <main>{slots.default()}</main>
            <footer>Built with @sigx/ssg</footer>
        </div>
    );
});
