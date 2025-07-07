function render(content, context)
  local meta = context.meta
  local path = context.path

  content = content:gsub('\\n', '\n')

  -- Create metadata component
  local metadata = '<div class="metadata">'
  
  if meta.author then
    metadata = metadata .. string.format('<span class="author">By %s</span>', meta.author)
  end
  
  if meta.date then
    metadata = metadata .. string.format('<span class="date">%s</span>', meta.date)
  end
  
  if meta.tags and type(meta.tags) == 'table' then
    metadata = metadata .. '<div class="tags">'
    for i, tag in ipairs(meta.tags) do
      metadata = metadata .. string.format('<span class="tag">#%s</span>', tag)
    end
    metadata = metadata .. '</div>'
  end
  
  metadata = metadata .. '</div>'

  -- Patch: Do not process blockquotes inside code blocks
  local blocks = {}
  local i = 1
  content = content:gsub('(<div class="code%-block%-container".-</div>)', function(block)
    blocks[i] = block
    local marker = "__CODE_BLOCK_" .. i .. "__"
    i = i + 1
    return marker
  end)

  -- Process blockquotes to clean up formatting
  local processedContent = content:gsub(
    '<blockquote>(.-)</blockquote>',
    function(quoteText)
      -- Clean up literal \n characters and extra whitespace
      quoteText = quoteText:gsub('\\n', '\n')
      quoteText = quoteText:gsub('^\n*', '')  -- Remove leading newlines
      quoteText = quoteText:gsub('\n*$', '')  -- Remove trailing newlines
      quoteText = quoteText:gsub('\n+', ' ')  -- Replace multiple newlines with single space
      quoteText = quoteText:gsub('%s+', ' ')  -- Replace multiple spaces with single space
      quoteText = quoteText:match('^%s*(.-)%s*$') or quoteText  -- Trim whitespace
      
      -- Try to extract quote and author if in format "quote" - author
      local quote, author = quoteText:match('"([^"]+)"%s*%-%s*(.+)')
      if quote and author then
        return string.format([[<blockquote>
  "%s"
  <cite>- %s</cite>
</blockquote>]], quote, author)
      else
        -- If no quote-author pattern found, just return cleaned content
        return string.format('<blockquote>%s</blockquote>', quoteText)
      end
    end
  )

  -- Restore code blocks
  processedContent = processedContent:gsub("__CODE_BLOCK_(%d+)__", function(idx)
    return blocks[tonumber(idx)] or ''
  end)

  return metadata .. processedContent
end 