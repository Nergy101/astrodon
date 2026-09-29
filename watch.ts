#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run --allow-net

import { dirname, resolve } from "@std/path";

function getArg(name: string, defaultValue = ""): string {
  const arg = Deno.args.find((value) => value.startsWith(`--${name}=`));
  return arg ? arg.slice(name.length + 3) : defaultValue;
}

const contentDir = getArg("contentDir", "./routes");
const outDir = getArg("outDir", "./dist");
const assetsDir = getArg("assetsDir", "./assets");
const templatePath = getArg("template", "./template.ts");
const componentsDir = getArg("componentsDir", "./components");
const basePath = getArg("basePath", "/");
const siteUrl = getArg("siteUrl");
const port = Number(getArg("port", "8000"));
const allowBuildNet = getArg("allowBuildNet") === "true" ||
  ["http:", "https:"].includes(new URL("./", import.meta.url).protocol);
const buildScript = new URL("./build.ts", import.meta.url).toString();
const serveScript = new URL("./serve.ts", import.meta.url).toString();

function buildArgs(): string[] {
  const args = [
    "run",
    "--allow-read",
    "--allow-write",
    "--allow-run",
  ];
  if (allowBuildNet) args.push("--allow-net");
  args.push(
    buildScript,
    `--contentDir=${contentDir}`,
    `--outDir=${outDir}`,
    `--assetsDir=${assetsDir}`,
    `--template=${templatePath}`,
    `--componentsDir=${componentsDir}`,
    `--basePath=${basePath}`,
  );
  if (siteUrl) args.push(`--siteUrl=${siteUrl}`);
  return args;
}

async function buildOnce(): Promise<boolean> {
  const { code } = await new Deno.Command("deno", {
    args: buildArgs(),
    stdout: "inherit",
    stderr: "inherit",
  }).output();
  return code === 0;
}

function watcherRoots(): string[] {
  return [
    ...new Set(
      [contentDir, assetsDir, componentsDir, templatePath].map((path) => {
        const absolutePath = resolve(path);
        try {
          return Deno.statSync(absolutePath).isDirectory
            ? absolutePath
            : dirname(absolutePath);
        } catch {
          return dirname(absolutePath);
        }
      }),
    ),
  ];
}

function isSameOrChild(root: string, candidate: string): boolean {
  const separator = Deno.build.os === "windows" ? String.fromCharCode(92) : "/";
  const normalizedRoot = Deno.build.os === "windows"
    ? root.toLowerCase()
    : root;
  const normalizedCandidate = Deno.build.os === "windows"
    ? candidate.toLowerCase()
    : candidate;
  return normalizedCandidate === normalizedRoot ||
    normalizedCandidate.startsWith(`${normalizedRoot}${separator}`);
}

function isOutputPath(path: string): boolean {
  return isSameOrChild(resolve(outDir), resolve(path));
}

function isRelevantInput(path: string): boolean {
  const changedPath = resolve(path);
  if (
    [contentDir, assetsDir, componentsDir].some((directory) =>
      isSameOrChild(resolve(directory), changedPath)
    )
  ) return true;

  const templateAbsolutePath = resolve(templatePath);
  try {
    if (Deno.statSync(templateAbsolutePath).isDirectory) {
      return isSameOrChild(templateAbsolutePath, changedPath);
    }
  } catch {
    // Also watch for a missing template being created at this path.
  }
  return changedPath === templateAbsolutePath;
}

async function main(): Promise<void> {
  const watcher = Deno.watchFs(watcherRoots());
  let stopping = false;
  const closeWatcher = () => {
    stopping = true;
    watcher.close();
  };
  Deno.addSignalListener("SIGINT", closeWatcher);
  Deno.addSignalListener("SIGTERM", closeWatcher);

  let serveProcess: Deno.ChildProcess | undefined;
  let serveExitCode: number | undefined;
  try {
    const initialBuildSucceeded = await buildOnce();
    if (!initialBuildSucceeded) {
      console.error("⚠️  Initial build failed; watching for a fix.");
    }
    if (stopping) return;

    serveProcess = new Deno.Command("deno", {
      args: [
        "run",
        "--allow-read",
        "--allow-net",
        serveScript,
        `--root=${outDir}`,
        `--port=${port}`,
        `--basePath=${basePath}`,
        "--liveReload=true",
      ],
      stdout: "inherit",
      stderr: "inherit",
    }).spawn();
    void serveProcess.status.then((status) => {
      if (!stopping) {
        serveExitCode = status.code;
        console.error(
          `❌ Development server exited with status ${status.code}`,
        );
        closeWatcher();
      }
    });

    console.log(
      `👀 Watching ${contentDir}, ${assetsDir}, ${componentsDir}, and ${templatePath}`,
    );
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    let buildRunning = false;
    let rebuildAgain = false;

    const rebuild = async () => {
      if (buildRunning) {
        rebuildAgain = true;
        return;
      }
      buildRunning = true;
      do {
        rebuildAgain = false;
        console.log("🔄 Change detected; rebuilding...");
        const succeeded = await buildOnce();
        if (succeeded) {
          const endpoint = `${
            basePath === "/" ? "" : basePath
          }/__astrodon/reload`;
          try {
            await fetch(`http://127.0.0.1:${port}${endpoint}`, {
              method: "POST",
            });
          } catch (error) {
            console.error("❌ Could not notify live-reload clients:", error);
          }
        }
      } while (rebuildAgain && !stopping);
      buildRunning = false;
    };

    for await (const event of watcher) {
      if (stopping) break;
      if (
        event.kind === "access" ||
        !event.paths.some((path) =>
          !isOutputPath(path) && isRelevantInput(path)
        )
      ) continue;
      if (debounceTimer !== undefined) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = undefined;
        void rebuild();
      }, 120);
    }

    if (debounceTimer !== undefined) clearTimeout(debounceTimer);
    if (serveExitCode !== undefined) {
      throw new Error(`Development server exited with status ${serveExitCode}`);
    }
  } finally {
    stopping = true;
    watcher.close();
    Deno.removeSignalListener("SIGINT", closeWatcher);
    Deno.removeSignalListener("SIGTERM", closeWatcher);
    if (serveProcess) {
      try {
        serveProcess.kill("SIGTERM");
      } catch {
        // It may have exited already.
      }
      await serveProcess.status;
    }
  }
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(
      `❌ Astrodon watch failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    Deno.exitCode = 1;
  }
}
