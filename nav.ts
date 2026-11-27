import { basename, dirname, join, relative } from '@std/path';
import { parseMarkdownFrontmatter } from './frontmatter.ts';
import { escapeHtml } from './seo.ts';

// Frontmatter is arbitrary YAML, so values are intentionally loosely typed.
// deno-lint-ignore no-explicit-any
export type Meta = Record<string, any>;

export interface NavItem {
  title: string;
  url: string;
  date?: string;
  children?: NavItem[];
}

const NAV_ACRONYMS: Record<string, string> = { ai: 'AI' };

export function defaultPageTitle(filePath: string): string {
  const name = basename(filePath, '.md').replace(/[-_]+/g, ' ');
  return name.replace(/\b[a-z]/g, (character) => character.toUpperCase());
}

export function withPageDefaults(metadata: Meta, filePath: string): Meta {
  if (typeof metadata.title !== 'string' || !metadata.title.trim()) {
    metadata.title = defaultPageTitle(filePath);
  }
  return metadata;
}

function formatFolderTitle(folderName: string): string {
  return NAV_ACRONYMS[folderName.toLowerCase()] ??
    folderName.charAt(0).toUpperCase() +
      folderName.slice(1).replace(/_/g, ' ');
}

function sortNavItems(items: NavItem[]): void {
  items.sort((a, b) => {
    if (a.date && b.date) {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    }
    if (a.date && !b.date) return -1;
    if (!a.date && b.date) return 1;
    return a.title.localeCompare(b.title);
  });
}

async function scanNavDirectory(
  dirPath: string,
  urlPrefix: string,
): Promise<NavItem[]> {
  const items: NavItem[] = [];

  for await (const entry of Deno.readDir(dirPath)) {
    if (entry.isFile && entry.name.endsWith('.md')) {
      if (entry.name === 'index.md') continue;
      const fileName = basename(entry.name, '.md');
      const filePath = join(dirPath, entry.name);
      let date = '';
      let title = defaultPageTitle(filePath);

      try {
        const content = await Deno.readTextFile(filePath);
        const meta = withPageDefaults(
          parseMarkdownFrontmatter(content, filePath).metadata as Meta,
          filePath,
        );
        if (meta.date) date = String(meta.date);
        if (meta.title) title = String(meta.title);
      } catch {
        // Fall back to filename title when metadata cannot be read.
      }

      items.push({
        title,
        url: `${urlPrefix}/${fileName}`,
        ...(date ? { date } : {}),
      });
    } else if (entry.isDirectory) {
      const subPrefix = `${urlPrefix}/${entry.name}`;
      const children = await scanNavDirectory(
        join(dirPath, entry.name),
        subPrefix,
      );
      if (children.length > 0) {
        items.push({
          title: formatFolderTitle(entry.name),
          url: subPrefix,
          children,
        });
      }
    }
  }

  sortNavItems(items);
  return items;
}

export async function generateNavigation(
  contentDir: string,
): Promise<NavItem[]> {
  try {
    return await scanNavDirectory(contentDir, '');
  } catch {
    console.error('❌ Could not read routes directory for navigation');
    return [];
  }
}

function containsCurrentPath(item: NavItem, currentPath: string): boolean {
  if (currentPath === item.url) return true;
  return item.children?.some((child) =>
    containsCurrentPath(child, currentPath)
  ) ?? false;
}

function flattenDropdownItems(
  items: NavItem[],
  currentPath: string,
  prefix = '',
): string {
  let html = '';
  for (const child of items) {
    if (child.children && child.children.length > 0) {
      const label = prefix ? `${prefix} / ${child.title}` : child.title;
      const isGroupActive = currentPath === child.url;
      html += `<a href="${escapeHtml(child.url)}" class="nav-dropdown-item${
        isGroupActive ? ' active' : ''
      }">${escapeHtml(label)}</a>`;
      html += flattenDropdownItems(child.children, currentPath, label);
    } else {
      const isChildActive = currentPath === child.url;
      const label = prefix ? `${prefix} / ${child.title}` : child.title;
      html += `<a href="${escapeHtml(child.url)}" class="nav-dropdown-item${
        isChildActive ? ' active' : ''
      }">${escapeHtml(label)}</a>`;
    }
  }
  return html;
}

export function generateNavigationHTML(
  navItems: NavItem[],
  currentPath = '',
): string {
  let html = '';

  for (const item of navItems) {
    if (item.children && item.children.length > 0) {
      const isActive = containsCurrentPath(item, currentPath);
      const activeClass = isActive ? ' active' : '';

      html += `<li class="nav-item nav-dropdown${activeClass}">`;
      html += `<button type="button" class="nav-link nav-dropdown-toggle${
        isActive ? ' active' : ''
      }">${escapeHtml(item.title)}</button>`;
      html += `<div class="nav-dropdown-content">`;

      const isSeeAllActive = currentPath === item.url;
      html += `<a href="${escapeHtml(item.url)}" class="nav-dropdown-item${
        isSeeAllActive ? ' active' : ''
      }">See All ${escapeHtml(item.title)}</a>`;
      html += `<div class="nav-dropdown-separator"></div>`;
      html += flattenDropdownItems(item.children, currentPath);
      html += `</div>`;
      html += `</li>`;
    } else {
      const isActive = currentPath === item.url;
      html += `<li class="nav-item${isActive ? ' active' : ''}">`;
      html += `<a href="${escapeHtml(item.url)}" class="nav-link${
        isActive ? ' active' : ''
      }">${escapeHtml(item.title)}</a>`;
      html += `</li>`;
    }
  }

  return html;
}

export async function processTOCMarker(
  content: string,
  filePath: string,
  contentDir: string,
): Promise<string> {
  const marker = '{{routes:toc}}';
  if (!content.includes(marker)) {
    return content;
  }

  const relativePath = relative(contentDir, filePath).split('\\').join('/');
  const directory = dirname(relativePath);

  if (!filePath.endsWith('/index.md') || directory === '.') {
    return content;
  }

  try {
    const targetDir = join(contentDir, directory);
    const posts: Array<{
      title: string;
      date: string;
      author: string;
      tags: string[];
      excerpt: string;
      filename: string;
      url: string;
    }> = [];

    for await (const entry of Deno.readDir(targetDir)) {
      if (
        entry.isFile &&
        entry.name.endsWith('.md') &&
        entry.name !== 'index.md'
      ) {
        const entryPath = join(targetDir, entry.name);
        const raw = await Deno.readTextFile(entryPath);
        const parsed = parseMarkdownFrontmatter(raw, entryPath);
        const meta = withPageDefaults(parsed.metadata as Meta, entryPath);

        let excerpt = '';
        const firstParagraph = parsed.body.split('\n\n')[0] ?? '';
        if (firstParagraph) {
          excerpt = firstParagraph
            .replace(/^#+\s*/, '')
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .substring(0, 150) + (firstParagraph.length > 150 ? '...' : '');
        }

        const filename = basename(entry.name, '.md');
        posts.push({
          title: meta.title || filename.replace(/-/g, ' ').replace(/_/g, ' '),
          date: meta.date || '',
          author: meta.author || '',
          tags: Array.isArray(meta.tags) ? meta.tags : [],
          excerpt,
          filename,
          url: `/${directory}/${filename}`,
        });
      }
    }

    posts.sort((a, b) => {
      if (a.date && b.date) {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
      if (a.date && !b.date) return -1;
      if (!a.date && b.date) return 1;
      return a.title.localeCompare(b.title);
    });

    const cardClass = directory === 'blogs' ? 'blog-card' : 'content-card';
    const cardsHTML = posts
      .map(
        (post) =>
          `<div class="${cardClass}">
    <a href="${escapeHtml(post.url)}" class="${cardClass}-link-wrapper">
        <div class="${cardClass}-header">
            <h3 class="${cardClass}-title">${escapeHtml(post.title)}</h3>
            ${
            directory === 'blogs' || post.date
              ? `<div class="${cardClass}-meta">
                <span class="${cardClass}-date">${escapeHtml(post.date)}</span>
                ${
                post.author
                  ? `<span class="${cardClass}-author">by ${
                    escapeHtml(post.author)
                  }</span>`
                  : ''
              }
            </div>`
              : ''
          }
        </div>
        ${
            post.excerpt
              ? `<p class="${cardClass}-excerpt">${
                escapeHtml(post.excerpt)
              }</p>`
              : ''
          }
        ${
            post.tags.length > 0
              ? `<div class="${cardClass}-tags">
            ${
                post.tags
                  .map((tag) =>
                    `<span class="${cardClass}-tag">${escapeHtml(tag)}</span>`
                  )
                  .join('')
              }
        </div>`
              : ''
          }
    </a>
</div>`,
      )
      .join('');

    return content.replace(marker, cardsHTML);
  } catch (error) {
    console.error(`❌ Error processing TOC marker for ${filePath}:`, error);
    return content.replace(
      marker,
      `<p>Error loading content from ${escapeHtml(directory)}.</p>`,
    );
  }
}
