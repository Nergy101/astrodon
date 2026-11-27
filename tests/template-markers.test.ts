#!/usr/bin/env -S deno test --allow-read --allow-write --allow-run --allow-net

/**
 * Tests for template marker replacements ({{title}}, {{content}}, {{navigation}}, etc.)
 */

import { join } from '@std/path';
import { assertEquals, assertStringIncludes } from '@std/assert';
import {
  buildBenchmarkBlog,
  buildTestSite,
  cleanupDir,
  createTestContent,
  getTemplatePath,
} from './utils/test-helpers.ts';

Deno.test('Template Markers - {{title}} replacement', async () => {
  const outDir = await Deno.makeTempDir({ prefix: 'astrodon-title-' });

  try {
    await buildBenchmarkBlog(outDir);

    const html = await Deno.readTextFile(
      join(outDir, 'testing', 'post-1.html')
    );

    assertEquals(
      html.includes('{{title}}'),
      false,
      '{{title}} should be replaced'
    );
    assertStringIncludes(
      html,
      'Getting Started with Performance Testing',
      'Should contain the page title'
    );
    assertStringIncludes(html, '<title>', 'Should have title tag');
  } finally {
    await cleanupDir(outDir);
  }
});

Deno.test('Template Markers - {{content}} replacement', async () => {
  const outDir = await Deno.makeTempDir({ prefix: 'astrodon-content-' });

  try {
    await buildBenchmarkBlog(outDir);

    const html = await Deno.readTextFile(
      join(outDir, 'testing', 'post-1.html')
    );

    assertEquals(
      html.includes('{{content}}'),
      false,
      '{{content}} should be replaced'
    );
    assertStringIncludes(
      html,
      'Getting Started with Performance Testing',
      'Should contain the markdown content'
    );
  } finally {
    await cleanupDir(outDir);
  }
});

Deno.test('Template Markers - {{navigation}} replacement', async () => {
  const outDir = await Deno.makeTempDir({ prefix: 'astrodon-nav-' });

  try {
    await buildBenchmarkBlog(outDir);

    const html = await Deno.readTextFile(
      join(outDir, 'testing', 'post-1.html')
    );

    assertEquals(
      html.includes('{{navigation}}'),
      false,
      '{{navigation}} should be replaced'
    );
    assertStringIncludes(html, '<nav', 'Should have nav element');
    assertStringIncludes(html, '/testing', 'Should contain navigation links');
  } finally {
    await cleanupDir(outDir);
  }
});

Deno.test('Template Markers - {{component:navbar}} replacement', async () => {
  const outDir = await Deno.makeTempDir({ prefix: 'astrodon-component-' });

  try {
    await buildBenchmarkBlog(outDir);

    const html = await Deno.readTextFile(
      join(outDir, 'testing', 'post-1.html')
    );

    assertEquals(
      html.includes('{{component:navbar}}'),
      false,
      '{{component:navbar}} should be replaced'
    );
    assertStringIncludes(html, 'navbar', 'Should have navbar component');
    assertStringIncludes(html, '<nav', 'Should have nav element');
  } finally {
    await cleanupDir(outDir);
  }
});

Deno.test('Template Markers - {{htmlcode}} custom HTML blocks', async () => {
  const root = await Deno.makeTempDir({ prefix: 'astrodon-htmlcode-' });
  const testContentDir = join(root, 'routes');
  const outDir = join(root, 'dist');

  try {
    await createTestContent(
      testContentDir,
      'test-htmlcode.md',
      `---
title: HTML Code Block Test
---

# Test

Here's some HTML code:

{{htmlcode}}
<div class="test">Hello World</div>
{{/htmlcode}}

More content here.
`
    );

    await buildTestSite({
      contentDir: testContentDir,
      outDir,
      template: getTemplatePath(),
    });

    const html = await Deno.readTextFile(join(outDir, 'test-htmlcode.html'));

    assertEquals(
      html.includes('{{htmlcode}}'),
      false,
      '{{htmlcode}} marker should be replaced'
    );
    assertEquals(
      html.includes('{{/htmlcode}}'),
      false,
      '{{/htmlcode}} marker should be replaced'
    );
    assertStringIncludes(html, '&lt;div', 'HTML should be escaped');
    assertStringIncludes(html, 'language-html', 'Should have HTML language class');
  } finally {
    await cleanupDir(root);
  }
});


