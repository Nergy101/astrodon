---
title: About
date: 2024-01-15
author: Your Name
tags: [about, documentation, deno, lua]
---

# About This Blog

This blog is built with a custom **Deno+Lua Static Site Generator (SSG)** that combines the speed of Deno with the flexibility of Lua templating. Here's how it works:

## How It Works

1. **Markdown Files**: Write your content in `/routes/` as `.md` files with YAML frontmatter
2. **Lua Templates**: Add custom logic and layouts with Lua scripts in `template.lua`
3. **Build Process**: Run `deno task build` to generate HTML with metadata components
4. **Assets**: Place images in `/assets/` and they're automatically copied to the output

## Key Features

### ✨ Content Management

- **Markdown Support**: Write content in Markdown with YAML frontmatter
- **Metadata Components**: Automatic author, date, and tags display
- **File Naming**: Use snake_case for files (e.g., `my_first_blog.md`)
- **Navigation**: Auto-generated navigation with smart title formatting

### 🎨 Styling & UX

- **Dark/Light Theme**: Toggle between themes with persistent preference
- **Responsive Design**: Mobile-friendly navigation and layout
- **Interactive Code Blocks**: Monaco Editor integration with syntax highlighting
- **Reading-Optimized**: Typography and spacing designed for readability

### 🔧 Technical Features

- **Lua Templating**: Custom rendering logic for dynamic content
- **Asset Management**: Automatic copying of images and styles
- **Development Server**: Live preview with `deno task serve`
- **Fast Builds**: Built with Deno for speed and simplicity

## File Structure

```
deno-lua/
├── routes/           # Your content (Markdown files)
│   ├── index.md     # Homepage
│   ├── about.md     # About page
│   └── blogs/       # Blog posts directory
│       └── my_first_blog.md
├── assets/          # Static assets (images, CSS)
│   ├── styles.css   # Custom styles
│   └── images/      # Your images
├── dist/            # Generated output (created by build)
├── build.ts         # Build script with navigation generation
├── serve.ts         # Development server
├── template.lua     # Lua templating logic
└── deno.json        # Deno configuration
```

## Writing Content

### Markdown Files

Create `.md` files in the `/routes/` directory. Each file becomes a page on your site.

**Example: `/routes/my_first_blog.md`**

```markdown
---
title: My First Blog Post
date: 2024-01-15
author: Your Name
tags: [blog, deno, lua, first-post]
---

# My First Blog Post

This is my first blog post written in Markdown.

## Features

- **Markdown Support**: Write content easily
- **Lua Templates**: Add custom logic
- **Dark Theme**: Beautiful styling

![Sample Image](/assets/sample.jpg)
```

### Frontmatter

Add YAML frontmatter at the top of your markdown files:

```yaml
---
title: Page Title
date: 2024-01-15
author: Your Name
tags: [tag1, tag2, tag3]
---
```

**Supported metadata:**

- `title`: Page title (used in navigation and browser tab)
- `date`: Publication date
- `author`: Author name
- `tags`: Array of tags (displayed as styled pills)

## Navigation

The navigation is automatically generated from your file structure:

- **File names**: Use snake_case (e.g., `my_first_blog.md`)
- **Display names**: Underscores are converted to spaces and titles are capitalized
- **Home link**: Click the brand/logo in the top left corner
- **Dropdown menus**: Subdirectories become dropdown menus

## Lua Templating

The `template.lua` file provides custom rendering logic:

```lua
function render(content, context)
  local meta = context.meta
  local path = context.path

  -- Create metadata component with tags
  local metadata = '<div class="metadata">'
  if meta.author then
    metadata = metadata .. string.format('<span class="author">By %s</span>', meta.author)
  end
  if meta.tags and type(meta.tags) == 'table' then
    metadata = metadata .. '<div class="tags">'
    for i, tag in ipairs(meta.tags) do
      metadata = metadata .. string.format('<span class="tag">#%s</span>', tag)
    end
    metadata = metadata .. '</div>'
  end
  metadata = metadata .. '</div>'

  return metadata .. content
end
```

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

- Modify `assets/styles.css` for custom styles
- Update the CSS variables in the template for theming
- Add custom CSS in your Lua templates

### Navigation

- File names in snake_case are automatically converted to readable titles
- Subdirectories become dropdown menus
- The "Home" link is handled by the brand/logo

### Content

- Add more markdown files to `/routes/` for new pages
- Use subdirectories for organized content (e.g., `/routes/blog/`)
- Tags are automatically displayed as styled components

## Deployment

After building (`deno task build`), upload the contents of `/dist/` to your web server.

**Popular hosting options:**

- GitHub Pages
- Netlify
- Vercel
- AWS S3
- Any static hosting service
