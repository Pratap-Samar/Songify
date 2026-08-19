import type { Album, AlbumSearchItem, PlaybackTrack, Track } from "./music";
import { searchTracksClientSide, getTrackClientSide, getAlbumClientSide } from "./ytmusic";

export type SearchResponse = {
  songs: Track[];
  albums: AlbumSearchItem[];
  videos: Track[];
};

export async function searchTracks(
  query: string,
  signal?: AbortSignal,
  type?: "songs" | "albums" | "videos",
): Promise<SearchResponse> {
  console.log("[Search] Using client-side search...");
  return await searchTracksClientSide(query, type);
}

export async function getPlaybackTrack(
  videoId: string,
  signal?: AbortSignal,
  fallbackTrack?: Track
): Promise<PlaybackTrack> {
  if (fallbackTrack) {
    console.log("[Metadata] Using provided track metadata, bypassing fetch.");
    return {
      ...fallbackTrack,
      streamUrl: `songify-unresolved://${videoId}.mp4`,
      mimeType: "audio/mp4",
      expiresInSeconds: null,
    };
  }

  console.log("[Metadata] Using client-side track metadata fetch...");
  const baseTrack = await getTrackClientSide(videoId);
  
  return {
    ...baseTrack,
    streamUrl: `songify-unresolved://${videoId}.mp4`,
    mimeType: "audio/mp4",
    expiresInSeconds: null,
  };
}

export async function getAlbum(
  browseId: string,
  signal?: AbortSignal,
): Promise<Album> {
  console.log("[Metadata] Using client-side album metadata fetch...");
  return await getAlbumClientSide(browseId);
}
