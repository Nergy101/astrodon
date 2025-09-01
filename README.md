# Astrodon

Astrodon is a tiny Deno + Lua static site toolkit. Build markdown with optional Lua-powered interpolation, and serve the output with a minimal dev server. Keep your site simple, fast, and readable.

See my blog for example usage: https://github.com/Nergy101/blog

## Quick start

1. Install Deno 1.40+ and (optionally) Lua 5.1+

2. Create `deno.json` with JSR import + tasks (Blog-style)

```json
{
  "tasks": {
    "build": "deno run --allow-read --allow-write --allow-run build.ts",
    "serve": "deno run --allow-read --allow-net --allow-run serve.ts",
    "dev": "deno task build && deno task serve"
  },
  "imports": {
    "astrodon": "jsr:@nergy101/astrodon@0.1.6"
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

## Project layout (consumer)

```
my-site/
├─ routes/               # Markdown content
├─ components/           # HTML partials (header, footer, nav, etc.)
├─ lua-scripts/          # Optional Lua scripts
├─ assets/               # Static files
├─ dist/                 # Build output
├─ build.ts
├─ serve.ts
└─ deno.json
```

## Markdown + Lua interpolation

Write markdown and embed dynamic bits using `{{lua:...}}`. Results are computed at build-time.

```markdown
---
title: Welcome
---

# Hello

Generated on {{lua:current_time:friendly}}

Steps: {{lua:counter:Step,3}}

Quote: {{lua:random_quote}}
```

Built‑in scripts:

- current_time: `iso`, `friendly`, `local`, `date`, `time`, `unix`
- counter: `{{lua:counter:Label,count}}`
- random_quote: `{{lua:random_quote}}`

Create your own in `lua-scripts/*.lua` with a `main(...)` function that returns a string.

```lua
-- lua-scripts/example.lua
function main(label, n)
  label = label or "Item"
  n = tonumber(n) or 3
  local out = {}
  for i=1,n do out[i] = label .. " " .. i end
  return table.concat(out, ", ")
end
```

## Runtime Lua APIs (dev server)

When using the dev server, you can also fetch dynamic values at runtime (as used in the Blog):

- `GET /lua-scripts/time/:format` → `{ "time": string }`
  - **format**: `iso | local | utc | date | time | datetime | friendly`
- `POST /lua-scripts/lua-execute` → `{ "result": string }`
  - body: `{ "module": "render-time|current-time|counter|random-quote|time-module", "context": { ... } }`

Example (client):

```js
const res = await fetch('/lua-scripts/time/friendly');
const { time } = await res.json();
document.querySelector('#dynamic-time').textContent = time;
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

Within the /Components folder you can create custom templates for:

- navbar.html

## Troubleshooting

- Missing Lua: `brew install lua` (or your OS package manager)
- Images not showing: check files in `assets/` and rebuild
- Custom port: `deno run -A serve.ts --port=5000`

## License

MIT
