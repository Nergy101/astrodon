const fs = require('node:fs');

// Read the Ghost backup file
const backupData = JSON.parse(
  fs.readFileSync("Nergy's Blog Dec 21 2024.json", 'utf8')
);

// Extract posts from the backup
const posts = backupData.db[0].data.posts;

// Create blogs directory if it doesn't exist
if (!fs.existsSync('blogs')) {
  fs.mkdirSync('blogs');
}

// Process each post
posts.forEach(post => {
  if (post.type === 'post' && post.status === 'published') {
    // Create filename from slug
    const filename = `${post.slug}.md`;
    const filepath = `blogs/${filename}`;

    // Create frontmatter
    const frontmatter = `---
title: "${post.title}"
date: "${post.published_at}"
slug: "${post.slug}"
featured: ${post.featured}
tags: []
---

`;

    // Convert HTML content to markdown
    let content = post.html || post.plaintext || '';

    // Replace image placeholders
    content = content.replace(/<img[^>]*src="[^"]*"[^>]*>/g, match => {
      return '\n\n```\n[IMAGE PLACEHOLDER]\n```\n\n';
    });

    // Replace HTML tags with markdown equivalents
    content = content
      .replace(/<h1[^>]*>(.*?)<\/h1>/g, '# $1\n\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/g, '## $1\n\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/g, '### $1\n\n')
      .replace(/<h4[^>]*>(.*?)<\/h4>/g, '#### $1\n\n')
      .replace(/<h5[^>]*>(.*?)<\/h5>/g, '##### $1\n\n')
      .replace(/<h6[^>]*>(.*?)<\/h6>/g, '###### $1\n\n')
      .replace(/<p[^>]*>(.*?)<\/p>/g, '$1\n\n')
      .replace(/<strong[^>]*>(.*?)<\/strong>/g, '**$1**')
      .replace(/<b[^>]*>(.*?)<\/b>/g, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/g, '*$1*')
      .replace(/<i[^>]*>(.*?)<\/i>/g, '*$1*')
      .replace(/<code[^>]*>(.*?)<\/code>/g, '`$1`')
      .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g, '[$2]($1)')
      .replace(/<ul[^>]*>(.*?)<\/ul>/gs, (match, content) => {
        return content.replace(/<li[^>]*>(.*?)<\/li>/g, '- $1\n') + '\n';
      })
      .replace(/<ol[^>]*>(.*?)<\/ol>/gs, (match, content) => {
        let counter = 1;
        return (
          content.replace(/<li[^>]*>(.*?)<\/li>/g, () => `${counter++}. $1\n`) +
          '\n'
        );
      })
      .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gs, (match, content) => {
        return (
          content
            .split('\n')
            .map(line => `> ${line}`)
            .join('\n') + '\n\n'
        );
      })
      .replace(/<hr[^>]*>/g, '---\n\n')
      .replace(/<br[^>]*>/g, '\n')
      .replace(
        /<div[^>]*class="github-card"[^>]*>.*?<\/div>/gs,
        '\n\n```\n[GITHUB CARD PLACEHOLDER]\n```\n\n'
      )
      .replace(
        /<div[^>]*class="kg-card[^"]*"[^>]*>.*?<\/div>/gs,
        '\n\n```\n[CARD PLACEHOLDER]\n```\n\n'
      )
      .replace(
        /<figure[^>]*>.*?<\/figure>/gs,
        '\n\n```\n[FIGURE PLACEHOLDER]\n```\n\n'
      )
      .replace(/<script[^>]*>.*?<\/script>/gs, '')
      .replace(/<style[^>]*>.*?<\/style>/gs, '')
      .replace(/<!--.*?-->/gs, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();

    // Write the markdown file
    fs.writeFileSync(filepath, frontmatter + content);
    console.log(`Created: ${filepath}`);
  }
});

console.log(
  '\nExtraction complete! Check the blogs/ directory for the markdown files.'
);
