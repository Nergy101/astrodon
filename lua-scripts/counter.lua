-- Simple counter script that demonstrates parameter passing
function main(prefix, count)
    prefix = prefix or "Item"
    count = tonumber(count) or 1
    
    local result = ""
    for i = 1, count do
        if i > 1 then
            result = result .. ", "
        end
        result = result .. prefix .. " " .. i
    end
    
    return result
end

-- If called directly, demonstrate with default values
if not main then
    print(main("Counter", 3))
end 