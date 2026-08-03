export const meta = {
    title: 'About - Basic Example',
    description: 'A TSX page whose export const meta drives the build-time head tags (#205).',
};

// A static .tsx page: its `export const meta` is read at scan time, so the
// built HTML carries this page's own <title>/<meta name="description">
// instead of the site-wide defaults.
export default function About() {
    return (
        <div>
            <h1>About</h1>
            <p>This TSX page's head tags come from its exported meta.</p>
        </div>
    );
}
