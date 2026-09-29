// Public API for Astrodon as a library

/**
 * Options for building a static site with Astrodon.
 *
 * @example
 * ```ts
 * await build({
 *   contentDir: './routes',
 *   outDir: './dist',
 *   assetsDir: './assets',
 *   componentsDir: './components',
 * });
 * ```
 */
export interface BuildOptions {
  /** Path to the directory containing markdown content files */
  contentDir: string;
  /** Path to the output directory where HTML files will be generated */
  outDir: string;
  /** Optional path to the assets directory (images, CSS, JS, etc.) */
  assetsDir?: string;
  /** Optional path to a TypeScript template file for custom rendering */
  template?: string;
  /** Optional path to the components directory (HTML partials like navbar.html) */
  componentsDir?: string;
  /** Whether to allow network access during build (for remote templates) */
  allowNet?: boolean;
  /** URL path prefix used by generated internal links and assets (default: '/') */
  basePath?: string;
  /** Absolute site origin used for sitemap and canonical/Open Graph URLs */
  siteUrl?: string;
}

/**
 * Options for serving the built static site.
 *
 * @example
 * ```ts
 * await serve({
 *   root: './dist',
 *   port: 8000,
 * });
 * ```
 */
export interface ServeOptions {
  /** Path to the root directory containing the built site files */
  root: string;
  /** Optional port number for the development server (default: 8000) */
  port?: number;
  /** Optional URL path prefix for serving a subdirectory deployment (default: '/') */
  basePath?: string;
}

/** Options for the rebuild + live-reload development workflow. */
export interface WatchOptions extends BuildOptions {
  /** Optional port number (default: 8000) */
  port?: number;
  /** Optional cancellation signal for tests and programmatic shutdown */
  signal?: AbortSignal;
}

function getBuildScriptArgs(options: BuildOptions, pkgBase: URL): string[] {
  const resolvedAssetsDir = options.assetsDir ??
    new URL('assets', pkgBase).pathname;
  const resolvedTemplate = options.template ??
    new URL('template.ts', pkgBase).pathname;
  const resolvedComponentsDir = options.componentsDir ??
    new URL('components', pkgBase).pathname;
  const args = [
    `--contentDir=${options.contentDir}`,
    `--outDir=${options.outDir}`,
    `--assetsDir=${resolvedAssetsDir}`,
    `--template=${resolvedTemplate}`,
    `--componentsDir=${resolvedComponentsDir}`,
    `--basePath=${options.basePath ?? '/'}`,
  ];
  if (options.siteUrl) args.push(`--siteUrl=${options.siteUrl}`);
  return args;
}

/**
 * Watches the content/configuration inputs, rebuilds on changes, and serves the
 * output with an SSE-backed browser reload. Runs until its signal is aborted.
 */
export async function watch(options: WatchOptions): Promise<void> {
  if (options.signal?.aborted) return;
  const watchScript = getScriptUrl('watch.ts');
  const pkgBase = new URL('./', import.meta.url);
  const args = [
    'run',
    '--allow-read',
    '--allow-write',
    '--allow-run',
    '--allow-net',
    watchScript,
    ...getBuildScriptArgs(options, pkgBase),
    `--port=${options.port ?? 8000}`,
  ];
  const isRemotePkg = pkgBase.protocol === 'http:' ||
    pkgBase.protocol === 'https:';
  if (options.allowNet || isRemotePkg) args.push('--allowBuildNet=true');

  const child = new Deno.Command('deno', {
    args,
    stdout: 'inherit',
    stderr: 'inherit',
  }).spawn();
  const abort = () => {
    try {
      child.kill('SIGTERM');
    } catch {
      // The watcher may already have exited.
    }
  };
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) abort();
  try {
    const { code } = await child.status;
    if (!options.signal?.aborted && code !== 0) {
      throw new Error('Astrodon watch process failed');
    }
  } finally {
    options.signal?.removeEventListener('abort', abort);
  }
}

function getScriptUrl(relativePath: string): string {
  const base = new URL('./', import.meta.url);
  return new URL(relativePath, base).toString();
}

/**
 * Builds a static site from markdown files.
 *
 * Processes all markdown files in the content directory, converts them to HTML,
 * applies templates and components, optimizes images, and outputs the final site
 * to the output directory.
 *
 * @param options - Configuration options for the build process
 * @returns A promise that resolves when the build is complete
 * @throws {Error} If the build process fails
 *
 * @example
 * ```ts
 * import { build } from 'astrodon';
 *
 * await build({
 *   contentDir: './routes',
 *   outDir: './dist',
 *   assetsDir: './assets',
 * });
 * ```
 */
export async function build(options: BuildOptions): Promise<void> {
  const buildScript = getScriptUrl('build.ts');
  const pkgBase = new URL('./', import.meta.url);
  const resolvedAssetsDir = options.assetsDir ??
    new URL('assets', pkgBase).pathname;
  const resolvedTemplate = options.template ??
    new URL('template.ts', pkgBase).pathname;
  const resolvedComponentsDir = options.componentsDir ??
    new URL('components', pkgBase).pathname;

  const args: string[] = [
    'run',
    '--allow-read',
    '--allow-write',
    '--allow-run',
  ];
  const isRemotePkg = pkgBase.protocol === 'http:' ||
    pkgBase.protocol === 'https:';
  if (options.allowNet || isRemotePkg) args.push('--allow-net');
  args.push(
    buildScript,
    `--contentDir=${options.contentDir}`,
    `--outDir=${options.outDir}`,
    `--assetsDir=${resolvedAssetsDir}`,
    `--template=${resolvedTemplate}`,
    `--componentsDir=${resolvedComponentsDir}`,
  );
  if (options.basePath) args.push(`--basePath=${options.basePath}`);
  if (options.siteUrl) args.push(`--siteUrl=${options.siteUrl}`);

  const cmd = new Deno.Command('deno', {
    args,
    stdout: 'inherit',
    stderr: 'inherit',
  });
  const { code } = await cmd.output();
  if (code !== 0) {
    throw new Error('Astrodon build failed');
  }
}

/**
 * Starts a development server to serve the built static site.
 *
 * Serves files from the specified root directory with automatic fallback to
 * index.html for clean URLs. Includes caching for API endpoints and proper
 * content-type headers.
 *
 * @param options - Configuration options for the server
 * @returns A promise that resolves when the server starts (runs indefinitely)
 * @throws {Error} If the server fails to start
 *
 * @example
 * ```ts
 * import { serve } from 'astrodon';
 *
 * await serve({
 *   root: './dist',
 *   port: 8000,
 * });
 * ```
 */
export async function serve(options: ServeOptions): Promise<void> {
  const serveScript = getScriptUrl('serve.ts');

  const args: string[] = [
    'run',
    '--allow-read',
    '--allow-net',
    '--allow-run',
    serveScript,
    `--root=${options.root}`,
  ];
  if (options.port) args.push(`--port=${options.port}`);
  if (options.basePath) args.push(`--basePath=${options.basePath}`);

  const cmd = new Deno.Command('deno', {
    args,
    stdout: 'inherit',
    stderr: 'inherit',
  });
  const { code } = await cmd.output();
  if (code !== 0) {
    throw new Error('Astrodon serve failed');
  }
}
