import fs from "fs/promises";
import path from "path";

const CACHE_DIR = path.join(process.cwd(), "cache", "sefaria");

// Module-level in-memory cache — survives across requests in the same Node.js process.
// This is the L1 layer; disk is the L2 layer.
const memCache = new Map<string, unknown>();

async function ensureCacheDir() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

function cacheFilePath(key: string): string {
  const safe = key.replace(/[^a-zA-Z0-9_\-]/g, "_");
  return path.join(CACHE_DIR, `${safe}.json`);
}

export async function readCache<T>(key: string): Promise<T | null> {
  // L1: memory
  if (memCache.has(key)) return memCache.get(key) as T;
  // L2: disk
  try {
    const filePath = cacheFilePath(key);
    const raw = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(raw) as T;
    memCache.set(key, data);
    return data;
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, data: T): Promise<void> {
  memCache.set(key, data);
  try {
    await ensureCacheDir();
    const filePath = cacheFilePath(key);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch {
    // Cache write failure is non-fatal
  }
}
