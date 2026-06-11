import { component } from 'sigx';
import type { LayoutProps, LayoutSlots } from '@sigx/ssg';
import SiteHeader from '../components/SiteHeader';

export default component<LayoutProps, unknown, LayoutSlots>(({ slots }) => {
    return () => (
        <div class="site">
            <SiteHeader />
            <main>{slots.default()}</main>
            <footer>Built with @sigx/ssg</footer>
        </div>
    );
});
