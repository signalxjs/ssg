# @sigx/ssr-islands

Islands architecture for SignalX SSR. Renders pages on the server and selectively hydrates only the components that need interactivity, controlled by `client:*` directives.

## Install

```bash
npm install @sigx/ssr-islands sigx vite
```

## Quick start

Add the Vite plugin to your app:

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import sigx from '@sigx/vite';
import islands from '@sigx/ssr-islands';

export default defineConfig({
  plugins: [sigx(), islands()],
});
```

Use a `client:*` directive on any component to mark it as an island:

```tsx
import { Counter } from './Counter';

export const Page = () => (
  <article>
    <h1>Mostly static content</h1>
    <p>This entire page is rendered on the server.</p>

    {/* Hydrated when the page loads */}
    <Counter client:load />

    {/* Hydrated when the browser is idle */}
    <Counter client:idle />

    {/* Hydrated when the component scrolls into view */}
    <Counter client:visible />
  </article>
);
```

Everything outside of an island stays as static HTML — no JavaScript shipped, no hydration cost.

## Hydration strategies

| Directive | When it hydrates |
| --- | --- |
| `client:load` | Immediately when the page boots |
| `client:idle` | When `requestIdleCallback` fires |
| `client:visible` | When the island intersects the viewport |
| `client:media={query}` | When a media query matches |
| `client:only` | Render is skipped on the server; hydrates on the client like an SPA component |

## License

MIT © Andreas Ekdahl
