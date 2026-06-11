import { component } from 'sigx';

interface PostProps {
    params: { slug: string };
    featured?: boolean;
}

export async function getStaticPaths() {
    return [
        { params: { slug: 'first-post' }, props: { featured: true } },
        { params: { slug: 'second-post' } },
    ];
}

export const meta = {
    title: 'Blog post',
    description: 'A statically generated blog post',
    category: 'Blog',
};

// Route params and getStaticPaths props arrive as component props (#73).
export default component<PostProps>(({ props }) => {
    return () => (
        <article>
            <h1>Post: {props.params.slug}</h1>
            {props.featured ? <p>This post is featured.</p> : null}
            <p>Rendered at build time from getStaticPaths.</p>
        </article>
    );
});
