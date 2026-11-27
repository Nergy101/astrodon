#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run

import { copy, ensureDir } from '@std/fs';
import {
  basename,
  dirname,
  extname,
  join,
  normalize,
  relative,
  resolve,
  toFileUrl,
} from '@std/path';
import { BuildCache, computeConfigHash, sha256 } from './cache.ts';
import {
  DEFAULT_BRAND_NAME,
  DEFAULT_NAVBAR_HTML,
  DEFAULT_SITE_TITLE,
  DEFAULT_TEMPLATE,
  NAVBAR_COMPONENT_PLACEHOLDER,
} from './default-template.ts';
import { parseMarkdownFrontmatter } from './frontmatter.ts';
import { parseMarkdown } from './markdown.ts';
import {
  generateNavigation,
  generateNavigationHTML,
  type Meta,
  processTOCMarker,
  withPageDefaults,
} from './nav.ts';
import {
  escapeHtml,
  generateSeoMetadata,
  normalizeBasePath,
  normalizeSiteUrl,
  pageRoutePath,
  prefixInternalUrls,
  writeSitemap,
} from './seo.ts';

function getArg(name: string, defaultValue: string): string {
  const arg = Deno.args.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.substring(name.length + 3) : defaultValue;
}

const contentDir = getArg('contentDir', './routes');
const outDir = getArg('outDir', './dist');
const assetsDir = getArg('assetsDir', './assets');
const componentsDir = getArg('componentsDir', './components');
const templatePath = getArg('template', './template.ts');
const siteTitle = getArg('siteTitle', DEFAULT_SITE_TITLE);
const brandName = getArg('brandName', DEFAULT_BRAND_NAME);
const logo = getArg('logo', '');
const verbose = getArg('verbose', 'false') === 'true';
let basePath = '/';
let siteUrl: string | undefined;

interface PageData {
  content: string;
  meta: Meta;
  path: string;
}

const buildMetrics = {
  startTime: 0,
  fileProcessingTimes: new Map<string, number>(),
  totalFiles: 0,
  cachedFiles: 0,
  processedFiles: 0,
};

function startBuildTimer(): void {
  buildMetrics.startTime = performance.now();
  buildMetrics.fileProcessingTimes.clear();
  buildMetrics.totalFiles = 0;
  buildMetrics.cachedFiles = 0;
  buildMetrics.processedFiles = 0;
}

function logBuildMetrics(): void {
  const totalTime = performance.now() - buildMetrics.startTime;
  const avgProcessingTime = buildMetrics.processedFiles > 0
    ? Array.from(buildMetrics.fileProcessingTimes.values()).reduce(
      (a, b) => a + b,
      0,
    ) / buildMetrics.processedFiles
    : 0;

  console.log('\n📊 Build Performance Metrics:');
  console.log(`⏱️  Total build time: ${totalTime.toFixed(2)}ms`);
  console.log(`📁 Total files: ${buildMetrics.totalFiles}`);
  console.log(`⚡ Cached files: ${buildMetrics.cachedFiles}`);
  console.log(`🔄 Processed files: ${buildMetrics.processedFiles}`);
  console.log(`📈 Average processing time: ${avgProcessingTime.toFixed(2)}ms`);

  if (buildMetrics.fileProcessingTimes.size > 0) {
    const sortedFiles = Array.from(buildMetrics.fileProcessingTimes.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);

    console.log('\n🐌 Slowest files:');
    sortedFiles.forEach(([file, time]) => {
      console.log(`  ${file}: ${time.toFixed(2)}ms`);
    });
  }
}

async function loadComponentHtml(name: string): Promise<string> {
  try {
    return await Deno.readTextFile(join(componentsDir, `${name}.html`));
  } catch {
    if (name === 'navbar') return DEFAULT_NAVBAR_HTML;
    return '';
  }
}

async function processTemplate(
  mdPath: string,
  content: string,
  meta: Meta,
): Promise<string> {
  const isRemote = templatePath.startsWith('http://') ||
    templatePath.startsWith('https://') ||
    templatePath.startsWith('file://');

  if (!isRemote) {
    const resolved = resolve(templatePath);
    try {
      await Deno.stat(resolved);
    } catch (error) {
      if (
        error instanceof Deno.errors.NotFound &&
        templatePath === './template.ts'
      ) {
        return content;
      }
      throw new Error(
        `Template file not found at '${templatePath}': ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  const templateUrl = isRemote
    ? templatePath
    : toFileUrl(resolve(templatePath)).href;
  const templateModule = await import(templateUrl);

  if (templateModule.render && typeof templateModule.render === 'function') {
    return await templateModule.render(content, { meta, path: mdPath });
  }
  return content;
}

async function processMarkdownFile(
  filePath: string,
  cache: BuildCache,
): Promise<PageData> {
  const raw = await Deno.readTextFile(filePath);
  const parsed = parseMarkdownFrontmatter(raw, filePath);
  const meta = withPageDefaults(parsed.metadata as Meta, filePath);

  // Skip cache when {{routes:toc}} is used since it depends on sibling files.
  const usesToc = parsed.body.includes('{{routes:toc}}');
  const contentHash = await sha256(raw);

  if (!usesToc) {
    const cachedHtml = cache.get(filePath, contentHash);
    if (cachedHtml !== undefined) {
      if (verbose) console.log(`⚡ Using cached result for ${filePath}`);
      buildMetrics.cachedFiles++;
      return { content: cachedHtml, meta, path: filePath };
    }
  }

  const tocProcessedContent = await processTOCMarker(
    parsed.body,
    filePath,
    contentDir,
  );
  const htmlContent = parseMarkdown(tocProcessedContent, outDir);
  const processedContent = await processTemplate(filePath, htmlContent, meta);

  if (!usesToc) {
    cache.set(filePath, contentHash, processedContent);
  }

  return {
    content: processedContent,
    meta,
    path: filePath,
  };
}

function buildBrandLogoHtml(): string {
  if (!logo) return '';
  return `<img src="${escapeHtml(logo)}" alt="${
    escapeHtml(brandName)
  }" class="navbar-logo">`;
}

async function generateHTML(
  content: string,
  meta: Meta,
  navigation: string,
  routePath: string,
): Promise<string> {
  let html = DEFAULT_TEMPLATE;

  const navbarHtml = (await loadComponentHtml('navbar'))
    .replace('{{brandLogo}}', buildBrandLogoHtml())
    .replace('{{brandName}}', escapeHtml(brandName));

  html = html.replace(NAVBAR_COMPONENT_PLACEHOLDER, navbarHtml);

  const pageTitle = String(meta.title || siteTitle);
  const fullTitle = pageTitle === siteTitle
    ? escapeHtml(siteTitle)
    : `${escapeHtml(pageTitle)} | ${escapeHtml(siteTitle)}`;

  html = html.replace('{{title}}', fullTitle);
  html = html.replace('{{content}}', content);
  html = html.replace('{{navigation}}', navigation);

  const additionalScripts = `
    <!-- Prism.js for syntax highlighting -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism.min.css">
    <script defer src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-core.min.js"></script>
    <script defer src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/plugins/autoloader/prism-autoloader.min.js"></script>
    `;

  const seoMetadata = generateSeoMetadata(
    meta,
    routePath,
    siteUrl,
    basePath,
    pageTitle,
  );
  html = html.replace(
    '</head>',
    `${seoMetadata}${seoMetadata ? '\n    ' : ''}${additionalScripts}</head>`,
  );

  return prefixInternalUrls(basePath, html);
}

async function copyAssets(): Promise<void> {
  const distAssetsDir = join(outDir, 'assets');

  try {
    await ensureDir(distAssetsDir);

    const copyAssetRecursively = async (
      dir: string,
      relBase = '',
    ): Promise<void> => {
      try {
        for await (const entry of Deno.readDir(dir)) {
          const sourcePath = join(dir, entry.name);
          const relativePath = join(relBase, entry.name);
          const destPath = join(distAssetsDir, relativePath);

          if (entry.isFile) {
            await ensureDir(dirname(destPath));
            await copy(sourcePath, destPath, { overwrite: true });
            if (verbose) console.log(`📁 Copied ${relativePath}`);
          } else if (entry.isDirectory) {
            await ensureDir(destPath);
            await copyAssetRecursively(sourcePath, relativePath);
          }
        }
      } catch {
        if (verbose) console.log(`ℹ️  Could not read directory ${dir}`);
      }
    };

    await copyAssetRecursively(assetsDir);
  } catch {
    if (verbose) console.log('ℹ️  No assets directory found');
  }

  try {
    await copy(join(assetsDir, 'favicon.ico'), join(outDir, 'favicon.ico'), {
      overwrite: true,
    });
  } catch {
    // Ignore if favicon.ico is not present.
  }
}

async function optimizeImages(): Promise<void> {
  const distAssetsDir = join(outDir, 'assets');
  const imageFiles: Array<{ fullPath: string; relativePath: string }> = [];

  async function findImages(dir: string, relBase = ''): Promise<void> {
    try {
      for await (const entry of Deno.readDir(dir)) {
        const fullPath = join(dir, entry.name);
        const relativePath = join(relBase, entry.name);

        if (entry.isFile) {
          const ext = extname(entry.name).toLowerCase();
          if (
            ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff'].includes(ext)
          ) {
            imageFiles.push({ fullPath, relativePath });
          }
        } else if (entry.isDirectory) {
          await findImages(fullPath, relativePath);
        }
      }
    } catch {
      if (verbose) console.log(`ℹ️  Could not read directory ${dir}`);
    }
  }

  try {
    await ensureDir(distAssetsDir);
    await findImages(assetsDir);

    if (imageFiles.length === 0) return;

    let optimiztAvailable = false;
    try {
      const { code } = await new Deno.Command('optimizt', {
        args: ['--help'],
        stdout: 'null',
        stderr: 'null',
      }).output();
      optimiztAvailable = code === 0;
    } catch {
      optimiztAvailable = false;
    }

    if (!optimiztAvailable) {
      if (verbose) {
        console.log('⚠️  optimizt not found, skipping webp optimization');
      }
      return;
    }

    for (const { fullPath, relativePath } of imageFiles) {
      try {
        const outputPath = join(
          distAssetsDir,
          relativePath.replace(/\.[^.]+$/, '.webp'),
        );
        const explicitWebpSource = fullPath.replace(/\.[^.]+$/, '.webp');

        try {
          if ((await Deno.stat(explicitWebpSource)).isFile) {
            if (verbose) {
              console.log(`⏭️  Skipping ${relativePath} (explicit .webp exists)`);
            }
            continue;
          }
        } catch {
          // No explicit .webp source file; proceed with optimization.
        }

        try {
          const [srcStat, destStat] = await Promise.all([
            Deno.stat(fullPath),
            Deno.stat(outputPath),
          ]);
          const srcMtime = srcStat.mtime ? srcStat.mtime.getTime() : 0;
          const destMtime = destStat.mtime ? destStat.mtime.getTime() : 0;
          if (destMtime >= srcMtime) {
            if (verbose) console.log(`⏭️  Skipping ${relativePath} (cached)`);
            continue;
          }
        } catch {
          // Destination does not exist yet.
        }

        await ensureDir(dirname(outputPath));
        const { code, stderr } = await new Deno.Command('optimizt', {
          args: [fullPath, '--webp', '--force'],
          stdout: 'piped',
          stderr: 'piped',
        }).output();

        const webpSource = fullPath.replace(/\.[^.]+$/, '.webp');
        if (code === 0) {
          await copy(webpSource, outputPath, { overwrite: true });
          await Deno.remove(webpSource);
          if (verbose) {
            console.log(
              `✅ Optimized ${relativePath} → ${basename(outputPath)}`,
            );
          }
        } else {
          console.error(
            `❌ Failed to optimize ${relativePath}:`,
            new TextDecoder().decode(stderr),
          );
        }
      } catch (error) {
        console.error(`❌ Error processing ${fullPath}:`, error);
      }
    }
  } catch {
    if (verbose) console.log('ℹ️  Image optimization skipped');
  }
}

function outputPathForMarkdown(filePath: string): string {
  const relativePath = relative(contentDir, filePath);
  const withoutExtension = relativePath.endsWith('.md')
    ? relativePath.slice(0, -3)
    : relativePath;
  if (basename(filePath, '.md') === 'index') {
    const directory = dirname(withoutExtension);
    return join(
      outDir,
      directory === '.' ? 'index.html' : join(directory, 'index.html'),
    );
  }
  return join(outDir, `${withoutExtension}.html`);
}

async function findOutputCollisions(
  markdownFiles: string[],
): Promise<string[]> {
  const planned = new Map<string, { path: string; source: string }>();
  const collisions = new Set<string>();
  const separator = Deno.build.os === 'windows' ? '\\' : '/';
  const register = (path: string, source: string) => {
    const normalizedPath = normalize(path);
    const key = Deno.build.os === 'windows'
      ? normalizedPath.toLowerCase()
      : normalizedPath;
    let collisionFound = false;
    for (const [existingKey, previous] of planned) {
      if (
        key === existingKey || key.startsWith(`${existingKey}${separator}`) ||
        existingKey.startsWith(`${key}${separator}`)
      ) {
        collisions.add(
          `Output path collision at ${normalizedPath}: ${previous.source} and ${source}`,
        );
        collisionFound = true;
      }
    }
    if (!collisionFound) planned.set(key, { path: normalizedPath, source });
  };

  for (const filePath of markdownFiles) {
    register(outputPathForMarkdown(filePath), `page ${filePath}`);
  }

  let imageOptimizerAvailable: boolean | undefined;
  const pendingWebpOptimizations: Array<{ path: string; source: string }> = [];
  const explicitAssetKeys = new Set<string>();
  async function scanAssets(
    directory: string,
    relativePath = '',
  ): Promise<void> {
    let entries: Deno.DirEntry[];
    try {
      entries = [];
      for await (const entry of Deno.readDir(directory)) entries.push(entry);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound && relativePath === '') return;
      throw error;
    }

    for (const entry of entries) {
      const sourcePath = join(directory, entry.name);
      const assetPath = relativePath
        ? join(relativePath, entry.name)
        : entry.name;
      if (entry.isDirectory) {
        await scanAssets(sourcePath, assetPath);
      } else if (entry.isFile) {
        const assetOutPath = join(outDir, 'assets', assetPath);
        const assetKey = Deno.build.os === 'windows'
          ? normalize(assetOutPath).toLowerCase()
          : normalize(assetOutPath);
        explicitAssetKeys.add(assetKey);
        register(assetOutPath, `asset ${sourcePath}`);
        if (assetPath === 'favicon.ico') {
          register(
            join(outDir, 'favicon.ico'),
            `root favicon copied from ${sourcePath}`,
          );
        }
        const assetExtension = extname(assetPath);
        if (
          ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff'].includes(
            assetExtension.toLowerCase(),
          )
        ) {
          if (imageOptimizerAvailable === undefined) {
            try {
              const result = await new Deno.Command('optimizt', {
                args: ['--help'],
                stdout: 'null',
                stderr: 'null',
              }).output();
              imageOptimizerAvailable = result.code === 0;
            } catch {
              imageOptimizerAvailable = false;
            }
          }
          if (imageOptimizerAvailable) {
            const optimizedPath = `${
              assetPath.slice(0, -assetExtension.length)
            }.webp`;
            pendingWebpOptimizations.push({
              path: join(outDir, 'assets', optimizedPath),
              source: `optimized WebP from ${sourcePath}`,
            });
          }
        }
      }
    }
  }

  await scanAssets(assetsDir);
  for (const webp of pendingWebpOptimizations) {
    const key = Deno.build.os === 'windows'
      ? normalize(webp.path).toLowerCase()
      : normalize(webp.path);
    if (!explicitAssetKeys.has(key)) {
      register(webp.path, webp.source);
    }
  }
  if (siteUrl) register(join(outDir, 'sitemap.xml'), 'generated sitemap');
  register(join(outDir, 'serve.ts'), 'generated development server');
  return [...collisions];
}

async function build(): Promise<void> {
  console.log('🚀 Starting build...');
  startBuildTimer();
  basePath = normalizeBasePath(getArg('basePath', '/'));
  siteUrl = normalizeSiteUrl(getArg('siteUrl', ''));

  const navItems = await generateNavigation(contentDir);
  if (verbose) {
    console.log('Navigation items:', navItems);
    console.log('Navigation HTML:', generateNavigationHTML(navItems));
  }

  const markdownFiles: string[] = [];
  async function scanDirectory(dir: string): Promise<void> {
    for await (const entry of Deno.readDir(dir)) {
      if (entry.isFile && entry.name.endsWith('.md')) {
        markdownFiles.push(join(dir, entry.name));
      } else if (entry.isDirectory) {
        await scanDirectory(join(dir, entry.name));
      }
    }
  }

  try {
    await scanDirectory(contentDir);
  } catch (error) {
    throw new Error(
      `Could not read routes directory '${contentDir}': ${String(error)}`,
    );
  }
  buildMetrics.totalFiles = markdownFiles.length;

  if (markdownFiles.length === 0) {
    console.log('ℹ️  No markdown files found in routes/');
    const elapsed = performance.now() - buildMetrics.startTime;
    console.log(
      `✅ Build succeeded: 0 pages, 0 failed, 0 cached, ${elapsed.toFixed(2)}ms`,
    );
    logBuildMetrics();
    return;
  }

  const frontmatterErrors: string[] = [];
  for (const filePath of markdownFiles) {
    try {
      parseMarkdownFrontmatter(await Deno.readTextFile(filePath), filePath);
    } catch (error) {
      frontmatterErrors.push(
        error instanceof Error ? error.message : String(error),
      );
    }
  }
  if (frontmatterErrors.length > 0) {
    frontmatterErrors.forEach((error) => console.error(`❌ ${error}`));
    throw new Error(
      `Frontmatter validation failed for ${frontmatterErrors.length} file(s)`,
    );
  }

  const collisions = await findOutputCollisions(markdownFiles);
  if (collisions.length > 0) {
    collisions.forEach((collision) => console.error(`❌ ${collision}`));
    throw new Error(`${collisions.length} output path collision(s)`);
  }

  await ensureDir(outDir);

  await copyAssets();
  await optimizeImages();

  const configHash = await computeConfigHash({
    templatePath,
    componentsDir,
    basePath,
    siteUrl,
    siteTitle,
    brandName,
    logo: logo || undefined,
  });
  const cache = await BuildCache.load(outDir, configHash);

  const processingPromises = markdownFiles.map(async (filePath) => {
    const startTime = performance.now();
    if (verbose) console.log(`📝 Processing ${filePath}...`);

    try {
      const pageData = await processMarkdownFile(filePath, cache);
      const currentPath = pageRoutePath(contentDir, filePath);
      const pageNavigationHTML = generateNavigationHTML(navItems, currentPath);
      const html = await generateHTML(
        pageData.content,
        pageData.meta,
        pageNavigationHTML,
        currentPath,
      );

      const outputPath = outputPathForMarkdown(filePath);
      await ensureDir(dirname(outputPath));
      await Deno.writeTextFile(outputPath, html);
      if (verbose) console.log(`✅ Generated ${outputPath}`);

      const processingTime = performance.now() - startTime;
      buildMetrics.fileProcessingTimes.set(filePath, processingTime);
      buildMetrics.processedFiles++;

      return { success: true, filePath, outputPath, processingTime };
    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error);
      return { success: false, filePath, error };
    }
  });

  const results = await Promise.all(processingPromises);
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  if (failed > 0) {
    throw new Error(
      `Build failed: ${failed} of ${markdownFiles.length} pages could not be generated`,
    );
  }

  await cache.save();
  await writeSitemap(outDir, contentDir, markdownFiles, siteUrl, basePath);

  const elapsed = performance.now() - buildMetrics.startTime;
  console.log(
    `✅ Build succeeded: ${successful} pages, 0 failed, ${buildMetrics.cachedFiles} cached, ${
      elapsed.toFixed(2)
    }ms`,
  );

  try {
    const serveUrl = new URL('./serve.ts', import.meta.url);
    if (serveUrl.protocol === 'file:') {
      let serveSrc = await Deno.readTextFile(serveUrl);
      serveSrc = serveSrc.replace(
        'const ROOT = getArg("root", "./dist");',
        'const ROOT = getArg("root", ".");',
      );
      await Deno.writeTextFile(join(outDir, 'serve.ts'), serveSrc);
    }
  } catch (error) {
    console.error('❌ Failed to copy/patch serve.ts:', error);
  }

  logBuildMetrics();
  console.log('🎉 Build complete!');
}

if (import.meta.main) {
  try {
    await build();
  } catch (error) {
    logBuildMetrics();
    console.error(
      `❌ Build failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    Deno.exitCode = 1;
  }
}
