#!/usr/bin/env -S deno test --allow-read --allow-write --allow-run --allow-net

/**
 * Tests for template.ts processing functionality (metadata, blockquotes, etc.)
 */

import { join } from '@std/path';
import { assertStringIncludes } from '@std/assert';
import {
  buildBenchmarkBlog,
  buildTestSite,
  cleanupDir,
  createTestContent,
  getTemplatePath,
} from './utils/test-helpers.ts';

Deno.test('Template Processing - Metadata rendering', async () => {
  const outDir = await Deno.makeTempDir({ prefix: 'astrodon-meta-' });

  try {
    await buildBenchmarkBlog(outDir);

    const html = await Deno.readTextFile(
      join(outDir, 'testing', 'post-1.html')
    );

    assertStringIncludes(html, '<div class="metadata">');
    assertStringIncludes(
      html,
      'Test Author',
      'Should contain author from frontmatter (may be in metadata div or content)'
    );
  } finally {
    await cleanupDir(outDir);
  }
});

Deno.test('Template Processing - Blockquote processing', async () => {
  const root = await Deno.makeTempDir({ prefix: 'astrodon-blockquote-' });
  const testContentDir = join(root, 'routes');
  const outDir = join(root, 'dist');

  try {
    await createTestContent(
      testContentDir,
      'test-blockquote.md',
      `---
title: Blockquote Test
---

# Test

> "This is a test quote" - Test Author

More content.
`
    );

    await buildTestSite({
      contentDir: testContentDir,
      outDir,
      template: getTemplatePath(),
    });

    const html = await Deno.readTextFile(join(outDir, 'test-blockquote.html'));

    assertStringIncludes(html, '<blockquote>', 'Should have blockquote');
    assertStringIncludes(html, '<cite>- Test Author</cite>', 'Should render cite tag');
  } finally {
    await cleanupDir(root);
  }
});

Deno.test('Template Processing - Frontmatter extraction', async () => {
  const outDir = await Deno.makeTempDir({ prefix: 'astrodon-fm-' });

  try {
    await buildBenchmarkBlog(outDir);

    const html = await Deno.readTextFile(
      join(outDir, 'testing', 'post-1.html')
    );

    // Verify all frontmatter fields are accessible
    assertStringIncludes(
      html,
      'Getting Started with Performance Testing',
      'Title should be extracted'
    );
    assertStringIncludes(html, 'Test Author', 'Author should be extracted');
    assertStringIncludes(html, 'testing', 'Tags should be extracted');
    assertStringIncludes(html, 'performance', 'Tags should be extracted');
    assertStringIncludes(html, 'benchmark', 'Tags should be extracted');
  } finally {
    await cleanupDir(outDir);
  }
});

Deno.test('Template Processing - Custom frontmatter fields', async () => {
  const root = await Deno.makeTempDir({ prefix: 'astrodon-custom-' });
  const testContentDir = join(root, 'routes');
  const outDir = join(root, 'dist');

  try {
    await createTestContent(
      testContentDir,
      'test-custom.md',
      `---
title: Custom Field Test
custom_field: Custom Value
category: test
draft: false
---

# Test

Content here.
`
    );

    await buildTestSite({
      contentDir: testContentDir,
      outDir,
      template: getTemplatePath(),
    });

    // Custom fields should be accessible in template
    // The build should succeed without errors
    const html = await Deno.readTextFile(join(outDir, 'test-custom.html'));
    assertStringIncludes(html, 'Custom Field Test', 'Should have title');
  } finally {
    await cleanupDir(root);
  }
});

