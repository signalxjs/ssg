# @sigx/ssg-theme-daisyui

[daisyUI](https://daisyui.com/) / Tailwind theme for [`@sigx/ssg`](https://github.com/signalxjs/ssg/tree/main/packages/ssg) with pre-built layouts and components.

## Installation

```bash
npm install @sigx/ssg-theme-daisyui daisyui
```

## Usage

Configure in your `ssg.config.ts`:

```ts
import { defineSSGConfig } from '@sigx/ssg';

export default defineSSGConfig({
    theme: '@sigx/ssg-theme-daisyui',
});
```

## Layouts

### `default`
A clean, minimal layout with header and footer. Good for general pages.

### `docs`
Documentation layout with:
- Collapsible sidebar navigation
- Table of contents (auto-generated from headings)
- Responsive design with mobile menu

### `blog`
Blog post layout with:
- Hero section with title, tags, date
- Author info
- Centered content column

## Components

The theme exports components you can use in your pages:

```tsx
import { Header, Footer, Sidebar, TOC } from '@sigx/ssg-theme-daisyui';
```

### `Header`
Site header with navigation and theme toggle.

### `Footer`
Site footer with links and copyright.

### `Sidebar`
Collapsible navigation sidebar for docs.

### `TOC`
Auto-generated table of contents from page headings.

## Customization

### Override layouts locally

Create your own layout in `src/layouts/` with the same name to override the theme's layout:

```tsx
// src/layouts/default.tsx - overrides theme's default layout
import { component } from 'sigx';

export default component(({ slots }) => {
    return () => (
        <div class="my-custom-layout">
            {slots.default()}
        </div>
    );
});
```

### DaisyUI themes

Change the DaisyUI theme by setting `data-theme` on the HTML element:

```ts
// In a component
document.documentElement.setAttribute('data-theme', 'dark');
```

Available themes: `light`, `dark`, `cupcake`, `bumblebee`, `emerald`, `corporate`, `synthwave`, `retro`, `cyberpunk`, `valentine`, `halloween`, `garden`, `forest`, `aqua`, `lofi`, `pastel`, `fantasy`, `wireframe`, `black`, `luxury`, `dracula`, `cmyk`, `autumn`, `business`, `acid`, `lemonade`, `night`, `coffee`, `winter`

## License

MIT © Andreas Ekdahl
