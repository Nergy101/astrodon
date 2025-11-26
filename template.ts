export interface RenderContext {
  meta: Record<string, any>;
  path: string;
}

export function render(content: string, context: RenderContext): string {
  const meta = context.meta;
  const path = context.path;

  // Replace literal \n with actual newlines
  content = content.replace(/\\n/g, '\n');

  // Create metadata component
  let metadata = '<div class="metadata">';
  
  if (meta.author) {
    metadata += `<span class="author">By ${meta.author}</span>`;
  }
  
  if (meta.date) {
    metadata += `<span class="date">${meta.date}</span>`;
  }
  
  if (meta.tags && Array.isArray(meta.tags)) {
    metadata += '<div class="tags">';
    for (const tag of meta.tags) {
      metadata += `<span class="tag">${tag}</span>`;
    }
    metadata += '</div>';
  }
  
  metadata += '</div>';

  // Patch: Do not process blockquotes inside code blocks
  const blocks: string[] = [];
  let i = 1;
  content = content.replace(/<div class="code-block-container".*?<\/div>/gs, (block) => {
    blocks[i] = block;
    const marker = `__CODE_BLOCK_${i}__`;
    i++;
    return marker;
  });

  // Process blockquotes to clean up formatting
  let processedContent = content.replace(
    /<blockquote>(.*?)<\/blockquote>/gs,
    (match, quoteText) => {
      // Clean up literal \n characters and extra whitespace
      quoteText = quoteText.replace(/\\n/g, '\n');
      quoteText = quoteText.replace(/^\n*/g, '');  // Remove leading newlines
      quoteText = quoteText.replace(/\n*$/g, '');  // Remove trailing newlines
      quoteText = quoteText.replace(/\n+/g, ' ');  // Replace multiple newlines with single space
      quoteText = quoteText.replace(/\s+/g, ' ');  // Replace multiple spaces with single space
      quoteText = quoteText.trim();  // Trim whitespace
      
      // Try to extract quote and author if in format "quote" - author
      const quoteMatch = quoteText.match(/^"([^"]+)"\s*-\s*(.+)$/);
      if (quoteMatch) {
        const [, quote, author] = quoteMatch;
        return `<blockquote>
  "${quote}"
  <cite>- ${author}</cite>
</blockquote>`;
      } else {
        // If no quote-author pattern found, just return cleaned content
        return `<blockquote>${quoteText}</blockquote>`;
      }
    }
  );

  // Restore code blocks
  processedContent = processedContent.replace(/__CODE_BLOCK_(\d+)__/g, (match, idx) => {
    const index = parseInt(idx, 10);
    return blocks[index] || '';
  });

  return metadata + processedContent;
}

