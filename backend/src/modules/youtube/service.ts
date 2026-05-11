import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config } from "../../config";

const execFileAsync = promisify(execFile);

export interface YouTubeVideoDetails {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  durationSec: number;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}
const SEARCH_TTL_MS = 10 * 60 * 1000;
const VIDEO_TTL_MS = 60 * 60 * 1000;
const searchCache = new Map<string, CacheEntry<YouTubeVideoDetails[]>>();
const videoCache = new Map<string, CacheEntry<YouTubeVideoDetails>>();

function readCache<T>(map: Map<string, CacheEntry<T>>, key: string): T | null {
  const hit = map.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    map.delete(key);
    return null;
  }
  return hit.value;
}

function writeCache<T>(map: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs: number) {
  map.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function thumbnailFor(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

function toDetails(info: any): YouTubeVideoDetails | null {
  const videoId = typeof info?.id === "string" ? info.id : null;
  if (!videoId) return null;
  return {
    videoId,
    title: typeof info.title === "string" ? info.title : "",
    channelTitle: info.channel || info.uploader || "",
    thumbnailUrl: thumbnailFor(videoId),
    durationSec: typeof info.duration === "number" ? Math.round(info.duration) : 0,
  };
}

async function ytdlp(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(config.ytdlpBinary, args, {
    timeout: 30_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  return stdout;
}

export async function getVideoDetails(ids: string[]): Promise<YouTubeVideoDetails[]> {
  const out: YouTubeVideoDetails[] = [];
  for (const id of ids) {
    const cached = readCache(videoCache, id);
    if (cached) {
      out.push(cached);
      continue;
    }
    const stdout = await ytdlp([
      `https://www.youtube.com/watch?v=${id}`,
      "--dump-single-json",
      "--skip-download",
      "--no-warnings",
      "--no-playlist",
    ]);
    const info = JSON.parse(stdout);
    const detail = toDetails(info);
    if (detail) {
      writeCache(videoCache, id, detail, VIDEO_TTL_MS);
      out.push(detail);
    }
  }
  return out;
}

export async function searchWithDurations(query: string, limit = 15): Promise<YouTubeVideoDetails[]> {
  const trimmed = query.trim();
  const cacheKey = `${limit}:${trimmed.toLowerCase()}`;
  const cached = readCache(searchCache, cacheKey);
  if (cached) return cached;

  const n = Math.min(Math.max(limit, 1), 50);
  const stdout = await ytdlp([
    `ytsearch${n}:${trimmed}`,
    "--dump-json",
    "--flat-playlist",
    "--skip-download",
    "--no-warnings",
  ]);
  const results: YouTubeVideoDetails[] = [];
  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    try {
      const detail = toDetails(JSON.parse(line));
      if (detail) results.push(detail);
    } catch {}
  }
  writeCache(searchCache, cacheKey, results, SEARCH_TTL_MS);
  return results;
}
