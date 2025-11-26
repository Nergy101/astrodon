/**
 * Test fixtures and expected data for benchmark blog posts
 */

export interface ExpectedPost {
  title: string;
  date: string;
  author: string;
  tags: string[];
  excerpt: string;
  url: string;
}

export const EXPECTED_BENCHMARK_POSTS: ExpectedPost[] = [
  {
    title: 'Getting Started with Performance Testing',
    date: '2024-01-15',
    author: 'Test Author',
    tags: ['testing', 'performance', 'benchmark'],
    excerpt:
      'This is the first test blog post used for benchmarking the Astrodon build process. It contains various markdown features to simulate a real-world blog post.',
    url: '/testing/post-1',
  },
  {
    title: 'Advanced Benchmarking Techniques',
    date: '2024-01-20',
    author: 'Test Author',
    tags: ['advanced', 'benchmarking', 'optimization'],
    excerpt:
      'This second blog post explores more advanced benchmarking scenarios and includes additional markdown complexity.',
    url: '/testing/post-2',
  },
  {
    title: 'Performance Metrics and Analysis',
    date: '2024-01-25',
    author: 'Test Author',
    tags: ['metrics', 'analysis', 'performance'],
    excerpt:
      'The third blog post focuses on performance metrics and includes various content types to test the build system thoroughly.',
    url: '/testing/post-3',
  },
];

