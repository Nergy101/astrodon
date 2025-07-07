#!/usr/bin/env -S deno run --allow-read --allow-net --allow-run

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { serveDir } from "https://deno.land/std@0.208.0/http/file_server.ts";
import { extname } from "https://deno.land/std@0.208.0/path/mod.ts";

const port = 8000;

console.log(`🚀 Starting development server at http://localhost:${port}`);
console.log(`📁 Serving files from ./dist/`);
console.log(`🔄 Auto fallback to index.html enabled`);

await serve(async (req) => {
    const url = new URL(req.url);
    const path = url.pathname;

    // API endpoint for current UTC time from Lua
    if (path === "/api/time") {
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