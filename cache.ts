import { crypto } from '@std/crypto';
import { join, resolve } from '@std/path';

const CACHE_FILENAME = '.astrodon-cache.json';
const CACHE_VERSION = 1;

export interface CachedEntry {
  hash: string;
  content: string;
}

interface CacheFile {
  version: number;
  configHash: string;
  entries: Record<string, CachedEntry>;
}

export async function sha256(content: string): Promise<string> {
  const data = new TextEncoder().encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function computeConfigHash(parts: {
  templatePath: string;
  componentsDir: string;
  basePath: string;
  siteUrl?: string;
  siteTitle: string;
  brandName: string;
  logo?: string;
}): Promise<string> {
  const resolvedTemplate = parts.templatePath.startsWith('http://') ||
      parts.templatePath.startsWith('https://') ||
      parts.templatePath.startsWith('file://')
    ? parts.templatePath
    : resolve(parts.templatePath);
  const pieces: string[] = [
    resolvedTemplate,
    parts.basePath,
    parts.siteUrl ?? '',
    parts.siteTitle,
    parts.brandName,
    parts.logo ?? '',
  ];

  try {
    pieces.push(await Deno.readTextFile(parts.templatePath));
  } catch {
    // Template may be remote or absent.
  }

  try {
    const names: string[] = [];
    for await (const entry of Deno.readDir(parts.componentsDir)) {
      if (entry.isFile) names.push(entry.name);
    }
    names.sort();
    for (const name of names) {
      pieces.push(name);
      pieces.push(await Deno.readTextFile(join(parts.componentsDir, name)));
    }
  } catch {
    // Components directory is optional.
  }

  return await sha256(pieces.join('\n'));
}

export class BuildCache {
  private entries: Map<string, CachedEntry>;

  private constructor(
    private readonly cachePath: string,
    private readonly configHash: string,
    entries: Record<string, CachedEntry>,
  ) {
    this.entries = new Map(Object.entries(entries));
  }

  static async load(
    outDir: string,
    configHash: string,
  ): Promise<BuildCache> {
    const cachePath = join(outDir, CACHE_FILENAME);
    try {
      const raw = await Deno.readTextFile(cachePath);
      const parsed = JSON.parse(raw) as CacheFile;
      if (
        parsed.version === CACHE_VERSION &&
        parsed.configHash === configHash &&
        parsed.entries &&
        typeof parsed.entries === 'object'
      ) {
        return new BuildCache(cachePath, configHash, parsed.entries);
      }
    } catch {
      // Missing or invalid cache; start fresh.
    }
    return new BuildCache(cachePath, configHash, {});
  }

  get(filePath: string, contentHash: string): string | undefined {
    const cached = this.entries.get(filePath);
    return cached && cached.hash === contentHash ? cached.content : undefined;
  }

  set(filePath: string, contentHash: string, content: string): void {
    this.entries.set(filePath, { hash: contentHash, content });
  }

  async save(): Promise<void> {
    const payload: CacheFile = {
      version: CACHE_VERSION,
      configHash: this.configHash,
      entries: Object.fromEntries(this.entries),
    };
    await Deno.writeTextFile(this.cachePath, JSON.stringify(payload));
  }
}
