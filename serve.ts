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

        // API endpoint for current UTC time from Lua
        if (path === "/lua-scripts/time") {
            try {
                const process = new Deno.Command("lua", {
                    args: ["api/get_time.lua"],
                    stdout: "piped",
                    stderr: "piped",
                });
                const { code, stdout, stderr } = await process.output();
                if (code !== 0) {
                    const error = new TextDecoder().decode(stderr);
                    const response = new Response(JSON.stringify({ error }), {
                        status: 500,
                        headers: {
                            "content-type": "application/json",
                            "cache-control": "no-cache, no-store, must-revalidate",
                        },
                    });
                    return response;
                }
                const time = new TextDecoder().decode(stdout).trim();
                const response = new Response(JSON.stringify({ time }), {
                    status: 200,
                    headers: {
                        "content-type": "application/json",
                        "cache-control": "public, max-age=300", // 5 minutes for API
                    },
                });
                setCachedResponse(path, response);
                return response;
            } catch (err) {
                const response = new Response(JSON.stringify({ error: String(err) }), {
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

                // SECURITY: Only allow specific modules
                const allowedModules = ["render-time"];
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
                const sanitizedContext: { format?: string; timezone?: string } = {};
                if (context && typeof context === 'object') {
                    // Only allow specific context properties for render-time
                    if (module === "render-time") {
                        const allowedFormats = ["iso", "local", "utc", "date", "time", "datetime", "friendly"];
                        const allowedTimezones = ["utc", "local"];

                        if (context.format && allowedFormats.includes(context.format)) {
                            sanitizedContext.format = context.format;
                        }
                        if (context.timezone && allowedTimezones.includes(context.timezone)) {
                            sanitizedContext.timezone = context.timezone;
                        }
                    }
                }

                // SECURITY: Use predefined, safe Lua scripts only
                let luaScript = "";

                if (module === "render-time") {
                    const format = sanitizedContext.format || "iso";
                    const timezone = sanitizedContext.timezone || "utc";

                    // SECURITY: Use parameterized script with validation
                    luaScript = `
local os = require("os")
local format = "${format}"
local timezone = "${timezone}"

-- SECURITY: Validate format parameter
local validFormats = {iso = true, local = true, utc = true, date = true, time = true, datetime = true, friendly = true}
if not validFormats[format] then
    format = "iso"
end

if format == "iso" then
    return os.date("!%Y-%m-%dT%H:%M:%SZ")
elseif format == "local" then
    return os.date("%Y-%m-%d %H:%M:%S")
elseif format == "utc" then
    return os.date("!%Y-%m-%d %H:%M:%S")
elseif format == "date" then
    return os.date("%Y-%m-%d")
elseif format == "time" then
    return os.date("%H:%M:%S")
elseif format == "datetime" then
    return os.date("%Y-%m-%d %H:%M:%S")
elseif format == "friendly" then
    return "Just now"
else
    return os.date("!%Y-%m-%dT%H:%M:%SZ")
end
                `;
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
                        "cache-control": "public, max-age=300", // 5 minutes for API
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