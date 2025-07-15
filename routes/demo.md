---
title: Demo - Markdown & Lua Interpolation Showcase
date: 2025-01-15
author: Christian / Nergy101
tags: [demo, markdown, lua, interpolation, showcase, hybrid, static, dynamic]
---

# Demo - Markdown & Lua Interpolation Showcase

Welcome to the comprehensive demo page! This showcases **all the different markdown features** combined with **dynamic Lua interpolation** using both build-time and runtime execution.

## 🎯 The Hybrid Approach

This demo demonstrates two approaches to Lua integration:

- **Static Content (Build-time)**: Processed once during build, cached for performance
- **Dynamic Content (Runtime)**: Executed on every page request, always fresh

---

## Dynamic Content with Lua

### Build-time Interpolation (Static)

**Today's Programming Quote:**

> {{lua:random_quote}}

**Build Time:** {{lua:current_time:friendly}}

**Static Counter:** {{lua:counter:Step,5}}

### Runtime Interpolation (Dynamic)

**Current Time:** <span id="dynamic-time">Loading...</span>

**Live Counter:** <span id="dynamic-counter">Loading...</span>

**Live Quote:** <span id="dynamic-quote">Loading...</span>

---

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
-- lua-scripts/current_time.lua
function main(format)
    local time = os.time()
    if format == "friendly" then
        return os.date("!%B %d, %Y at %I:%M %p", time)
    elseif format == "iso" then
        return os.date("!%Y-%m-%dT%H:%M:%SZ", time)
    else
        return os.date("!%Y-%m-%d %H:%M:%S", time)
    end
end
```

This Lua script is executed server-side using WASMOON for secure execution.

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
- [x] Add server-side Lua execution
- [ ] Implement WebSocket connections
- [ ] Add database integration
- [ ] Create custom Lua modules

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
- **Server-side execution** - Secure Lua execution with WASMOON
- **Build-time caching** - Static content for optimal performance

[^1]: Deno's startup time is typically under 50ms, making it ideal for CLI tools and microservices.
[^2]: Lua is one of the fastest scripting languages, with a small memory footprint and excellent performance characteristics.

## How Lua Interpolation Works

### Build-time Processing

This page uses the `{{lua:script_name}}` syntax to embed Lua script results directly in the markdown. During the build process:

1. The system finds all `{{lua:...}}` patterns
2. Executes the corresponding Lua scripts using the local Lua interpreter
3. Replaces the patterns with the script output
4. Processes the result through the markdown pipeline

### Runtime Processing

For dynamic content, the system provides API endpoints:

- **Time API:** `/lua-scripts/time/{format}` - Get current time in various formats
- **Module API:** `/lua-scripts/lua-execute` - Execute Lua modules with context

All runtime Lua execution happens server-side using WASMOON for security and performance.

## API Usage Examples

### Direct API Calls

```bash
# Get current time in different formats
curl http://localhost:8000/lua-scripts/time/iso
curl http://localhost:8000/lua-scripts/time/friendly
curl http://localhost:8000/lua-scripts/time/datetime

# Execute Lua modules
curl -X POST http://localhost:8000/lua-scripts/lua-execute \
  -H "Content-Type: application/json" \
  -d '{"module":"random-quote","context":{}}'

# Execute counter with parameters
curl -X POST http://localhost:8000/lua-scripts/lua-execute \
  -H "Content-Type: application/json" \
  -d '{"module":"counter","context":{"prefix":"Step","count":3}}'
```

### JavaScript Fetch Examples

```javascript
// Get current time
fetch('/lua-scripts/time/friendly')
  .then(response => response.json())
  .then(data => console.log(data.time));

// Execute module
fetch('/lua-scripts/lua-execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    module: 'random-quote',
    context: {},
  }),
})
  .then(response => response.json())
  .then(data => console.log(data.result));
```

## Available Lua Scripts

### Built-in Scripts

- `current_time` - Get current time in various formats
- `counter` - Generate numbered lists with custom prefix
- `random_quote` - Get random programming quotes
- `time_module` - Advanced time functions

### Creating Custom Scripts

To create your own Lua script for interpolation:

1. Create a new file in the `./lua-scripts/` directory with a `.lua` extension
2. Define a `main` function that accepts parameters and returns a string
3. Use the script in your markdown with `{{lua:script_name}}`

**Example Script:**

```lua
-- lua-scripts/example.lua
function main(param1, param2)
    param1 = param1 or "default"
    param2 = tonumber(param2) or 1

    local result = ""
    for i = 1, param2 do
        if i > 1 then
            result = result .. ", "
        end
        result = result .. param1 .. " " .. i
    end

    return result
end
```

**Usage in markdown:**

```markdown
{{lua:example:Hello,3}}
```

**Output:**

```
Hello 1, Hello 2, Hello 3
```

## Performance Benefits

### Build-time Caching (Static Content)

- ✅ **Fast page loads** - No Lua execution on requests
- ✅ **Reduced server load** - Cached results served instantly
- ✅ **Better SEO** - Content available immediately
- ✅ **Lower bandwidth** - No repeated API calls

### Runtime Execution (Dynamic Content)

- ✅ **Always fresh data** - Real-time updates
- ✅ **Interactive experience** - Live clocks, counters, etc.
- ✅ **User-specific content** - Can respond to user actions
- ✅ **Flexible updates** - Configurable intervals

## Security Considerations

- Only scripts in the `./lua-scripts/` directory can be executed
- Runtime scripts are executed in a controlled WASMOON environment
- Output is limited to prevent excessive content generation
- Parameters are passed as strings and should be validated within scripts
- No file system access or network calls are allowed by default

## Best Practices

### When to Use Static (Build-time)

- Content that doesn't change frequently
- SEO-critical information
- Performance-critical pages
- Content that's the same for all users

### When to Use Dynamic (Runtime)

- Real-time data (clocks, live feeds)
- User-specific content
- Interactive elements
- Content that changes frequently
- API-driven applications

## What's Next?

I'm excited to explore more advanced features like:

- WebSocket connections
- File system operations
- Database integrations
- Custom Lua modules
- Enhanced caching strategies

## Thanks for reading!

[Back to Home](/)

---

_This page demonstrates all major markdown features including headings, text formatting, lists, code blocks, tables, links, images, blockquotes, task lists, footnotes, and both build-time and runtime Lua interpolation!_
