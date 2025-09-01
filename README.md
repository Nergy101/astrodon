# Astrodon

Astrodon is a tiny Deno + Lua static site toolkit. Build markdown with optional Lua-powered interpolation, and serve the output with a minimal dev server. Keep your site simple, fast, and readable.

## Quick start

1. Install Deno 1.40+ and (optionally) Lua 5.1+

2. Add import map

```json
{
  "imports": {
    "astrodon": "https://raw.githubusercontent.com/Nergy101/astrodon/main/mod.ts"
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
deno run -A build.ts
deno run -A serve.ts
# open http://localhost:8000
```

## Project layout (consumer)

```
my-site/
├─ routes/               # Markdown content
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

## Optional image optimization

Install `optimizt` once to convert images to WebP during build:

```bash
./install-optimizt.sh
# or: npm i -g @funboxteam/optimizt
```

## Commands

```bash
deno run -A build.ts          # Build
deno run -A serve.ts          # Serve locally (use --port=5000 to change)
```

## Configuration (minimal)

Use `optimization.config.json` if you want simple tuning:

```json
{
  "build": { "parallel": { "enabled": true, "maxConcurrency": 4 } },
  "server": { "cache": { "enabled": true, "ttl": 300000 } }
}
```

## Troubleshooting

- Missing Lua: `brew install lua` (or your OS package manager)
- Images not showing: check files in `assets/` and rebuild
- Custom port: `deno run -A serve.ts --port=5000`

## License

MIT
