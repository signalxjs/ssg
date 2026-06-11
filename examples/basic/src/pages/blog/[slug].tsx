import { component } from 'sigx';
import { useRoute } from '@sigx/router';

export async function getStaticPaths() {
    return [
        { params: { slug: 'first-post' } },
        { params: { slug: 'second-post' } },
    ];
}

export const meta = {
    title: 'Blog post',
    description: 'A statically generated blog post',
    category: 'Blog',
};

// Pages read params from the router (signalxjs/ssg#73 tracks passing
// getStaticPaths params/props directly as component props).
export default component(() => {
    const route = useRoute();
    return () => (
        <article>
            <h1>Post: {route.params.slug}</h1>
            <p>Rendered at build time from getStaticPaths.</p>
        </article>
    );
});
