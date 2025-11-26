#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run

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
    iterations: number = 3,
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
    console.log("🚀 Starting Performance Benchmark\n");

    for (const test of this.tests) {
      const times = await this.runTest(test, iterations);
      this.results.set(test.name, times);
    }

    this.printResults();
  }

  printResults() {
    console.log("\n📊 Performance Benchmark Results\n");
    console.log(
      "Test Name".padEnd(30) + "Avg (ms)".padEnd(12) + "Min (ms)".padEnd(12) +
        "Max (ms)".padEnd(12),
    );
    console.log("-".repeat(66));

    for (const [name, times] of this.results) {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const min = Math.min(...times);
      const max = Math.max(...times);

      console.log(
        name.padEnd(30) +
          avg.toFixed(2).padEnd(12) +
          min.toFixed(2).padEnd(12) +
          max.toFixed(2).padEnd(12),
      );
    }

    console.log("\n🎯 Optimization Impact:");
    const buildTimes = this.results.get("Build Process");
    const serverTimes = this.results.get("Server Response");

    if (buildTimes && serverTimes) {
      const avgBuildTime = buildTimes.reduce((a, b) => a + b, 0) /
        buildTimes.length;
      const avgServerTime = serverTimes.reduce((a, b) => a + b, 0) /
        serverTimes.length;

      console.log(`📈 Build time: ${avgBuildTime.toFixed(2)}ms`);
      console.log(`🌐 Server response: ${avgServerTime.toFixed(2)}ms`);
    }
  }
}

// Create benchmark instance
const benchmark = new PerformanceBenchmark();

// Test 1: Build Process (simulated)
benchmark.addTest("Build Process", async () => {
  // Simulate build process
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Simulate file operations
  try {
    await Deno.readTextFile("./routes/index.md");
  } catch {
    // File might not exist, that's okay for testing
  }
});

// Test 2: Server Response (simulated)
benchmark.addTest("Server Response", async () => {
  // Simulate server request processing
  await new Promise((resolve) => setTimeout(resolve, 10));

  // Simulate file reading
  try {
    await Deno.readTextFile("./dist/index.html");
  } catch {
    // File might not exist, that's okay for testing
  }
});

// Test 3: Markdown Processing (simulated)
benchmark.addTest("Markdown Processing", async () => {
  const sampleMarkdown = `
# Test Document

This is a **test** document with some *markdown* formatting.

## Code Example

\`\`\`lua
print("Hello, World!")
\`\`\`

- List item 1
- List item 2
- List item 3

> This is a blockquote

| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
    `;

  // Simulate markdown processing
  await new Promise((resolve) => setTimeout(resolve, 50));
});

// Test 5: File System Operations
benchmark.addTest("File System Operations", async () => {
  const testDir = "./test-temp";
  await Deno.mkdir(testDir, { recursive: true });

  // Write test file
  await Deno.writeTextFile(`${testDir}/test.txt`, "Hello, World!");

  // Read test file
  await Deno.readTextFile(`${testDir}/test.txt`);

  // Clean up
  await Deno.remove(testDir, { recursive: true });
});

// Run all tests
if (import.meta.main) {
  await benchmark.runAll(3);
}
