-- Random quote generator
local quotes = {
    "The only way to do great work is to love what you do. - Steve Jobs",
    "Stay hungry, stay foolish. - Steve Jobs",
    "Code is like humor. When you have to explain it, it's bad. - Cory House",
    "First, solve the problem. Then, write the code. - John Johnson",
    "Sometimes it pays to stay in bed on Monday, rather than spending the rest of the week debugging Monday's code. - Dan Salomon",
    "It's not a bug – it's an undocumented feature. - Anonymous",
    "The best error message is the one that never shows up. - Thomas Fuchs",
    "Any fool can write code that a computer can understand. Good programmers write code that humans can understand. - Martin Fowler",
    "Programming isn't about what you know; it's about what you can figure out. - Chris Pine",
    "The only way to learn a new programming language is by writing programs in it. - Dennis Ritchie"
}

function main()
    math.randomseed(os.time())
    local index = math.random(1, #quotes)
    return quotes[index]
end

-- If called directly, print a random quote
print(main()) 