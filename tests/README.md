# Test Suite

This directory contains comprehensive tests for Astrodon's templating and build functionality.

**All tests use Deno's built-in testing framework** - no external testing libraries required.

## Structure

```
tests/
├── fixtures/              # Test data and fixtures
│   └── benchmark-data.ts  # Expected benchmark blog post data
├── utils/                 # Shared test utilities
│   └── test-helpers.ts    # Helper functions for building and testing
├── routes-toc.test.ts     # Tests for {{routes:toc}} functionality
├── template-markers.test.ts    # Tests for template marker replacements
├── template-processing.test.ts # Tests for template.ts processing
└── README.md              # This file
```

## Test Organization

### `routes-toc.test.ts`
Tests for the `{{routes:toc}}` template marker that generates content cards:
- Marker replacement
- Post titles extraction
- Metadata (dates, authors)
- Excerpts
- Tags
- URLs/links

### `template-markers.test.ts`
Tests for template marker replacements in the HTML template:
- `{{title}}` replacement
- `{{content}}` replacement
- `{{navigation}}` replacement
- `{{component:navbar}}` replacement
- `{{htmlcode}}` custom HTML blocks

### `template-processing.test.ts`
Tests for template.ts processing functionality:
- Metadata rendering
- Blockquote processing
- Frontmatter extraction
- Custom frontmatter fields

## Best Practices

### Test Isolation
- Each test is independent and can run in any order
- Tests use unique output directories to avoid conflicts
- Cleanup is handled in `finally` blocks

### DRY Principle
- Shared utilities are in `tests/utils/test-helpers.ts`
- Test data/fixtures are in `tests/fixtures/benchmark-data.ts`
- Common patterns are abstracted into helper functions

### Naming Conventions
- Test files: `*.test.ts`
- Test names: Descriptive and grouped by feature
- Helper functions: Clear, single-purpose functions

### Error Handling
- All cleanup operations use `cleanupDir()` which safely ignores errors
- Tests use try/finally blocks to ensure cleanup
- Assertions include descriptive error messages

## Testing Framework

This test suite uses **Deno's built-in testing framework**:
- `Deno.test()` - Native Deno test function
- `@std/assert` - Standard assertion library from Deno's standard library (JSR)

No external testing frameworks are required. All tests use Deno's native testing capabilities.

## Running Tests

Run all tests:
```bash
deno task test
```

Run specific test file:
```bash
deno test --allow-read --allow-write --allow-run --allow-net tests/routes-toc.test.ts
```

Run with verbose output:
```bash
deno test --allow-read --allow-write --allow-run --allow-net tests/ --verbose
```

Run tests with coverage:
```bash
deno test --allow-read --allow-write --allow-run --allow-net --coverage=cov_profile tests/
deno coverage cov_profile
```

Filter tests by name:
```bash
deno test --allow-read --allow-write --allow-run --allow-net tests/ --filter "routes-toc"
```

## Adding New Tests

1. **Choose the right file**: Add tests to the appropriate test file based on functionality
2. **Use helpers**: Leverage utilities from `test-helpers.ts` for common operations
3. **Follow patterns**: Match the structure and naming of existing tests
4. **Clean up**: Always use try/finally with cleanupDir() for test output
5. **Document**: Add comments for complex test logic

## Test Utilities

### `buildBenchmarkBlog(outDir: string)`
Builds the benchmark blog for testing.

### `buildTestSite(options: TestBuildOptions)`
Builds a custom test site with specified options.

### `cleanupDir(dir: string)`
Safely removes a directory, ignoring errors if it doesn't exist.

### `extractTextByClass(html: string, className: string)`
Extracts text content from HTML elements by class name.

### `extractLinks(html: string)`
Extracts all href attributes from HTML.

### `extractExcerpts(html: string)`
Extracts excerpt text from content cards.

### `createTestContent(dir: string, filename: string, content: string)`
Creates a temporary test markdown file.

