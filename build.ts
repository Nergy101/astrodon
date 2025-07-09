#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run

import { ensureDir, copy } from "https://deno.land/std@0.208.0/fs/mod.ts";
import { join, extname, basename, dirname } from "https://deno.land/std@0.208.0/path/mod.ts";
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";

// Cache for processed files to avoid reprocessing unchanged content
const fileCache = new Map<string, { hash: string; content: string }>();

// Simple hash function for file content
async function getFileHash(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Check if file needs reprocessing
async function needsReprocessing(filePath: string, content: string): Promise<boolean> {
    const cached = fileCache.get(filePath);
    if (!cached) return true;

    const currentHash = await getFileHash(content);
    return cached.hash !== currentHash;
}

// Update cache after processing
async function updateCache(filePath: string, content: string, processedContent: string) {
    const hash = await getFileHash(content);
    fileCache.set(filePath, { hash, content: processedContent });
}

// Optimized markdown to HTML conversion with consolidated regex operations
function parseMarkdown(markdown: string): string {
    // Store script tags first to preserve their structure
    const scriptBlocks: string[] = [];
    let scriptBlockIndex = 0;

    markdown = markdown.replace(/<script>([\s\S]*?)<\/script>/g, function (match, scriptContent) {
        scriptBlocks.push(match);
        return `\n\n__SCRIPT_BLOCK_${scriptBlockIndex++}__\n\n`;
    });



    // Images - ensure proper asset paths with WebP fallback (process before links)
    markdown = markdown.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
        // Clean up src path
        let origSrc = src;
        if (!src.startsWith('http') && !src.startsWith('https') && !src.startsWith('/assets/')) {
            origSrc = `/assets/${src.replace(/^\.?\/?/, '')}`;
        }

        // Generate WebP path
        let webpSrc = origSrc;
        // Remove any query/hash from src for webp path
        webpSrc = webpSrc.replace(/[#?].*$/, '');
        webpSrc = webpSrc.replace(/\.[^.\/]+$/, '.webp');

        // Check if WebP file exists in dist/assets
        const webpPath = webpSrc.replace('/assets/', './dist/assets/');
        let webpExists = false;
        try {
            // Synchronous check for file existence
            const stat = Deno.statSync(webpPath);
            webpExists = stat.isFile;
        } catch {
            // File doesn't exist
            webpExists = false;
        }

        // Create picture element with WebP and original fallback, only if WebP exists
        if (webpExists) {
            return `<picture>
                <source srcset="${webpSrc}" type="image/webp">
                <img src="${origSrc}" alt="${alt}">
            </picture>`;
        } else {
            // If WebP doesn't exist, just use the original image
            return `<img src="${origSrc}" alt="${alt}">`;
        }
    });

    // Links (process after images to avoid conflicts)
    markdown = markdown.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
        // Add target="_blank" to all links
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    });

    // --- NESTED LISTS HANDLING ---
    // We'll process the markdown line by line for lists, then join back for the rest of the regexes
    const lines = markdown.split(/\r?\n/);
    const htmlLines: string[] = [];
    const listStack: { type: 'ul' | 'ol', indent: number }[] = [];
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
            while (listStack.length > 0 && indent < listStack[listStack.length - 1].indent) {
                htmlLines.push(`</${listStack.pop()!.type}>`);
            }
            // Open new lists if we're indenting
            if (listStack.length === 0 || indent > listStack[listStack.length - 1].indent) {
                for (let j = (listStack.length > 0 ? listStack[listStack.length - 1].indent + 1 : 0); j <= indent && j < 3; j++) {
                    htmlLines.push(`<${type}>`);
                    listStack.push({ type, indent: j });
                }
            }
            // If switching between ul/ol at same indent, close and open
            if (listStack.length > 0 && listStack[listStack.length - 1].type !== type && indent === listStack[listStack.length - 1].indent) {
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

    // --- CODE BLOCK HANDLING ---
    // Store raw code blocks and insert uncommon delimiter placeholders
    const rawCodeBlocks: { lang: string, code: string }[] = [];
    let rawCodeBlockIndex = 0;
    markdown = markdown.replace(/```(\w+)?\n([\s\S]*?)```/g, function (match, language, code) {
        rawCodeBlocks.push({
            lang: language || 'plaintext',
            code: code // preserve as-is
        });
        return `@@CODEBLOCK${rawCodeBlockIndex++}@@`;
    });
    // --- END CODE BLOCK HANDLING ---

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
        } else if (trimmedLine && !trimmedLine.startsWith('<') && !trimmedLine.startsWith('>') &&
            !trimmedLine.startsWith('#') && !trimmedLine.startsWith('|') &&
            !trimmedLine.startsWith('-') && !trimmedLine.startsWith('*') &&
            !trimmedLine.match(/^\d+\./) && !trimmedLine.startsWith('```') &&
            !trimmedLine.startsWith('---') && !trimmedLine.startsWith('_[') &&
            !trimmedLine.match(/^\[\^[^\]]+\]:/)) {
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
        if (!lines[0].startsWith('|') || !lines[1].replace(/\s/g, '').match(/^\|?[-:|]+\|?$/)) return block;
        // Parse header
        const headerCells = lines[0].split('|').slice(1, -1).map(cell => cell.trim());
        // Parse rows
        const rows = lines.slice(2).map(row => row.split('|').slice(1, -1).map(cell => cell.trim()));
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
    markdown = markdown.replace(/<li>\s*\[x\]\s*(.*?)<\/li>/gi, '<li class="task-list-item"><input type="checkbox" checked disabled> $1</li>');
    markdown = markdown.replace(/<li>\s*\[ \]\s*(.*?)<\/li>/gi, '<li class="task-list-item"><input type="checkbox" disabled> $1</li>');
    // --- END TASK LISTS HANDLING ---




    // --- ABBREVIATIONS HANDLING ---
    // Collect abbreviation definitions
    const abbrevDefs: Record<string, string> = {};
    markdown = markdown.replace(/^\\_\[(.+?)\]:\s*(.+)$/gm, (match, abbr, def) => {
        abbrevDefs[abbr] = def;
        return '';
    });
    // Replace abbreviation references with <abbr> elements
    Object.keys(abbrevDefs).forEach(abbr => {
        const regex = new RegExp(`\\b${abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        markdown = markdown.replace(regex, `<abbr title="${abbrevDefs[abbr]}">${abbr}</abbr>`);
    });
    // --- END ABBREVIATIONS HANDLING ---

    // --- FOOTNOTES HANDLING (before paragraph wrapping) ---
    // Collect footnote definitions first (both at start of line and after newlines)
    const footnoteDefs: Record<string, string> = {};
    markdown = markdown.replace(/^\[\^([^\]]+)\]:\s*(.+)$/gm, (match, name, def) => {
        footnoteDefs[name] = def.trim();
        return '';
    });

    // Also handle footnote definitions that might be at the end of content
    markdown = markdown.replace(/\n\[\^([^\]]+)\]:\s*(.+)$/gm, (match, name, def) => {
        if (!footnoteDefs[name]) {
            footnoteDefs[name] = def.trim();
        }
        return '';
    });

    // Replace footnote references with numbered links (but not definitions)
    let footnoteCounter = 1;
    const footnoteRefs: Record<string, number> = {};

    markdown = markdown.replace(/\[\^([^\]]+)\](?!:)/g, (match, name) => {
        if (!footnoteRefs[name]) {
            footnoteRefs[name] = footnoteCounter++;
        }
        const num = footnoteRefs[name];
        return `<sup class="footnote-ref"><a href="#footnote-${num}" id="footnote-ref-${num}">[${num}]</a></sup>`;
    });
    // --- END FOOTNOTES HANDLING ---

    // Restore script blocks BEFORE other processing
    markdown = markdown.replace(/__SCRIPT_BLOCK_(\d+)__/g, (match, index) => {
        return scriptBlocks[parseInt(index)] || match;
    });

    // Process the rest of the markdown
    markdown = markdown
        // Headers - allow for leading whitespace and add anchor links
        .replace(/^\s*### (.*$)/gim, (match, title) => {
            const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
            return `<h3 id="${id}"><a href="#${id}" class="header-anchor">${title}</a></h3>`;
        })
        .replace(/^\s*## (.*$)/gim, (match, title) => {
            const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
            return `<h2 id="${id}"><a href="#${id}" class="header-anchor">${title}</a></h2>`;
        })
        .replace(/^\s*# (.*$)/gim, (match, title) => {
            const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
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
                .map(line => line.replace(/^\s*> ?/, '')) // Remove > and leading spaces
                .filter(line => line.trim() !== '') // Remove empty lines
                .join(' ');
            return `<blockquote>${content}</blockquote>`;
        })
        // Horizontal rules (---) - process before paragraph wrapping
        .replace(/^[ ]*---[ ]*$/gm, '<hr>')
        // Line breaks - be more selective about when to add <br> tags
        .replace(/\n\n/g, '</p><p>')
        // Only add <br> for single newlines that are not between list items or other block elements
        .replace(/(?<!<\/li>)\n(?!<[uo]l>|<li>|<\/[uo]l>|<dl>|<dt>|<dd>|<\/dl>|<table>|<thead>|<tbody>|<tr>|<th>|<td>|<\/table>|<\/thead>|<\/tbody>|<\/tr>|<\/th>|<\/td>|<div|<\/div>|<h[1-6]>|<\/h[1-6]>|<p>|<\/p>|<blockquote>|<\/blockquote>|<hr>|<pre>|<\/pre>|<code>|<\/code>|<strong>|<\/strong>|<em>|<\/em>|<del>|<\/del>|<a\b|<\/a>|<img\b|<\/img>|<abbr>|<\/abbr>|<sup>|<\/sup>|<span>|<\/span>)/g, '<br>')
        // Wrap in paragraphs (exclude HTML elements, blockquotes, and code block placeholders)
        .replace(/^(?!<[^>]*>)(?!> )(?!@@CODEBLOCK\d+@@)(.*)$/gm, '<p>$1</p>')
        // Clean up empty paragraphs
        .replace(/<p><\/p>/g, '')
        .replace(/<p><br><\/p>/g, '')
        // Remove <br> tags from definition descriptions
        .replace(/<dd>(.*?)<\/dd>/g, (match, content) => {
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
        .replace(/<br>\s*<div class="blog-card-header">/g, '<div class="blog-card-header">')
        .replace(/<br>\s*<div class="blog-card-meta">/g, '<div class="blog-card-meta">')
        .replace(/<br>\s*<div class="blog-card-tags">/g, '<div class="blog-card-tags">')
        .replace(/<br>\s*<h3 class="blog-card-title">/g, '<h3 class="blog-card-title">')
        .replace(/<br>\s*<a class="blog-card-link">/g, '<a class="blog-card-link">')
        .replace(/<br>\s*<span class="blog-card-date">/g, '<span class="blog-card-date">')
        .replace(/<br>\s*<span class="blog-card-author">/g, '<span class="blog-card-author">')
        .replace(/<br>\s*<span class="blog-card-tag">/g, '<span class="blog-card-tag">')
        .replace(/<br>\s*<p class="blog-card-excerpt">/g, '<p class="blog-card-excerpt">')
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

        const language = block.lang.toLowerCase();
        const uniqueId = `code-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        return `<div class="code-block-container" data-language="${language}" id="${uniqueId}">
            <div class="code-block-header">
                <span class="language-label">${language}</span>
                <button class="copy-button" type="button">Copy</button>
            </div>
            <pre><code class="language-${language}">${sanitizedCode}</code></pre>
        </div>`;
    });

    return markdown;
}

interface PageData {
    content: string;
    meta: Record<string, any>;
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
   </head>
<body>
    <!-- Navigation Bar -->
    <nav class="navbar">
        <div class="navbar-container">
            <a href="/" class="navbar-brand"><picture><source srcset="/assets/nemic-logos/logo.webp" type="image/webp"><img src="/assets/nemic-logos/logo.png" alt="Logo" class="navbar-logo"></picture><span class="navbar-brand-text">Nergy's Blog</span></a>
            <button class="mobile-menu-toggle" id="mobile-menu-toggle" aria-label="Toggle mobile menu">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                    <line x1="3" y1="12" x2="21" y2="12"></line>
                    <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
            </button>
            <button class="nav-link theme-toggle" id="theme-toggle" aria-label="Toggle dark mode">
                <svg class="sun-icon" viewBox="0 0 24 24" style="display: none;">
                    <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z"/>
                </svg>
                <svg class="moon-icon" viewBox="0 0 24 24">
                    <path d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z"/>
                </svg>
            </button>
            <ul class="navbar-nav" id="navbar-nav">
                {{navigation}}
            </ul>
        </div>
    </nav>

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
            if (e.target.classList.contains('header-anchor')) {
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
                    
                    // Copy URL to clipboard
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
</script>
    </body>
    </html>`;

// Helper: Convert JS object to Lua table string
function jsToLuaTable(obj: any): string {
    if (Array.isArray(obj)) {
        let out = '{';
        for (let i = 0; i < obj.length; i++) {
            const v = obj[i];
            if (typeof v === 'object' && v !== null) {
                out += jsToLuaTable(v);
            } else if (typeof v === 'string') {
                out += '"' + v.replace(/"/g, '\\"') + '"';
            } else {
                out += String(v);
            }
            if (i < obj.length - 1) out += ', ';
        }
        out += '}';
        return out;
    } else if (typeof obj === 'object' && obj !== null) {
        let out = '{';
        for (const [k, v] of Object.entries(obj)) {
            out += `["${k}"] = `;
            if (typeof v === 'object' && v !== null) {
                out += jsToLuaTable(v);
            } else if (typeof v === 'string') {
                out += '"' + v.replace(/"/g, '\\"') + '"';
            } else {
                out += String(v);
            }
            out += ', ';
        }
        out += '}';
        return out;
    } else if (typeof obj === 'string') {
        return '"' + obj.replace(/"/g, '\\"') + '"';
    } else {
        return String(obj);
    }
}

// Lua interpolation system
export interface LuaInterpolation {
    script: string;
    params?: string[];
    fullMatch: string;
}

export function parseLuaInterpolations(content: string): LuaInterpolation[] {
    const interpolations: LuaInterpolation[] = [];

    // Match patterns like {{lua:script_name}} or {{lua:script_name:param1,param2}}
    const regex = /\{\{lua:([^:}]+)(?::([^}]+))?\}\}/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
        interpolations.push({
            script: match[1].trim(),
            params: match[2] ? match[2].split(',').map(p => p.trim()) : undefined,
            fullMatch: match[0]
        });
    }

    return interpolations;
}

export async function executeLuaScript(scriptName: string, params?: string[]): Promise<string> {
    const luaPath = `./lua-scripts/${scriptName}.lua`;

    try {
        // Check if the script exists
        await Deno.stat(luaPath);

        // Create a temporary Lua script that executes the target script
        let tempLuaScript = `dofile("${luaPath}")\n`;

        // If the script has a main function, call it with parameters
        if (params && params.length > 0) {
            tempLuaScript += `\n-- Call main function with parameters\n`;
            tempLuaScript += `if main then\n`;
            tempLuaScript += `  local result = main(${params.map(p => `"${p}"`).join(', ')})\n`;
            tempLuaScript += `  if result then\n`;
            tempLuaScript += `    print(result)\n`;
            tempLuaScript += `  end\n`;
            tempLuaScript += `end\n`;
        } else {
            // If no parameters, just execute the script and capture any output
            tempLuaScript += `\n-- Script executed without parameters\n`;
        }

        // Write temporary script
        const tempFile = `temp_interp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.lua`;
        await Deno.writeTextFile(tempFile, tempLuaScript);

        // Execute Lua script
        const process = new Deno.Command("lua", {
            args: [tempFile],
            stdout: "piped",
            stderr: "piped",
        });

        const { code, stdout, stderr } = await process.output();
        const output = new TextDecoder().decode(stdout);
        const error = new TextDecoder().decode(stderr);

        // Clean up temp file
        await Deno.remove(tempFile);

        if (code !== 0) {
            console.error(`Lua interpolation error for ${scriptName}:`, error);
            return `[Lua Error: ${scriptName}]`;
        }

        return output.trim();
    } catch (error) {
        console.error(`Lua script not found or failed: ${luaPath}`);
        return `[Lua Script Not Found: ${scriptName}]`;
    }
}

export async function processLuaInterpolations(content: string): Promise<string> {
    const interpolations = parseLuaInterpolations(content);

    for (const interpolation of interpolations) {
        const result = await executeLuaScript(interpolation.script, interpolation.params);
        content = content.replace(interpolation.fullMatch, result);
    }

    return content;
}

// Process TOC marker and replace with blog cards
async function processTOCMarker(content: string, filePath: string): Promise<string> {
    const marker = '{{routes:toc}}';
    if (!content.includes(marker)) {
        return content;
    }

    // Only process TOC for blogs index page
    if (!filePath.includes('/blogs/index.md')) {
        return content;
    }

    try {
        const blogsDir = './routes/blogs';
        const blogPosts: Array<{
            title: string;
            date: string;
            author: string;
            tags: string[];
            excerpt: string;
            filename: string;
            url: string;
        }> = [];

        // Scan blogs directory for markdown files (excluding index.md)
        for await (const entry of Deno.readDir(blogsDir)) {
            if (entry.isFile && entry.name.endsWith('.md') && entry.name !== 'index.md') {
                const filePath = join(blogsDir, entry.name);
                const content = await Deno.readTextFile(filePath);
                const meta = await extractMetadata(content);

                // Extract excerpt (first paragraph after frontmatter)
                let excerpt = '';
                if (content.startsWith('---')) {
                    const endIndex = content.indexOf('---', 3);
                    if (endIndex !== -1) {
                        const markdownContent = content.substring(endIndex + 3).trim();
                        const firstParagraph = markdownContent.split('\n\n')[0];
                        // Remove markdown formatting for excerpt
                        excerpt = firstParagraph
                            .replace(/^#+\s*/, '') // Remove headers
                            .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
                            .replace(/\*(.*?)\*/g, '$1') // Remove italic
                            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
                            .substring(0, 150) + (firstParagraph.length > 150 ? '...' : '');
                    }
                }

                const filename = basename(entry.name, '.md');
                blogPosts.push({
                    title: meta.title || filename.replace(/-/g, ' ').replace(/_/g, ' '),
                    date: meta.date || '',
                    author: meta.author || '',
                    tags: meta.tags || [],
                    excerpt,
                    filename,
                    url: `/blogs/${filename}`
                });
            }
        }

        // Sort by date (newest first)
        blogPosts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // Generate blog cards HTML
        const blogCardsHTML = blogPosts.map(post => `<div class="blog-card">
    <a href="${post.url}" class="blog-card-link-wrapper">
        <div class="blog-card-header">
            <h3 class="blog-card-title">${post.title}</h3>
            <div class="blog-card-meta">
                <span class="blog-card-date">${post.date}</span>
                ${post.author ? `<span class="blog-card-author">by ${post.author}</span>` : ''}
            </div>
        </div>
        ${post.excerpt ? `<p class="blog-card-excerpt">${post.excerpt}</p>` : ''}
        ${post.tags.length > 0 ? `<div class="blog-card-tags">
            ${post.tags.map(tag => `<span class="blog-card-tag">${tag}</span>`).join('')}
        </div>` : ''}
    </a>
</div>`).join('');

        // Replace marker with blog cards
        return content.replace(marker, blogCardsHTML);

    } catch (error) {
        console.error('❌ Error processing TOC marker:', error);
        return content.replace(marker, '<p>Error loading blog posts.</p>');
    }
}

// Process Lua template if it exists
async function processLuaTemplate(mdPath: string, content: string, meta: Record<string, any>): Promise<string> {
    const luaPath = './template.lua';

    try {
        const luaFile = await Deno.readTextFile(luaPath);

        // Create a temporary Lua script that processes the content
        const tempLuaScript = `
${luaFile}

-- Call the render function if it exists
if render then
  result = render([[
${content}
]], {
    meta = ${jsToLuaTable(meta)},
    path = "${mdPath}"
})
else
  result = [[
${content}
]]
end

print(result)
`;

        // Write temporary script
        const safePath = mdPath.replace(/[^a-zA-Z0-9]/g, '_');
        const tempFile = `temp_${Date.now()}_${safePath}.lua`;
        await Deno.writeTextFile(tempFile, tempLuaScript);

        // Execute Lua script
        const process = new Deno.Command("lua", {
            args: [tempFile],
            stdout: "piped",
            stderr: "piped",
        });

        const { code, stdout, stderr } = await process.output();
        const output = new TextDecoder().decode(stdout);
        const error = new TextDecoder().decode(stderr);

        // Clean up temp file
        await Deno.remove(tempFile);

        if (code !== 0) {
            console.error(`Lua error for ${mdPath}:`, error);
            return content;
        }

        return output.trim();
    } catch (error) {
        // If Lua file doesn't exist or fails, return original content
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
            const meta = await extractMetadata(content);
            return {
                content: cached.content,
                meta,
                path: filePath
            };
        }
    }

    // Extract frontmatter if present
    const meta = await extractMetadata(content);
    let markdownContent = content;

    if (content.startsWith('---')) {
        const endIndex = content.indexOf('---', 3);
        if (endIndex !== -1) {
            markdownContent = content.substring(endIndex + 3).trim();
        }
    }

    // Process Lua interpolations in the markdown content
    const interpolatedContent = await processLuaInterpolations(markdownContent);

    // Process TOC marker if present
    const tocProcessedContent = await processTOCMarker(interpolatedContent, filePath);

    // Parse markdown to HTML (after interpolation and TOC processing)
    const htmlContent = parseMarkdown(tocProcessedContent);

    // Process with Lua template if available
    const processedContent = await processLuaTemplate(filePath, htmlContent, meta);

    // Update cache
    await updateCache(filePath, content, processedContent);

    return {
        content: processedContent,
        meta,
        path: filePath
    };
}

// Extract metadata from markdown content
async function extractMetadata(content: string): Promise<Record<string, any>> {
    const meta: Record<string, any> = {};

    if (content.startsWith('---')) {
        const endIndex = content.indexOf('---', 3);
        if (endIndex !== -1) {
            const frontmatter = content.substring(3, endIndex).trim();

            // Simple YAML-like parsing
            for (const line of frontmatter.split('\n')) {
                const colonIndex = line.indexOf(':');
                if (colonIndex !== -1) {
                    const key = line.substring(0, colonIndex).trim();
                    const value = line.substring(colonIndex + 1).trim();

                    // Handle YAML arrays like [tag1, tag2]
                    if (value.startsWith('[') && value.endsWith(']')) {
                        const arrayContent = value.substring(1, value.length - 1);
                        const arrayItems = arrayContent.split(',').map(item => item.trim());
                        meta[key] = arrayItems;
                    } else {
                        meta[key] = value;
                    }
                }
            }
        }
    }

    return meta;
}

// Helper function to check if WebP logo exists
function checkWebPLogoExists(): boolean {
    try {
        const webpPath = './dist/assets/nemic-logos/logo.webp';
        const stat = Deno.statSync(webpPath);
        return stat.isFile;
    } catch {
        return false;
    }
}

// Generate HTML from template
function generateHTML(content: string, meta: Record<string, any>, navigation: string, currentPath: string = ''): string {
    let html = DEFAULT_TEMPLATE;

    // Check if WebP logo exists and replace the logo HTML accordingly
    const webpLogoExists = checkWebPLogoExists();
    if (webpLogoExists) {
        // WebP exists, use picture element with WebP source
        html = html.replace(
            '<picture><source srcset="/assets/nemic-logos/logo.webp" type="image/webp"><img src="/assets/nemic-logos/logo.png" alt="Logo" class="navbar-logo"></picture>',
            '<picture><source srcset="/assets/nemic-logos/logo.webp" type="image/webp"><img src="/assets/nemic-logos/logo.png" alt="Logo" class="navbar-logo"></picture>'
        );
    } else {
        // WebP doesn't exist, use just the original image
        html = html.replace(
            '<picture><source srcset="/assets/nemic-logos/logo.webp" type="image/webp"><img src="/assets/nemic-logos/logo.png" alt="Logo" class="navbar-logo"><span class="navbar-brand-text">Nergy\'s Blog</span>',
            '<img src="/assets/nemic-logos/logo.png" alt="Logo" class="navbar-logo"><span class="navbar-brand-text">Nergy\'s Blog</span>'
        );
    }

    // Replace template variables
    html = html.replace('{{title}}', meta.title + ' | Nergy' || 'Nergy\'s Blog');
    html = html.replace('{{content}}', content);
    html = html.replace('{{navigation}}', navigation);

    // Add Lua WASM runtime script and Prism.js scripts
    const additionalScripts = `
    <script type="application/lua" data-module="render-time">
-- Simple render time module for backward compatibility
local os = require("os")
local format = "iso"
return os.date("!%Y-%m-%dT%H:%M:%SZ")
    </script>
    <!-- Prism.js for syntax highlighting -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism.min.css">
    <script defer src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-core.min.js"></script>
    <script defer src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/plugins/autoloader/prism-autoloader.min.js"></script>
    `;

    html = html.replace('</head>', additionalScripts + '</head>');

    return html;
}

// Generate navigation from routes directory
async function generateNavigation(): Promise<NavItem[]> {
    const routesDir = './routes';
    const navItems: NavItem[] = [];

    try {
        for await (const entry of Deno.readDir(routesDir)) {
            if (entry.isFile && entry.name.endsWith('.md')) {
                const fileName = basename(entry.name, '.md');
                if (fileName !== 'index') {
                    navItems.push({
                        title: fileName.charAt(0).toUpperCase() + fileName.slice(1).replace(/_/g, ' '),
                        url: `/${fileName}`
                    });
                }
            } else if (entry.isDirectory) {
                const folderName = entry.name;
                const children: NavItem[] = [];

                // Scan subdirectory for markdown files
                try {
                    for await (const subEntry of Deno.readDir(join(routesDir, folderName))) {
                        if (subEntry.isFile && subEntry.name.endsWith('.md') && subEntry.name !== 'index.md') {
                            const fileName = basename(subEntry.name, '.md');
                            const filePath = join(routesDir, folderName, subEntry.name);

                            // Read file content to extract metadata
                            let date = '';
                            let title = fileName.charAt(0).toUpperCase() + fileName.slice(1).replace(/_/g, ' ').replace(/-/g, ' ');

                            try {
                                const content = await Deno.readTextFile(filePath);
                                const meta = await extractMetadata(content);
                                if (meta.date) {
                                    date = meta.date;
                                }
                                if (meta.title) {
                                    title = meta.title;
                                }
                            } catch (error) {
                                console.log(`ℹ️  Could not read metadata from ${filePath}`);
                            }

                            children.push({
                                title,
                                url: `/${folderName}/${fileName}`,
                                date
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
                } catch (error) {
                    console.log(`ℹ️  Could not read subdirectory ${folderName}`);
                }

                if (children.length > 0) {
                    navItems.push({
                        title: folderName.charAt(0).toUpperCase() + folderName.slice(1).replace(/_/g, ' '),
                        url: `/${folderName}`,
                        children
                    });
                }
            }
        }
    } catch (error) {
        console.error('❌ Could not read routes directory for navigation');
    }

    return navItems;
}

// Generate navigation HTML
function generateNavigationHTML(navItems: NavItem[], currentPath: string = ''): string {
    let html = '';

    for (const item of navItems) {
        if (item.children && item.children.length > 0) {
            // Check if current page is in this dropdown
            const isActive = currentPath === item.url || item.children.some(child => currentPath === child.url);
            const activeClass = isActive ? ' active' : '';

            // Dropdown menu
            html += `<li class="nav-item nav-dropdown${activeClass}">`;
            html += `<button type="button" class="nav-link nav-dropdown-toggle${isActive ? ' active' : ''}">${item.title}</button>`;
            html += `<div class="nav-dropdown-content">`;
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
    const assetsDir = './assets';
    const distAssetsDir = './dist/assets';

    try {
        await ensureDir(distAssetsDir);

        // Copy all assets recursively, including images
        async function copyAssetRecursively(dir: string, basePath: string = '') {
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
            } catch (error) {
                console.log(`ℹ️  Could not read directory ${dir}`);
            }
        }

        await copyAssetRecursively(assetsDir);
        console.log('✅ All assets copied to dist/assets/');
    } catch (error) {
        console.log('ℹ️  No assets directory found');
    }

    // Always copy favicon.ico to dist root
    try {
        await copy('./assets/favicon.ico', './dist/favicon.ico', { overwrite: true });
        console.log('✅ favicon.ico copied to dist/');
    } catch (error) {
        // Ignore if not present
    }
}

// Optimize images to WebP format using optimizt
async function optimizeImages(): Promise<void> {
    const assetsDir = './assets';
    const distAssetsDir = './dist/assets';

    // Find all image files recursively
    const imageFiles: Array<{ fullPath: string; relativePath: string }> = [];

    async function findImages(dir: string, basePath: string = '') {
        try {
            for await (const entry of Deno.readDir(dir)) {
                const fullPath = join(dir, entry.name);
                const relativePath = join(basePath, entry.name);

                if (entry.isFile) {
                    const ext = extname(entry.name).toLowerCase();
                    if ([
                        '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff'
                    ].includes(ext)) {
                        imageFiles.push({ fullPath, relativePath });
                    }
                } else if (entry.isDirectory) {
                    await findImages(fullPath, relativePath);
                }
            }
        } catch (error) {
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
            const process = new Deno.Command("optimizt", {
                args: ["--help"],
                stdout: "piped",
                stderr: "piped",
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
                const outputPath = join(distAssetsDir, relativePath.replace(/\.[^.]+$/, '.webp'));

                // Ensure output directory exists
                await ensureDir(dirname(outputPath));

                // Run optimizt to create WebP version
                const process = new Deno.Command("optimizt", {
                    args: [
                        fullPath,
                        "--webp",
                        "--force",
                    ],
                    stdout: "piped",
                    stderr: "piped",
                });

                const { code, stderr } = await process.output();

                // Move the generated .webp to dist/assets
                const webpSource = fullPath.replace(/\.[^.]+$/, '.webp');
                if (code === 0) {
                    try {
                        await copy(webpSource, outputPath, { overwrite: true });
                        console.log(`✅ Optimized ${relativePath} → ${basename(outputPath)}`);
                        // Optionally remove the .webp from source
                        await Deno.remove(webpSource);
                    } catch (err) {
                        console.error(`❌ Failed to move/copy webp: ${webpSource} to ${outputPath}`);
                    }
                } else {
                    const error = new TextDecoder().decode(stderr);
                    console.error(`❌ Failed to optimize ${relativePath}:`, error.toString());
                }
            } catch (error) {
                console.error(`❌ Error processing ${fullPath}:`, error);
            }
        }

        console.log('✅ Image optimization complete!');
        // No need to update HTML references
    } catch (error) {
        console.log('ℹ️  Image optimization failed');
    }
}

// Performance monitoring
const buildMetrics = {
    startTime: 0,
    fileProcessingTimes: new Map<string, number>(),
    totalFiles: 0,
    cachedFiles: 0,
    processedFiles: 0
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
        ? Array.from(buildMetrics.fileProcessingTimes.values()).reduce((a, b) => a + b, 0) / buildMetrics.processedFiles
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

// Main build function
async function build(): Promise<void> {
    console.log('🚀 Starting build...');
    startBuildTimer();

    // Ensure dist directory exists
    await ensureDir('./dist');

    // Generate navigation
    console.log('🧭 Generating navigation...');
    const navItems = await generateNavigation();
    const navigationHTML = generateNavigationHTML(navItems);
    console.log('Navigation items:', navItems);
    console.log('Navigation HTML:', navigationHTML);

    // Find all markdown files in routes (including subdirectories)
    const routesDir = './routes';
    const markdownFiles: string[] = [];

    async function scanDirectory(dir: string, basePath: string = '') {
        try {
            for await (const entry of Deno.readDir(dir)) {
                if (entry.isFile && entry.name.endsWith('.md')) {
                    const relativePath = join(basePath, entry.name);
                    markdownFiles.push(join(dir, entry.name));
                } else if (entry.isDirectory) {
                    const subDir = join(dir, entry.name);
                    const subBasePath = join(basePath, entry.name);
                    await scanDirectory(subDir, subBasePath);
                }
            }
        } catch (error) {
            console.error(`❌ Could not read directory ${dir}`);
        }
    }

    try {
        await scanDirectory(routesDir);
    } catch (error) {
        console.error('❌ Routes directory not found.');
        return;
    }

    if (markdownFiles.length === 0) {
        console.log('ℹ️  No markdown files found in routes/');
        return;
    }

    // Process markdown files in parallel for better performance
    console.log(`📝 Processing ${markdownFiles.length} markdown files...`);
    buildMetrics.totalFiles = markdownFiles.length;

    const processingPromises = markdownFiles.map(async (filePath) => {
        const startTime = performance.now();
        console.log(`📝 Processing ${filePath}...`);

        try {
            const pageData = await processMarkdownFile(filePath);

            // Determine current path for active navigation
            const fileName = basename(filePath, '.md');
            const relativePath = filePath.replace(/^\.?\/?routes\//, '').replace('.md', '');
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
            const html = generateHTML(pageData.content, pageData.meta, pageNavigationHTML, currentPath);

            // Determine output path
            let outputPath;

            if (fileName === 'index') {
                if (relativePath === 'index') {
                    outputPath = join('./dist', 'index.html');
                } else {
                    // index.md in a subdirectory
                    const dirName = dirname(relativePath);
                    outputPath = join('./dist', dirName, 'index.html');
                }
            } else {
                if (relativePath === fileName) {
                    // Top-level file
                    outputPath = join('./dist', `${fileName}.html`);
                } else {
                    // File in subdirectory
                    outputPath = join('./dist', `${relativePath}.html`);
                }
            }

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

    // Log summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    console.log(`📊 Build summary: ${successful} files processed successfully, ${failed} failed`);

    // Copy assets and optimize images
    console.log('📁 Copying assets...');
    await copyAssets();

    // Copy serve.ts to dist for independent execution
    console.log('🚀 Copying and patching serve.ts to dist...');
    try {
        let serveSrc = await Deno.readTextFile('./serve.ts');
        // Patch fsRoot: "./dist" to fsRoot: "."
        serveSrc = serveSrc.replace('fsRoot: "./dist"', 'fsRoot: "."');
        // Patch specific Deno.readTextFile calls - be more precise
        serveSrc = serveSrc.replace(/Deno\.readTextFile\("\.\/dist" \+ htmlPath\)/g, 'Deno.readTextFile(htmlPath.slice(1))');
        serveSrc = serveSrc.replace(/const indexPath = "\.\/dist\/index\.html";/g, 'const indexPath = "index.html";');
        serveSrc = serveSrc.replace(/const indexContent = await Deno\.readTextFile\(indexPath\);/g, 'const indexContent = await Deno.readTextFile(indexPath);');
        await Deno.writeTextFile('./dist/serve.ts', serveSrc);
        console.log('✅ serve.ts copied and patched to dist/');
    } catch (error) {
        console.error('❌ Failed to copy/patch serve.ts:', error);
    }

    console.log('🖼️  Optimizing images...');
    await optimizeImages();

    // Log performance metrics
    logBuildMetrics();

    // Clean up WebP files
    console.log('🧹 Cleaning up WebP files...');
    // await cleanupWebpFiles(); // This line is removed as per the edit hint

    console.log('🎉 Build complete!');
}

// Run build if this script is executed directly
if (import.meta.main) {
    await build();
} 