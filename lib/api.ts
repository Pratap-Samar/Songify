import type { PlaybackTrack, Track, Album, AlbumSearchItem } from "./music";

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, "");

export type SearchResponse = {
  songs: Track[];
  albums: AlbumSearchItem[];
  videos: Track[];
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
    const payload = (await response.json().catch(() => null)) as { detail?: any } | null;
    const detailMessage = typeof payload?.detail === "string" 
      ? payload.detail 
      : payload?.detail 
        ? JSON.stringify(payload.detail) 
        : "Unable to reach Songify right now.";
    throw new Error(detailMessage);
  }

  return response.json() as Promise<T>;
}

function proxyImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  // If it's already a relative URL or already proxied, leave it alone
  if (url.startsWith("/")) return url;
  return `${getApiBaseUrl()}/proxy/image?url=${encodeURIComponent(url)}`;
}

export async function searchTracks(query: string, signal?: AbortSignal, type?: "songs" | "albums" | "videos"): Promise<SearchResponse> {
  let url = `/search?q=${encodeURIComponent(query)}`;
  if (type) {
    url += `&type=${encodeURIComponent(type)}`;
  }
  const response = await request<SearchResponse>(url, signal);
  return {
    songs: (response.songs || []).map((track) => ({
      ...track,
      thumbnailUrl: proxyImageUrl(track.thumbnailUrl) || track.thumbnailUrl,
    })),
    albums: (response.albums || []).map((album) => ({
      ...album,
      thumbnailUrl: proxyImageUrl(album.thumbnailUrl) || album.thumbnailUrl,
    })),
    videos: (response.videos || []).map((track) => ({
      ...track,
      thumbnailUrl: proxyImageUrl(track.thumbnailUrl) || track.thumbnailUrl,
    })),
  };
}

export async function getPlaybackTrack(videoId: string, signal?: AbortSignal): Promise<PlaybackTrack> {
  const result = await request<PlaybackTrack>(`/tracks/${encodeURIComponent(videoId)}/playback`, signal);
  result.streamUrl = getAudioProxyUrl(videoId);
  result.thumbnailUrl = proxyImageUrl(result.thumbnailUrl) || result.thumbnailUrl;
  return result;
}

export async function getAlbum(browseId: string, signal?: AbortSignal): Promise<Album> {
  const result = await request<Album>(`/albums/${encodeURIComponent(browseId)}`, signal);
  result.artwork = proxyImageUrl(result.artwork) || result.artwork;
  result.tracks = result.tracks.map((track) => ({
    ...track,
    thumbnailUrl: result.artwork,
  }));
  return result;
}

export function getAudioProxyUrl(videoId: string): string {
  return `${getApiBaseUrl()}/proxy/audio/${encodeURIComponent(videoId)}.mp4`;
}

export async function prefetchAudioUrl(videoId: string): Promise<void> {
  try {
    await fetch(`${getApiBaseUrl()}/proxy/audio/${encodeURIComponent(videoId)}/prefetch`);
  } catch {
    // Prefetch is an optimization; normal playback will resolve the stream.
  }
}
