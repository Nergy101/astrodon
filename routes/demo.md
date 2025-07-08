---
title: Demo - Markdown & Lua Interpolation Showcase
date: 2025-07-07
author: Christian / Nergy101
tags: [demo, markdown, lua, interpolation, showcase]
---

# Demo - Markdown & Lua Interpolation Showcase

Welcome to the comprehensive demo page! This showcases **all the different markdown features** combined with **dynamic Lua interpolation**.

## Dynamic Content with Lua

**Today's Programming Quote:**

> {{lua:random_quote}}

**Current Time UTC:** {{lua:current_time:friendly}}

## Text Formatting

Let's start with **bold text** and _italic text_. We can also use **_bold italic_** for emphasis.

~~Strikethrough text~~ shows deleted content, while `inline code` highlights technical terms.

### Subheadings and Lists

Here's an unordered list:

- First item
- Second item with **bold text**
- Third item with _italic text_
- Fourth item with `code`

And an ordered list:

1. First numbered item
2. Second numbered item
3. Third numbered item
   1. Nested item
   2. Another nested item

## Dynamic Counters

**Simple Counter:** {{lua:counter:Item,3}}

**Step Counter:** {{lua:counter:Step,5}}

**Custom Counter:** {{lua:counter:Task,4}}

## Code Blocks

### TypeScript Example

```typescript
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';

const handler = async (req: Request): Promise<Response> => {
  const currentTime = new Date().toISOString();
  return new Response(`Current time: ${currentTime}`, {
    headers: { 'content-type': 'text/plain' },
  });
};

await serve(handler, { port: 8000 });
```

### Lua Example

```lua
-- template.lua
function greet(name)
    return "Hello, " .. name .. " from Lua!"
end

print(greet("World"))
```

This will show the time the page was rendered, using Lua running in the browser via WASM.

## Time Formats Showcase

**Local Format:** {{lua:current_time:local}}

**Date Only:** {{lua:current_time:date}}

**Time Only:** {{lua:current_time:time}}

**Unix Timestamp:** {{lua:current_time:unix}}

## Tables

| Feature            | Deno          | Lua            | JavaScript    |
| ------------------ | ------------- | -------------- | ------------- |
| **Type Safety**    | ✅ TypeScript | ❌ Dynamic     | ✅ TypeScript |
| **Performance**    | ⚡ Fast       | ⚡ Fast        | 🐌 Slower     |
| **Ecosystem**      | 📦 Modern     | 📦 Lightweight | 📦 Huge       |
| **Learning Curve** | 📈 Moderate   | 📈 Easy        | 📈 Moderate   |

## Links and Images

Here are some useful links:

- [Deno Documentation](https://deno.land/manual)
- [Lua Documentation](https://www.lua.org/manual/5.4/)
- [Markdown Guide](https://www.markdownguide.org/)

![Project Logo](/assets/nemic-logos/logo.png)

## Blockquotes

> This is a simple blockquote.

> This is a blockquote with **bold text** and `inline code`.

Or multiple lines

> This is a blockquote. If the content is long enough, and its really needed,
> it can span multiple lines.

## Horizontal Rules

---

## Task Lists

- [x] Set up Deno project
- [x] Create basic web server
- [x] Integrate Lua scripts
- [x] Add markdown support
- [x] Implement Lua interpolation
- [ ] Implement WebSocket connections
- [ ] Add database integration
- [ ] Create custom Lua modules

## Dynamic List Generation

Here's a dynamic list of items:

{{lua:counter:Feature,6}}

## Real-time Status

- **Build Time:** {{lua:current_time:friendly}}
- **Current Date:** {{lua:current_time:date}}
- **Current Time:** {{lua:current_time:time}}
- **Unix Timestamp:** {{lua:current_time:unix}}

## Definition Lists

Term 1
: Definition 1 with **bold text** and `code`.

Term 2
: Definition 2 with _italic text_.

## Abbreviations

\_[HTML]: HyperText Markup Language
\_[CSS]: Cascading Style Sheets
\_[API]: Application Programming Interface

The HTML and CSS are used to style this page, while the API provides dynamic content.

## Performance Benefits

- **Fast startup times** - Deno starts up quickly[^1]
- **Type safety** - TypeScript provides excellent developer experience
- **Lua integration** - Lightweight scripting when needed[^2]
- **Modern tooling** - Built-in formatter, linter, and test runner

[^1]: Deno's startup time is typically under 50ms, making it ideal for CLI tools and microservices.
[^2]: Lua is one of the fastest scripting languages, with a small memory footprint and excellent performance characteristics.

## How Lua Interpolation Works

This page uses the `{{lua:script_name}}` syntax to embed Lua script results directly in the markdown. During the build process:

1. The system finds all `{{lua:...}}` patterns
2. Executes the corresponding Lua scripts
3. Replaces the patterns with the script output
4. Processes the result through the markdown pipeline

The dynamic content you see above is generated fresh each time the site is built!

## What's Next?

I'm excited to explore more advanced features like:

- WebSocket connections
- File system operations
- Database integrations
- Custom Lua modules

## Stay tuned for more updates!

## Thanks for reading!

[Back to Home](/)

---

_This page demonstrates all major markdown features including headings, text formatting, lists, code blocks, tables, links, images, blockquotes, task lists, mathematical expressions, footnotes, and dynamic Lua interpolation!_
