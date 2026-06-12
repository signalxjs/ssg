/**
 * Blog Layout
 *
 * Layout for blog posts with metadata and author info.
 */

import { component } from 'sigx';
import type { LayoutProps, LayoutSlots } from '@sigx/ssg';
import Header from '../components/Header.js';
import { AnnouncementBar } from '../components/PageChrome.js';
import Footer from '../components/Footer.js';

export default component<LayoutProps, unknown, LayoutSlots>(({ slots, props }) => {
    const meta = props.meta || {};
    const date = meta.date ? new Date(meta.date as string) : null;

    return () => (
        <div class="min-h-screen flex flex-col">
            <AnnouncementBar site={props.site} />
            <Header site={props.site} search={props.site?.search} />

            <main class="flex-1">
                {/* Hero section */}
                <div class="bg-base-200 py-12">
                    <div class="container mx-auto px-4">
                        <div class="max-w-3xl mx-auto text-center">
                            {meta.tags && (
                                <div class="flex gap-2 justify-center mb-4">
                                    {(meta.tags as string[]).map((tag) => (
                                        <span class="badge badge-primary">{tag}</span>
                                    ))}
                                </div>
                            )}

                            <h1 class="text-4xl lg:text-5xl font-bold mb-4">
                                {meta.title || 'Untitled Post'}
                            </h1>

                            {meta.description && (
                                <p class="text-lg text-base-content/70 mb-6">
                                    {meta.description}
                                </p>
                            )}

                            <div class="flex items-center justify-center gap-4 text-sm text-base-content/60">
                                {meta.author && (
                                    // Single-expression child keeps the SSR output free of the
                                    // <!--t--> text-boundary marker the renderer inserts between
                                    // adjacent text children (works-as-designed hydration aid,
                                    // signalxjs/core#97) — purely cosmetic, mixed children work too.
                                    <span>{`By ${meta.author as string}`}</span>
                                )}
                                {date && (
                                    <time dateTime={date.toISOString()}>
                                        {date.toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric',
                                        })}
                                    </time>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Article content */}
                <article class="container mx-auto px-4 py-12">
                    <div class="max-w-3xl mx-auto prose prose-lg">
                        {slots.default()}
                    </div>
                </article>
            </main>

            <Footer site={props.site} />
        </div>
    );
});
