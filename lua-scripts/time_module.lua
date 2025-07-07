-- Lua WASM module for getting current time
-- This module will be compiled to WASM and called from JavaScript

-- Function to get current time as a string
function get_current_time()
    local time = os.time()
    local formatted_time = os.date("%Y-%m-%d %H:%M:%S", time)
    return formatted_time
end

-- Function to get current timestamp
function get_timestamp()
    return os.time()
end

-- Function to get time components
function get_time_components()
    local time = os.time()
    local components = {
        year = tonumber(os.date("%Y", time)),
        month = tonumber(os.date("%m", time)),
        day = tonumber(os.date("%d", time)),
        hour = tonumber(os.date("%H", time)),
        minute = tonumber(os.date("%M", time)),
        second = tonumber(os.date("%S", time))
    }
    return components
end

-- Export functions for WASM
return {
    get_current_time = get_current_time,
    get_timestamp = get_timestamp,
    get_time_components = get_time_components
} 