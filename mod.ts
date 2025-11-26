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
  const resolvedAssetsDir =
    options.assetsDir ?? new URL('assets', pkgBase).pathname;
  const resolvedTemplate =
    options.template ?? new URL('template.ts', pkgBase).pathname;
  const resolvedComponentsDir =
    options.componentsDir ?? new URL('components', pkgBase).pathname;

  const args: string[] = [
    'run',
    '--allow-read',
    '--allow-write',
    '--allow-run',
  ];
  const isRemotePkg =
    pkgBase.protocol === 'http:' || pkgBase.protocol === 'https:';
  if (options.allowNet || isRemotePkg) args.push('--allow-net');
  args.push(
    buildScript,
    `--contentDir=${options.contentDir}`,
    `--outDir=${options.outDir}`,
    `--assetsDir=${resolvedAssetsDir}`,
    `--template=${resolvedTemplate}`,
    `--componentsDir=${resolvedComponentsDir}`
  );

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
