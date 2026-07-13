import { component } from 'sigx';

/** Tiny static component imported from MDX (see docs/mdx-features.mdx). */
export default component<{ text: string }>((props) => {
    return () => <p class="callout">💡 {props.text}</p>;
});
