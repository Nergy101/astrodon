// Public API for Astrodon as a library

export interface BuildOptions {
  contentDir: string;
  outDir: string;
  assetsDir?: string;
  luaDir?: string;
  template?: string;
  componentsDir?: string;
  allowNet?: boolean;
}

export interface ServeOptions {
  root: string;
  port?: number;
  luaDir?: string;
}

function getScriptUrl(relativePath: string): string {
  const base = new URL("./", import.meta.url);
  return new URL(relativePath, base).toString();
}

export async function build(options: BuildOptions): Promise<void> {
  const buildScript = getScriptUrl("build.ts");
  const pkgBase = new URL("./", import.meta.url);
  const resolvedAssetsDir = options.assetsDir ??
    new URL("assets", pkgBase).pathname;
  const resolvedLuaDir = options.luaDir ??
    new URL("lua-scripts/", pkgBase).toString();
  const resolvedTemplate = options.template ??
    new URL("template.lua", pkgBase).pathname;
  const resolvedComponentsDir = options.componentsDir ??
    new URL("components", pkgBase).pathname;

  const args: string[] = [
    "run",
    "--allow-read",
    "--allow-write",
    "--allow-run",
  ];
  const isRemotePkg = pkgBase.protocol === "http:" || pkgBase.protocol === "https:";
  if (options.allowNet || isRemotePkg) args.push("--allow-net");
  args.push(
    buildScript,
    `--contentDir=${options.contentDir}`,
    `--outDir=${options.outDir}`,
    `--assetsDir=${resolvedAssetsDir}`,
    `--luaDir=${resolvedLuaDir}`,
    `--template=${resolvedTemplate}`,
    `--componentsDir=${resolvedComponentsDir}`,
  );

  const cmd = new Deno.Command("deno", {
    args,
    stdout: "inherit",
    stderr: "inherit",
  });
  const { code } = await cmd.output();
  if (code !== 0) {
    throw new Error("Astrodon build failed");
  }
}

export async function serve(options: ServeOptions): Promise<void> {
  const serveScript = getScriptUrl("serve.ts");
  const pkgBase = new URL("./", import.meta.url);
  const resolvedLuaDir = options.luaDir ??
    new URL("lua-scripts/", pkgBase).toString();

  const args: string[] = [
    "run",
    "--allow-read",
    "--allow-net",
    "--allow-run",
    serveScript,
    `--root=${options.root}`,
    `--luaDir=${resolvedLuaDir}`,
  ];
  if (options.port) args.push(`--port=${options.port}`);

  const cmd = new Deno.Command("deno", {
    args,
    stdout: "inherit",
    stderr: "inherit",
  });
  const { code } = await cmd.output();
  if (code !== 0) {
    throw new Error("Astrodon serve failed");
  }
}
