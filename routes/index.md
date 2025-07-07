---
title: Welcome to My Blog
date: 2025-07-07
author: Christian / Nergy101
tags: [blog, introduction]
---

# Welcome to My Blog

This is a sample blog post created with the Deno+Lua SSG framework. You can edit this file in `/routes/index.md`.

## Features

- **Markdown Support**: Write content in Markdown with frontmatter
- **Lua Templates**: Add custom logic and layouts with Lua scripts
- **Custom CSS**: Reading-friendly, rounded, blogging-optimized styling
- **Code Blocks**: Simple and clean code blocks with syntax highlighting
- **Image Support**: Place images in `/assets/` folder and they'll be automatically copied

## Example Image

![Sample Image](/assets/crow_fox.png)

## Code Examples

### JavaScript Example

```javascript
function greet(name) {
  return `Hello, ${name}!`;
}

console.log(greet('World'));
```

### TypeScript Example

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

function createUser(userData: Partial<User>): User {
  return {
    id: Date.now(),
    name: userData.name || 'Anonymous',
    email: userData.email || '',
  };
}
```

### Python Example

```python
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

# Generate first 10 Fibonacci numbers
for i in range(10):
    print(f"F({i}) = {fibonacci(i)}")
```

## Lists

- Feature 1
- Feature 2
- Feature 3

## Links

[Visit the GitHub repository](https://github.com/Nergy101/deno-lua-ssg)

[About this blog](/about)

## Quote

> "The best way to predict the future is to invent it." - Alan Kay
