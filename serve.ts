#!/usr/bin/env -S deno run --allow-read --allow-net --allow-run

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { serveDir } from "https://deno.land/std@0.208.0/http/file_server.ts";
import { extname } from "https://deno.land/std@0.208.0/path/mod.ts";
import { LuaFactory } from "npm:wasmoon@1.16.0";

// Get port from command line arguments or use default
const portArg = Deno.args.find(arg => arg.startsWith('--port='));
const port = portArg ? parseInt(portArg.split('=')[1]) : 8000;

// Performance optimizations: Response cache
const responseCache = new Map<string, { response: Response; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Compression helper
function compressResponse(content: string, contentType: string, enableCache: boolean = false): Response {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);

    const headers: Record<string, string> = {
        "content-type": contentType,
    };

    // Only add cache headers for API endpoints
    if (enableCache) {
        headers["cache-control"] = "public, max-age=300"; // 5 minutes
        headers["vary"] = "Accept-Encoding";
    } else {
        // Disable caching for normal routes
        headers["cache-control"] = "no-cache, no-store, must-revalidate";
        headers["pragma"] = "no-cache";
        headers["expires"] = "0";
    }

    return new Response(data, { headers });
}

// Cache management
function getCachedResponse(path: string): Response | null {
    const cached = responseCache.get(path);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > CACHE_TTL) {
        responseCache.delete(path);
        return null;
    }

    return cached.response;
}

function setCachedResponse(path: string, response: Response) {
    responseCache.set(path, { response, timestamp: Date.now() });
}

// Clean up old cache entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [path, cached] of responseCache.entries()) {
        if (now - cached.timestamp > CACHE_TTL) {
            responseCache.delete(path);
        }
    }
}, CACHE_TTL);

console.log(`🚀 Starting development server at http://localhost:${port}`);
console.log(`📁 Serving files from ./dist/`);
console.log(`🔄 Auto fallback to index.html enabled`);
console.log(`⚡ API caching enabled (5min TTL), normal routes disabled`);

// Function to generate tree view of dist directory
async function generateTreeView(dirPath: string, prefix: string = "", isLast: boolean = true): Promise<string[]> {
    const tree: string[] = [];
    try {
        const entries = [];
        for await (const entry of Deno.readDir(dirPath)) {
            entries.push(entry);
        }

        // Sort entries: directories first, then files
        entries.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
        });

        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            const isLastEntry = i === entries.length - 1;
            const connector = isLastEntry ? "└── " : "├── ";
            const nextPrefix = isLastEntry ? "    " : "│   ";

            tree.push(`${prefix}${connector}${entry.name}${entry.isDirectory ? "/" : ""}`);

            if (entry.isDirectory) {
                const subTree = await generateTreeView(
                    `${dirPath}/${entry.name}`,
                    prefix + nextPrefix,
                    isLastEntry
                );
                tree.push(...subTree);
            }
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        tree.push(`${prefix}└── [Error reading directory: ${errorMessage}]`);
    }
    return tree;
}

// Display tree view of dist directory
console.log(`\n📂 File tree for ./dist/:`);
try {
    const treeLines = await generateTreeView("./dist");
    treeLines.forEach(line => console.log(line));
} catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`❌ Error generating tree view: ${errorMessage}`);
}
console.log(""); // Empty line for better readability

await serve(
    async (req) => {
        const url = new URL(req.url);
        const path = url.pathname;

        // Check cache first (only for API endpoints)
        if (path.startsWith('/lua-scripts/')) {
            const cachedResponse = getCachedResponse(path);
            if (cachedResponse) {
                // Optionally log cache hit for API endpoints only
                // console.log(`⚡ Cache hit for ${path}`);
                return cachedResponse;
            }
        }

        // API endpoint for current time with format parameter
        if (path.startsWith("/lua-scripts/time/")) {
            try {
                const format = path.split("/").pop() || "iso";
                const allowedFormats = ["iso", "local", "utc", "date", "time", "datetime", "friendly"];

                if (!allowedFormats.includes(format)) {
                    const response = new Response(JSON.stringify({ error: `Invalid format: ${format}` }), {
                        status: 400,
                        headers: {
                            "content-type": "application/json",
                            "cache-control": "no-cache, no-store, must-revalidate",
                        },
                    });
                    return response;
                }

                // Read and execute the current_time.lua script
                const luaScript = await Deno.readTextFile("./lua-scripts/current_time.lua");

                // Use WASMOON for secure execution
                const factory = new LuaFactory();
                const lua = await factory.createEngine();

                // Execute the script and call main function with format parameter
                const result = await lua.doString(luaScript + `\nreturn main("${format}")`);
                const response = new Response(JSON.stringify({ time: result }), {
                    status: 200,
                    headers: {
                        "content-type": "application/json",
                        "cache-control": "no-cache, no-store, must-revalidate", // No cache for dynamic time
                    },
                });
                return response;
            } catch (err) {
                console.error("Time API error:", err);
                const response = new Response(JSON.stringify({ error: "Time generation failed" }), {
                    status: 500,
                    headers: {
                        "content-type": "application/json",
                        "cache-control": "no-cache, no-store, must-revalidate",
                    },
                });
                return response;
            }
        }



        // API endpoint for executing Lua modules (SECURE VERSION)
        if (path === "/lua-scripts/lua-execute" && req.method === "POST") {
            try {
                const body = await req.json();
                const { module, context } = body;

                // SECURITY: Only allow specific modules that correspond to existing Lua scripts
                const allowedModules = ["render-time", "current-time", "counter", "random-quote", "time-module"];
                if (!allowedModules.includes(module)) {
                    const response = new Response(JSON.stringify({ error: `Module '${module}' not allowed` }), {
                        status: 403,
                        headers: {
                            "content-type": "application/json",
                            "cache-control": "no-cache, no-store, must-revalidate",
                        },
                    });
                    return response;
                }

                // SECURITY: Validate and sanitize context
                const sanitizedContext: { format?: string; timezone?: string; prefix?: string; count?: number } = {};
                if (context && typeof context === 'object') {
                    // Allow specific context properties for each module
                    if (module === "render-time" || module === "current-time") {
                        const allowedFormats = ["iso", "local", "utc", "date", "time", "datetime", "friendly"];
                        const allowedTimezones = ["utc", "local"];

                        if (context.format && allowedFormats.includes(context.format)) {
                            sanitizedContext.format = context.format;
                        }
                        if (context.timezone && allowedTimezones.includes(context.timezone)) {
                            sanitizedContext.timezone = context.timezone;
                        }
                    } else if (module === "counter") {
                        if (context.prefix && typeof context.prefix === 'string' && context.prefix.length <= 50) {
                            sanitizedContext.prefix = context.prefix;
                        }
                        if (context.count && typeof context.count === 'number' && context.count >= 1 && context.count <= 100) {
                            sanitizedContext.count = context.count;
                        }
                    } else if (module === "time-module") {
                        // time-module doesn't need additional context validation
                        // it provides predefined functions
                    }
                }

                // SECURITY: Use existing Lua scripts from lua-scripts directory
                let luaScript = "";
                let scriptPath = "";

                if (module === "render-time" || module === "current-time") {
                    scriptPath = "./lua-scripts/current_time.lua";
                    const format = sanitizedContext.format || "iso";
                    luaScript = await Deno.readTextFile(scriptPath);
                    // Call the main function with the format parameter
                    luaScript += `\nreturn main("${format}")`;
                } else if (module === "counter") {
                    scriptPath = "./lua-scripts/counter.lua";
                    const prefix = sanitizedContext.prefix || "Item";
                    const count = sanitizedContext.count || 3;
                    luaScript = await Deno.readTextFile(scriptPath);
                    // Call the main function with parameters
                    luaScript += `\nreturn main("${prefix}", ${count})`;
                } else if (module === "random-quote") {
                    scriptPath = "./lua-scripts/random_quote.lua";
                    luaScript = await Deno.readTextFile(scriptPath);
                    // Call the main function
                    luaScript += `\nreturn main()`;
                } else if (module === "time-module") {
                    scriptPath = "./lua-scripts/time_module.lua";
                    luaScript = await Deno.readTextFile(scriptPath);
                    // Return the module functions
                    luaScript += `\nreturn { get_current_time = get_current_time, get_timestamp = get_timestamp, get_time_components = get_time_components }`;
                }

                // Use WASMOON to execute Lua code securely in memory
                let result = "";
                try {
                    const factory = new LuaFactory();
                    const lua = await factory.createEngine();
                    result = await lua.doString(luaScript);
                    // Note: LuaEngine doesn't have a close method in this version
                    // The engine will be garbage collected automatically
                } catch (err) {
                    console.error("Lua execution error:", err);
                    const response = new Response(JSON.stringify({ error: "Execution failed" }), {
                        status: 500,
                        headers: {
                            "content-type": "application/json",
                            "cache-control": "no-cache, no-store, must-revalidate",
                        },
                    });
                    return response;
                }

                // SECURITY: Limit output size
                if (typeof result === "string" && result.length > 1000) {
                    const response = new Response(JSON.stringify({ error: "Output too large" }), {
                        status: 413,
                        headers: {
                            "content-type": "application/json",
                            "cache-control": "no-cache, no-store, must-revalidate",
                        },
                    });
                    return response;
                }

                const response = new Response(JSON.stringify({ result }), {
                    status: 200,
                    headers: {
                        "content-type": "application/json",
                        "cache-control": "no-cache, no-store, must-revalidate", // No cache for dynamic content
                    },
                });
                return response;
            } catch (err) {
                console.error("Lua API error:", err);
                const response = new Response(JSON.stringify({ error: "Internal server error" }), {
                    status: 500,
                    headers: {
                        "content-type": "application/json",
                        "cache-control": "no-cache, no-store, must-revalidate",
                    },
                });
                return response;
            }
        }

        // Try to serve clean URLs like /about as /about.html
        if (!extname(path) && path !== "/") {
            let htmlPath = path.endsWith("/") ? path.slice(0, -1) : path;
            htmlPath = htmlPath + ".html";
            try {
                const html = await Deno.readTextFile("./dist" + htmlPath);
                const response = compressResponse(html, "text/html; charset=utf-8", false);
                setCachedResponse(path, response);
                return response;
            } catch {
                // If not found, fall through to serveDir
            }
        }

        // Try to serve the requested file
        try {
            const response = await serveDir(req, {
                fsRoot: "./dist",
                urlRoot: "",
            });

            // If the file exists, return it with cache disabled for normal routes
            if (response.status !== 404) {
                // Clone the response and add no-cache headers for normal routes
                const headers = new Headers(response.headers);
                headers.set("cache-control", "no-cache, no-store, must-revalidate");
                headers.set("pragma", "no-cache");
                headers.set("expires", "0");

                const modifiedResponse = new Response(response.body, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: headers,
                });

                setCachedResponse(path, modifiedResponse);
                return modifiedResponse;
            }
        } catch (error) {
            // Continue to fallback logic
        }

        // Fallback to index.html for 404s (SPA-style routing)
        try {
            const indexPath = "./dist/index.html";
            const indexContent = await Deno.readTextFile(indexPath);

            const response = compressResponse(indexContent, "text/html; charset=utf-8", false);
            setCachedResponse(path, response);
            return response;
        } catch (error) {
            // If index.html doesn't exist, return a proper 404
            const response = new Response("404 - Page not found", {
                status: 404,
                headers: {
                    "content-type": "text/plain; charset=utf-8",
                    "cache-control": "no-cache, no-store, must-revalidate",
                },
            });
            return response;
        }
    },
    { port }
); 