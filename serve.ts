#!/usr/bin/env -S deno run --allow-read --allow-net --allow-run

import { serveDir } from "jsr:@std/http/file-server";
import { extname, join } from "jsr:@std/path";

// Get port from command line arguments or use default
const portArg = Deno.args.find((arg) => arg.startsWith("--port="));
const port = portArg ? parseInt(portArg.split("=")[1]) : 8000;
const rootArg = Deno.args.find((arg) => arg.startsWith("--root="));
const ROOT = rootArg ? rootArg.split("=")[1] : "./dist";

// Performance optimizations: Response cache
const responseCache = new Map<
  string,
  { response: Response; timestamp: number }
>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Compression helper
function compressResponse(
  content: string,
  contentType: string,
  enableCache: boolean = false,
): Response {
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
console.log(`📁 Serving files from ${ROOT}/`);
console.log(`🔄 Auto fallback to index.html enabled`);
console.log(`⚡ API caching enabled (5min TTL), normal routes disabled`);

// Function to generate tree view of dist directory
async function generateTreeView(
  dirPath: string,
  prefix: string = "",
  _isLast: boolean = true,
): Promise<string[]> {
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

      tree.push(
        `${prefix}${connector}${entry.name}${entry.isDirectory ? "/" : ""}`,
      );

      if (entry.isDirectory) {
        const subTree = await generateTreeView(
          `${dirPath}/${entry.name}`,
          prefix + nextPrefix,
          isLastEntry,
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
  treeLines.forEach((line) => console.log(line));
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.log(`❌ Error generating tree view: ${errorMessage}`);
}
console.log(""); // Empty line for better readability

Deno.serve({ port }, async (req: Request) => {
  const url = new URL(req.url);
  const path = url.pathname;

  // Handle requests to removed Lua endpoints
  if (path.startsWith("/lua-scripts/")) {
    const response = new Response(
      JSON.stringify({
        error: "Lua functionality has been removed. This project now uses pure TypeScript.",
        message: "Please update your client-side code to remove references to /lua-scripts/ endpoints.",
      }),
      {
        status: 410, // Gone - indicates the resource is no longer available
        headers: {
          "content-type": "application/json",
          "cache-control": "no-cache, no-store, must-revalidate",
        },
      },
    );
    return response;
  }

  // Try to serve clean URLs like /about as /about.html
  if (!extname(path) && path !== "/") {
    let htmlPath = path.endsWith("/") ? path.slice(0, -1) : path;
    htmlPath = htmlPath + ".html";
    try {
      const html = await Deno.readTextFile(ROOT + htmlPath);
      const response = compressResponse(
        html,
        "text/html; charset=utf-8",
        false,
      );
      setCachedResponse(path, response);
      return response;
    } catch {
      // If not found, fall through to serveDir
    }
  }

  // Try to serve the requested file
  try {
    const response = await serveDir(req, {
      fsRoot: ROOT,
      urlRoot: "",
    });

    if (response.status !== 404) {
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
  } catch (_error) {
    // Continue to fallback logic
  }

  // Fallback to index.html for 404s (SPA-style routing)
  try {
    const indexPath = join(ROOT, "index.html");
    const indexContent = await Deno.readTextFile(indexPath);

    const response = compressResponse(
      indexContent,
      "text/html; charset=utf-8",
      false,
    );
    setCachedResponse(path, response);
    return response;
  } catch (_error) {
    const response = new Response("404 - Page not found", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-cache, no-store, must-revalidate",
      },
    });
    return response;
  }
});
