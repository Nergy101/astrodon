local os = require("os")

-- Function to get current time in different formats
function main(format)
    format = format or "iso"
    
    if format == "iso" then
        return os.date("!%Y-%m-%dT%H:%M:%SZ")
    elseif format == "local" then
        return os.date("%Y-%m-%d %H:%M:%S")
    elseif format == "date" then
        return os.date("%Y-%m-%d")
    elseif format == "time" then
        return os.date("%H:%M:%S")
    elseif format == "friendly" then
        return os.date("%B %d, %Y at %I:%M %p")
    elseif format == "unix" then
        return tostring(os.time())
    else
        return os.date("!%Y-%m-%dT%H:%M:%SZ")
    end
end

-- If called directly (not through interpolation), print current time
if not main then
    print(main("iso"))
end 