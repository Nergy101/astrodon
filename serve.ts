#!/usr/bin/env -S deno run --allow-read --allow-net --allow-run

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { serveDir } from "https://deno.land/std@0.208.0/http/file_server.ts";
import { extname } from "https://deno.land/std@0.208.0/path/mod.ts";
import { LuaFactory } from "npm:wasmoon@1.16.0";

const port = 8000;

console.log(`🚀 Starting development server at http://localhost:${port}`);
console.log(`📁 Serving files from ./dist/`);
console.log(`🔄 Auto fallback to index.html enabled`);

await serve(async (req) => {
    const url = new URL(req.url);
    const path = url.pathname;

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
                return new Response(JSON.stringify({ error }), {
                    status: 500,
                    headers: { "content-type": "application/json" },
                });
            }
            const time = new TextDecoder().decode(stdout).trim();
            return new Response(JSON.stringify({ time }), {
                status: 200,
                headers: { "content-type": "application/json" },
            });
        } catch (err) {
            return new Response(JSON.stringify({ error: String(err) }), {
                status: 500,
                headers: { "content-type": "application/json" },
            });
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
                return new Response(JSON.stringify({ error: `Module '${module}' not allowed` }), {
                    status: 403,
                    headers: { "content-type": "application/json" },
                });
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
                await lua.close();
            } catch (err) {
                console.error("Lua execution error:", err);
                return new Response(JSON.stringify({ error: "Execution failed" }), {
                    status: 500,
                    headers: { "content-type": "application/json" },
                });
            }

            // SECURITY: Limit output size
            if (typeof result === "string" && result.length > 1000) {
                return new Response(JSON.stringify({ error: "Output too large" }), {
                    status: 413,
                    headers: { "content-type": "application/json" },
                });
            }

            return new Response(JSON.stringify({ result }), {
                status: 200,
                headers: { "content-type": "application/json" },
            });
        } catch (err) {
            console.error("Lua API error:", err);
            return new Response(JSON.stringify({ error: "Internal server error" }), {
                status: 500,
                headers: { "content-type": "application/json" },
            });
        }
    }

    // Try to serve clean URLs like /about as /about.html
    if (!extname(path) && path !== "/") {
        let htmlPath = path.endsWith("/") ? path.slice(0, -1) : path;
        htmlPath = htmlPath + ".html";
        try {
            const html = await Deno.readTextFile("./dist" + htmlPath);
            return new Response(html, {
                status: 200,
                headers: { "content-type": "text/html; charset=utf-8" },
            });
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

        // If the file exists, return it
        if (response.status !== 404) {
            return response;
        }
    } catch (error) {
        // Continue to fallback logic
    }

    // Fallback to index.html for 404s (SPA-style routing)
    try {
        const indexPath = "./dist/index.html";
        const indexContent = await Deno.readTextFile(indexPath);

        return new Response(indexContent, {
            status: 200,
            headers: {
                "content-type": "text/html; charset=utf-8",
            },
        });
    } catch (error) {
        // If index.html doesn't exist, return a proper 404
        return new Response("404 - Page not found", {
            status: 404,
            headers: {
                "content-type": "text/plain; charset=utf-8",
            },
        });
    }
}, { port }); 