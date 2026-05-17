const API_BASE = "/api";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  getPlayerState: () => request<PlayerState>("/player/state"),
  play: (videoId?: string) =>
    request("/player/play", {
      method: "POST",
      body: JSON.stringify(videoId ? { videoId } : {}),
    }),
  pause: () => request("/player/pause", { method: "POST" }),
  next: () => request("/player/next", { method: "POST" }),
  addToQueue: (video: YouTubeSearchResult) =>
    request<{ item: QueueItem }>("/player/queue", {
      method: "POST",
      body: JSON.stringify(video),
    }),
  removeFromQueue: (id: string) =>
    request(`/player/queue/${id}`, { method: "DELETE" }),
  getQueue: () => request<QueueResponse>("/player/queue"),
  setVolume: (volumePercent: number) =>
    request("/player/volume", {
      method: "PUT",
      body: JSON.stringify({ volumePercent }),
    }),

  search: (q: string) =>
    request<{ results: YouTubeSearchResult[] }>(`/search?q=${encodeURIComponent(q)}`),
};

export interface PlayerState {
  videoId: string | null;
  title: string | null;
  channelTitle: string | null;
  thumbnailUrl: string | null;
  durationMs: number;
  positionMs: number;
  isPlaying: boolean;
  volumePercent: number;
  piConnected: boolean;
}

export interface QueueItem {
  id: string;
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  durationSec: number;
  createdAt: string;
}

export interface QueueResponse {
  currentlyPlaying: PlayerState;
  queue: QueueItem[];
}

export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  durationSec: number;
}
