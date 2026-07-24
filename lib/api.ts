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

export async function searchTracks(query: string, signal?: AbortSignal): Promise<Track[]> {
  const response = await request<SearchResponse>(`/search?q=${encodeURIComponent(query)}`, signal);
  return response.items;
}

export function getPlaybackTrack(videoId: string): Promise<PlaybackTrack> {
  return request<PlaybackTrack>(`/tracks/${encodeURIComponent(videoId)}/playback`);
}
