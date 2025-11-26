#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run --allow-net

import { build } from './mod.ts';
import { join } from '@std/path';

// Use built-in performance API
const { performance } = globalThis;

interface PerformanceTest {
  name: string;
  fn: () => Promise<void>;
}

class PerformanceBenchmark {
  private tests: PerformanceTest[] = [];
  private results: Map<string, number[]> = new Map();

  addTest(name: string, fn: () => Promise<void>) {
    this.tests.push({ name, fn });
  }

  async runTest(
    test: PerformanceTest,
    iterations: number = 3
  ): Promise<number[]> {
    const times: number[] = [];

    console.log(`🧪 Running ${test.name} (${iterations} iterations)...`);

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await test.fn();
      const end = performance.now();
      times.push(end - start);
      console.log(`  Iteration ${i + 1}: ${(end - start).toFixed(2)}ms`);
    }

    return times;
  }

  async runAll(iterations: number = 3) {
    console.log('🚀 Starting Performance Benchmark\n');

    for (const test of this.tests) {
      const times = await this.runTest(test, iterations);
      this.results.set(test.name, times);
    }

    this.printResults();
  }

  printResults() {
    console.log('\n📊 Performance Benchmark Results\n');
    console.log(
      'Test Name'.padEnd(30) +
        'Avg (ms)'.padEnd(12) +
        'Min (ms)'.padEnd(12) +
        'Max (ms)'.padEnd(12)
    );
    console.log('-'.repeat(66));

    for (const [name, times] of this.results) {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const min = Math.min(...times);
      const max = Math.max(...times);

      console.log(
        name.padEnd(30) +
          avg.toFixed(2).padEnd(12) +
          min.toFixed(2).padEnd(12) +
          max.toFixed(2).padEnd(12)
      );
    }

    console.log('\n🎯 Build Performance Summary:');
    const buildTimes = this.results.get('Build Process');

    if (buildTimes) {
      const avgBuildTime =
        buildTimes.reduce((a, b) => a + b, 0) / buildTimes.length;
      const minBuildTime = Math.min(...buildTimes);
      const maxBuildTime = Math.max(...buildTimes);

      console.log(`📈 Average build time: ${avgBuildTime.toFixed(2)}ms`);
      console.log(`⚡ Fastest build: ${minBuildTime.toFixed(2)}ms`);
      console.log(`🐌 Slowest build: ${maxBuildTime.toFixed(2)}ms`);
    }
  }
}

// Create benchmark instance
const benchmark = new PerformanceBenchmark();

// Get benchmark directories
const benchmarkDir = new URL('./benchmark', import.meta.url).pathname;
const contentDir = join(benchmarkDir, 'routes');

// Test: Build Process (actual build)
benchmark.addTest('Build Process', async () => {
  // Create temporary output directory for this test
  const tempOutDir = join(benchmarkDir, 'dist-temp');

  try {
    // Clean up any existing temp directory
    try {
      await Deno.remove(tempOutDir, { recursive: true });
    } catch {
      // Directory might not exist, that's okay
    }

    // Build the benchmark blog
    await build({
      contentDir,
      outDir: tempOutDir,
      template: new URL('./template.ts', import.meta.url).pathname,
    });

    // Clean up temp directory after build
    await Deno.remove(tempOutDir, { recursive: true });
  } catch (error) {
    // Clean up on error
    try {
      await Deno.remove(tempOutDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
});

// Run all tests
if (import.meta.main) {
  await benchmark.runAll(3);
}
