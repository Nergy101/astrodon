---
title: Retro Ranker
date: 2025-04-03
author: Christian / Nergy101
tags: [deno, retroranker, hobby]
---

# Building Retro Ranker with Deno Fresh: A Developer's Journey

When I started building [Retro Ranker](https://retroranker.site) — a platform for ranking and comparing retro gaming devices — I wanted a fast, modern, and SEO-friendly web framework. After evaluating several options, I chose Deno Fresh, and this post dives into my experience with it.

**Note:** Some screenshots contain paths within the GitHub repo.

## Table of Contents

- [Building Retro Ranker with Deno Fresh: A Developer's Journey](#building-retro-ranker-with-deno-fresh-a-developers-journey)
  - [Table of Contents](#table-of-contents)
  - [Introduction](#introduction)
  - [Key Benefits of Using Deno Fresh](#key-benefits-of-using-deno-fresh)
    - [Developer Experience](#developer-experience)
    - [Islands Architecture](#islands-architecture)
    - [Built-in TypeScript Support](#built-in-typescript-support)
    - [Performance](#performance)
  - [Common Challenges (and How I Solved Them)](#common-challenges-and-how-i-solved-them)
    - [Third-Party Library Integration](#third-party-library-integration)
    - [State Management](#state-management)
    - [Deployment](#deployment)
    - [Integrating PocketBase](#integrating-pocketbase)
  - [Conclusion](#conclusion)

---

## Introduction

The decision to use Deno Fresh was driven by several key factors. First and foremost, I wanted a framework that would allow me to build a fast, SEO-friendly website without the complexity of traditional server-side rendering solutions. Deno Fresh's zero-configuration approach and built-in TypeScript support made it an attractive choice.

The framework's "islands architecture" was particularly appealing for my use case. Retro Ranker needed to be interactive while maintaining excellent performance, and Fresh's approach of only hydrating the parts of the page that need interactivity (islands) while keeping the rest static was perfect for this balance.

## Key Benefits of Using Deno Fresh

### Developer Experience

The developer experience with Deno Fresh was outstanding. The framework's file-based routing system made it incredibly intuitive to organize my application. Creating new routes was as simple as adding files to the `routes` directory.

### Islands Architecture

The 'islands' architecture was a game-changer for performance optimization. I could keep most of my pages static while adding interactivity only where needed. For example, the device comparison feature uses islands for interactive charts and filtering.

Besides islands, there's also 'normal' server-side rendered components. This leads to a pattern where data is retrieved server-side and passed to:

- **Page 'static' components**
- **Server-side 'static' components**
- **Client-side island 'interactive' components**

Which is quite a different world when you're used to writing fully client-side applications with the likes of React, Angular, and Vue.

### Built-in TypeScript Support

Having TypeScript support out of the box was invaluable. The type safety helped catch potential issues early in development, and the excellent IDE integration made refactoring a breeze. This came in handy not just within the code itself, but also for the local developer experience and CI/CD, which uses Deno to run separate typescript-scripts. Think of:

- Fetching device information from the community data source
- Scraping the required device images
- Saving all data to a local json file ('cache') and PocketBase

### Performance

The performance benefits were immediately noticeable. Pages loaded quickly, and the partial hydration model meant that interactive elements didn't slow down the entire page. This was particularly important for Retro Ranker, which features complex device comparison charts and filtering systems.

## Common Challenges (and How I Solved Them)

### Third-Party Library Integration

One of the main challenges was integrating third-party libraries. While Deno's import system is powerful, some npm packages require additional configuration. I solved this by using the `deno.json` configuration file to map imports from different sources like `deno.land`, `esm.sh`, `jsr` and `npm`:

```json
{
  "imports": {
    "preact": "https://esm.sh/preact@10.19.6",
    "preact/": "https://esm.sh/preact@10.19.6/",
    "preact-render-to-string": "https://esm.sh/*preact-render-to-string",
    "@preact/signals": "https://esm.sh/*@preact/signals",
    "@preact/signals-core": "https://esm.sh/*@preact/signals-core"
  }
}
```

### State Management

Managing state across islands required careful consideration. I ended up using Preact Signals for reactive state management, which worked well with Fresh's architecture:

```typescript
import { signal } from '@preact/signals';

// Global state management
export const selectedDevices = signal<Device[]>([]);
export const comparisonMode = signal<'chart' | 'table'>('chart');
```

### Deployment

Deploying to production was initially challenging, but the Fresh team's documentation and the Deno Deploy platform made it straightforward. I used a Dockerfile for containerization:

```dockerfile
FROM denoland/deno:1.40

WORKDIR /app
COPY . .

RUN deno cache main.ts

EXPOSE 8000

CMD ["deno", "run", "--allow-net", "--allow-read", "--allow-env", "main.ts"]
```

### Integrating PocketBase

The integration was implemented through a custom `PocketBaseService` that handles all interactions with the Pocketbase instance. What makes this setup particularly elegant is how it leverages Deno's native TypeScript support and Fresh's server-side capabilities.

The service provides a three-tier authentication model using `PocketBaseService`, which handles all data access:

1. **Public access** – for read-only operations (like device browsing)
2. **Authenticated users** – for personal collections, likes, saves, and comments
3. **Superuser access** – for admin-level tasks like analytics, bulk queries, and cross-user queries

This approach works despite PocketBase not being designed for server-side use. With Deno's native TypeScript and cookie handling, I made it secure and functional, even if not the cleanest solution.

## Conclusion

Would I use Deno Fresh again? **Absolutely.** For content-heavy projects that need high performance and great DX, it's hard to beat.

It's particularly well-suited for:

- ✅ Content-heavy websites that need SEO optimization
- ✅ Applications requiring partial interactivity
- ✅ Projects where TypeScript is a priority
- ✅ Developers who value simplicity and convention over configuration

🕹️ **If you're building a modern, SEO-optimized site with partial interactivity — and love working with TypeScript — give Deno Fresh a shot.**
