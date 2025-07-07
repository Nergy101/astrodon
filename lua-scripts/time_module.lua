-- Optimized Lua WASM module for getting current time
-- This module will be compiled to WASM and called from JavaScript

-- Cache for time values to avoid multiple os.time() calls
local time_cache = {
    timestamp = nil,
    last_update = 0,
    cache_duration = 1 -- Cache for 1 second
}

-- Get cached or fresh timestamp
local function get_cached_time()
    local current_time = os.time()
    if not time_cache.timestamp or (current_time - time_cache.last_update) >= time_cache.cache_duration then
        time_cache.timestamp = current_time
        time_cache.last_update = current_time
    end
    return time_cache.timestamp
end

-- Function to get current time as a string
function get_current_time()
    local time = get_cached_time()
    return os.date("%Y-%m-%d %H:%M:%S", time)
end

-- Function to get current timestamp
function get_timestamp()
    return get_cached_time()
end

-- Function to get time components (optimized to use single os.date call)
function get_time_components()
    local time = get_cached_time()
    local date_str = os.date("%Y-%m-%d-%H-%M-%S", time)
    local year, month, day, hour, minute, second = date_str:match("(%d+)-(%d+)-(%d+)-(%d+)-(%d+)-(%d+)")
    
    return {
        year = tonumber(year),
        month = tonumber(month),
        day = tonumber(day),
        hour = tonumber(hour),
        minute = tonumber(minute),
        second = tonumber(second)
    }
end

-- Export functions for WASM
return {
    get_current_time = get_current_time,
    get_timestamp = get_timestamp,
    get_time_components = get_time_components
} 