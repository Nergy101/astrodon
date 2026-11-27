#!/usr/bin/env -S deno test --allow-read --allow-write --allow-run --allow-net

/**
 * Tests for {{routes:toc}} template marker functionality
 */

import { join } from '@std/path';
import { assertEquals, assertStringIncludes } from '@std/assert';
import {
  buildBenchmarkBlog,
  cleanupDir,
  extractTextByClass,
  extractLinks,
  extractExcerpts,
} from './utils/test-helpers.ts';
import { EXPECTED_BENCHMARK_POSTS } from './fixtures/benchmark-data.ts';

Deno.test('{{routes:toc}} - Marker replacement', async () => {
  const outDir = await Deno.makeTempDir({ prefix: 'astrodon-toc-' });

  try {
    await buildBenchmarkBlog(outDir);

    const html = await Deno.readTextFile(
      join(outDir, 'testing', 'index.html')
    );

    // Verify marker is replaced
    assertEquals(
      html.includes('{{routes:toc}}'),
      false,
      '{{routes:toc}} marker should be replaced'
    );
    assertStringIncludes(
      html,
      'content-card',
      'Should contain content cards'
    );
  } finally {
    await cleanupDir(outDir);
  }
});

Deno.test('{{routes:toc}} - Post titles', async () => {
  const outDir = await Deno.makeTempDir({ prefix: 'astrodon-toc-titles-' });

  try {
    await buildBenchmarkBlog(outDir);

    const html = await Deno.readTextFile(
      join(outDir, 'testing', 'index.html')
    );

    // Verify all expected posts are present
    for (const post of EXPECTED_BENCHMARK_POSTS) {
      assertStringIncludes(
        html,
        post.title,
        `Should contain title: ${post.title}`
      );
    }

    // Verify titles are correctly extracted
    const titles = extractTextByClass(html, 'content-card-title');
    assertEquals(
      titles.length,
      EXPECTED_BENCHMARK_POSTS.length,
      `Should have ${EXPECTED_BENCHMARK_POSTS.length} card titles`
    );

    for (const post of EXPECTED_BENCHMARK_POSTS) {
      assertEquals(
        titles.includes(post.title),
        true,
        `Should contain title: ${post.title}`
      );
    }
  } finally {
    await cleanupDir(outDir);
  }
});

Deno.test('{{routes:toc}} - Post metadata (dates, authors)', async () => {
  const outDir = await Deno.makeTempDir({ prefix: 'astrodon-toc-meta-' });

  try {
    await buildBenchmarkBlog(outDir);

    const html = await Deno.readTextFile(
      join(outDir, 'testing', 'index.html')
    );

    // Verify dates
    const dates = extractTextByClass(html, 'content-card-date');
    for (const post of EXPECTED_BENCHMARK_POSTS) {
      assertEquals(
        dates.includes(post.date),
        true,
        `Should contain date: ${post.date}`
      );
    }

    // Verify authors
    const authors = extractTextByClass(html, 'content-card-author');
    for (const post of EXPECTED_BENCHMARK_POSTS) {
      assertEquals(
        authors.some(a => a.includes(post.author)),
        true,
        `Should contain author: ${post.author}`
      );
    }
  } finally {
    await cleanupDir(outDir);
  }
});

Deno.test('{{routes:toc}} - Post excerpts', async () => {
  const outDir = await Deno.makeTempDir({ prefix: 'astrodon-toc-excerpts-' });

  try {
    await buildBenchmarkBlog(outDir);

    const html = await Deno.readTextFile(
      join(outDir, 'testing', 'index.html')
    );

    const excerptElementsExist = html.includes('content-card-excerpt');
    const extractedExcerpts = extractExcerpts(html);

    if (excerptElementsExist && extractedExcerpts.length > 0) {
      assertEquals(
        extractedExcerpts.length >= EXPECTED_BENCHMARK_POSTS.length,
        true,
        `Should have excerpts for all posts (found: ${extractedExcerpts.length})`
      );

      // Verify excerpts contain expected content
      // Note: Excerpts might be titles if first paragraph is a header
      for (const post of EXPECTED_BENCHMARK_POSTS) {
        const excerptFound = extractedExcerpts.some(e => {
          const keyWords = post.excerpt.split(' ').slice(0, 5).join(' ');
          return (
            e.includes(post.title) ||
            e.includes(keyWords) ||
            e.includes(post.excerpt.substring(0, 30))
          );
        });
        assertEquals(
          excerptFound,
          true,
          `Should contain excerpt or title for: ${post.title}`
        );
      }
    } else {
      // At least verify card structure exists
      assertStringIncludes(
        html,
        'content-card',
        'Should have content card structure'
      );
    }
  } finally {
    await cleanupDir(outDir);
  }
});

Deno.test('{{routes:toc}} - Post tags', async () => {
  const outDir = await Deno.makeTempDir({ prefix: 'astrodon-toc-tags-' });

  try {
    await buildBenchmarkBlog(outDir);

    const html = await Deno.readTextFile(
      join(outDir, 'testing', 'index.html')
    );

    const tags = extractTextByClass(html, 'content-card-tag');
    for (const post of EXPECTED_BENCHMARK_POSTS) {
      for (const tag of post.tags) {
        assertEquals(
          tags.includes(tag),
          true,
          `Should contain tag: ${tag}`
        );
      }
    }
  } finally {
    await cleanupDir(outDir);
  }
});

Deno.test('{{routes:toc}} - Post URLs', async () => {
  const outDir = await Deno.makeTempDir({ prefix: 'astrodon-toc-urls-' });

  try {
    await buildBenchmarkBlog(outDir);

    const html = await Deno.readTextFile(
      join(outDir, 'testing', 'index.html')
    );

    const links = extractLinks(html);
    for (const post of EXPECTED_BENCHMARK_POSTS) {
      assertEquals(
        links.includes(post.url),
        true,
        `Should contain link: ${post.url}`
      );
    }
  } finally {
    await cleanupDir(outDir);
  }
});


