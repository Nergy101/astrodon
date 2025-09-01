# Lua Interpolation System

This document explains how to use the Lua interpolation system in your markdown
files for dynamic content generation.

## Overview

The Lua interpolation system allows you to embed the results of Lua script
execution directly into your markdown content during the build process. This
enables dynamic content generation similar to static site generators like Jekyll
or Hugo, but with the power and flexibility of Lua scripting.

## Syntax

### Basic Interpolation

Use `{{lua:script_name}}` to execute a Lua script and embed its output:

```markdown
The current time is: {{lua:current_time}}
```

### Parameter Passing

Pass parameters to Lua scripts using `{{lua:script_name:param1,param2}}`:

```markdown
Counter: {{lua:counter:Item,5}} Time in friendly format:
{{lua:current_time:friendly}}
```

## Available Scripts

### current_time.lua

Returns the current time in various formats with optimized caching.

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
- Date: `2024-12-19`
- Time: `15:30:45`
- Unix: `1703001045`

**Performance Features:**

- Cached `os.time()` calls (1-second cache duration)
- Optimized date parsing with single `os.date()` call
- Reduced function calls from 6 to 1 for component extraction

### counter.lua

Generates numbered lists with custom prefixes.

**Usage:**

- `{{lua:counter:Item,3}}` - Generates "Item 1, Item 2, Item 3"
- `{{lua:counter:Step,5}}` - Generates "Step 1, Step 2, Step 3, Step 4, Step 5"
- `{{lua:counter:Task,4}}` - Generates "Task 1, Task 2, Task 3, Task 4"

**Parameters:**

- First parameter: Prefix text (e.g., "Item", "Step", "Task")
- Second parameter: Number of items to generate

### random_quote.lua

Returns a random programming quote from a curated collection.

**Usage:**

- `{{lua:random_quote}}` - Returns a random quote

**Example Output:**

```
"Any fool can write code that a computer can understand. Good programmers write code that humans can understand." - Martin Fowler
```

### time_module.lua

Advanced time utilities with caching and multiple format support.

**Usage:**

- `{{lua:time_module:format,timezone}}` - Custom format and timezone
- `{{lua:time_module:rfc2822}}` - RFC 2822 format
- `{{lua:time_module:iso8601}}` - ISO 8601 format

**Features:**

- Built-in caching for performance
- Multiple timezone support
- Extensive format options

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

### Advanced Script Example

```lua
-- lua-scripts/weather.lua
function main(city, format)
    city = city or "Unknown"
    format = format or "simple"

    -- Simulate weather data (in real usage, you might call an API)
    local weather_data = {
        ["New York"] = { temp = 72, condition = "Sunny" },
        ["London"] = { temp = 55, condition = "Rainy" },
        ["Tokyo"] = { temp = 68, condition = "Cloudy" }
    }

    local data = weather_data[city] or { temp = 70, condition = "Unknown" }

    if format == "detailed" then
        return string.format("Weather in %s: %d°F, %s", city, data.temp, data.condition)
    else
        return string.format("%s: %d°F", city, data.temp)
    end
end
```

**Usage:**

```markdown
{{lua:weather:New York,detailed}} {{lua:weather:London}}
```

## How It Works

1. **Build Time Processing**: During the build process, the system scans
   markdown files for `{{lua:...}}` patterns
2. **Script Execution**: For each pattern found, the corresponding Lua script is
   executed using WASMOON
3. **Output Replacement**: The script's output replaces the interpolation
   pattern
4. **Markdown Processing**: The processed content continues through the normal
   markdown-to-HTML pipeline
5. **Caching**: Results are cached for performance optimization

## Performance Optimizations

### Built-in Optimizations

- **Time Module Caching**: `os.time()` calls are cached for 1 second
- **Optimized Date Parsing**: Single `os.date()` call with pattern matching
- **Script Result Caching**: Interpolation results are cached during build
- **Parallel Processing**: Multiple interpolations can be processed concurrently

### Best Practices for Performance

1. **Keep scripts lightweight**: Avoid heavy computations in interpolation
   scripts
2. **Use caching**: Leverage the built-in caching for expensive operations
3. **Validate parameters**: Always check and sanitize input parameters
4. **Handle errors gracefully**: Provide fallback values for missing data
5. **Limit output size**: Keep script output reasonable to avoid memory issues

## Security Considerations

- Only scripts in the `./lua-scripts/` directory can be executed
- Scripts are executed in a controlled WASMOON environment
- Output is limited to prevent excessive content generation
- Parameters are passed as strings and should be validated within scripts
- No file system access or network calls are allowed by default

## Error Handling

If a script fails or doesn't exist, the interpolation will be replaced with an
error message:

- `[Lua Script Not Found: script_name]` - Script file doesn't exist
- `[Lua Error: script_name]` - Script execution failed
- `[Lua Timeout: script_name]` - Script execution timed out

## Advanced Usage Examples

### Blog Post with Dynamic Content

```markdown
---
title: "My Blog Post"
date: "2024-12-19"
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

## Dynamic List

Here are today's tasks:

{{lua:counter:Task,3}}
```

### Documentation with Live Examples

```markdown
# API Documentation

## Current Server Status

- **Build Time**: {{lua:current_time:friendly}}
- **Server Uptime**: {{lua:time_module:uptime}}

## Quick Start Steps

{{lua:counter:Step,4}}

## API Endpoints

1. **Authentication**: {{lua:counter:Endpoint,3}}
2. **Data Operations**: {{lua:counter:Operation,5}}
```

### E-commerce Product Page

```markdown
# Product Catalog

## Today's Special Offers

Generated on {{lua:current_time:date}} at {{lua:current_time:time}}

## Featured Products

{{lua:counter:Product,6}}

## Customer Reviews

> {{lua:random_quote}}
```

## Troubleshooting

### Common Issues

1. **Script not found**: Ensure the script file exists in `./lua-scripts/`
2. **Parameter errors**: Check that parameters are passed correctly
3. **Performance issues**: Use caching and optimize script logic
4. **Output formatting**: Ensure scripts return clean, HTML-safe strings

### Debugging Tips

1. **Test scripts independently**: Run Lua scripts outside the build process
2. **Check build logs**: Look for error messages in build output
3. **Validate syntax**: Ensure Lua syntax is correct
4. **Monitor performance**: Use `deno task benchmark` to identify slow scripts

## Future Enhancements

Planned improvements for the Lua interpolation system:

1. **Async Script Support**: Allow scripts to perform async operations
2. **Template Inheritance**: Support for script templates and inheritance
3. **Advanced Caching**: More sophisticated caching strategies
4. **Script Libraries**: Shared script libraries and utilities
5. **Hot Reloading**: Development-time script reloading
6. **Performance Profiling**: Detailed script performance metrics

## Contributing

When adding new scripts:

1. **Follow naming conventions**: Use descriptive, lowercase names
2. **Include documentation**: Add usage examples in script comments
3. **Test thoroughly**: Ensure scripts work with various parameters
4. **Consider performance**: Optimize for speed and memory usage
5. **Handle errors**: Provide meaningful error messages
