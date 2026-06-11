/**
 * Documentation Layout
 *
 * Layout for documentation pages with sidebar navigation and table of contents.
 */

import { component } from 'sigx';
import type { LayoutProps, LayoutSlots } from '@sigx/ssg';
import Header from '../components/Header.js';
import Footer from '../components/Footer.js';
import Sidebar from '../components/Sidebar.js';
import TOC from '../components/TOC.js';
import PrevNext from '../components/PrevNext.js';

export default component<LayoutProps, unknown, LayoutSlots>(({ slots, props, signal }) => {
    const state = signal({
        sidebarOpen: false,
    });

    const toggleSidebar = () => {
        state.sidebarOpen = !state.sidebarOpen;
    };

    return () => (
        <div class="min-h-screen flex flex-col">
            <Header onMenuClick={toggleSidebar} site={props.site} />

            <div class="flex-1 flex">
                {/* Sidebar */}
                <aside
                    class={`
                        w-64 bg-base-200 border-r border-base-300
                        fixed lg:static inset-y-0 left-0 z-40
                        transform transition-transform duration-200
                        ${state.sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                    `}
                >
                    <div class="sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto p-4">
                        <Sidebar />
                    </div>
                </aside>

                {/* Overlay for mobile */}
                {state.sidebarOpen && (
                    <div
                        class="fixed inset-0 bg-black/50 z-30 lg:hidden"
                        onClick={toggleSidebar}
                    />
                )}

                {/* Main content */}
                <main class="flex-1 min-w-0">
                    <div class="container mx-auto px-4 py-8 lg:px-8">
                        <div class="flex gap-8">
                            {/* Article content */}
                            <article class="flex-1 min-w-0 prose prose-lg max-w-none">
                                {props.meta?.title && !props.meta?.titleFromContent && (
                                    <h1>{props.meta.title}</h1>
                                )}
                                {slots.default()}
                                <PrevNext />
                            </article>

                            {/* Table of contents */}
                            <aside class="hidden xl:block w-64 shrink-0">
                                <div class="sticky top-20">
                                    <TOC meta={props.meta} />
                                </div>
                            </aside>
                        </div>
                    </div>
                </main>
            </div>

            <Footer site={props.site} />
        </div>
    );
});
