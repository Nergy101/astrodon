#!/usr/bin/env -S deno run --allow-read --allow-net --allow-run

import { serveDir } from "@std/http/file-server";
import { extname, join } from "@std/path";

function getArg(name: string, defaultValue: string): string {
  const arg = Deno.args.find((value) => value.startsWith(`--${name}=`));
  return arg ? arg.slice(name.length + 3) : defaultValue;
}

function normalizeBasePath(path: string): string {
  if (
    path.includes("?") || path.includes("#") ||
    path.includes(String.fromCharCode(92))
  ) {
    throw new Error(`Invalid basePath '${path}'`);
  }
  const segments = path.split("/").filter(Boolean);
  for (const segment of segments) {
    try {
      const decoded = decodeURIComponent(segment);
      if (decoded === "." || decoded === "..") {
        throw new Error(`Invalid basePath '${path}'`);
      }
    } catch (error) {
      if (error instanceof URIError) {
        throw new Error(`Invalid basePath '${path}'`);
      }
      throw error;
    }
  }
  return segments.length === 0 ? "/" : `/${segments.join("/")}`;
}

const port = Number.parseInt(getArg("port", "8000"), 10);
const ROOT = getArg("root", "./dist");
const BASE_PATH = normalizeBasePath(getArg("basePath", "/"));
const LIVE_RELOAD = getArg("liveReload", "false") === "true";
const eventsPath = `${BASE_PATH === "/" ? "" : BASE_PATH}/__astrodon/events`;
const reloadPath = `${BASE_PATH === "/" ? "" : BASE_PATH}/__astrodon/reload`;

const NO_CACHE_HEADERS: Record<string, string> = {
  "cache-control": "no-cache, no-store, must-revalidate",
  pragma: "no-cache",
  expires: "0",
};

const encoder = new TextEncoder();
const eventClients = new Set<ReadableStreamDefaultController<Uint8Array>>();

function withLiveReload(content: string): string {
  if (!LIVE_RELOAD) return content;
  const eventUrl = JSON.stringify(eventsPath);
  const script =
    `<script>(()=>{const events=new EventSource(${eventUrl});events.addEventListener('reload',()=>location.reload())})();</script>`;
  const bodyEnd = content.toLowerCase().lastIndexOf("</body>");
  return bodyEnd < 0
    ? `${content}${script}`
    : `${content.slice(0, bodyEnd)}${script}${content.slice(bodyEnd)}`;
}

function htmlResponse(content: string, status = 200): Response {
  return new Response(encoder.encode(withLiveReload(content)), {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      ...NO_CACHE_HEADERS,
    },
  });
}

function eventsResponse(): Response {
  let client: ReadableStreamDefaultController<Uint8Array> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      client = controller;
      eventClients.add(controller);
      controller.enqueue(encoder.encode(": connected\n\n"));
    },
    cancel() {
      if (client) eventClients.delete(client);
    },
  });
  return new Response(stream, {
    headers: {
      ...NO_CACHE_HEADERS,
      "content-type": "text/event-stream; charset=utf-8",
      connection: "keep-alive",
    },
  });
}

function notifyReload(): void {
  const event = encoder.encode("event: reload\ndata: rebuild-complete\n\n");
  for (const client of eventClients) {
    try {
      client.enqueue(event);
    } catch {
      eventClients.delete(client);
    }
  }
}

async function generateTreeView(
  dirPath: string,
  prefix = "",
  _isLast = true,
): Promise<string[]> {
  const tree: string[] = [];
  try {
    const entries = [];
    for await (const entry of Deno.readDir(dirPath)) entries.push(entry);
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
        tree.push(
          ...await generateTreeView(
            join(dirPath, entry.name),
            prefix + nextPrefix,
            isLastEntry,
          ),
        );
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    tree.push(`${prefix}└── [Error reading directory: ${message}]`);
  }
  return tree;
}

console.log(
  `🚀 Starting development server at http://localhost:${port}${
    BASE_PATH === "/" ? "/" : BASE_PATH + "/"
  }`,
);
console.log(`📁 Serving files from ${ROOT}/`);
console.log("🔄 Auto fallback to index.html enabled");
console.log("⚡ Caching disabled (dev server always serves fresh content)");
if (LIVE_RELOAD) console.log("♻️  Live reload enabled");
console.log("\n📂 File tree for site root:");
try {
  const treeLines = await generateTreeView(ROOT);
  treeLines.forEach((line) => console.log(line));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.log(`❌ Error generating tree view: ${message}`);
}
console.log("");

Deno.serve({ port }, async (request: Request) => {
  const url = new URL(request.url);
  const incomingPath = url.pathname;

  if (LIVE_RELOAD && incomingPath === eventsPath && request.method === "GET") {
    return eventsResponse();
  }
  if (LIVE_RELOAD && incomingPath === reloadPath && request.method === "POST") {
    notifyReload();
    return new Response(null, { status: 204, headers: NO_CACHE_HEADERS });
  }

  let path = incomingPath;
  if (BASE_PATH !== "/") {
    if (path !== BASE_PATH && !path.startsWith(`${BASE_PATH}/`)) {
      return new Response("404 - Page not found", {
        status: 404,
        headers: NO_CACHE_HEADERS,
      });
    }
    path = path === BASE_PATH ? "/" : path.slice(BASE_PATH.length);
    url.pathname = path;
    request = new Request(url, request);
  }

  // Try clean URLs such as /about as /about.html.
  if (!extname(path) && path !== "/") {
    const htmlPath = `${path.endsWith("/") ? path.slice(0, -1) : path}.html`;
    try {
      const html = await Deno.readTextFile(join(ROOT, htmlPath.slice(1)));
      return htmlResponse(html);
    } catch {
      // If no standalone page exists, try normal static-file serving.
    }
  }

  try {
    const response = await serveDir(request, { fsRoot: ROOT, urlRoot: "" });
    if (response.status !== 404) {
      const headers = new Headers(response.headers);
      for (const [key, value] of Object.entries(NO_CACHE_HEADERS)) {
        headers.set(key, value);
      }
      if (LIVE_RELOAD && headers.get("content-type")?.includes("text/html")) {
        return htmlResponse(await response.text(), response.status);
      }
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }
  } catch {
    // Continue to the final fallback.
  }

  try {
    const indexContent = await Deno.readTextFile(join(ROOT, "index.html"));
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
