# @sigx/ssg-theme-daisyui

[daisyUI](https://daisyui.com/) / Tailwind theme for [`@sigx/ssg`](https://sigx.dev/ssg/) with pre-built layouts and components.

[![npm @sigx/ssg-theme-daisyui](https://img.shields.io/npm/v/@sigx/ssg-theme-daisyui.svg?label=@sigx/ssg-theme-daisyui&color=blue)](https://www.npmjs.com/package/@sigx/ssg-theme-daisyui)
[![license](https://img.shields.io/npm/l/@sigx/ssg-theme-daisyui.svg)](../../LICENSE)

> 🚧 SignalX is in early public release. The API surface is small and stabilising — feedback is very welcome.

## 📚 Documentation

Full guides, API reference and live examples → **<https://sigx.dev/daisyui/>**

## What is it?

A drop-in theme for [`@sigx/ssg`](https://sigx.dev/ssg/) built on
[daisyUI](https://daisyui.com/) and Tailwind. It ships ready-made `default`, `docs`
and `blog` layouts plus the components behind them — header with theme toggle,
collapsible sidebar, auto-generated table of contents, and footer — so you get a
polished docs or blog site without hand-rolling any UI. Layouts can be overridden
locally and every daisyUI theme is available out of the box.

## A taste

```ts
// ssg.config.ts
import { defineSSGConfig } from '@sigx/ssg';

export default defineSSGConfig({
    theme: '@sigx/ssg-theme-daisyui',
});
```

Layout reference, exported components, customization and the full list of daisyUI
themes are all documented at **<https://sigx.dev/daisyui/>**.

## Part of SignalX

- [`@sigx/ssg`](https://sigx.dev/ssg/) — the static site generator this theme plugs into
- [SignalX core](https://sigx.dev/core/) — `sigx` and friends
- [`@sigx/daisyui`](https://sigx.dev/daisyui/) — daisyUI components for SignalX

## License

MIT © Andreas Ekdahl
