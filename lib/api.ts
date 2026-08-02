import type { PlaybackTrack, Track } from "./music";

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, "");

type SearchResponse = {
  items: Track[];
};

function getApiBaseUrl() {
  if (!apiBaseUrl) {
    throw new Error("Set EXPO_PUBLIC_API_BASE_URL to the Songify backend URL.");
  }

  return apiBaseUrl;
}

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, { signal });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(payload?.detail ?? "Unable to reach Songify right now.");
  }

  return response.json() as Promise<T>;
}

function proxyImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  // If it's already a relative URL or already proxied, leave it alone
  if (url.startsWith("/")) return url;
  return `${getApiBaseUrl()}/proxy/image?url=${encodeURIComponent(url)}`;
}

export async function searchTracks(query: string, signal?: AbortSignal): Promise<Track[]> {
  const response = await request<SearchResponse>(`/search?q=${encodeURIComponent(query)}`, signal);
  return response.items.map((track) => ({
    ...track,
    thumbnailUrl: proxyImageUrl(track.thumbnailUrl) || track.thumbnailUrl,
  }));
}

export async function getPlaybackTrack(videoId: string): Promise<PlaybackTrack> {
  const result = await request<PlaybackTrack>(`/tracks/${encodeURIComponent(videoId)}/playback`);
  result.streamUrl = `${getApiBaseUrl()}${result.streamUrl}`;
  result.thumbnailUrl = proxyImageUrl(result.thumbnailUrl) || result.thumbnailUrl;
  return result;
}
