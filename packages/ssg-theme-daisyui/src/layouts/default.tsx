/**
 * Default Layout
 *
 * A clean, minimal layout with header and footer.
 */

import { component } from 'sigx';
import type { LayoutProps, LayoutSlots } from '@sigx/ssg';
import Header from '../components/Header.js';
import Footer from '../components/Footer.js';

export default component<LayoutProps, unknown, LayoutSlots>(({ slots, props }) => {
    return () => (
        <div class="min-h-screen flex flex-col">
            <Header site={props.site} />

            <main class="flex-1 container mx-auto px-4 py-8">
                {slots.default()}
            </main>

            <Footer site={props.site} />
        </div>
    );
});
