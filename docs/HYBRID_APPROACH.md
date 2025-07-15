# Hybrid Lua Approach Documentation

This document explains how to use the hybrid approach that combines build-time caching with runtime Lua execution for optimal performance and user experience.

## Overview

The hybrid approach provides the best of both worlds:

- **Static Content (Build-time)**: Processed once during build, cached for performance
- **Dynamic Content (Runtime)**: Executed on every page request, always fresh

## 🎯 When to Use Each Approach

### Use Build-time (Static) When:

- Content doesn't change frequently
- SEO-critical information
- Performance-critical pages
- Content that's the same for all users
- Page metadata, titles, descriptions

### Use Runtime (Dynamic) When:

- Real-time data (clocks, live feeds)
- User-specific content
- Interactive elements
- Content that changes frequently
- Live counters, timers, quotes

## 📝 Static Content (Build-time)

### Syntax

Use the standard Lua interpolation syntax in your markdown:

```markdown
**Build time:** {{lua:current_time:friendly}}
**Static counter:** {{lua:counter:Step,5}}
**Static quote:** {{lua:random_quote}}
```

### Available Scripts

- `current_time` - Time in various formats
- `counter` - Numbered lists with prefixes
- `random_quote` - Programming quotes
- `time_module` - Advanced time utilities

### Performance Benefits

- ✅ Fast page loads (no Lua execution on requests)
- ✅ Reduced server load (cached results)
- ✅ Better SEO (content available immediately)
- ✅ Lower bandwidth (no repeated API calls)

## ⚡ Dynamic Content (Runtime)

### Method 1: Direct API Calls

Use the server-side API endpoints directly:

```bash
# Get current time in different formats
curl http://localhost:8000/lua-scripts/time/iso
curl http://localhost:8000/lua-scripts/time/friendly
curl http://localhost:8000/lua-scripts/time/datetime

# Execute Lua modules with context
curl -X POST http://localhost:8000/lua-scripts/lua-execute \
  -H "Content-Type: application/json" \
  -d '{"module":"random-quote","context":{}}'
```

### Method 2: JavaScript Fetch API

Use the Fetch API to call server endpoints:

```javascript
// Get current time
fetch('/lua-scripts/time/friendly')
  .then(response => response.json())
  .then(data => console.log(data.time));

// Execute any module
fetch('/lua-scripts/lua-execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    module: 'random-quote',
    context: {},
  }),
})
  .then(response => response.json())
  .then(data => console.log(data.result));
```

### Method 3: Server-side Integration

Integrate with other server-side services:

```javascript
// Example: Node.js/Deno server integration
const response = await fetch('http://localhost:8000/lua-scripts/time/iso');
const data = await response.json();
console.log(data.time);
```

## 🔧 Available Runtime Modules

### current-time

Get current time in various formats.

**Parameters:**

- `format`: `iso`, `local`, `utc`, `date`, `time`, `datetime`, `friendly`
- `timezone`: `utc`, `local`

**Examples:**

```bash
# Get ISO time
curl http://localhost:8000/lua-scripts/time/iso

# Get friendly time
curl http://localhost:8000/lua-scripts/time/friendly

# Execute with context
curl -X POST http://localhost:8000/lua-scripts/lua-execute \
  -H "Content-Type: application/json" \
  -d '{"module":"current-time","context":{"format":"datetime"}}'
```

### counter

Generate numbered lists with custom prefixes.

**Parameters:**

- `prefix`: String prefix (e.g., "Item", "Step", "Task")
- `count`: Number of items (1-100)

**Examples:**

```bash
# Generate 5 steps
curl -X POST http://localhost:8000/lua-scripts/lua-execute \
  -H "Content-Type: application/json" \
  -d '{"module":"counter","context":{"prefix":"Step","count":5}}'

# Generate 3 tasks
curl -X POST http://localhost:8000/lua-scripts/lua-execute \
  -H "Content-Type: application/json" \
  -d '{"module":"counter","context":{"prefix":"Task","count":3}}'
```

### random-quote

Get a random programming quote.

**Parameters:** None

**Examples:**

```bash
# Get random quote
curl -X POST http://localhost:8000/lua-scripts/lua-execute \
  -H "Content-Type: application/json" \
  -d '{"module":"random-quote","context":{}}'
```

## 🎨 Customization Examples

### Server-side Integration

```javascript
// Example: Express.js middleware
app.get('/api/time/:format', async (req, res) => {
  const response = await fetch(
    `http://localhost:8000/lua-scripts/time/${req.params.format}`
  );
  const data = await response.json();
  res.json(data);
});

// Example: Next.js API route
export default async function handler(req, res) {
  const response = await fetch(
    'http://localhost:8000/lua-scripts/lua-execute',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    }
  );
  const data = await response.json();
  res.json(data);
}
```

### Custom Context Parameters

```bash
# Custom counter with prefix and count
curl -X POST http://localhost:8000/lua-scripts/lua-execute \
  -H "Content-Type: application/json" \
  -d '{"module":"counter","context":{"prefix":"Feature","count":8}}'

# Custom time format
curl -X POST http://localhost:8000/lua-scripts/lua-execute \
  -H "Content-Type: application/json" \
  -d '{"module":"current-time","context":{"format":"datetime"}}'
```

### Advanced Server Integration

```javascript
// Example: Scheduled tasks with cron
import cron from 'node-cron';

// Update time every minute
cron.schedule('* * * * *', async () => {
  const response = await fetch('http://localhost:8000/lua-scripts/time/iso');
  const data = await response.json();
  console.log('Current time:', data.time);
});

// Example: WebSocket integration
io.on('connection', socket => {
  setInterval(async () => {
    const response = await fetch(
      'http://localhost:8000/lua-scripts/lua-execute',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: 'random-quote',
          context: {},
        }),
      }
    );
    const data = await response.json();
    socket.emit('quote', data.result);
  }, 30000);
});
```

## 🚀 Implementation Details

### Server-side Endpoints

The following endpoints are available for runtime Lua execution:

- `POST /lua-scripts/lua-execute` - Execute Lua modules with context
- `GET /lua-scripts/time/{format}` - Get current time in specific format
- `GET /lua-scripts/time` - Legacy endpoint for UTC time

### Security Features

- **Module Whitelist**: Only specific modules are allowed
- **Parameter Validation**: All inputs are validated and sanitized
- **Output Limits**: Results are limited to prevent abuse
- **Secure Execution**: Lua runs in isolated WASMOON environment

### Error Handling

The system includes comprehensive error handling:

```javascript
// Errors are caught and displayed gracefully
lua.execute('invalid-module').catch(error => {
  console.error('Lua execution failed:', error);
  // Element will show "[Error: Module not allowed]"
});
```

## 📱 Mobile Performance

The hybrid approach is optimized for mobile devices:

- **Static content** loads instantly (cached)
- **Dynamic content** updates efficiently
- **Minimal JavaScript** footprint
- **Progressive enhancement** - works without JavaScript

## 🔍 Debugging

### API Testing

Test the endpoints directly:

```bash
# Test time API
curl http://localhost:8000/lua-scripts/time/iso

# Test module execution
curl -X POST http://localhost:8000/lua-scripts/lua-execute \
  -H "Content-Type: application/json" \
  -d '{"module":"random-quote","context":{}}'

# Check server logs for errors
tail -f /var/log/your-app.log
```

### Network Monitoring

Monitor API calls in your application:

- `POST /lua-scripts/lua-execute` - Module execution
- `GET /lua-scripts/time/{format}` - Time requests
- Check response status codes and error messages

## 🎯 Best Practices

### Performance

- Use static content for SEO-critical information
- Use server-side execution for real-time updates
- Implement appropriate caching strategies
- Monitor API response times

### Security

- Only use allowed modules
- Validate all user inputs
- Sanitize context parameters
- Limit output sizes

### User Experience

- Provide loading states for API calls
- Handle errors gracefully
- Implement proper error responses
- Ensure API documentation is clear

## 🚀 Next Steps

1. **Explore the Demo**: Visit `/hybrid-demo` to see the server-side approach in action
2. **Test the APIs**: Use curl or your preferred API client to experiment with the endpoints
3. **Create Custom Modules**: Add new Lua modules to the server
4. **Optimize Performance**: Adjust caching and server configuration based on your needs

The server-side approach provides clean separation of concerns with secure execution and optimal performance.
