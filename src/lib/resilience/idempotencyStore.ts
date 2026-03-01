import fs from "node:fs";
import path from "node:path";

type StoreMap = Record<string, number>;

const DEFAULT_FILE = path.resolve(process.cwd(), ".runtime-logs/idempotency-keys.json");
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function getStoreFile(): string {
  return process.env.IDEMPOTENCY_STORE_FILE || DEFAULT_FILE;
}

function ensureParent(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function safeReadStore(filePath: string): StoreMap {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: StoreMap = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "number" && Number.isFinite(value)) {
        out[key] = value;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function writeStore(filePath: string, store: StoreMap): void {
  ensureParent(filePath);
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2));
}

function pruneExpired(store: StoreMap, now = Date.now()): StoreMap {
  const next: StoreMap = {};
  for (const [key, expiresAt] of Object.entries(store)) {
    if (expiresAt > now) next[key] = expiresAt;
  }
  return next;
}

export function idempotencyKeyExists(key: string): boolean {
  const filePath = getStoreFile();
  const now = Date.now();
  const store = pruneExpired(safeReadStore(filePath), now);
  return Number(store[key] || 0) > now;
}

export function rememberIdempotencyKey(key: string, ttlMs = DEFAULT_TTL_MS): void {
  const filePath = getStoreFile();
  const now = Date.now();
  const store = pruneExpired(safeReadStore(filePath), now);
  store[key] = now + Math.max(1, Number.isFinite(ttlMs) ? ttlMs : DEFAULT_TTL_MS);
  writeStore(filePath, store);
}
