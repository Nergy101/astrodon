# Lua Scripts Reference

This document provides a comprehensive reference for all available Lua scripts
in the `lua-scripts/` directory.

## 📋 Available Scripts

### current_time.lua

Returns the current time in various formats with optimized caching.

**Usage:**

```markdown
{{lua:current_time}} {{lua:current_time:friendly}} {{lua:current_time:local}}
{{lua:current_time:date}} {{lua:current_time:time}} {{lua:current_time:unix}}
```

**Parameters:**

- `friendly` - Human-readable format (e.g., "December 19, 2024 at 3:30 PM")
- `local` - Local time format (e.g., "2024-12-19 15:30:45")
- `date` - Date only (e.g., "2024-12-19")
- `time` - Time only (e.g., "15:30:45")
- `unix` - Unix timestamp (e.g., "1703001045")
- No parameter - ISO format (e.g., "2024-12-19T15:30:45Z")

**Example Output:**

```markdown
Current time: {{lua:current_time}} Build date: {{lua:current_time:date}}
Friendly time: {{lua:current_time:friendly}}
```

### counter.lua

Generates numbered lists with custom prefixes.

**Usage:**

```markdown
{{lua:counter:Item,3}} {{lua:counter:Step,5}} {{lua:counter:Task,4}}
```

**Parameters:**

- First parameter: Prefix text (e.g., "Item", "Step", "Task")
- Second parameter: Number of items to generate

**Example Output:**

```markdown
{{lua:counter:Item,3}}

# Output: Item 1, Item 2, Item 3

{{lua:counter:Step,5}}

# Output: Step 1, Step 2, Step 3, Step 4, Step 5
```

### random_quote.lua

Returns a random programming quote from a curated collection.

**Usage:**

```markdown
{{lua:random_quote}}
```

**Parameters:** None

**Example Output:**

```markdown
{{lua:random_quote}}

# Output: "Any fool can write code that a computer can understand. Good programmers write code that humans can understand." - Martin Fowler
```

### time_module.lua

Advanced time utilities with caching and multiple format support.

**Usage:**

```markdown
{{lua:time_module:format,timezone}} {{lua:time_module:rfc2822}}
{{lua:time_module:iso8601}}
```

**Parameters:**

- `format` - Time format (iso, local, utc, date, time, datetime, friendly)
- `timezone` - Timezone (utc, local)
- `rfc2822` - RFC 2822 format
- `iso8601` - ISO 8601 format

**Features:**

- Built-in caching for performance
- Multiple timezone support
- Extensive format options

### get_time.lua

Simple time utility for basic time operations.

**Usage:**

```markdown
{{lua:get_time}}
```

**Parameters:** None

**Example Output:**

```markdown
{{lua:get_time}}

# Output: Current timestamp
```

## 🔧 Creating Custom Scripts

### Script Structure

All Lua scripts must follow this structure:

```lua
-- lua-scripts/my_script.lua
function main(param1, param2)
    -- Your script logic here
    param1 = param1 or "default"
    param2 = tonumber(param2) or 1

    -- Return a string
    return "Your output here"
end
```

### Required Elements

1. **Function Name**: Must be `main`
2. **Parameters**: Accept any number of string parameters
3. **Return Value**: Must return a string
4. **File Location**: Must be in `./lua-scripts/` directory
5. **File Extension**: Must have `.lua` extension

### Example Custom Script

```lua
-- lua-scripts/weather.lua
function main(city, format)
    city = city or "Unknown"
    format = format or "simple"

    -- Simulate weather data
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

## 📊 Performance Considerations

### Built-in Optimizations

- **Time Module Caching**: `os.time()` calls are cached for 1 second
- **Script Result Caching**: Interpolation results cached during build
- **Parallel Processing**: Multiple scripts can execute concurrently

### Best Practices

1. **Keep scripts lightweight**: Avoid heavy computations
2. **Use caching**: Leverage built-in caching for expensive operations
3. **Validate parameters**: Always check and sanitize input
4. **Handle errors gracefully**: Provide fallback values
5. **Limit output size**: Keep script output reasonable

### Performance Guidelines

- **Simple operations**: < 10ms execution time
- **Medium operations**: 10-100ms execution time
- **Complex operations**: > 100ms (consider caching)
- **Memory usage**: Keep under 1MB per script execution

## 🔒 Security Considerations

### Execution Environment

- Scripts run in isolated WASMOON environment
- No file system access by default
- No network calls allowed
- Limited memory and execution time

### Input Validation

```lua
-- Good: Validate and sanitize input
function main(user_input)
    -- Validate input
    if not user_input or type(user_input) ~= "string" then
        return "Invalid input"
    end

    -- Sanitize input (remove potentially dangerous characters)
    user_input = string.gsub(user_input, "[<>\"']", "")

    return "Processed: " .. user_input
end
```

### Error Handling

```lua
-- Good: Handle errors gracefully
function main(param1, param2)
    local success, result = pcall(function()
        -- Your script logic here
        return "Success: " .. (param1 or "default")
    end)

    if success then
        return result
    else
        return "Error occurred"
    end
end
```

## 🧪 Testing Scripts

### Manual Testing

Test scripts independently before using in markdown:

```bash
# Test a script directly
lua lua-scripts/my_script.lua "param1" "param2"
```

### Build Testing

```bash
# Test during build process
deno task build

# Look for error messages in build output
```

### Performance Testing

```bash
# Run performance benchmarks
deno task benchmark

# Check for slow scripts in output
```

## 📝 Script Documentation

### Commenting Guidelines

```lua
-- lua-scripts/example.lua
--[[
    Example Script

    Purpose: Demonstrates script structure and documentation

    Parameters:
    - param1: First parameter (string)
    - param2: Second parameter (number, optional)

    Returns: Formatted string

    Usage:
    {{lua:example:Hello,3}}

    Example Output:
    Hello 1, Hello 2, Hello 3
--]]

function main(param1, param2)
    param1 = param1 or "default"
    param2 = tonumber(param2) or 1

    local result = ""
    for i = 1, param2 do
        if i > 1 then result = result .. ", " end
        result = result .. param1 .. " " .. i
    end

    return result
end
```

## 🔄 Script Updates

### Adding New Scripts

1. Create new `.lua` file in `lua-scripts/` directory
2. Follow the required structure
3. Add comprehensive documentation
4. Test thoroughly
5. Update this reference document

### Updating Existing Scripts

1. Maintain backward compatibility when possible
2. Update documentation
3. Test with existing usage
4. Consider performance impact

## 🚨 Common Issues

### Script Not Found

**Error:** `[Lua Script Not Found: script_name]`

**Solutions:**

- Check file exists in `lua-scripts/` directory
- Verify file has `.lua` extension
- Check file permissions

### Script Execution Error

**Error:** `[Lua Error: script_name]`

**Solutions:**

- Check Lua syntax
- Verify `main` function exists
- Check parameter handling
- Test script independently

### Performance Issues

**Symptoms:** Slow build times, high memory usage

**Solutions:**

- Optimize script logic
- Use caching for expensive operations
- Limit output size
- Check for infinite loops

## 📚 Additional Resources

- [Lua Programming Language](https://www.lua.org/)
- [Lua Reference Manual](https://www.lua.org/manual/)
- [WASMOON Documentation](https://github.com/ceifa/wasmoon)
- [Performance Best Practices](OPTIMIZATION.md)
