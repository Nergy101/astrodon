#!/usr/bin/env -S deno run --allow-read --allow-net --allow-run

import { serveDir } from "@std/http/file-server";
import { extname, join } from "@std/path";

// Get port from command line arguments or use default
const portArg = Deno.args.find((arg) => arg.startsWith("--port="));
const port = portArg ? parseInt(portArg.split("=")[1]) : 8000;
const rootArg = Deno.args.find((arg) => arg.startsWith("--root="));
const ROOT = rootArg ? rootArg.split("=")[1] : "./dist";

// Headers that keep the dev server from caching anything, so edits show up
// immediately on the next request.
const NO_CACHE_HEADERS: Record<string, string> = {
  "cache-control": "no-cache, no-store, must-revalidate",
  "pragma": "no-cache",
  "expires": "0",
};

function htmlResponse(content: string): Response {
  return new Response(new TextEncoder().encode(content), {
    headers: { "content-type": "text/html; charset=utf-8", ...NO_CACHE_HEADERS },
  });
}

console.log(`🚀 Starting development server at http://localhost:${port}`);
console.log(`📁 Serving files from ${ROOT}/`);
console.log(`🔄 Auto fallback to index.html enabled`);
console.log(`⚡ Caching disabled (dev server always serves fresh content)`);

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

  // Try to serve clean URLs like /about as /about.html
  if (!extname(path) && path !== "/") {
    let htmlPath = path.endsWith("/") ? path.slice(0, -1) : path;
    htmlPath = htmlPath + ".html";
    try {
      const html = await Deno.readTextFile(ROOT + htmlPath);
      return htmlResponse(html);
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
      for (const [key, value] of Object.entries(NO_CACHE_HEADERS)) {
        headers.set(key, value);
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: headers,
      });
    }
  } catch {
    // Continue to fallback logic
  }

  // Fallback to index.html for 404s (SPA-style routing)
  try {
    const indexPath = join(ROOT, "index.html");
    const indexContent = await Deno.readTextFile(indexPath);
    return htmlResponse(indexContent);
  } catch {
    return new Response("404 - Page not found", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        ...NO_CACHE_HEADERS,
      },
    });
  }
});
