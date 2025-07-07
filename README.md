# Deno+Lua Static Site Generator

[![Deno](https://img.shields.io/badge/Deno-1.40+-000000?style=flat&logo=deno)](https://deno.land/)
[![Lua](https://img.shields.io/badge/Lua-5.1+-0000AA?style=flat&logo=lua)](https://www.lua.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A high-performance static site generator built with Deno and Lua templating, featuring advanced interpolation, image optimization, and comprehensive performance monitoring.

## ✨ Features

- **🚀 High Performance**: File caching, parallel processing, and response caching
- **📝 Markdown Support**: Write content in Markdown with YAML frontmatter
- **🔧 Lua Interpolation**: Dynamic content generation with `{{lua:script_name}}` syntax
- **🎨 Lua Templating**: Custom rendering logic with Lua scripts
- **🖼️ Image Optimization**: Automatic WebP conversion with `optimizt`
- **⚡ Performance Monitoring**: Built-in metrics and benchmarking tools
- **🎨 PicoCSS**: Beautiful, classless styling that looks great out of the box
- **🌐 Development Server**: Live preview with hot reloading
- **📊 Real-time Metrics**: Build performance tracking and optimization insights

## 🚀 Quick Start

### Prerequisites

- [Deno](https://deno.land/) (v1.40+)
- [Lua](https://www.lua.org/) (v5.1+)

### Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/Nergy101/astrodon.git
   cd astrodon
   ```

2. **Install image optimization tools** (optional but recommended):

   ```bash
   ./install-optimizt.sh
   # or manually: npm install -g @funboxteam/optimizt
   ```

3. **Build your site:**

   ```bash
   deno task build
   ```

4. **Serve locally:**

   ```bash
   deno task serve
   ```

5. **Open your browser** to `http://localhost:8000`

## 📁 Project Structure

```
deno-lua/
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
├── docs/               # Documentation
│   ├── README.md
│   ├── LUA_INTERPOLATION.md
│   └── OPTIMIZATION.md
├── build.ts            # Build script with optimizations
├── serve.ts            # Development server with caching
├── performance-test.ts # Performance benchmarking
├── optimization.config.json # Performance configuration
├── deno.json           # Deno configuration
└── README.md           # This file
```

## ✍️ Writing Content

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

## 🛠️ Available Commands

```bash
# Build the site
deno task build

# Build with image optimization
deno task build:images

# Build and watch for changes
deno task dev

# Serve the built site locally
deno task serve

# Run performance benchmarks
deno task benchmark

# Build with increased memory limit
deno task build:fast

# Production server with increased memory
deno task serve:prod
```

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
