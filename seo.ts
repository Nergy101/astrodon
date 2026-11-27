import { basename, dirname, join, relative } from '@std/path';

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function isExternalUrl(value: string): boolean {
  if (value.startsWith('//')) return true;
  const schemeEnd = value.indexOf(':');
  return schemeEnd > 0 &&
    /^[A-Za-z][A-Za-z0-9+.-]*$/.test(value.slice(0, schemeEnd));
}

export function normalizeBasePath(path: string): string {
  if (/[?#\\]/.test(path)) {
    throw new Error(
      `Invalid basePath '${path}': query, fragment, and backslash are not allowed`,
    );
  }
  const segments = path.split('/').filter(Boolean);
  if (
    segments.some((segment) => {
      try {
        const decoded = decodeURIComponent(segment);
        return decoded === '.' || decoded === '..';
      } catch {
        return true;
      }
    })
  ) {
    throw new Error(
      `Invalid basePath '${path}': invalid or dot segments are not allowed`,
    );
  }
  return segments.length === 0 ? '/' : `/${segments.join('/')}`;
}

export function normalizeSiteUrl(value: string): string | undefined {
  if (!value) return undefined;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(
      `Invalid siteUrl '${value}': expected an absolute http(s) URL`,
    );
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(
      `Invalid siteUrl '${value}': expected an absolute http(s) URL`,
    );
  }
  if (
    url.pathname !== '/' || url.search || url.hash || url.username ||
    url.password
  ) {
    throw new Error(
      `Invalid siteUrl '${value}': configure only the site origin; use basePath for a subdirectory`,
    );
  }
  return url.origin;
}

export function pageRoutePath(contentDir: string, filePath: string): string {
  const relativePath = relative(contentDir, filePath).split('\\').join('/');
  const routePath = relativePath.endsWith('.md')
    ? relativePath.slice(0, -3)
    : relativePath;
  const route = basename(filePath, '.md') === 'index'
    ? dirname(routePath) === '.' ? '' : dirname(routePath)
    : routePath;
  return route ? `/${route}` : '/';
}

export function publicPath(basePath: string, routePath: string): string {
  const normalizedRoute = routePath.startsWith('/')
    ? routePath
    : `/${routePath}`;
  if (basePath === '/') return normalizedRoute;
  return normalizedRoute === '/'
    ? `${basePath}/`
    : `${basePath}${normalizedRoute}`;
}

export function absolutePageUrl(
  siteUrl: string | undefined,
  basePath: string,
  routePath: string,
): string | undefined {
  return siteUrl ? `${siteUrl}${publicPath(basePath, routePath)}` : undefined;
}

export function prefixInternalUrl(basePath: string, value: string): string {
  if (
    basePath === '/' || !value.startsWith('/') || value.startsWith('//') ||
    value === basePath || value.startsWith(`${basePath}/`)
  ) return value;
  return `${basePath}${value}`;
}

export function prefixInternalUrls(basePath: string, html: string): string {
  if (basePath === '/') return html;
  return html.replace(
    /((?:href|src|srcset|poster|action|data-src)=["'])([^"']*)(["'])/gi,
    (_match, prefix, rawValue, quote) => {
      const value = String(rawValue);
      const rewritten = /srcset/i.test(prefix)
        ? value.split(',').map((candidate: string) => {
          const parts = candidate.trim().split(' ', 2);
          return [prefixInternalUrl(basePath, parts[0]), parts[1]]
            .filter(Boolean)
            .join(' ');
        }).join(', ')
        : prefixInternalUrl(basePath, value);
      return `${prefix}${rewritten}${quote}`;
    },
  );
}

export function generateSeoMetadata(
  // deno-lint-ignore no-explicit-any
  meta: Record<string, any>,
  routePath: string,
  siteUrl: string | undefined,
  basePath: string,
  fallbackTitle: string,
): string {
  if (!siteUrl) return '';
  const canonical = typeof meta.canonical === 'string' &&
      (meta.canonical.startsWith('https://') ||
        meta.canonical.startsWith('http://'))
    ? meta.canonical
    : absolutePageUrl(siteUrl, basePath, routePath)!;
  const title = meta.ogTitle ?? meta.title ?? fallbackTitle;
  const description = meta.ogDescription ?? meta.description;
  const image = meta.ogImage ?? meta.image ?? meta.cover;
  const tags = [
    `<link rel="canonical" href="${escapeHtml(canonical)}">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:url" content="${escapeHtml(canonical)}">`,
    `<meta property="og:type" content="${
      escapeHtml(meta.ogType ?? meta.type ?? 'website')
    }">`,
  ];
  if (description) {
    tags.push(
      `<meta name="description" content="${escapeHtml(description)}">`,
    );
    tags.push(
      `<meta property="og:description" content="${escapeHtml(description)}">`,
    );
  }
  if (image) {
    const imageValue = String(image);
    const imageUrl = isExternalUrl(imageValue)
      ? imageValue
      : `${siteUrl}${
        prefixInternalUrl(
          basePath,
          imageValue.startsWith('/') ? imageValue : `/${imageValue}`,
        )
      }`;
    tags.push(`<meta property="og:image" content="${escapeHtml(imageUrl)}">`);
  }
  return tags.join('\n    ');
}

export async function writeSitemap(
  outDir: string,
  contentDir: string,
  markdownFiles: string[],
  siteUrl: string | undefined,
  basePath: string,
): Promise<void> {
  if (!siteUrl) return;
  const locations = markdownFiles
    .map((filePath) =>
      absolutePageUrl(siteUrl, basePath, pageRoutePath(contentDir, filePath))
    )
    .filter((url): url is string => Boolean(url))
    .sort();
  const entries = locations
    .map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`)
    .join('\n');
  const sitemap =
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
  await Deno.writeTextFile(join(outDir, 'sitemap.xml'), sitemap);
}
