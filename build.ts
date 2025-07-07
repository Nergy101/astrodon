#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run

import { ensureDir, copy } from "https://deno.land/std@0.208.0/fs/mod.ts";
import { join, extname, basename, dirname } from "https://deno.land/std@0.208.0/path/mod.ts";

// Simple markdown to HTML conversion
function parseMarkdown(markdown: string): string {
    // Store script tags first to preserve their structure
    const scriptBlocks: string[] = [];
    let scriptBlockIndex = 0;

    markdown = markdown.replace(/<script>([\s\S]*?)<\/script>/g, function (match, scriptContent) {
        scriptBlocks.push(match);
        return `\n\n__SCRIPT_BLOCK_${scriptBlockIndex++}__\n\n`;
    });

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

    // Images - ensure proper asset paths (process before links)
    markdown = markdown.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
        if (!src.startsWith('http') && !src.startsWith('https') && !src.startsWith('/assets/')) {
            const cleanSrc = src.replace(/^\.?\/?/, '');
            return `<img src="/assets/${cleanSrc}" alt="${alt}">`;
        }
        return `<img src="${src}" alt="${alt}">`;
    });

    // Links (process after images to avoid conflicts)
    markdown = markdown.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

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
        return html;
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
        // Inline code
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
        // Line breaks
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>')
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
        // Remove <br> tags that are inside HTML elements (like Monaco editors)
        .replace(/(<[^>]+>)([^<]*?)<br>([^<]*?)(<\/[^>]+>)/g, '$1$2 $3$4');

    // At the very end, replace code block placeholders with Monaco HTML using the raw code
    markdown = markdown.replace(/@@CODEBLOCK(\d+)@@/g, (match, index) => {
        const block = rawCodeBlocks[parseInt(index)];
        if (!block) return match;
        const uniqueId = `code-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        return `<div class="monaco-editor-container" data-language="${block.lang}" id="${uniqueId}">
            <div class="code-block-header">
                <span class="language-label">${block.lang}</span>
                <button class="copy-button">Copy</button>
            </div>
            <div class="monaco-editor-wrapper"></div>
            <textarea style="display: none;">${block.code}</textarea>
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
    <script src="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs/loader.min.js"></script>
    <!-- KaTeX for math rendering -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
   </head>
<body>
    <!-- Navigation Bar -->
    <nav class="navbar">
        <div class="navbar-container">
            <a href="/" class="navbar-brand"><img src="/assets/nemic-logos/logo.png" alt="Logo" class="navbar-logo"> Nergy's Blog</a>
            <ul class="navbar-nav">
                {{navigation}}
                <li class="nav-item">
                    <button class="nav-link theme-toggle" id="theme-toggle" aria-label="Toggle dark mode">
                        <svg class="sun-icon" viewBox="0 0 24 24" style="display: none;">
                            <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z"/>
                        </svg>
                        <svg class="moon-icon" viewBox="0 0 24 24">
                            <path d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z"/>
                        </svg>
                    </button>
                </li>
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
            
            // Update Monaco editor themes
            if (window.monaco && window.monaco.editor) {
                const monacoTheme = newTheme === 'dark' ? 'vs-dark' : 'vs';
                monaco.editor.setTheme(monacoTheme);
            }
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

        // Simple Monaco Editor initialization
        require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' }});
        
        require(['vs/editor/editor.main'], function() {
            const codeBlocks = document.querySelectorAll('.monaco-editor-container');
            
            codeBlocks.forEach((container) => {
                const textarea = container.querySelector('textarea');
                const wrapper = container.querySelector('.monaco-editor-wrapper');
                const language = container.dataset.language || 'plaintext';
                
                if (!textarea || !wrapper) return;
                
                const code = textarea.value || '';
                const theme = document.documentElement.getAttribute('data-theme') || 'light';
                const monacoTheme = theme === 'dark' ? 'vs-dark' : 'vs';
                
                try {
                    const editor = monaco.editor.create(wrapper, {
                        value: code,
                        language: language,
                        theme: monacoTheme,
                        readOnly: true,
                        minimap: { enabled: false },
                        fontSize: 14,
                        lineNumbers: 'on',
                        automaticLayout: true
                    });
                    
                    // --- Fit editor height to content ---
                    function updateEditorHeight() {
                        const lineCount = editor.getModel().getLineCount();
                        const lineHeight = editor.getOption(monaco.editor.EditorOption.lineHeight);
                        // Add a little extra for padding/header
                        const headerHeight = 32;
                        const minHeight = 80;
                        const maxHeight = 600;
                        let height = lineCount * lineHeight + headerHeight;
                        if (height < minHeight) height = minHeight;
                        if (height > maxHeight) height = maxHeight;
                        wrapper.style.height = height + 'px';
                        editor.layout();
                    }
                    updateEditorHeight();
                    // If content could change, listen for changes:
                    editor.onDidChangeModelContent(updateEditorHeight);
                    // --- End fit-content logic ---
                    
                    textarea.style.display = 'none';
                    
                    // Copy button functionality
                    const copyButton = container.querySelector('.copy-button');
                    if (copyButton) {
                        copyButton.addEventListener('click', async () => {
                            try {
                                await navigator.clipboard.writeText(editor.getValue());
                                copyButton.textContent = 'Copied!';
                                setTimeout(() => copyButton.textContent = 'Copy', 2000);
                            } catch (err) {
                                console.error('Failed to copy code:', err);
                            }
                        });
                    }
                } catch (error) {
                    // Fallback to simple pre block
                    wrapper.innerHTML = '<pre style="margin: 0; padding: 1rem; background: #f5f5f5; border-radius: 4px; overflow-x: auto;">' + code + '</pre>';
                }
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
        const tempFile = `temp_interp_${Date.now()}.lua`;
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
        const tempFile = `temp_${Date.now()}.lua`;
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

// Process markdown file
async function processMarkdownFile(filePath: string): Promise<PageData> {
    const content = await Deno.readTextFile(filePath);

    // Extract frontmatter if present
    let meta: Record<string, any> = {};
    let markdownContent = content;

    if (content.startsWith('---')) {
        const endIndex = content.indexOf('---', 3);
        if (endIndex !== -1) {
            const frontmatter = content.substring(3, endIndex).trim();
            markdownContent = content.substring(endIndex + 3).trim();

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

    // Debug: Log the parsed metadata
    console.log(`📋 Metadata for ${filePath}:`, JSON.stringify(meta, null, 2));

    // Process Lua interpolations in the markdown content
    const interpolatedContent = await processLuaInterpolations(markdownContent);

    // Parse markdown to HTML (after interpolation)
    const htmlContent = parseMarkdown(interpolatedContent);

    // Process with Lua template if available
    const processedContent = await processLuaTemplate(filePath, htmlContent, meta);

    return {
        content: processedContent,
        meta,
        path: filePath
    };
}

// Generate HTML from template
function generateHTML(content: string, meta: Record<string, any>, navigation: string, currentPath: string = ''): string {
    let html = DEFAULT_TEMPLATE;

    // Replace template variables
    html = html.replace('{{title}}', meta.title || 'My Blog');
    html = html.replace('{{content}}', content);
    html = html.replace('{{navigation}}', navigation);

    // Add Lua WASM runtime script
    const luaRuntimeScript = `
    <script type="application/lua" data-module="render-time">
-- Simple render time module for backward compatibility
local os = require("os")
local format = "iso"
return os.date("!%Y-%m-%dT%H:%M:%SZ")
    </script>
    `;

    html = html.replace('</head>', luaRuntimeScript + '</head>');

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
                        if (subEntry.isFile && subEntry.name.endsWith('.md')) {
                            const fileName = basename(subEntry.name, '.md');
                            children.push({
                                title: fileName.charAt(0).toUpperCase() + fileName.slice(1).replace(/_/g, ' ').replace(/-/g, ' '),
                                url: `/${folderName}/${fileName}`
                            });
                        }
                    }
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
            html += `<a href="${item.url}" class="nav-link nav-dropdown-toggle${isActive ? ' active' : ''}">${item.title}</a>`;
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

// Copy assets
async function copyAssets(): Promise<void> {
    const assetsDir = './assets';
    const distAssetsDir = './dist/assets';

    try {
        await ensureDir(distAssetsDir);
        await copy(assetsDir, distAssetsDir, { overwrite: true });
        console.log('✅ Assets copied to dist/assets/');
    } catch (error) {
        console.log('ℹ️  No assets directory found or already copied');
    }
}

// Main build function
async function build(): Promise<void> {
    console.log('🚀 Starting build...');

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

    // Process each markdown file
    for (const filePath of markdownFiles) {
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

        } catch (error) {
            console.error(`❌ Error processing ${filePath}:`, error);
        }
    }

    // Copy assets
    await copyAssets();

    console.log('🎉 Build complete!');
}

// Run build if this script is executed directly
if (import.meta.main) {
    await build();
} 