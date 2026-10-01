import { parse as parseYaml } from "@std/yaml";

export type PageMetadata = Record<string, unknown>;

export interface ParsedMarkdown {
  metadata: PageMetadata;
  body: string;
  hasFrontmatter: boolean;
}

function normalizeYamlValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (Array.isArray(value)) return value.map(normalizeYamlValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map((
        [key, nested],
      ) => [key, normalizeYamlValue(nested)]),
    );
  }
  return value;
}

/** Parse optional YAML frontmatter while leaving metadata-free Markdown intact. */
export function parseMarkdownFrontmatter(
  content: string,
  filePath: string,
): ParsedMarkdown {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== "---") {
    return { metadata: {}, body: content, hasFrontmatter: false };
  }

  const closingIndex = lines.findIndex((line, index) =>
    index > 0 && line === "---"
  );
  // An opening horizontal rule without a matching fence is ordinary Markdown.
  if (closingIndex === -1) {
    return { metadata: {}, body: content, hasFrontmatter: false };
  }

  const yamlSource = lines.slice(1, closingIndex).join("\n");
  let parsed: unknown;
  try {
    parsed = parseYaml(yamlSource);
  } catch (error) {
    const yamlLineCount = Math.max(1, closingIndex - 1);
    const reportedLine =
      error && typeof error === "object" && "line" in error &&
        typeof error.line === "number"
        ? error.line
        : 1;
    const sourceLine = Math.min(Math.max(1, reportedLine), yamlLineCount) + 1;
    const detail = error instanceof Error
      ? error.message.split("\n")[0]
      : String(error);
    throw new Error(
      `${filePath}:${sourceLine}: invalid frontmatter: ${detail}`,
    );
  }

  if (parsed === null || parsed === undefined) parsed = {};
  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${filePath}:2: frontmatter must be a YAML mapping`);
  }

  return {
    metadata: normalizeYamlValue(parsed) as PageMetadata,
    body: lines.slice(closingIndex + 1).join("\n").trim(),
    hasFrontmatter: true,
  };
}
