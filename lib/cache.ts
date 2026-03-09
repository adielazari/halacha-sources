import fs from "fs/promises";
import path from "path";

const CACHE_DIR = path.join(process.cwd(), "cache", "sefaria");

async function ensureCacheDir() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

function cacheFilePath(key: string): string {
  const safe = key.replace(/[^a-zA-Z0-9_\-]/g, "_");
  return path.join(CACHE_DIR, `${safe}.json`);
}

export async function readCache<T>(key: string): Promise<T | null> {
  try {
    const filePath = cacheFilePath(key);
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, data: T): Promise<void> {
  try {
    await ensureCacheDir();
    const filePath = cacheFilePath(key);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch {
    // Cache write failure is non-fatal
  }
}
