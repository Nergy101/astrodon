/**
 * Shared test utilities and helpers
 */

import { join } from '@std/path';
import { build } from '../../mod.ts';

export interface TestBuildOptions {
  contentDir: string;
  outDir: string;
  template?: string;
}

/**
 * Get the benchmark directory path
 */
export function getBenchmarkDir(): string {
  return new URL('../../benchmark', import.meta.url).pathname;
}

/**
 * Get the template path
 */
export function getTemplatePath(): string {
  return new URL('../../template.ts', import.meta.url).pathname;
}

/**
 * Build the benchmark blog for testing
 */
export async function buildBenchmarkBlog(
  outDir: string
): Promise<void> {
  const benchmarkDir = getBenchmarkDir();
  const contentDir = join(benchmarkDir, 'routes');

  await build({
    contentDir,
    outDir,
    template: getTemplatePath(),
  });
}

/**
 * Build a custom test site
 */
export async function buildTestSite(
  options: TestBuildOptions
): Promise<void> {
  await build({
    contentDir: options.contentDir,
    outDir: options.outDir,
    template: options.template ?? getTemplatePath(),
  });
}

/**
 * Clean up a directory (safe - ignores errors)
 */
export async function cleanupDir(dir: string): Promise<void> {
  try {
    await Deno.remove(dir, { recursive: true });
  } catch {
    // Ignore errors - directory might not exist
  }
}

/**
 * Extract text content from HTML elements by class selector
 */
export function extractTextByClass(
  html: string,
  className: string
): string[] {
  const results: string[] = [];
  
  // Determine tag name based on class name
  let tagName = 'span';
  if (className.includes('excerpt')) {
    tagName = 'p';
  } else if (className.includes('title')) {
    tagName = 'h3';
  } else if (className.includes('tag')) {
    tagName = 'span';
  } else if (className.includes('date') || className.includes('author')) {
    tagName = 'span';
  }

  // Match specific tag with class
  const classRegex = new RegExp(
    `<${tagName}[^>]*class="[^"]*${className}[^"]*"[^>]*>(.*?)</${tagName}>`,
    'gis'
  );
  
  let match;
  while ((match = classRegex.exec(html)) !== null) {
    const text = match[1]
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
    if (text) {
      results.push(text);
    }
  }
  
  return results;
}

/**
 * Extract all href attributes from HTML
 */
export function extractLinks(html: string): string[] {
  const results: string[] = [];
  const linkRegex = /href="([^"]+)"/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    results.push(match[1]);
  }
  return results;
}

/**
 * Extract excerpts from HTML using a more specific pattern
 */
export function extractExcerpts(html: string): string[] {
  const excerptRegex =
    /<p[^>]*class="[^"]*content-card-excerpt[^"]*"[^>]*>([^<]*(?:<[^>]*>[^<]*)*?)<\/p>/gi;
  const extractedExcerpts: string[] = [];
  let match;
  
  while ((match = excerptRegex.exec(html)) !== null) {
    const text = match[1]
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
    if (text) {
      extractedExcerpts.push(text);
    }
  }
  
  return extractedExcerpts;
}

/**
 * Create a temporary test content directory with a markdown file
 */
export async function createTestContent(
  dir: string,
  filename: string,
  content: string
): Promise<string> {
  await Deno.mkdir(dir, { recursive: true });
  const filePath = join(dir, filename);
  await Deno.writeTextFile(filePath, content);
  return filePath;
}

