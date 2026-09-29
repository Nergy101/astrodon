import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import { build, watch } from "../mod.ts";
import { cleanupDir, createTestContent } from "./utils/test-helpers.ts";

Deno.test("frontmatter validation reports the source file and offending line", async () => {
  const root = await Deno.makeTempDir({
    prefix: "astrodon-frontmatter-invalid-",
  });
  const contentDir = join(root, "routes");
  const outDir = join(root, "dist");
  const source = join(contentDir, "invalid.md");

  try {
    await createTestContent(
      contentDir,
      "invalid.md",
      `---
title: Valid
this is not metadata
---
Body.`,
    );
    const result = await new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "--allow-read",
        "--allow-write",
        "--allow-run",
        join(new URL("../build.ts", import.meta.url).pathname),
        `--contentDir=${contentDir}`,
        `--outDir=${outDir}`,
      ],
      stdout: "piped",
      stderr: "piped",
    }).output();
    const diagnostic = new TextDecoder().decode(result.stderr);

    assertEquals(result.code, 1);
    assertStringIncludes(diagnostic, `${source}:3`);
    assertStringIncludes(diagnostic, "invalid frontmatter");
    try {
      await Deno.stat(outDir);
      throw new Error(
        "output directory should not be created when metadata is invalid",
      );
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    }
  } finally {
    await cleanupDir(root);
  }
});

Deno.test("build rejects page and asset output collisions before writing output", async () => {
  const root = await Deno.makeTempDir({ prefix: "astrodon-collision-" });
  const contentDir = join(root, "routes");
  const assetsDir = join(root, "assets");
  const outDir = join(root, "dist");

  try {
    await Deno.mkdir(join(contentDir, "assets"), { recursive: true });
    await createTestContent(contentDir, "assets/index.md", "# Assets route");
    await Deno.mkdir(assetsDir, { recursive: true });
    await Deno.writeTextFile(join(assetsDir, "index.html"), "static asset");
    const result = await new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "--allow-read",
        "--allow-write",
        "--allow-run",
        join(new URL("../build.ts", import.meta.url).pathname),
        `--contentDir=${contentDir}`,
        `--outDir=${outDir}`,
        `--assetsDir=${assetsDir}`,
      ],
      stdout: "piped",
      stderr: "piped",
    }).output();
    const diagnostic = new TextDecoder().decode(result.stderr);

    assertEquals(result.code, 1);
    assertStringIncludes(diagnostic, "Output path collision");
    assertStringIncludes(diagnostic, "assets/index.html");
    assertStringIncludes(
      diagnostic,
      "Build failed: 1 output path collision(s)",
    );
    try {
      await Deno.stat(outDir);
      throw new Error(
        "output directory should not be created when paths collide",
      );
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    }
  } finally {
    await cleanupDir(root);
  }
});

Deno.test("basePath and siteUrl prefix internal URLs and emit SEO metadata and sitemap", async () => {
  const root = await Deno.makeTempDir({ prefix: "astrodon-site-url-" });
  const contentDir = join(root, "routes");
  const outDir = join(root, "dist");

  try {
    await createTestContent(
      contentDir,
      "index.md",
      `---
title: Home
description: A test home page
image: /assets/cover.png
---

[Local](/about) [External](https://outside.example/path)

![Cover](/assets/cover.png)

![Remote](https://images.example/remote.png)

![Protocol](//cdn.example/remote.png)`,
    );
    await createTestContent(
      contentDir,
      "about.md",
      `---
title: About
ogTitle: About preview
canonical: https://canonical.example/about
---
About content.`,
    );
    await build({
      contentDir,
      outDir,
      basePath: "/preview",
      siteUrl: "https://example.test",
    });

    const html = await Deno.readTextFile(join(outDir, "index.html"));
    assertStringIncludes(html, 'href="/preview/about"');
    assertStringIncludes(html, 'href="https://outside.example/path"');
    assertStringIncludes(html, 'src="/preview/assets/cover.png"');
    assertStringIncludes(html, 'src="https://images.example/remote.png"');
    assertStringIncludes(html, 'src="//cdn.example/remote.png"');
    assertStringIncludes(
      html,
      'rel="canonical" href="https://example.test/preview/"',
    );
    assertStringIncludes(html, 'property="og:title" content="Home"');
    assertStringIncludes(
      html,
      'property="og:description" content="A test home page"',
    );
    assertStringIncludes(
      html,
      'property="og:image" content="https://example.test/preview/assets/cover.png"',
    );

    const sitemap = await Deno.readTextFile(join(outDir, "sitemap.xml"));
    assertStringIncludes(sitemap, "<loc>https://example.test/preview/</loc>");
    assertStringIncludes(
      sitemap,
      "<loc>https://example.test/preview/about</loc>",
    );
    const aboutHtml = await Deno.readTextFile(join(outDir, "about.html"));
    assertStringIncludes(
      aboutHtml,
      'rel="canonical" href="https://canonical.example/about"',
    );
    assertStringIncludes(
      aboutHtml,
      'property="og:title" content="About preview"',
    );
  } finally {
    await cleanupDir(root);
  }
});

Deno.test("watch rebuilds content and notifies live-reload clients", async () => {
  const root = await Deno.makeTempDir({ prefix: "astrodon-watch-" });
  const contentDir = join(root, "routes");
  const assetsDir = join(root, "assets");
  const outDir = join(root, "dist");
  const listener = Deno.listen({ port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();
  const controller = new AbortController();
  let eventReader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const watchDone = watch({
    contentDir,
    assetsDir,
    outDir,
    basePath: "/docs",
    port,
    signal: controller.signal,
  });

  try {
    await Deno.mkdir(assetsDir, { recursive: true });
    const pagePath = await createTestContent(
      contentDir,
      "index.md",
      "# Before",
    );
    const origin = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        const response = await fetch(`${origin}/docs/`);
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {
        // The development server is still starting.
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert(ready, "watch should start the development server");

    const events = await fetch(`${origin}/docs/__astrodon/events`);
    assertEquals(events.status, 200);
    eventReader = events.body!.getReader();
    const reloadNotice = (async () => {
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await eventReader!.read();
        if (done) return false;
        if (decoder.decode(value).includes("event: reload")) return true;
      }
    })();

    await Deno.writeTextFile(pagePath, "# After change");
    const sawReload = await Promise.race([
      reloadNotice,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("timed out waiting for live reload")),
          10_000,
        )
      ),
    ]);
    assert(sawReload, "successful rebuild should notify connected browsers");

    const response = await fetch(`${origin}/docs/`);
    const html = await response.text();
    assertStringIncludes(html, "After change");
    assertStringIncludes(html, "EventSource");
    assertStringIncludes(html, "/docs/__astrodon/events");
  } finally {
    await eventReader?.cancel();
    controller.abort();
    await watchDone.catch(() => {});
    await cleanupDir(root);
  }
});

Deno.test("successful builds report a concise status alongside detailed metrics", async () => {
  const root = await Deno.makeTempDir({ prefix: "astrodon-summary-" });
  const contentDir = join(root, "routes");
  const outDir = join(root, "dist");

  try {
    await createTestContent(contentDir, "index.md", "# Summary test");
    const result = await new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "--allow-read",
        "--allow-write",
        "--allow-run",
        join(new URL("../build.ts", import.meta.url).pathname),
        `--contentDir=${contentDir}`,
        `--outDir=${outDir}`,
      ],
      stdout: "piped",
      stderr: "piped",
    }).output();
    const output = new TextDecoder().decode(result.stdout);

    assertEquals(result.code, 0);
    assertStringIncludes(
      output,
      "Build succeeded: 1 pages, 0 failed, 0 cached,",
    );
    assertStringIncludes(output, "Build Performance Metrics:");
  } finally {
    await cleanupDir(root);
  }
});

Deno.test("frontmatter compatibility - metadata-free pages use filename defaults", async () => {
  const root = await Deno.makeTempDir({ prefix: "astrodon-frontmatter-" });
  const contentDir = join(root, "routes");
  const outDir = join(root, "dist");

  try {
    await createTestContent(
      contentDir,
      "plain-page.md",
      "# Hello\n\nPage body.",
    );
    await build({ contentDir, outDir });

    const html = await Deno.readTextFile(join(outDir, "plain-page.html"));
    assertStringIncludes(html, "<title>Plain Page | Nergy</title>");
    assert(!html.includes("undefined | Nergy"));
    assertEquals(html.includes('rel="canonical"'), false);
    try {
      await Deno.stat(join(outDir, "sitemap.xml"));
      throw new Error("sitemap should be opt-in when siteUrl is omitted");
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    }
  } finally {
    await cleanupDir(root);
  }
});
