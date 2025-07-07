# Deno+Lua Static Site Generator

A lightweight static site generator built with Deno and Lua templating, perfect for blogs and documentation sites.

## Features

- **Markdown Support**: Write content in Markdown with YAML frontmatter
- **Lua Templating**: Add custom logic and layouts with Lua scripts
- **PicoCSS**: Beautiful, classless styling that looks great out of the box
- **Image Support**: Automatic copying of assets (png, jpeg, svg, webp, avif)
- **Fast Build**: Built with Deno for speed and simplicity
- **Development Server**: Live preview with `deno task serve`

## Prerequisites

- [Deno](https://deno.land/) (v1.40+)
- [Lua](https://www.lua.org/) (v5.1+)

### Installing Lua

**macOS:**

```bash
brew install lua
```

**Ubuntu/Debian:**

```bash
sudo apt-get install lua5.1
```

**Windows:**
Download from [Lua.org](https://www.lua.org/download.html)

## Quick Start

1. **Clone or download this repository**

2. **Install dependencies** (Deno will cache them automatically)

3. **Build your site:**

   ```bash
   deno task build
   ```

4. **Serve locally:**

   ```bash
   deno task serve
   ```

5. **Open your browser** to `http://localhost:8000`

## File Structure

```
deno-lua/
├── routes/           # Your content (Markdown files)
│   ├── index.md     # Homepage
│   ├── index.lua    # Optional: custom rendering
│   └── about.md     # About page
├── assets/          # Static assets (images, etc.)
│   └── sample.jpg
├── dist/            # Generated output (created by build)
├── build.ts         # Build script
├── serve.ts         # Development server
├── deno.json        # Deno configuration
└── README.md        # This file
```

## Writing Content

### Markdown Files

Create `.md` files in the `/routes/` directory. Each file becomes a page on your site.

**Example: `/routes/index.md`**

```markdown
---
title: Welcome to My Blog
date: 2024-01-15
author: Your Name
tags: [blog, introduction]
---

# Welcome to My Blog

This is my first blog post written in Markdown.

## Features

- **Markdown Support**: Write content easily
- **Lua Templates**: Add custom logic
- **PicoCSS**: Beautiful styling

![Sample Image](/assets/sample.jpg)
```

### Frontmatter

Add YAML frontmatter at the top of your markdown files:

```yaml
---
title: Page Title
date: 2024-01-15
author: Your Name
tags: [tag1, tag2]
---
```

## Lua Templating

For custom rendering, create a `.lua` file with the same name as your markdown file.

**Example: `/routes/index.lua`**

```lua
function render(content, context)
  -- Extract metadata
  local meta = context.meta
  local path = context.path

  -- Add custom styling
  local customStyle = [[
<style>
  .hero {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 3rem 1rem;
    text-align: center;
  }
</style>
]]

  -- Create hero section
  local hero = string.format([[
<div class="hero">
  <h1>%s</h1>
  <p>%s</p>
</div>
]], meta.title, meta.date or "")

  -- Return combined content
  return customStyle .. hero .. content
end
```

### Lua Context

The `render` function receives:

- `content`: The HTML content from your markdown
- `context`: A table with:
  - `meta`: Your frontmatter data
  - `path`: The file path

## Adding Images

1. Place your images in the `/assets/` directory
2. Reference them in your markdown: `![Alt text](/assets/image.jpg)`
3. Run `deno task build` - images are automatically copied to `/dist/assets/`

**Supported formats:** png, jpeg, svg, webp, avif

## Commands

```bash
# Build the site
deno task build

# Build and watch for changes
deno task dev

# Serve the built site locally
deno task serve
```

## Customization

### Styling

The default template uses PicoCSS. You can customize it by:

1. **Modifying the template** in `build.ts` (DEFAULT_TEMPLATE)
2. **Adding custom CSS** in your Lua templates
3. **Overriding PicoCSS** with your own styles

### Adding Pages

Simply create new `.md` files in `/routes/`:

- `/routes/blog.md` → `/dist/blog.html`
- `/routes/contact.md` → `/dist/contact.html`
- `/routes/posts/first-post.md` → `/dist/posts/first-post.html`

## Deployment

After building (`deno task build`), upload the contents of `/dist/` to your web server.

**Popular hosting options:**

- GitHub Pages
- Netlify
- Vercel
- AWS S3
- Any static hosting service

## Troubleshooting

### Lua not found

Make sure Lua is installed and available in your PATH:

```bash
lua --version
```

### Build errors

Check that:

- All markdown files are valid
- Lua scripts have proper syntax
- File permissions are correct

### Images not showing

- Ensure images are in `/assets/`
- Check that the build completed successfully
- Verify image paths in markdown are correct

## License

MIT License - feel free to use this for your own projects!
