# Astrodon

Astrodon is a tiny Deno static site toolkit. Build markdown with TypeScript-powered templates, and serve the output with a minimal dev server. Keep your site simple, fast, and readable.

See my blog for example usage: https://github.com/Nergy101/blog

## Quick start

1. Install Deno 1.40+

2. Create `deno.json` with JSR import + tasks

```json
{
  "tasks": {
    "build": "deno run --allow-read --allow-write --allow-run build.ts",
    "serve": "deno run --allow-read --allow-net --allow-run serve.ts",
    "dev": "deno task build && deno task serve"
  },
  "imports": {
    "astrodon": "jsr:@nergy101/astrodon@0.2.1"
  }
}
```

3. Create `build.ts`

```ts
#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run
import { build } from 'astrodon';

await build({
  contentDir: new URL('./routes', import.meta.url).pathname,
  outDir: new URL('./dist', import.meta.url).pathname,
  assetsDir: new URL('./assets', import.meta.url).pathname, // optional
  componentsDir: new URL('./components', import.meta.url).pathname, // optional
  template: new URL('./template.ts', import.meta.url).pathname, // optional
});
```

4. Create `serve.ts`

```ts
#!/usr/bin/env -S deno run --allow-read --allow-net --allow-run
import { serve } from 'astrodon';

await serve({
  root: new URL('./dist', import.meta.url).pathname,
  port: 8000,
});
```

5. Run

```bash
deno task build
deno task serve
# open http://localhost:8000
```

Or use the combined dev task:

```bash
deno task dev
```

## Project layout (consumer)

```
my-site/
├─ routes/               # Markdown content
├─ components/           # HTML partials (header, footer, nav, etc.)
├─ assets/               # Static files
├─ dist/                 # Build output
├─ build.ts
├─ serve.ts
├─ template.ts           # Optional TypeScript template
└─ deno.json
```

## Markdown features

Astrodon supports standard markdown with frontmatter metadata:

```markdown
---
title: Welcome
date: 2024-01-01
author: Your Name
tags: [blog, welcome]
---

# Hello

This is a markdown file with frontmatter metadata.
```

### Supported markdown features

- Headers with anchor links
- Code blocks with syntax highlighting (Prism.js)
- Tables
- Task lists
- Footnotes
- Definition lists
- Blockquotes
- Images (with automatic WebP optimization)
- Links (external links open in new tabs)

### Table of Contents

Use `{{routes:toc}}` in an `index.md` file within a subdirectory to automatically generate a table of contents with cards for all markdown files in that directory.

### Custom templates

Create a `template.ts` file to customize how your content is rendered:

```ts
export interface RenderContext {
  meta: Record<string, any>;
  path: string;
}

export function render(content: string, context: RenderContext): string {
  const { meta } = context;
  // Customize the rendered HTML
  return `<div class="custom-wrapper">${content}</div>`;
}
```

## Optional image optimization

Install `optimizt` once to convert images to WebP during build:

```bash
./install-optimizt.sh
# or: npm i -g @funboxteam/optimizt
```

## Commands

```bash
deno task build               # Build
deno task serve               # Serve locally
# pass flags to scripts: deno task serve -- --port=5000
```

## Configuration (minimal)

Use `optimization.config.json` if you want simple tuning:

```json
{
  "build": { "parallel": { "enabled": true, "maxConcurrency": 4 } },
  "server": { "cache": { "enabled": true, "ttl": 300000 } }
}
```

## Custom components

Within the `components/` folder you can create custom HTML templates for:

- `navbar.html` - Navigation bar component

## Troubleshooting

- Images not showing: check files in `assets/` and rebuild
- Custom port: `deno run -A serve.ts --port=5000`
- Build errors: ensure all required directories exist (`routes/`, `assets/`, etc.)
- Template not working: check that `template.ts` exports a `render` function with the correct signature

## License

MIT
