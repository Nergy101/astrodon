#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run

import { copy, ensureDir } from '@std/fs';
import { basename, dirname, extname, join, normalize, relative } from '@std/path';
import { crypto } from '@std/crypto';
import { parseMarkdownFrontmatter } from './frontmatter.ts';

// Frontmatter is arbitrary YAML, so values are intentionally loosely typed.
// deno-lint-ignore no-explicit-any
type Meta = Record<string, any>;

// Cache for processed files to avoid reprocessing unchanged content
const fileCache = new Map<string, { hash: string; content: string }>();

// Configurable directories via CLI flags
function getArg(name: string, defaultValue: string): string {
  const arg = Deno.args.find((a) => a.startsWith(`--${name}=`));
  if (!arg) return defaultValue;
  return arg.substring(name.length + 3);
}

function normalizeBasePath(path: string): string {
  if (/[?#\\\\]/.test(path)) {
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

function normalizeSiteUrl(value: string): string | undefined {
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

// Content and output directories (can be absolute or relative)
const contentDir = getArg('contentDir', './routes');
const outDir = getArg('outDir', './dist');
const assetsDir = getArg('assetsDir', './assets');
const componentsDir = getArg('componentsDir', './components');
const templatePath = getArg('template', './template.ts');
let basePath = '/';
let siteUrl: string | undefined;

// Simple hash function for file content
async function getFileHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Check if file needs reprocessing
async function needsReprocessing(
  filePath: string,
  content: string,
): Promise<boolean> {
  const cached = fileCache.get(filePath);
  if (!cached) return true;

  const currentHash = await getFileHash(content);
  return cached.hash !== currentHash;
}

// Update cache after processing
async function updateCache(
  filePath: string,
  content: string,
  processedContent: string,
) {
  const hash = await getFileHash(content);
  fileCache.set(filePath, { hash, content: processedContent });
}

function isExternalUrl(value: string): boolean {
  if (value.startsWith('//')) return true;
  const schemeEnd = value.indexOf(':');
  return schemeEnd > 0 &&
    /^[A-Za-z][A-Za-z0-9+.-]*$/.test(value.slice(0, schemeEnd));
}

// Optimized markdown to HTML conversion with consolidated regex operations
function parseMarkdown(markdown: string): string {
  // Store script tags first to preserve their structure
  const scriptBlocks: string[] = [];
  let scriptBlockIndex = 0;

  markdown = markdown.replace(
    /<script>([\s\S]*?)<\/script>/g,
    function (match, _scriptContent) {
      scriptBlocks.push(match);
      return `\n\n__SCRIPT_BLOCK_${scriptBlockIndex++}__\n\n`;
    },
  );

  // Images - ensure proper asset paths with WebP fallback (process before links)
  markdown = markdown.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (_match, alt, src) => {
      // Clean up src path
      let origSrc = src;
      if (!isExternalUrl(src) && !src.startsWith('/assets/')) {
        origSrc = `/assets/${src.replace(/^\.?\/?/, '')}`;
      }

      // Generate WebP path
      let webpSrc = origSrc;
      // Remove any query/hash from src for webp path
      webpSrc = webpSrc.replace(/[#?].*$/, '');
      webpSrc = webpSrc.replace(/\.[^.\/]+$/, '.webp');

      // Check if WebP file exists in output assets
      const webpPath = join(outDir, webpSrc.replace(/^\/assets\//, 'assets/'));
      let webpExists = false;
      try {
        // Synchronous check for file existence
        const stat = Deno.statSync(webpPath);
        webpExists = stat.isFile;
      } catch {
        // File doesn't exist
        webpExists = false;
      }

      // Use WebP directly if it exists, otherwise use original
      if (webpExists) {
        return `<img src="${webpSrc}" alt="${alt}">`;
      } else {
        // If WebP doesn't exist, just use the original image
        return `<img src="${origSrc}" alt="${alt}">`;
      }
    },
  );

  // Links (process after images to avoid conflicts)
  markdown = markdown.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_match, text, url) => {
      // Add target="_blank" to all links
      return `<a href="${url}" target="&#95;blank" rel="noopener noreferrer">${text}</a>`;
    },
  );

  // --- CODE BLOCK HANDLING ---
  // Store raw code blocks and insert uncommon delimiter placeholders
  // This MUST happen BEFORE list processing to prevent YAML/JSON content from being converted to lists
  const rawCodeBlocks: { lang: string; code: string }[] = [];
  let rawCodeBlockIndex = 0;
  // Support CRLF and optional/trailing spaces after language token
  markdown = markdown.replace(
    /```([^\r\n]+)?\r?\n([\s\S]*?)```/g,
    function (_match, language, code) {
      rawCodeBlocks.push({
        lang: language ? String(language).trim() : 'plaintext',
        code: code, // preserve as-is
      });
      return `@@CODEBLOCK${rawCodeBlockIndex++}@@`;
    },
  );
  // --- END CODE BLOCK HANDLING ---

  // Wrap standalone HTML blocks (e.g., <script>...</script>) in <pre><code> unless already in a code block or script block placeholder
  markdown = markdown.replace(
    /(^|\n)(<script[\s\S]*?<\/script>)/g,
    (match, p1, p2) => {
      // Only wrap if not already inside a code block or script block placeholder
      if (
        !/^@@CODEBLOCK\d+@@$/.test(p2.trim()) &&
        !/^__SCRIPT_BLOCK_\d+__$/.test(p2.trim())
      ) {
        return `${p1}<pre><code class=\"language-html\">${
          p2
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
        }</code></pre>`;
      }
      return match;
    },
  );

  // --- NESTED LISTS HANDLING ---
  // We'll process the markdown line by line for lists, then join back for the rest of the regexes
  const lines = markdown.split(/\r?\n/);
  const htmlLines: string[] = [];
  const listStack: { type: 'ul' | 'ol'; indent: number }[] = [];
  const listItemRegex = /^([ ]{0,6})([-*]|\d+\.)[ ]+(.*)$/;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(listItemRegex);
    if (match) {
      const indent = Math.floor(match[1].length / 2); // 2 spaces per level
      const marker = match[2];
      const content = match[3];
      const isOrdered = /\d+\./.test(marker);
      const type = isOrdered ? 'ol' : 'ul';

      // Close lists if we're dedenting
      while (
        listStack.length > 0 &&
        indent < listStack[listStack.length - 1].indent
      ) {
        htmlLines.push(`</${listStack.pop()!.type}>`);
      }
      // Open new lists if we're indenting
      if (
        listStack.length === 0 ||
        indent > listStack[listStack.length - 1].indent
      ) {
        for (
          let j = listStack.length > 0 ? listStack[listStack.length - 1].indent + 1 : 0;
          j <= indent && j < 3;
          j++
        ) {
          htmlLines.push(`<${type}>`);
          listStack.push({ type, indent: j });
        }
      }
      // If switching between ul/ol at same indent, close and open
      if (
        listStack.length > 0 &&
        listStack[listStack.length - 1].type !== type &&
        indent === listStack[listStack.length - 1].indent
      ) {
        htmlLines.push(`</${listStack.pop()!.type}>`);
        htmlLines.push(`<${type}>`);
        listStack.push({ type, indent });
      }
      htmlLines.push(`<li>${content}</li>`);
    } else {
      // Close any open lists if a non-list line is found
      while (listStack.length > 0) {
        htmlLines.push(`</${listStack.pop()!.type}>`);
      }
      htmlLines.push(line);
    }
  }
  // Close any remaining open lists
  while (listStack.length > 0) {
    htmlLines.push(`</${listStack.pop()!.type}>`);
  }
  markdown = htmlLines.join('\n');
  // --- END NESTED LISTS HANDLING ---

  // --- DEFINITION LISTS HANDLING ---
  // Process definition lists: term on one line, : definition on next line
  const defLines = markdown.split(/\r?\n/);
  const defHtmlLines: string[] = [];
  let inDefinitionList = false;

  for (let i = 0; i < defLines.length; i++) {
    const line = defLines[i];
    const trimmedLine = line.trim();

    // Check if this is a definition line (starts with : followed by space)
    const defMatch = trimmedLine.match(/^:\s+(.+)$/);

    if (defMatch) {
      // This is a definition line
      if (!inDefinitionList) {
        // Start a new definition list
        inDefinitionList = true;
        defHtmlLines.push('<dl>');
      }

      // Add the definition - preserve line breaks within the definition
      const definition = defMatch[1];
      defHtmlLines.push(`<dd>${definition}</dd>`);
    } else if (
      trimmedLine &&
      !trimmedLine.startsWith('<') &&
      !trimmedLine.startsWith('>') &&
      !trimmedLine.startsWith('#') &&
      !trimmedLine.startsWith('|') &&
      !trimmedLine.startsWith('-') &&
      !trimmedLine.startsWith('*') &&
      !trimmedLine.match(/^\d+\./) &&
      !trimmedLine.startsWith('```') &&
      !trimmedLine.startsWith('---') &&
      !trimmedLine.startsWith('_[') &&
      !trimmedLine.match(/^\[\^[^\]]+\]:/)
    ) {
      // This could be a term line (not empty, not HTML, not other markdown elements)
      if (inDefinitionList) {
        // Close the previous definition list
        defHtmlLines.push('</dl>');
        inDefinitionList = false;
      }

      // Check if the next line is a definition
      const nextLine = defLines[i + 1];
      const nextTrimmed = nextLine ? nextLine.trim() : '';
      const nextIsDefinition = nextTrimmed.match(/^:\s+(.+)$/);

      if (nextIsDefinition) {
        // This is a term, start a new definition list
        inDefinitionList = true;
        defHtmlLines.push('<dl>');
        defHtmlLines.push(`<dt>${trimmedLine}</dt>`);
      } else {
        // Not part of a definition list, keep as is
        defHtmlLines.push(line);
      }
    } else {
      // Not a definition list element, close any open definition list
      if (inDefinitionList) {
        defHtmlLines.push('</dl>');
        inDefinitionList = false;
      }
      defHtmlLines.push(line);
    }
  }

  // Close any remaining open definition list
  if (inDefinitionList) {
    defHtmlLines.push('</dl>');
  }

  markdown = defHtmlLines.join('\n');
  // --- END DEFINITION LISTS HANDLING ---

  // --- TABLES HANDLING ---
  // Convert markdown tables to HTML tables before other regexes
  markdown = markdown.replace(/((?:^\|.*\|.*\n)+)/gm, (block) => {
    // Only process if block looks like a table (at least 2 lines, starts with |, has --- separator)
    const lines = block.trim().split(/\r?\n/);
    if (lines.length < 2) return block;
    if (
      !lines[0].startsWith('|') ||
      !lines[1].replace(/\s/g, '').match(/^\|?[-:|]+\|?$/)
    ) {
      return block;
    }
    // Parse header
    const headerCells = lines[0]
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    // Parse rows
    const rows = lines.slice(2).map((row) =>
      row
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim())
    );
    let html = '<table><thead><tr>';
    for (const cell of headerCells) html += `<th>${cell}</th>`;
    html += '</tr></thead><tbody>';
    for (const row of rows) {
      if (row.length === 0 || (row.length === 1 && row[0] === '')) continue;
      html += '<tr>';
      for (const cell of row) html += `<td>${cell}</td>`;
      html += '</tr>';
    }
    html += '</tbody></table>';
    return `<div class="table-responsive">${html}</div>`;
  });
  // --- END TABLES HANDLING ---

  // --- TASK LISTS HANDLING ---
  // Convert markdown task list items to HTML checkboxes
  markdown = markdown.replace(
    /<li>\s*\[x\]\s*(.*?)<\/li>/gi,
    '<li class="task-list-item"><input type="checkbox" checked disabled> $1</li>',
  );
  markdown = markdown.replace(
    /<li>\s*\[ \]\s*(.*?)<\/li>/gi,
    '<li class="task-list-item"><input type="checkbox" disabled> $1</li>',
  );
  // --- END TASK LISTS HANDLING ---

  // --- ABBREVIATIONS HANDLING ---
  // Collect abbreviation definitions
  const abbrevDefs: Record<string, string> = {};
  markdown = markdown.replace(
    /^\\_\[(.+?)\]:\s*(.+)$/gm,
    (_match, abbr, def) => {
      abbrevDefs[abbr] = def;
      return '';
    },
  );
  // Replace abbreviation references with <abbr> elements
  Object.keys(abbrevDefs).forEach((abbr) => {
    const regex = new RegExp(
      `\\b${abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
      'gi',
    );
    markdown = markdown.replace(
      regex,
      `<abbr title="${abbrevDefs[abbr]}">${abbr}</abbr>`,
    );
  });
  // --- END ABBREVIATIONS HANDLING ---

  // --- FOOTNOTES HANDLING (before paragraph wrapping) ---
  // Collect footnote definitions first (both at start of line and after newlines)
  const footnoteDefs: Record<string, string> = {};
  markdown = markdown.replace(
    /^\[\^([^\]]+)\]:\s*(.+)$/gm,
    (_match, name, def) => {
      footnoteDefs[name] = def.trim();
      return '';
    },
  );

  // Also handle footnote definitions that might be at the end of content
  markdown = markdown.replace(
    /\n\[\^([^\]]+)\]:\s*(.+)$/gm,
    (_match, name, def) => {
      if (!footnoteDefs[name]) {
        footnoteDefs[name] = def.trim();
      }
      return '';
    },
  );

  // Replace footnote references with numbered links (but not definitions)
  let footnoteCounter = 1;
  const footnoteRefs: Record<string, number> = {};

  markdown = markdown.replace(/\[\^([^\]]+)\](?!:)/g, (_match, name) => {
    if (!footnoteRefs[name]) {
      footnoteRefs[name] = footnoteCounter++;
    }
    const num = footnoteRefs[name];
    return `<sup class="footnote-ref"><a href="#footnote-${num}" id="footnote-ref-${num}">[${num}]</a></sup>`;
  });
  // --- END FOOTNOTES HANDLING ---

  // Restore script blocks AFTER all other processing to prevent interference
  // (This will be done at the end of the function)

  // Process the rest of the markdown
  markdown = markdown
    // Headers - allow for leading whitespace and add anchor links
    .replace(/^\s*###### (.*$)/gim, (_match, title) => {
      const id = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      return `<h6 id="${id}"><a href="#${id}" class="header-anchor">${title}</a></h6>`;
    })
    .replace(/^\s*##### (.*$)/gim, (_match, title) => {
      const id = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      return `<h5 id="${id}"><a href="#${id}" class="header-anchor">${title}</a></h5>`;
    })
    .replace(/^\s*#### (.*$)/gim, (_match, title) => {
      const id = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      return `<h4 id="${id}"><a href="#${id}" class="header-anchor">${title}</a></h4>`;
    })
    .replace(/^\s*### (.*$)/gim, (_match, title) => {
      const id = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      return `<h3 id="${id}"><a href="#${id}" class="header-anchor">${title}</a></h3>`;
    })
    .replace(/^\s*## (.*$)/gim, (_match, title) => {
      const id = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      return `<h2 id="${id}"><a href="#${id}" class="header-anchor">${title}</a></h2>`;
    })
    .replace(/^\s*# (.*$)/gim, (_match, title) => {
      const id = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      return `<h1 id="${id}"><a href="#${id}" class="header-anchor">${title}</a></h1>`;
    })
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic (both asterisk and underscore)
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    // Strikethrough
    .replace(/~~(.*?)~~/g, '<del>$1</del>')
    // Inline code (but not inside code block placeholders)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Multi-line blockquotes (process before paragraph wrapping)
    .replace(/((?:^\s*> .*$\n?)+)/gm, (match) => {
      const lines = match.trim().split(/\r?\n/);
      const content = lines
        .map((line) => line.replace(/^\s*> ?/, '')) // Remove > and leading spaces
        .filter((line) => line.trim() !== '') // Remove empty lines
        .join(' ');
      return `<blockquote>${content}</blockquote>`;
    })
    // Horizontal rules (---) - process before paragraph wrapping
    .replace(/^[ ]*---[ ]*$/gm, '<hr>')
    // Line breaks - be more selective about when to add <br> tags
    .replace(/\n\n/g, '</p><p>')
    // Only add <br> for single newlines that are not between list items or other block elements
    .replace(
      /(?<!<\/li>)\n(?!<[uo]l>|<li>|<\/[uo]l>|<dl>|<dt>|<dd>|<\/dl>|<table>|<thead>|<tbody>|<tr>|<th>|<td>|<\/table>|<\/thead>|<\/tbody>|<\/tr>|<\/th>|<\/td>|<div|<\/div>|<h[1-6]>|<\/h[1-6]>|<p>|<\/p>|<blockquote>|<\/blockquote>|<hr>|<pre>|<\/pre>|<code>|<\/code>|<strong>|<\/strong>|<em>|<\/em>|<del>|<\/del>|<a\b|<\/a>|<img\b|<\/img>|<abbr>|<\/abbr>|<sup>|<\/sup>|<span>|<\/span>)/g,
      '<br>',
    )
    // Wrap in paragraphs (exclude HTML elements, blockquotes, and code block placeholders)
    .replace(/^(?!<[^>]*>)(?!> )(?!@@CODEBLOCK\d+@@)(.*)$/gm, '<p>$1</p>')
    // Clean up empty paragraphs
    .replace(/<p><\/p>/g, '')
    .replace(/<p><br><\/p>/g, '')
    // Remove <br> tags from definition descriptions
    .replace(/<dd>(.*?)<\/dd>/g, (_match, content) => {
      return `<dd>${content.replace(/<br>/g, ' ')}</dd>`;
    })
    // Clean up <br> tags around definition list elements
    .replace(/<br>\s*<dl>/g, '<dl>')
    .replace(/<\/dl>\s*<br>/g, '</dl>')
    .replace(/<br>\s*<dt>/g, '<dt>')
    .replace(/<\/dt>\s*<br>/g, '</dt>')
    .replace(/<br>\s*<dd>/g, '<dd>')
    .replace(/<\/dd>\s*<br>/g, '</dd>')
    // Remove <br> tags that are inside HTML elements
    .replace(/(<[^>]+>)([^<]*?)<br>([^<]*?)(<\/[^>]+>)/g, '$1$2 $3$4')
    // Additional cleanup for blog cards and other HTML structures
    .replace(/<br>\s*<div class="blog-card">/g, '<div class="blog-card">')
    .replace(/<\/div>\s*<br>/g, '</div>')
    .replace(
      /<br>\s*<div class="blog-card-header">/g,
      '<div class="blog-card-header">',
    )
    .replace(
      /<br>\s*<div class="blog-card-meta">/g,
      '<div class="blog-card-meta">',
    )
    .replace(
      /<br>\s*<div class="blog-card-tags">/g,
      '<div class="blog-card-tags">',
    )
    .replace(
      /<br>\s*<h3 class="blog-card-title">/g,
      '<h3 class="blog-card-title">',
    )
    .replace(/<br>\s*<a class="blog-card-link">/g, '<a class="blog-card-link">')
    .replace(
      /<br>\s*<span class="blog-card-date">/g,
      '<span class="blog-card-date">',
    )
    .replace(
      /<br>\s*<span class="blog-card-author">/g,
      '<span class="blog-card-author">',
    )
    .replace(
      /<br>\s*<span class="blog-card-tag">/g,
      '<span class="blog-card-tag">',
    )
    .replace(
      /<br>\s*<p class="blog-card-excerpt">/g,
      '<p class="blog-card-excerpt">',
    )
    // Remove <br> tags that appear between HTML elements
    .replace(/>\s*<br>\s*</g, '> <')
    // Remove <br> tags at the beginning or end of HTML elements
    .replace(/<br>\s*>/g, '>')
    .replace(/>\s*<br>/g, '>');

  // Replace code block placeholders with simple pre/code blocks AFTER all other processing
  markdown = markdown.replace(/@@CODEBLOCK(\d+)@@/g, (match, index) => {
    const block = rawCodeBlocks[parseInt(index)];
    if (!block) return match;

    // Sanitize the code content to prevent XSS
    const sanitizedCode = block.code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');

    // Normalize common language identifiers for Prism
    const rawLang = block.lang.toLowerCase().trim();
    const language = ((): string => {
      switch (rawLang) {
        case 'cs':
        case 'c#':
          return 'csharp';
        case 'ts':
          return 'typescript';
        case 'js':
          return 'javascript';
        case 'yml':
          return 'yaml';
        default:
          return rawLang || 'plaintext';
      }
    })();
    const uniqueId = `code-${Date.now()}-${
      Math.random()
        .toString(36)
        .substr(2, 9)
    }`;

    return `<div class="code-block-container" data-language="${language}" id="${uniqueId}">
            <div class="code-block-header">
                <span class="language-label">${language}</span>
                <button class="copy-button" type="button">Copy</button>
            </div>
            <pre><code class="language-${language}">${sanitizedCode}</code></pre>
        </div>`;
  });

  // Restore script blocks AFTER all other processing to prevent interference
  markdown = markdown.replace(/__SCRIPT_BLOCK_(\d+)__/g, (match, index) => {
    return scriptBlocks[parseInt(index)] || match;
  });

  // Handle custom HTML code blocks: {{htmlcode}} ... {{/htmlcode}} - AFTER all other processing
  markdown = markdown.replace(
    /\{\{htmlcode\}\}([\s\S]*?)\{\{\/htmlcode\}\}/g,
    (_match, code) => {
      return `<pre><code class=\"language-html\">${
        code
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
      }</code></pre>`;
    },
  );

  // Process existing HTML <img> tags (not already in <picture> elements) to add WebP support
  // First, protect img tags that are already inside picture elements
  const pictureImgPattern = /<picture>[\s\S]*?<img\s+[^>]*?>[\s\S]*?<\/picture>/gi;
  const protectedImages: string[] = [];
  markdown = markdown.replace(pictureImgPattern, (match) => {
    protectedImages.push(match);
    return `__PROTECTED_IMG_${protectedImages.length - 1}__`;
  });

  // Now process remaining img tags
  markdown = markdown.replace(/<img\s+([^>]*?)>/gi, (match, attrs) => {
    // Extract src attribute from attrs (handle both single and double quotes, case insensitive)
    const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
    if (!srcMatch) {
      return match; // No src attribute, skip
    }
    const src = srcMatch[1];

    // Leave all absolute and protocol-relative asset URLs untouched.
    if (isExternalUrl(src)) return match;

    // Clean up src path
    let origSrc = src;
    if (!src.startsWith('/assets/')) {
      origSrc = `/assets/${src.replace(/^\.?\/?/, '')}`;
    }

    // Generate WebP path
    let webpSrc = origSrc;
    // Remove any query/hash from src for webp path
    webpSrc = webpSrc.replace(/[#?].*$/, '');
    webpSrc = webpSrc.replace(/\.[^.\/]+$/, '.webp');

    // Check if WebP file exists in output assets
    const webpPath = join(outDir, webpSrc.replace(/^\/assets\//, 'assets/'));
    let webpExists = false;
    try {
      // Synchronous check for file existence
      const stat = Deno.statSync(webpPath);
      webpExists = stat.isFile;
    } catch {
      // File doesn't exist
      webpExists = false;
    }

    // Replace with WebP directly if it exists, otherwise use original
    if (webpExists) {
      // Update src attribute to use WebP version
      const updatedAttrs = attrs.replace(
        /src=["'][^"']+["']/i,
        `src="${webpSrc}"`,
      );
      return `<img ${updatedAttrs}>`;
    } else {
      // If WebP doesn't exist, return original img tag with updated src if needed
      if (origSrc !== src) {
        const updatedAttrs = attrs.replace(
          /src=["'][^"']+["']/i,
          `src="${origSrc}"`,
        );
        return `<img ${updatedAttrs}>`;
      }
      return match;
    }
  });

  // Restore protected images
  markdown = markdown.replace(/__PROTECTED_IMG_(\d+)__/g, (match, index) => {
    return protectedImages[parseInt(index)] || match;
  });

  return markdown;
}

interface PageData {
  content: string;
  meta: Meta;
  path: string;
}

interface NavItem {
  title: string;
  url: string;
  date?: string;
  children?: NavItem[];
}

// Default HTML template
const DEFAULT_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{title}}</title>
    <link rel="icon" type="image/x-icon" href="/assets/favicon.ico">
    <link rel="shortcut icon" type="image/x-icon" href="/assets/favicon.ico">
    <link rel="stylesheet" href="/assets/styles.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <!-- KaTeX for math rendering -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
    <style>
        /* Back to Top Button */
        .back-to-top {
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            width: 48px;
            height: 48px;
            background: #1a1a1a;
            color: #ffffff;
            border: none;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.3s ease, visibility 0.3s ease, transform 0.3s ease, background-color 0.3s ease, color 0.3s ease;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .back-to-top:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
        }

        .back-to-top:active {
            transform: translateY(0);
        }

        .back-to-top:focus {
            outline: 2px solid currentColor;
            outline-offset: 2px;
        }

        .back-to-top.visible {
            opacity: 1;
            visibility: visible;
        }

        .back-to-top svg {
            width: 24px;
            height: 24px;
            stroke: currentColor;
        }

        [data-theme="dark"] .back-to-top {
            background: #e5e5e5;
            color: #1a1a1a;
        }

        [data-theme="dark"] .back-to-top:hover {
            box-shadow: 0 6px 16px rgba(255, 255, 255, 0.2);
        }

        @media (max-width: 768px) {
            .back-to-top {
                bottom: 1.5rem;
                right: 1.5rem;
                width: 44px;
                height: 44px;
            }

            .back-to-top svg {
                width: 20px;
                height: 20px;
            }
        }
    </style>
   </head>
<body>
    {{component:navbar}}

    <div class="page">
        <main class="main">
            <div class="container">
                {{content}}
            </div>
        </main>
    </div>
    <script>
        // Theme management
        function initTheme() {
            const theme = localStorage.getItem('theme') || 'light';
            document.documentElement.setAttribute('data-theme', theme);
            updateThemeIcon(theme);
        }

        function toggleTheme() {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateThemeIcon(newTheme);
        }

        function updateThemeIcon(theme) {
            const sunIcon = document.querySelector('.sun-icon');
            const moonIcon = document.querySelector('.moon-icon');
            
            if (theme === 'dark') {
                sunIcon.style.display = 'block';
                moonIcon.style.display = 'none';
            } else {
                sunIcon.style.display = 'none';
                moonIcon.style.display = 'block';
            }
        }

        // Initialize theme
        initTheme();
        
        // Add event listener to theme toggle
        document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

        // Mobile navigation functionality
        const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
        const navbarNav = document.getElementById('navbar-nav');
        
        if (mobileMenuToggle && navbarNav) {
            mobileMenuToggle.addEventListener('click', function() {
                const isActive = navbarNav.classList.contains('active');
                
                if (isActive) {
                    navbarNav.classList.remove('active');
                    mobileMenuToggle.classList.remove('active');
                    document.body.classList.remove('mobile-menu-open');
                    // Close all dropdowns
                    navbarNav.querySelectorAll('.nav-dropdown').forEach(dd => dd.classList.remove('active'));
                } else {
                    navbarNav.classList.add('active');
                    mobileMenuToggle.classList.add('active');
                    document.body.classList.add('mobile-menu-open');
                }
            });

            // Close mobile menu when clicking outside
            document.addEventListener('click', function(e) {
                if (!navbarNav.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
                    navbarNav.classList.remove('active');
                    mobileMenuToggle.classList.remove('active');
                    document.body.classList.remove('mobile-menu-open');
                    // Close all dropdowns
                    navbarNav.querySelectorAll('.nav-dropdown').forEach(dd => dd.classList.remove('active'));
                }
            });

            // Handle dropdown toggles on mobile
            const dropdownToggles = navbarNav.querySelectorAll('.nav-dropdown-toggle');
            dropdownToggles.forEach(toggle => {
                toggle.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation(); // Prevent bubbling so it doesn't immediately reopen
                    const dropdown = this.closest('.nav-dropdown');
                    const isActive = dropdown.classList.contains('active');
                    if (isActive) {
                        dropdown.classList.remove('active');
                    } else {
                        dropdown.classList.add('active');
                    }
                });
            });

            // Close mobile menu when clicking on a link
            const navLinks = navbarNav.querySelectorAll('.nav-link:not(.nav-dropdown-toggle)');
            navLinks.forEach(link => {
                link.addEventListener('click', function() {
                    navbarNav.classList.remove('active');
                    mobileMenuToggle.classList.remove('active');
                    document.body.classList.remove('mobile-menu-open');
                    // Close all dropdowns
                    navbarNav.querySelectorAll('.nav-dropdown').forEach(dd => dd.classList.remove('active'));
                });
            });
        }

        // Initialize syntax highlighting
        document.addEventListener('DOMContentLoaded', function() {
            if (typeof Prism !== 'undefined') {
                Prism.highlightAll();
            }
            
            // Add copy button functionality
            document.querySelectorAll('.copy-button').forEach(button => {
                button.addEventListener('click', function() {
                    const codeBlock = this.closest('.code-block-container');
                    const codeElement = codeBlock.querySelector('code');
                    
                    if (codeElement) {
                        // Get the raw text content (without HTML tags)
                        const textToCopy = codeElement.textContent || codeElement.innerText;
                        
                        navigator.clipboard.writeText(textToCopy).then(() => {
                            // Visual feedback
                            const originalText = this.textContent;
                            this.textContent = 'Copied!';
                            this.classList.add('copied');
                            
                            setTimeout(() => {
                                this.textContent = originalText;
                                this.classList.remove('copied');
                            }, 2000);
                        }).catch(err => {
                            console.error('Failed to copy code:', err);
                            // Fallback for older browsers
                            const textArea = document.createElement('textarea');
                            textArea.value = textToCopy;
                            document.body.appendChild(textArea);
                            textArea.select();
                            document.execCommand('copy');
                            document.body.removeChild(textArea);
                            
                            // Visual feedback
                            const originalText = this.textContent;
                            this.textContent = 'Copied!';
                            this.classList.add('copied');
                            
                            setTimeout(() => {
                                this.textContent = originalText;
                                this.classList.remove('copied');
                            }, 2000);
                        });
                    }
                });
            });
        });

        // Header anchor functionality
        document.addEventListener('click', function(e) {
            // Handle both header-anchor class and regular anchor links to headers
            if (e.target.classList.contains('header-anchor') || 
                (e.target.tagName === 'A' && e.target.getAttribute('href') && e.target.getAttribute('href').startsWith('#'))) {
                e.preventDefault();
                const href = e.target.getAttribute('href');
                if (!href) return;
                const targetId = href.substring(1);
                const targetElement = document.getElementById(targetId);
                
                if (targetElement) {
                    // Get navbar height for offset
                    const navbar = document.querySelector('.navbar');
                    const navbarHeight = navbar ? navbar.offsetHeight + 10 : 90;
                    
                    // Calculate target position with navbar offset
                    const targetPosition = targetElement.offsetTop - navbarHeight;
                    
                    // Smooth scroll to target with offset
                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });
                    
                    // Update URL without page reload
                    history.pushState(null, null, href);
                    
                    // Only copy URL to clipboard for header-anchor class (not for TOC links)
                    if (e.target.classList.contains('header-anchor')) {
                        const url = window.location.origin + window.location.pathname + href;
                        navigator.clipboard.writeText(url).then(() => {
                            // Show a brief visual feedback
                            const originalText = e.target.textContent;
                            e.target.textContent = '✓ Copied!';
                            e.target.style.color = '#10b981';
                            
                            setTimeout(() => {
                                e.target.textContent = originalText;
                                e.target.style.color = '';
                            }, 1500);
                        }).catch(err => {
                            console.log('Could not copy URL to clipboard:', err);
                        });
                    }
                }
            }
        });

        // Footnote functionality
        document.addEventListener('click', function(e) {
            // Handle footnote reference clicks (scroll down to footnote definition)
            if (e.target.classList.contains('footnote-ref') || e.target.closest('.footnote-ref')) {
                e.preventDefault();
                const link = e.target.classList.contains('footnote-ref') ? e.target : e.target.closest('.footnote-ref');
                const href = link.getAttribute('href');
                if (!href) return;
                const targetId = href.substring(1);
                const targetElement = document.getElementById(targetId);
                
                if (targetElement) {
                    const navbar = document.querySelector('.navbar');
                    const navbarHeight = navbar ? navbar.offsetHeight + 20 : 100;
                    const targetPosition = targetElement.offsetTop - navbarHeight;
                    
                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });
                    
                    history.pushState(null, null, href);
                }
            }
            
            // Handle back reference clicks (scroll back up to footnote reference)
            if (e.target.classList.contains('footnote-backref')) {
                e.preventDefault();
                const href = e.target.getAttribute('href');
                if (!href) return;
                const targetId = href.substring(1);
                const targetElement = document.getElementById(targetId);
                
                if (targetElement) {
                    const navbar = document.querySelector('.navbar');
                    const navbarHeight = navbar ? navbar.offsetHeight + 20 : 100;
                    const targetPosition = targetElement.offsetTop - navbarHeight;
                    
                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });
                    
                    history.pushState(null, null, href);
                }
            }
        });

        // Simple code block copy functionality
        document.addEventListener('DOMContentLoaded', function() {
            const codeBlocks = document.querySelectorAll('.code-block-container');
            
            codeBlocks.forEach((container) => {
                const codeElement = container.querySelector('code');
                const copyButton = container.querySelector('.copy-button');
                
                if (!codeElement || !copyButton) return;
                
                copyButton.addEventListener('click', async () => {
                    try {
                        await navigator.clipboard.writeText(codeElement.textContent || '');
                        copyButton.textContent = 'Copied!';
                        copyButton.classList.add('copied');
                        setTimeout(() => {
                            copyButton.textContent = 'Copy';
                            copyButton.classList.remove('copied');
                        }, 2000);
                    } catch (err) {
                        console.error('Failed to copy code:', err);
                        // Fallback for older browsers
                        const textArea = document.createElement('textarea');
                        textArea.value = codeElement.textContent || '';
                        document.body.appendChild(textArea);
                        textArea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textArea);
                        copyButton.textContent = 'Copied!';
                        setTimeout(() => copyButton.textContent = 'Copy', 2000);
                    }
                });
            });
        });

        // Back to Top Button
        (function() {
            const button = document.createElement('button');
            button.className = 'back-to-top';
            button.setAttribute('aria-label', 'Back to top');
            button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>';
            document.body.appendChild(button);

            const scrollThreshold = 300;

            function checkScrollPosition() {
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                if (scrollTop > scrollThreshold) {
                    button.classList.add('visible');
                } else {
                    button.classList.remove('visible');
                }
            }

            function scrollToTop() {
                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
            }

            // Scroll event listener
            window.addEventListener('scroll', checkScrollPosition, { passive: true });

            // Click event listener
            button.addEventListener('click', scrollToTop);

            // Keyboard navigation
            button.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    scrollToTop();
                }
            });

            // Initial check
            checkScrollPosition();
        })();
</script>
    </body>
    </html>`;

// Component placeholder and defaults
const NAVBAR_COMPONENT_PLACEHOLDER = '{{component:navbar}}';
const DEFAULT_NAVBAR_HTML = `<nav class="navbar">
        <div class="navbar-container">
            <a href="/" class="navbar-brand"><picture><source srcset="/assets/nemic-logos/logo.webp" type="image/webp"><img src="/assets/nemic-logos/logo.png" alt="Logo" class="navbar-logo"></picture><span class="navbar-brand-text">Nergy's Blog</span></a>
            <button class="mobile-menu-toggle" id="mobile-menu-toggle" aria-label="Toggle mobile menu">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                    <line x1="3" y1="12" x2="21" y2="12"></line>
                    <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
            </button>
            <ul class="navbar-nav" id="navbar-nav">
                {{navigation}}
            </ul>
            <button class="nav-link theme-toggle" id="theme-toggle" aria-label="Toggle dark mode">
                <svg class="sun-icon" viewBox="0 0 24 24" style="display: none;">
                    <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z"/>
                </svg>
                <svg class="moon-icon" viewBox="0 0 24 24">
                    <path d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z"/>
                </svg>
            </button>
        </div>
    </nav>`;

async function loadComponentHtml(name: string): Promise<string> {
  try {
    const candidatePath = join(componentsDir, `${name}.html`);
    const content = await Deno.readTextFile(candidatePath);
    return content;
  } catch {
    switch (name) {
      case 'navbar':
        return DEFAULT_NAVBAR_HTML;
      default:
        return '';
    }
  }
}

// Process TOC marker and replace with dynamic content cards
async function processTOCMarker(
  content: string,
  filePath: string,
): Promise<string> {
  const marker = '{{routes:toc}}';
  if (!content.includes(marker)) {
    return content;
  }

  // Extract directory from file path
  const relativePath = relative(contentDir, filePath);
  const directory = dirname(relativePath);

  // Only process TOC for index.md files in subdirectories
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

    // Scan target directory for markdown files (excluding index.md)
    for await (const entry of Deno.readDir(targetDir)) {
      if (
        entry.isFile &&
        entry.name.endsWith('.md') &&
        entry.name !== 'index.md'
      ) {
        const entryPath = join(targetDir, entry.name);
        const content = await Deno.readTextFile(entryPath);
        const parsed = parseMarkdownFrontmatter(content, entryPath);
        const meta = withPageDefaults(parsed.metadata as Meta, entryPath);

        // Extract excerpt (first paragraph after optional frontmatter)
        let excerpt = '';
        const firstParagraph = parsed.body.split('\n\n')[0] ?? '';
        if (firstParagraph) {
          excerpt = firstParagraph
            .replace(/^#+\s*/, '') // Remove headers
            .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
            .replace(/\*(.*?)\*/g, '$1') // Remove italic
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
            .substring(0, 150) + (firstParagraph.length > 150 ? '...' : '');
        }

        const filename = basename(entry.name, '.md');
        posts.push({
          title: meta.title || filename.replace(/-/g, ' ').replace(/_/g, ' '),
          date: meta.date || '',
          author: meta.author || '',
          tags: meta.tags || [],
          excerpt,
          filename,
          url: `/${directory}/${filename}`,
        });
      }
    }

    // Sort by date (newest first) if dates are available, otherwise by title
    posts.sort((a, b) => {
      if (a.date && b.date) {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      } else if (a.date && !b.date) {
        return -1; // Items with dates come first
      } else if (!a.date && b.date) {
        return 1;
      } else {
        // If neither has a date, sort by title
        return a.title.localeCompare(b.title);
      }
    });

    // Generate cards HTML based on directory type
    let cardsHTML = '';

    if (directory === 'blogs') {
      // Blog-style cards with metadata
      cardsHTML = posts
        .map(
          (post) =>
            `<div class="blog-card">
    <a href="${post.url}" class="blog-card-link-wrapper">
        <div class="blog-card-header">
            <h3 class="blog-card-title">${post.title}</h3>
            <div class="blog-card-meta">
                <span class="blog-card-date">${post.date}</span>
                ${post.author ? `<span class="blog-card-author">by ${post.author}</span>` : ''}
            </div>
        </div>
        ${post.excerpt ? `<p class="blog-card-excerpt">${post.excerpt}</p>` : ''}
        ${
              post.tags.length > 0
                ? `<div class="blog-card-tags">
            ${
                  post.tags
                    .map((tag) => `<span class="blog-card-tag">${tag}</span>`)
                    .join('')
                }
        </div>`
                : ''
            }
    </a>
</div>`,
        )
        .join('');
    } else {
      // Generic content cards for other directories
      cardsHTML = posts
        .map(
          (post) =>
            `<div class="content-card">
    <a href="${post.url}" class="content-card-link-wrapper">
        <div class="content-card-header">
            <h3 class="content-card-title">${post.title}</h3>
            ${
              post.date
                ? `<div class="content-card-meta">
                <span class="content-card-date">${post.date}</span>
                ${post.author ? `<span class="content-card-author">by ${post.author}</span>` : ''}
            </div>`
                : ''
            }
        </div>
        ${post.excerpt ? `<p class="content-card-excerpt">${post.excerpt}</p>` : ''}
        ${
              post.tags.length > 0
                ? `<div class="content-card-tags">
            ${
                  post.tags
                    .map((tag) => `<span class="content-card-tag">${tag}</span>`)
                    .join('')
                }
        </div>`
                : ''
            }
    </a>
</div>`,
        )
        .join('');
    }

    // Replace marker with generated cards
    return content.replace(marker, cardsHTML);
  } catch (error) {
    console.error(`❌ Error processing TOC marker for ${filePath}:`, error);
    return content.replace(
      marker,
      `<p>Error loading content from ${directory}.</p>`,
    );
  }
}

// Process TypeScript template if it exists
async function processTemplate(
  mdPath: string,
  content: string,
  meta: Meta,
): Promise<string> {
  try {
    // Convert relative path to absolute file:// URL for import
    let templateUrl: string;
    if (
      templatePath.startsWith('http://') ||
      templatePath.startsWith('https://') ||
      templatePath.startsWith('file://')
    ) {
      templateUrl = templatePath;
    } else {
      // Resolve relative path to absolute path
      const absolutePath = join(Deno.cwd(), templatePath.replace(/^\.\//, ''));
      templateUrl = `file://${absolutePath}`;
    }

    // Dynamically import the template module
    const templateModule = await import(templateUrl);

    if (templateModule.render && typeof templateModule.render === 'function') {
      return templateModule.render(content, {
        meta,
        path: mdPath,
      });
    }

    // If render function doesn't exist, return original content
    return content;
  } catch {
    // If template file doesn't exist or fails, return original content
    return content;
  }
}

// Process markdown file with caching
async function processMarkdownFile(filePath: string): Promise<PageData> {
  const content = await Deno.readTextFile(filePath);

  // Check cache first
  if (!(await needsReprocessing(filePath, content))) {
    const cached = fileCache.get(filePath);
    if (cached) {
      console.log(`⚡ Using cached result for ${filePath}`);
      buildMetrics.cachedFiles++;
      // We still need to parse metadata for the return value
      const meta = withPageDefaults(
        extractMetadata(content, filePath),
        filePath,
      );
      return {
        content: cached.content,
        meta,
        path: filePath,
      };
    }
  }

  // Parse frontmatter and preserve files that intentionally omit metadata.
  const parsed = parseMarkdownFrontmatter(content, filePath);
  const meta = withPageDefaults(parsed.metadata as Meta, filePath);
  const markdownContent = parsed.body;

  // Process TOC marker if present
  const tocProcessedContent = await processTOCMarker(markdownContent, filePath);

  // Parse markdown to HTML (after TOC processing)
  const htmlContent = parseMarkdown(tocProcessedContent);

  // Process with TypeScript template if available
  const processedContent = await processTemplate(filePath, htmlContent, meta);

  // Update cache
  await updateCache(filePath, content, processedContent);

  return {
    content: processedContent,
    meta,
    path: filePath,
  };
}

// Extract optional YAML metadata; pages without a delimited block remain valid.
function extractMetadata(content: string, filePath: string): Meta {
  return parseMarkdownFrontmatter(content, filePath).metadata as Meta;
}

function defaultPageTitle(filePath: string): string {
  const name = basename(filePath, '.md').replace(/[-_]+/g, ' ');
  return name.replace(/\b[a-z]/g, (character) => character.toUpperCase());
}

function withPageDefaults(metadata: Meta, filePath: string): Meta {
  if (typeof metadata.title !== 'string' || !metadata.title.trim()) {
    metadata.title = defaultPageTitle(filePath);
  }
  return metadata;
}

// Helper function to check if WebP logo exists
function checkWebPLogoExists(): boolean {
  try {
    const webpPath = join(outDir, 'assets/nemic-logos/logo.webp');
    const stat = Deno.statSync(webpPath);
    return stat.isFile;
  } catch {
    return false;
  }
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function pageRoutePath(filePath: string): string {
  const relativePath = relative(contentDir, filePath).split('\\\\').join('/');
  const routePath = relativePath.endsWith('.md') ? relativePath.slice(0, -3) : relativePath;
  const route = basename(filePath, '.md') === 'index'
    ? dirname(routePath) === '.' ? '' : dirname(routePath)
    : routePath;
  return route ? `/${route}` : '/';
}

function publicPath(routePath: string): string {
  const normalizedRoute = routePath.startsWith('/') ? routePath : `/${routePath}`;
  if (basePath === '/') return normalizedRoute;
  return normalizedRoute === '/' ? `${basePath}/` : `${basePath}${normalizedRoute}`;
}

function absolutePageUrl(routePath: string): string | undefined {
  return siteUrl ? `${siteUrl}${publicPath(routePath)}` : undefined;
}

function prefixInternalUrl(value: string): string {
  if (
    basePath === '/' || !value.startsWith('/') || value.startsWith('//') ||
    value === basePath || value.startsWith(`${basePath}/`)
  ) return value;
  return `${basePath}${value}`;
}

function prefixInternalUrls(html: string): string {
  if (basePath === '/') return html;
  return html.replace(
    /((?:href|src|srcset|poster|action|data-src)=["'])([^"']*)(["'])/gi,
    (_match, prefix, rawValue, quote) => {
      const value = String(rawValue);
      const rewritten = /srcset/i.test(prefix)
        ? value.split(',').map((candidate: string) => {
          const parts = candidate.trim().split(' ', 2);
          return [prefixInternalUrl(parts[0]), parts[1]].filter(Boolean).join(
            ' ',
          );
        }).join(', ')
        : prefixInternalUrl(value);
      return `${prefix}${rewritten}${quote}`;
    },
  );
}

function generateSeoMetadata(meta: Meta, routePath: string): string {
  if (!siteUrl) return '';
  const canonical = typeof meta.canonical === 'string' &&
      (meta.canonical.startsWith('https://') ||
        meta.canonical.startsWith('http://'))
    ? meta.canonical
    : absolutePageUrl(routePath)!;
  const title = meta.ogTitle ?? meta.title ?? defaultPageTitle(routePath);
  const description = meta.ogDescription ?? meta.description;
  const image = meta.ogImage ?? meta.image ?? meta.cover;
  const tags = [
    `<link rel="canonical" href="${escapeHtml(canonical)}">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:url" content="${escapeHtml(canonical)}">`,
    `<meta property="og:type" content="${escapeHtml(meta.ogType ?? meta.type ?? 'website')}">`,
  ];
  if (description) {
    tags.push(`<meta name="description" content="${escapeHtml(description)}">`);
    tags.push(
      `<meta property="og:description" content="${escapeHtml(description)}">`,
    );
  }
  if (image) {
    const imageValue = String(image);
    const imageUrl = isExternalUrl(imageValue) ? imageValue : `${siteUrl}${
      prefixInternalUrl(
        imageValue.startsWith('/') ? imageValue : `/${imageValue}`,
      )
    }`;
    tags.push(`<meta property="og:image" content="${escapeHtml(imageUrl)}">`);
  }
  return tags.join(String.fromCharCode(10) + '    ');
}

// Generate HTML from template
async function generateHTML(
  content: string,
  meta: Meta,
  navigation: string,
  routePath: string,
): Promise<string> {
  let html = DEFAULT_TEMPLATE;

  // Inject components (navbar)
  const navbarHtml = await loadComponentHtml('navbar');
  html = html.replace(NAVBAR_COMPONENT_PLACEHOLDER, navbarHtml);

  // Check if WebP logo exists and replace the logo HTML accordingly
  const webpLogoExists = checkWebPLogoExists();
  if (webpLogoExists) {
    // WebP exists, use picture element with WebP source
    html = html.replace(
      '<picture><source srcset="/assets/nemic-logos/logo.webp" type="image/webp"><img src="/assets/nemic-logos/logo.png" alt="Logo" class="navbar-logo"></picture>',
      '<picture><source srcset="/assets/nemic-logos/logo.webp" type="image/webp"><img src="/assets/nemic-logos/logo.png" alt="Logo" class="navbar-logo"></picture>',
    );
  } else {
    // WebP doesn't exist, use just the original image
    html = html.replace(
      '<picture><source srcset="/assets/nemic-logos/logo.webp" type="image/webp"><img src="/assets/nemic-logos/logo.png" alt="Logo" class="navbar-logo"><span class="navbar-brand-text">Nergy\'s Blog</span>',
      '<img src="/assets/nemic-logos/logo.png" alt="Logo" class="navbar-logo"><span class="navbar-brand-text">Nergy\'s Blog</span>',
    );
  }

  // Replace template variables
  const pageTitle = String(meta.title || "Nergy's Blog");
  html = html.replace('{{title}}', `${escapeHtml(pageTitle)} | Nergy`);
  html = html.replace('{{content}}', content);
  html = html.replace('{{navigation}}', navigation);

  // Add Prism.js scripts for syntax highlighting
  const additionalScripts = `
    <!-- Prism.js for syntax highlighting -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism.min.css">
    <script defer src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-core.min.js"></script>
    <script defer src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/plugins/autoloader/prism-autoloader.min.js"></script>
    `;

  const seoMetadata = generateSeoMetadata(meta, routePath);
  html = html.replace(
    '</head>',
    `${seoMetadata}${seoMetadata ? '\n    ' : ''}${additionalScripts}</head>`,
  );

  return prefixInternalUrls(html);
}

// Generate navigation from routes directory
async function generateNavigation(): Promise<NavItem[]> {
  const routesDir = contentDir;
  const navItems: NavItem[] = [];

  try {
    for await (const entry of Deno.readDir(routesDir)) {
      if (entry.isFile && entry.name.endsWith('.md')) {
        const fileName = basename(entry.name, '.md');
        if (fileName !== 'index') {
          navItems.push({
            title: fileName.charAt(0).toUpperCase() +
              fileName.slice(1).replace(/_/g, ' '),
            url: `/${fileName}`,
          });
        }
      } else if (entry.isDirectory) {
        const folderName = entry.name;
        const children: NavItem[] = [];

        // Scan subdirectory for markdown files
        try {
          for await (
            const subEntry of Deno.readDir(
              join(routesDir, folderName),
            )
          ) {
            if (
              subEntry.isFile &&
              subEntry.name.endsWith('.md') &&
              subEntry.name !== 'index.md'
            ) {
              const fileName = basename(subEntry.name, '.md');
              const filePath = join(routesDir, folderName, subEntry.name);

              // Read file content to extract metadata
              let date = '';
              let title = fileName.charAt(0).toUpperCase() +
                fileName.slice(1).replace(/_/g, ' ').replace(/-/g, ' ');

              try {
                const content = await Deno.readTextFile(filePath);
                const meta = withPageDefaults(
                  extractMetadata(content, filePath),
                  filePath,
                );
                if (meta.date) {
                  date = meta.date;
                }
                if (meta.title) {
                  title = meta.title;
                }
              } catch {
                console.log(`ℹ️  Could not read metadata from ${filePath}`);
              }

              children.push({
                title,
                url: `/${folderName}/${fileName}`,
                date,
              });
            }
          }

          // Sort children by date (newest first), then by title for items without dates
          children.sort((a, b) => {
            if (a.date && b.date) {
              return new Date(b.date).getTime() - new Date(a.date).getTime();
            } else if (a.date && !b.date) {
              return -1; // Items with dates come first
            } else if (!a.date && b.date) {
              return 1;
            } else {
              // If neither has a date, sort by title
              return a.title.localeCompare(b.title);
            }
          });
        } catch {
          console.log(`ℹ️  Could not read subdirectory ${folderName}`);
        }

        if (children.length > 0) {
          navItems.push({
            title: folderName.charAt(0).toUpperCase() +
              folderName.slice(1).replace(/_/g, ' '),
            url: `/${folderName}`,
            children,
          });
        }
      }
    }
  } catch {
    console.error('❌ Could not read routes directory for navigation');
  }

  return navItems;
}

// Generate navigation HTML
function generateNavigationHTML(
  navItems: NavItem[],
  currentPath: string = '',
): string {
  let html = '';

  for (const item of navItems) {
    if (item.children && item.children.length > 0) {
      // Check if current page is in this dropdown
      const isActive = currentPath === item.url ||
        item.children.some((child) => currentPath === child.url);
      const activeClass = isActive ? ' active' : '';

      // Dropdown menu
      html += `<li class="nav-item nav-dropdown${activeClass}">`;
      html += `<button type="button" class="nav-link nav-dropdown-toggle${
        isActive ? ' active' : ''
      }">${item.title}</button>`;
      html += `<div class="nav-dropdown-content">`;

      // Add "see all" item at the top of the dropdown
      const isSeeAllActive = currentPath === item.url;
      html += `<a href="${item.url}" class="nav-dropdown-item${
        isSeeAllActive ? ' active' : ''
      }">See All ${item.title}</a>`;

      // Add separator
      html += `<div class="nav-dropdown-separator"></div>`;

      // Add child items
      for (const child of item.children) {
        const isChildActive = currentPath === child.url;
        html += `<a href="${child.url}" class="nav-dropdown-item${isChildActive ? ' active' : ''}">${child.title}</a>`;
      }
      html += `</div>`;
      html += `</li>`;
    } else {
      // Regular link
      const isActive = currentPath === item.url;
      html += `<li class="nav-item${isActive ? ' active' : ''}">`;
      html += `<a href="${item.url}" class="nav-link${isActive ? ' active' : ''}">${item.title}</a>`;
      html += `</li>`;
    }
  }

  return html;
}

// Copy assets (non-image files)
async function copyAssets(): Promise<void> {
  const distAssetsDir = join(outDir, 'assets');

  try {
    await ensureDir(distAssetsDir);

    // Copy all assets recursively, including images
    const copyAssetRecursively = async (
      dir: string,
      basePath: string = '',
    ): Promise<void> => {
      try {
        for await (const entry of Deno.readDir(dir)) {
          const sourcePath = join(dir, entry.name);
          const relativePath = join(basePath, entry.name);
          const destPath = join(distAssetsDir, relativePath);

          if (entry.isFile) {
            await ensureDir(dirname(destPath));
            await copy(sourcePath, destPath, { overwrite: true });
            console.log(`📁 Copied ${relativePath}`);
          } else if (entry.isDirectory) {
            await ensureDir(destPath);
            await copyAssetRecursively(sourcePath, relativePath);
          }
        }
      } catch {
        console.log(`ℹ️  Could not read directory ${dir}`);
      }
    };

    await copyAssetRecursively(assetsDir);
    console.log('✅ All assets copied to dist/assets/');
  } catch {
    console.log('ℹ️  No assets directory found');
  }

  // Always copy favicon.ico to dist root
  try {
    await copy(join(assetsDir, 'favicon.ico'), join(outDir, 'favicon.ico'), {
      overwrite: true,
    });
    console.log('✅ favicon.ico copied to dist/');
  } catch {
    // Ignore if not present
  }
}

// Optimize images to WebP format using optimizt
async function optimizeImages(): Promise<void> {
  const distAssetsDir = join(outDir, 'assets');

  // Find all image files recursively
  const imageFiles: Array<{ fullPath: string; relativePath: string }> = [];

  async function findImages(dir: string, basePath: string = '') {
    try {
      for await (const entry of Deno.readDir(dir)) {
        const fullPath = join(dir, entry.name);
        const relativePath = join(basePath, entry.name);

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
      console.log(`ℹ️  Could not read directory ${dir}`);
    }
  }

  try {
    await ensureDir(distAssetsDir);
    await findImages(assetsDir);

    if (imageFiles.length === 0) {
      console.log('ℹ️  No image files found to optimize');
      return;
    }

    console.log(`🖼️  Found ${imageFiles.length} images to optimize...`);

    // Check if optimizt is available
    let optimiztAvailable = false;
    try {
      const process = new Deno.Command('optimizt', {
        args: ['--help'],
        stdout: 'piped',
        stderr: 'piped',
      });
      const { code } = await process.output();
      optimiztAvailable = code === 0;
    } catch {
      optimiztAvailable = false;
    }

    if (!optimiztAvailable) {
      console.log('⚠️  optimizt not found, skipping webp optimization');
      return;
    }

    // Process each image with optimizt
    for (const { fullPath, relativePath } of imageFiles) {
      try {
        const outputPath = join(
          distAssetsDir,
          relativePath.replace(/\.[^.]+$/, '.webp'),
        );

        // Skip if already optimized and up-to-date in dist
        try {
          const [srcStat, destStat] = await Promise.all([
            Deno.stat(fullPath),
            Deno.stat(outputPath),
          ]);
          const srcMtime = srcStat.mtime ? srcStat.mtime.getTime() : 0;
          const destMtime = destStat.mtime ? destStat.mtime.getTime() : 0;
          if (destMtime >= srcMtime) {
            console.log(`⏭️  Skipping ${relativePath} (cached)`);
            continue;
          }
        } catch {
          // If dest doesn't exist, proceed with optimization
        }

        // Ensure output directory exists
        await ensureDir(dirname(outputPath));

        // Run optimizt to create WebP version
        const process = new Deno.Command('optimizt', {
          args: [fullPath, '--webp', '--force'],
          stdout: 'piped',
          stderr: 'piped',
        });

        const { code, stderr } = await process.output();

        // Move the generated .webp to dist/assets
        const webpSource = fullPath.replace(/\.[^.]+$/, '.webp');
        if (code === 0) {
          try {
            await copy(webpSource, outputPath, { overwrite: true });
            console.log(
              `✅ Optimized ${relativePath} → ${basename(outputPath)}`,
            );
            // Optionally remove the .webp from source
            await Deno.remove(webpSource);
          } catch {
            console.error(
              `❌ Failed to move/copy webp: ${webpSource} to ${outputPath}`,
            );
          }
        } else {
          const error = new TextDecoder().decode(stderr);
          console.error(
            `❌ Failed to optimize ${relativePath}:`,
            error.toString(),
          );
        }
      } catch (error) {
        console.error(`❌ Error processing ${fullPath}:`, error);
      }
    }

    console.log('✅ Image optimization complete!');
    // No need to update HTML references
  } catch {
    console.log('ℹ️  Image optimization failed');
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function writeSitemap(markdownFiles: string[]): Promise<void> {
  if (!siteUrl) return;
  const locations = markdownFiles
    .map((filePath) => absolutePageUrl(pageRoutePath(filePath)))
    .filter((url): url is string => Boolean(url))
    .sort();
  const entries = locations.map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`).join('\n');
  const sitemap =
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
  await Deno.writeTextFile(join(outDir, 'sitemap.xml'), sitemap);
}

// Performance monitoring
const buildMetrics = {
  startTime: 0,
  fileProcessingTimes: new Map<string, number>(),
  totalFiles: 0,
  cachedFiles: 0,
  processedFiles: 0,
};

function startBuildTimer() {
  buildMetrics.startTime = performance.now();
  buildMetrics.fileProcessingTimes.clear();
  buildMetrics.totalFiles = 0;
  buildMetrics.cachedFiles = 0;
  buildMetrics.processedFiles = 0;
}

function logBuildMetrics() {
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

  // Show slowest files
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

function outputPathForMarkdown(filePath: string): string {
  const relativePath = relative(contentDir, filePath);
  const withoutExtension = relativePath.endsWith('.md') ? relativePath.slice(0, -3) : relativePath;
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
  const separator = Deno.build.os === 'windows' ? String.fromCharCode(92) : '/';
  const register = (path: string, source: string) => {
    const normalizedPath = normalize(path);
    const key = Deno.build.os === 'windows' ? normalizedPath.toLowerCase() : normalizedPath;
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
      const assetPath = relativePath ? join(relativePath, entry.name) : entry.name;
      if (entry.isDirectory) {
        await scanAssets(sourcePath, assetPath);
      } else if (entry.isFile) {
        register(join(outDir, 'assets', assetPath), `asset ${sourcePath}`);
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
            const optimizedPath = `${assetPath.slice(0, -assetExtension.length)}.webp`;
            register(
              join(outDir, 'assets', optimizedPath),
              `optimized WebP from ${sourcePath}`,
            );
          }
        }
      }
    }
  }

  await scanAssets(assetsDir);
  if (siteUrl) register(join(outDir, 'sitemap.xml'), 'generated sitemap');
  register(join(outDir, 'serve.ts'), 'generated development server');
  return [...collisions];
}

// Main build function
async function build(): Promise<void> {
  console.log('🚀 Starting build...');
  startBuildTimer();
  basePath = normalizeBasePath(getArg('basePath', '/'));
  siteUrl = normalizeSiteUrl(getArg('siteUrl', ''));

  // Generate navigation
  console.log('🧭 Generating navigation...');
  const navItems = await generateNavigation();
  const navigationHTML = generateNavigationHTML(navItems);
  console.log('Navigation items:', navItems);
  console.log('Navigation HTML:', navigationHTML);

  // Find all markdown files in routes (including subdirectories)
  const routesDir = contentDir;
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
    await scanDirectory(routesDir);
  } catch (error) {
    throw new Error(
      `Could not read routes directory '${routesDir}': ${String(error)}`,
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

  // Validate every delimited frontmatter block before creating or modifying output.
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

  // Copy assets and optimize images BEFORE processing markdown files
  // This ensures WebP files exist when parseMarkdown() checks for them
  console.log('📁 Copying assets...');
  await copyAssets();

  console.log('🖼️  Optimizing images...');
  await optimizeImages();

  // Process markdown files in parallel for better performance
  console.log(`📝 Processing ${markdownFiles.length} markdown files...`);

  const processingPromises = markdownFiles.map(async (filePath) => {
    const startTime = performance.now();
    console.log(`📝 Processing ${filePath}...`);

    try {
      const pageData = await processMarkdownFile(filePath);

      // Determine current path for active navigation
      const fileName = basename(filePath, '.md');
      const relativePath = relative(contentDir, filePath).replace('.md', '');
      let currentPath = '';

      if (fileName === 'index') {
        if (relativePath === 'index') {
          currentPath = '/';
        } else {
          // index.md in a subdirectory
          currentPath = `/${dirname(relativePath)}`;
        }
      } else {
        if (relativePath === fileName) {
          // Top-level file
          currentPath = `/${fileName}`;
        } else {
          // File in subdirectory
          currentPath = `/${relativePath}`;
        }
      }

      // Generate navigation with current path
      const pageNavigationHTML = generateNavigationHTML(navItems, currentPath);
      const html = await generateHTML(
        pageData.content,
        pageData.meta,
        pageNavigationHTML,
        pageRoutePath(filePath),
      );

      const outputPath = outputPathForMarkdown(filePath);

      // Ensure output directory exists
      await ensureDir(dirname(outputPath));

      // Write HTML file
      await Deno.writeTextFile(outputPath, html);
      console.log(`✅ Generated ${outputPath}`);

      // Record processing time
      const processingTime = performance.now() - startTime;
      buildMetrics.fileProcessingTimes.set(filePath, processingTime);
      buildMetrics.processedFiles++;

      return { success: true, filePath, outputPath, processingTime };
    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error);
      return { success: false, filePath, error };
    }
  });

  // Wait for all files to be processed
  const results = await Promise.all(processingPromises);

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  if (failed > 0) {
    throw new Error(
      `Build failed: ${failed} of ${markdownFiles.length} pages could not be generated`,
    );
  }

  await writeSitemap(markdownFiles);
  const elapsed = performance.now() - buildMetrics.startTime;
  console.log(
    `✅ Build succeeded: ${successful} pages, 0 failed, ${buildMetrics.cachedFiles} cached, ${elapsed.toFixed(2)}ms`,
  );

  // Copy serve.ts to dist for independent execution
  console.log('🚀 Copying and patching serve.ts to dist...');
  try {
    let serveSrc = await Deno.readTextFile('./serve.ts');
    // Patch fsRoot: "./dist" to fsRoot: "."
    serveSrc = serveSrc.replace('fsRoot: "./dist"', 'fsRoot: "."');
    // Patch specific Deno.readTextFile calls - be more precise
    serveSrc = serveSrc.replace(
      /Deno\.readTextFile\("\.\/dist" \+ htmlPath\)/g,
      'Deno.readTextFile(htmlPath.slice(1))',
    );
    serveSrc = serveSrc.replace(
      /const indexPath = "\.\/dist\/index\.html";/g,
      'const indexPath = "index.html";',
    );
    serveSrc = serveSrc.replace(
      /const indexContent = await Deno\.readTextFile\(indexPath\);/g,
      'const indexContent = await Deno.readTextFile(indexPath);',
    );
    await Deno.writeTextFile(join(outDir, 'serve.ts'), serveSrc);
    console.log('✅ serve.ts copied and patched to dist/');
  } catch (error) {
    console.error('❌ Failed to copy/patch serve.ts:', error);
  }

  // Log performance metrics
  logBuildMetrics();

  console.log('🎉 Build complete!');
}

// Run build if this script is executed directly
if (import.meta.main) {
  try {
    await build();
  } catch (error) {
    logBuildMetrics();
    console.error(
      `❌ Build failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    Deno.exitCode = 1;
  }
}
