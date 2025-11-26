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
  getBenchmarkDir,
  getTemplatePath,
} from './utils/test-helpers.ts';

Deno.test('Template Markers - {{title}} replacement', async () => {
  const benchmarkDir = getBenchmarkDir();
  const outDir = join(benchmarkDir, 'dist-test-title');

  try {
    await cleanupDir(outDir);
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
  const benchmarkDir = getBenchmarkDir();
  const outDir = join(benchmarkDir, 'dist-test-content');

  try {
    await cleanupDir(outDir);
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
  const benchmarkDir = getBenchmarkDir();
  const outDir = join(benchmarkDir, 'dist-test-nav');

  try {
    await cleanupDir(outDir);
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
  const benchmarkDir = getBenchmarkDir();
  const outDir = join(benchmarkDir, 'dist-test-component');

  try {
    await cleanupDir(outDir);
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
  const benchmarkDir = getBenchmarkDir();
  const testContentDir = join(benchmarkDir, 'routes-test-htmlcode');
  const outDir = join(benchmarkDir, 'dist-test-htmlcode');

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

    await cleanupDir(outDir);
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
    await cleanupDir(outDir);
    await cleanupDir(testContentDir);
  }
});

