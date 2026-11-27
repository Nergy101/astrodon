import { join } from '@std/path';
import { Marked, type RendererObject, type Tokens } from 'marked';
import { escapeHtml, isExternalUrl } from './seo.ts';

function resolveAssetSrc(
  src: string,
  outDir: string,
): { resolvedSrc: string; changed: boolean } {
  if (isExternalUrl(src)) {
    return { resolvedSrc: src, changed: false };
  }

  let origSrc = src;
  if (!src.startsWith('/assets/')) {
    origSrc = `/assets/${src.replace(/^\.?\/?/, '')}`;
  }

  const webpSrc = origSrc
    .replace(/[#?].*$/, '')
    .replace(/\.[^./]+$/, '.webp');
  const webpPath = join(outDir, webpSrc.replace(/^\/assets\//, 'assets/'));

  try {
    if (Deno.statSync(webpPath).isFile) {
      return { resolvedSrc: webpSrc, changed: true };
    }
  } catch {
    // WebP variant does not exist; fall back to original asset path.
  }

  return { resolvedSrc: origSrc, changed: origSrc !== src };
}

function normalizeLanguage(lang?: string): string {
  const rawLang = (lang ?? 'plaintext').toLowerCase().trim();
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
}

function escapeCode(code: string): string {
  return code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

export function parseMarkdown(markdown: string, outDir: string): string {
  // Handle custom {{htmlcode}} ... {{/htmlcode}} blocks before parsing.
  const htmlCodeBlocks: string[] = [];
  markdown = markdown.replace(
    /\{\{htmlcode\}\}([\s\S]*?)\{\{\/htmlcode\}\}/g,
    (_match, code) => {
      const idx = htmlCodeBlocks.length;
      htmlCodeBlocks.push(
        `<pre><code class="language-html">${
          String(code).replace(/</g, '&lt;').replace(/>/g, '&gt;')
        }</code></pre>`,
      );
      return `@@HTMLCODE_${idx}@@`;
    },
  );

  // Collect footnote definitions outside fenced code blocks.
  const footnoteCounter = { value: 1 };
  const footnoteRefs: Record<string, number> = {};

  const renderer: RendererObject = {
    heading(this, { tokens, depth }: Tokens.Heading): string {
      const inner = this.parser.parseInline(tokens);
      const plainText = inner.replace(/<[^>]*>/g, '');
      const id = plainText
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      return `<h${depth} id="${id}"><a href="#${id}" class="header-anchor">${inner}</a></h${depth}>\n`;
    },

    code({ text, lang }: Tokens.Code): string {
      const language = normalizeLanguage(lang);
      const uniqueId = `code-${Date.now()}-${
        Math.random().toString(36).slice(2, 11)
      }`;
      return `<div class="code-block-container" data-language="${
        escapeHtml(language)
      }" id="${uniqueId}">
            <div class="code-block-header">
                <span class="language-label">${escapeHtml(language)}</span>
                <button class="copy-button" type="button">Copy</button>
            </div>
            <pre><code class="language-${escapeHtml(language)}">${
        escapeCode(text)
      }</code></pre>
        </div>\n`;
    },

    link(this, { href, title, tokens }: Tokens.Link): string {
      const text = this.parser.parseInline(tokens);
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
      if (isExternalUrl(href)) {
        return `<a href="${
          escapeHtml(href)
        }"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
      }
      return `<a href="${escapeHtml(href)}"${titleAttr}>${text}</a>`;
    },

    image({ href, title, text }: Tokens.Image): string {
      const { resolvedSrc } = resolveAssetSrc(href, outDir);
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
      return `<img src="${escapeHtml(resolvedSrc)}" alt="${
        escapeHtml(text)
      }"${titleAttr}>`;
    },

    table(this, token: Tokens.Table): string {
      let header = '<thead><tr>';
      for (const cell of token.header) {
        const align = cell.align ? ` style="text-align:${cell.align}"` : '';
        header += `<th${align}>${this.parser.parseInline(cell.tokens)}</th>`;
      }
      header += '</tr></thead>';

      let body = '<tbody>';
      for (const row of token.rows) {
        body += '<tr>';
        for (const cell of row) {
          const align = cell.align ? ` style="text-align:${cell.align}"` : '';
          body += `<td${align}>${this.parser.parseInline(cell.tokens)}</td>`;
        }
        body += '</tr>';
      }
      body += '</tbody>';

      return `<div class="table-responsive"><table>${header}${body}</table></div>\n`;
    },
  };

  const marked = new Marked({
    gfm: true,
    breaks: false,
    renderer,
    extensions: [
      {
        name: 'footnoteDef',
        level: 'block',
        start(src: string) {
          return src.match(/^\[\^[^\]]+\]:/m)?.index;
        },
        tokenizer(src: string) {
          const match = src.match(/^\[\^([^\]]+)\]:\s*(.+)(?:\r?\n|$)/);
          if (match) {
            return { type: 'footnoteDef', raw: match[0] };
          }
        },
        renderer() {
          return '';
        },
      },
      {
        name: 'footnoteRef',
        level: 'inline',
        start(src: string) {
          return src.indexOf('[^');
        },
        tokenizer(src: string) {
          const match = src.match(/^\[\^([^\]]+)\](?!:)/);
          if (match) {
            return { type: 'footnoteRef', raw: match[0], name: match[1] };
          }
        },
        renderer(token) {
          const name = String(token.name);
          if (!footnoteRefs[name]) {
            footnoteRefs[name] = footnoteCounter.value++;
          }
          const num = footnoteRefs[name];
          return `<sup class="footnote-ref"><a href="#footnote-${num}" id="footnote-ref-${num}">[${num}]</a></sup>`;
        },
      },
    ],
  });

  let html = marked.parse(markdown) as string;

  // Restore {{htmlcode}} blocks.
  html = html.replace(/@@HTMLCODE_(\d+)@@/g, (match, index) => {
    return htmlCodeBlocks[parseInt(index, 10)] ?? match;
  });

  // Protect <img> tags already inside <picture> elements before WebP rewriting.
  const pictureImgPattern =
    /<picture>[\s\S]*?<img\s+[^>]*?>[\s\S]*?<\/picture>/gi;
  const protectedImages: string[] = [];
  html = html.replace(pictureImgPattern, (match) => {
    protectedImages.push(match);
    return `__PROTECTED_IMG_${protectedImages.length - 1}__`;
  });

  // Rewrite raw HTML <img> tags to WebP when available.
  html = html.replace(/<img\s+([^>]*?)>/gi, (match, attrs) => {
    const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
    if (!srcMatch) return match;
    const { resolvedSrc, changed } = resolveAssetSrc(srcMatch[1], outDir);
    if (!changed) return match;
    const updatedAttrs = attrs.replace(
      /src=["'][^"']+["']/i,
      `src="${escapeHtml(resolvedSrc)}"`,
    );
    return `<img ${updatedAttrs}>`;
  });

  html = html.replace(/__PROTECTED_IMG_(\d+)__/g, (match, index) => {
    return protectedImages[parseInt(index, 10)] ?? match;
  });

  return html;
}
