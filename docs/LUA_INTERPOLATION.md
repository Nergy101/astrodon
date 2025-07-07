# Lua Interpolation System

This document explains how to use the Lua interpolation system in your markdown files.

## Overview

The Lua interpolation system allows you to embed the results of Lua script execution directly into your markdown content during the build process. This is similar to how static site generators like Jekyll or Hugo handle template variables.

## Syntax

### Basic Interpolation

Use `{{lua:script_name}}` to execute a Lua script and embed its output:

```markdown
The current time is: {{lua:current_time}}
```

### Parameter Passing

Pass parameters to Lua scripts using `{{lua:script_name:param1,param2}}`:

```markdown
Counter: {{lua:counter:Item,5}}
Time in friendly format: {{lua:current_time:friendly}}
```

## Available Scripts

### current_time.lua

Returns the current time in various formats.

**Usage:**

- `{{lua:current_time}}` - ISO format (default)
- `{{lua:current_time:friendly}}` - Human-readable format
- `{{lua:current_time:local}}` - Local time format
- `{{lua:current_time:date}}` - Date only
- `{{lua:current_time:time}}` - Time only
- `{{lua:current_time:unix}}` - Unix timestamp

**Example Output:**

- ISO: `2024-12-19T15:30:45Z`
- Friendly: `December 19, 2024 at 3:30 PM`
- Local: `2024-12-19 15:30:45`

### counter.lua

Generates numbered lists with custom prefixes.

**Usage:**

- `{{lua:counter:Item,3}}` - Generates "Item 1, Item 2, Item 3"
- `{{lua:counter:Step,5}}` - Generates "Step 1, Step 2, Step 3, Step 4, Step 5"

### random_quote.lua

Returns a random programming quote.

**Usage:**

- `{{lua:random_quote}}` - Returns a random quote

## Creating Custom Scripts

To create your own Lua script for interpolation:

1. Create a new file in the `./lua-scripts/` directory with a `.lua` extension
2. Define a `main` function that accepts parameters and returns a string
3. Use the script in your markdown with `{{lua:script_name}}`

### Example Script

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

## How It Works

1. **Build Time Processing**: During the build process, the system scans markdown files for `{{lua:...}}` patterns
2. **Script Execution**: For each pattern found, the corresponding Lua script is executed
3. **Output Replacement**: The script's output replaces the interpolation pattern
4. **Markdown Processing**: The processed content continues through the normal markdown-to-HTML pipeline

## Security Considerations

- Only scripts in the `./lua-scripts/` directory can be executed
- Scripts are executed in a controlled environment
- Output is limited to prevent excessive content generation
- Parameters are passed as strings and should be validated within scripts

## Error Handling

If a script fails or doesn't exist, the interpolation will be replaced with an error message:

- `[Lua Script Not Found: script_name]` - Script file doesn't exist
- `[Lua Error: script_name]` - Script execution failed

## Best Practices

1. **Keep scripts simple**: Focus on generating content, not complex logic
2. **Validate parameters**: Always check and sanitize input parameters
3. **Handle errors gracefully**: Provide fallback values for missing data
4. **Cache expensive operations**: If a script does heavy computation, consider caching results
5. **Document your scripts**: Include usage examples in script comments

## Examples

### Blog Post with Dynamic Content

```markdown
---
title: 'My Blog Post'
date: '2024-12-19'
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
```

This will generate dynamic content that updates each time the site is built.
