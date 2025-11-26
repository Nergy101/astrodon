# Astrodon

Astrodon is a tiny Deno static site toolkit. Build markdown with TypeScript-powered templates, and serve the output with a minimal dev server. Keep your site simple, fast, and readable.

See my blog for example usage: https://github.com/Nergy101/blog
Or check out the look and feel on my blog https://blog.nergy.space

## Quick start

1. Install Deno 2+ (or Bun 1.0+)

2. Create `deno.json` with JSR import + tasks

```json
{
  "tasks": {
    "build": "deno run --allow-read --allow-write --allow-run build.ts",
    "serve": "deno run --allow-read --allow-net --allow-run serve.ts",
    "dev": "deno task build && deno task serve"
  },
  "imports": {
    "astrodon": "jsr:@nergy101/astrodon@0.2.5"
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

Astrodon supports standard markdown with frontmatter metadata. Frontmatter is a YAML-like block at the top of your markdown file that provides metadata about the page.

### Frontmatter metadata

Frontmatter is enclosed between `---` delimiters at the beginning of your markdown file. All fields are optional and can be accessed in your templates via the `meta` object.

**Common frontmatter fields:**

- `title` - Page title (used in HTML `<title>` tag and navigation)
- `date` - Publication date (used for sorting blog posts and content cards)
- `author` - Author name (displayed in metadata sections)
- `tags` - Array of tags (used for categorization and filtering)

**Example:**

```markdown
---
title: Welcome to Astrodon
date: 2024-01-15
author: John Doe
tags: [getting-started, tutorial, astrodon]
---

# Hello

This is a markdown file with frontmatter metadata.
```

**Custom fields:**

You can add any custom fields to frontmatter - they'll all be available in your template's `meta` object:

```markdown
---
title: Advanced Guide
custom_field: Custom value
category: advanced
draft: false
---

Content here...
```

**Array syntax:**

Tags and other arrays can be written in YAML array syntax:

```markdown
---
tags: [tag1, tag2, tag3]
# or
tags:
  - tag1
  - tag2
  - tag3
---
```

**Accessing metadata in templates:**

All frontmatter fields are available in your `template.ts` render function:

```ts
export function render(content: string, context: RenderContext): string {
  const { meta } = context;
  // Access any frontmatter field
  const title = meta.title;
  const tags = meta.tags; // Array
  const custom = meta.custom_field;

  return content;
}
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

**File structure example:**

```
routes/
├── index.md                    # Homepage
├── about.md                    # About page
└── blogs/                      # Blog directory
    ├── index.md                # Blog index (uses {{routes:toc}})
    ├── getting-started.md      # Blog post
    ├── advanced-guide.md       # Blog post
    └── tips-and-tricks.md      # Blog post
```

**Example `routes/blogs/index.md`:**

```markdown
---
title: Blog
---

# My Blog

Welcome to my blog! Here are all my posts:

{{routes:toc}}
```

The `{{routes:toc}}` marker will be automatically replaced with cards for all markdown files in the `blogs/` directory (excluding `index.md` itself). Each card includes:

- **Title** - From the `title` frontmatter field or filename
- **Date** - From the `date` frontmatter field (if present)
- **Author** - From the `author` frontmatter field (if present)
- **Excerpt** - First paragraph of the content (auto-generated)
- **Tags** - From the `tags` frontmatter array (if present)

**Blog post example (`routes/blogs/getting-started.md`):**

```markdown
---
title: Getting Started with Astrodon
date: 2024-01-15
author: John Doe
tags: [tutorial, getting-started]
---

# Getting Started

This is the first paragraph that will be used as the excerpt in the table of contents card.

More content here...
```

**Note:** The `{{routes:toc}}` marker only works in `index.md` files within subdirectories. It will not work in the root `index.md` file.

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
