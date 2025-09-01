# Astrodon — Deno + Lua Static Site Generation Framework

[![Deno](https://img.shields.io/badge/Deno-1.40+-000000?style=flat&logo=deno)](https://deno.land/)
[![Lua](https://img.shields.io/badge/Lua-5.1+-0000AA?style=flat&logo=lua)](https://www.lua.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
![Status](<https://img.shields.io/badge/status-alpha%20(0.0.1)-orange>)

Astrodon is a reusable framework for building static sites using Deno and Lua. Use it as a library in your own projects to build and serve content, with Lua-powered templating/interpolation, optional image optimization, and performance tooling.

Note: This is an early alpha release (`0.0.1-alpha`). The API may change.

If you're looking for a reference implementation, see the example blog that uses Astrodon.

## ✨ Features

- **🚀 High Performance**: File caching, parallel processing, and response caching
- **📝 Markdown Support**: Write content in Markdown with YAML frontmatter
- **🔧 Lua Interpolation**: Dynamic content generation with `{{lua:script_name}}` syntax
- **🎨 Lua Templating**: Custom rendering logic with Lua scripts
- **🖼️ Image Optimization**: Automatic WebP conversion with `optimizt`
- **⚡ Performance Monitoring**: Built-in metrics and benchmarking tools
- **🎨 Clean Styling**: Beautiful, reading-optimized styling with dark/light themes
- **🌐 Development Server**: Live preview with hot reloading
- **📊 Real-time Metrics**: Build performance tracking and optimization insights

## 🚀 Quick Start (as a Framework)

### Prerequisites

- [Deno](https://deno.land/) (v1.40+)
- [Lua](https://www.lua.org/) (v5.1+)

### Install in your project

1. **Add Astrodon to your Deno project (using import maps or direct URL import):**

   Add to your `deno.json` import map:

   ```json
   {
     "imports": {
       "astrodon": "https://raw.githubusercontent.com/Nergy101/astrodon/main/mod.ts"
     }
   }
   ```

2. **Install image optimization tools** (optional but recommended):

   ```bash
   ./install-optimizt.sh
   # or manually: npm install -g @funboxteam/optimizt
   ```

3. **Use the API in your project:**

   Create `build.ts` in your site:

   ```ts
   #!/usr/bin/env -S deno run --allow-read --allow-write --allow-run
   import { build } from 'astrodon';

   await build({
     contentDir: new URL('./routes', import.meta.url).pathname,
     outDir: new URL('./dist', import.meta.url).pathname,
   });
   ```

   Create `serve.ts` in your site:

   ```ts
   #!/usr/bin/env -S deno run --allow-read --allow-net --allow-run
   import { serve } from 'astrodon';

   await serve({
     root: new URL('./dist', import.meta.url).pathname,
     port: 8000,
   });
   ```

4. **Build your site:**

   ```bash
   deno run -A build.ts
   ```

5. **Serve locally:**

   ```bash
   deno run -A serve.ts
   ```

6. **Open your browser** to `http://localhost:8000`

## 📁 Typical Project Structure (consumer project)

```
my-site/
├── routes/              # Your content (Markdown files)
│   ├── index.md        # Homepage
│   ├── index.lua       # Optional: custom rendering
│   └── about.md        # About page
├── lua-scripts/        # Lua interpolation scripts
│   ├── current_time.lua
│   ├── counter.lua
│   └── random_quote.lua
├── assets/             # Static assets (images, etc.)
│   └── sample.jpg
├── dist/               # Generated output (created by build)
├── build.ts            # Uses Astrodon.build
├── serve.ts            # Uses Astrodon.serve
├── optimization.config.json # Optional performance configuration
├── deno.json           # Deno configuration with import map
└── README.md
```

## ✍️ Writing Content (with Lua)

### Markdown with Dynamic Content

Create `.md` files in the `/routes/` directory with dynamic Lua interpolation:

```markdown
---
title: Welcome to My Blog
date: 2024-01-15
author: Your Name
tags: [blog, introduction]
---

# Welcome to My Blog

This post was generated on {{lua:current_time:friendly}}.

## Today's Programming Quote

> {{lua:random_quote}}

## Steps to Follow

{{lua:counter:Step,5}}

## Current Status

- **Time**: {{lua:current_time:time}}
- **Date**: {{lua:current_time:date}}
- **Timestamp**: {{lua:current_time:unix}}

![Sample Image](/assets/sample.jpg)
```

### Built-in Lua Scripts

**Time and Date:**

- `{{lua:current_time}}` - ISO format
- `{{lua:current_time:friendly}}` - Human-readable format
- `{{lua:current_time:local}}` - Local time format
- `{{lua:current_time:date}}` - Date only
- `{{lua:current_time:time}}` - Time only
- `{{lua:current_time:unix}}` - Unix timestamp

**Content Generation:**

- `{{lua:counter:Item,3}}` - Generates "Item 1, Item 2, Item 3"
- `{{lua:random_quote}}` - Returns a random programming quote

## 🛠️ Commands (consumer project)

```bash
deno run -A build.ts          # Build the site
deno run -A serve.ts          # Serve locally
deno task build:images        # Optional image optimization (if configured)
deno task benchmark           # Optional performance tests (if included)
```

## Running on a Custom Port

To start the server on a custom port (e.g., 5000), use the `--port` argument:

```bash
deno run --allow-read --allow-net --allow-run serve.ts --port=5000
```

This will start the development server at http://localhost:5000/

## ⚡ Performance Features

### Build Optimizations

- **File Caching**: SHA-256 hash-based caching (5min TTL)
- **Parallel Processing**: Concurrent file processing
- **Performance Monitoring**: Built-in metrics and slow file detection

### Server Optimizations

- **Response Caching**: In-memory cache with TTL
- **Compression**: Automatic response compression
- **Hardware Acceleration**: CSS optimizations for smooth animations

### Image Optimization

- **WebP Conversion**: Automatic conversion with `optimizt`
- **File Size Reduction**: 25-50% smaller images
- **Quality Preservation**: High visual quality maintained
- **Browser Compatibility**: Automatic fallback support

## 🎯 Performance Benchmarks

Run comprehensive performance tests:

```bash
deno task benchmark
```

**Expected Results:**

- **Build Performance**: 50-80% faster on subsequent builds
- **Server Performance**: 90%+ cache hit rate for static files
- **Image Optimization**: 25-50% smaller file sizes
- **Lua Execution**: 2-3x faster for time-related operations

## ⚙️ Configuration

Performance settings are configurable via `optimization.config.json`:

```json
{
  "build": {
    "cache": {
      "enabled": true,
      "ttl": 300000,
      "maxSize": 100
    },
    "parallel": {
      "enabled": true,
      "maxConcurrency": 4
    }
  },
  "server": {
    "cache": {
      "enabled": true,
      "ttl": 300000
    }
  }
}
```

## 📚 Documentation

- **[Lua Interpolation Guide](docs/LUA_INTERPOLATION.md)** - Dynamic content generation
- **[Lua Scripts Reference](docs/LUA_SCRIPTS_REFERENCE.md)** - Comprehensive script reference
- **[Performance Optimizations](docs/OPTIMIZATION.md)** - Detailed optimization documentation

## 📦 Publishing (JSR)

Astrodon is prepared for publishing to JSR as `0.0.1-alpha`.

Commands:

```bash
deno task jsr:login     # Authenticate once
deno task jsr:publish   # Publish the package
```

## 🚀 Deployment

After building (`deno task build`), upload the contents of `/dist/` to your web server.

**Popular hosting options:**

- [GitHub Pages](https://pages.github.com/)
- [Netlify](https://www.netlify.com/)
- [Vercel](https://vercel.com/)
- [AWS S3](https://aws.amazon.com/s3/)
- Any static hosting service

## 🔧 Troubleshooting

### Common Issues

**Lua not found:**

```bash
lua --version
# Install Lua if needed:
# macOS: brew install lua
# Ubuntu: sudo apt-get install lua5.1
```

**Build errors:**

- Check that all markdown files are valid
- Verify Lua scripts have proper syntax
- Ensure file permissions are correct

**Images not showing:**

- Ensure images are in `/assets/`
- Check that the build completed successfully
- Verify image paths in markdown are correct

**Performance issues:**

- Run `deno task benchmark` to identify bottlenecks
- Check cache settings in `optimization.config.json`
- Monitor memory usage with `deno task build:fast`

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines:

1. **Fork the repository**
2. **Create a feature branch**
3. **Make your changes**
4. **Add tests if applicable**
5. **Submit a pull request**

### Development Setup

```bash
# Clone the repository
git clone https://github.com/Nergy101/astrodon.git
cd astrodon

# Install dependencies
./install-optimizt.sh

# Run development server
deno task dev
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Deno](https://deno.land/) - JavaScript/TypeScript runtime
- [Lua](https://www.lua.org/) - Lightweight scripting language
- [PicoCSS](https://picocss.com/) - Minimal CSS framework
- [WASMOON](https://github.com/ceifa/wasmoon) - Lua in WebAssembly
- [Optimizt](https://github.com/funbox/optimizt) - Image optimization tool

## 📊 Project Status

- ✅ **Core Features**: Complete
- ✅ **Performance Optimizations**: Complete
- ✅ **Image Optimization**: Complete
- ✅ **Documentation**: Complete
- 🔄 **Testing**: In Progress
- 🔄 **CI/CD**: In Progress

---

**Built with ❤️ using Deno and Lua**
