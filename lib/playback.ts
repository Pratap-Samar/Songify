import { getPlaybackTrack } from "./api";
import { playQueue, playStandaloneTrack, playLogicalCollection, getLatestPlayId, incrementPlayId } from "./track-player";
import { Alert } from "react-native";
import type { Router } from "expo-router";
import { type Collection } from "./music";
import type { PlaybackSource } from "./playback-session";

/**
 * Tracks the latest navigation request to prevent duplicate screens
 * from rapid taps during delayed playback initialization.
 */
let navRequestId = 0;

/**
 * Capture a new navigation request ID.
 */
export function getNavRequestId() {
  return ++navRequestId;
}

/**
 * Safe, idempotent navigation to the Player screen.
 * - Uses `router.navigate` to natively prevent stacking duplicate screens.
 * - If `reqId` is provided (from delayed async calls), it aborts if superseded.
 * - If called synchronously, it updates the global ID to cancel pending navigation.
 */
export function openPlayerSafe(router: Router, videoId: string, reqId?: number) {
  if (reqId !== undefined) {
    if (reqId !== navRequestId) return;
  } else {
    navRequestId++;
  }
  router.navigate({ pathname: "/player", params: { videoId } });
}

const resolveLocks = new Map<string, Promise<{ url: string, mimeType?: string }>>();

/**
 * Safely resolves a stream with deduplication to prevent multiple simultaneous calls for the same videoId.
 * No backend fallback. If it fails, it throws.
 */
export async function resolveStreamSafely(
  videoId: string, 
  currentUrl?: string,
  trackMeta?: { title: string, artist: string }
): Promise<{ url: string, mimeType?: string }> {
  // If the URL is already a googlevideo URL, skip resolving again.
  if (currentUrl && currentUrl.includes("googlevideo.com")) {
    return { url: currentUrl };
  }
  
  if (resolveLocks.has(videoId)) {
    return resolveLocks.get(videoId)!;
  }

  const promise = (async () => {
    try {
      const { resolveYouTubeStream } = await import("./youtube-resolver");
      const resolved = await resolveYouTubeStream(videoId, true, trackMeta);
      console.log(`[YouTubeResolver] Audio stream resolved for ${videoId}`);
      return resolved;
    } catch (e: any) {
      if (e.message && (e.message.includes('Streaming data not available') || e.message.includes('Video unavailable'))) {
        console.log(`[YouTubeResolver] Hybrid fallback to proxy for ${videoId}`);
        const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
        return { url: `${apiBaseUrl || 'https://songify-api.onrender.com'}/proxy/audio/${encodeURIComponent(videoId)}.mp4` };
      }
      throw e;
    } finally {
      resolveLocks.delete(videoId);
    }
  })();

  resolveLocks.set(videoId, promise);
  return promise;
}

/**
 * Loads a track's playback stream and immediately plays it.
 * This is used for Search, History, etc. where we only want to play a single track.
 * Must NOT contain navigation logic.
 */
export async function loadAndPlayTrack(videoId: string, track?: import("./music").Track): Promise<void> {
  console.log(`[DIAGNOSTIC] loadAndPlayTrack called. Stack:`, new Error().stack);
  const playId = incrementPlayId();

  const t0 = performance.now();
  const result = await getPlaybackTrack(videoId, undefined, track);
  const t1 = performance.now();
  if (!result) {
    throw new Error("Unable to resolve playback stream.");
  }
  
  const resolved = await resolveStreamSafely(videoId, result.streamUrl, {
    title: result.title,
    artist: result.artists?.[0] || 'Unknown Artist'
  });
  const t2 = performance.now();
  result.streamUrl = resolved.url;
  if (resolved.mimeType) result.mimeType = resolved.mimeType;
  
  if (getLatestPlayId() !== playId) {
    console.log(`[DIAGNOSTIC] loadAndPlayTrack aborted due to newer playId`);
    return;
  }
  await playStandaloneTrack(result, playId);
  const t3 = performance.now();
  
  console.log(`[PlaybackPerf] Tap -> Metadata: ${(t1-t0).toFixed(1)} ms`);
  console.log(`[PlaybackPerf] Metadata -> Resolver: ${(t2-t1).toFixed(1)} ms`);
  console.log(`[PlaybackPerf] Resolver -> TrackPlayer play: ${(t3-t2).toFixed(1)} ms`);
  console.log(`[PlaybackPerf] TOTAL tap -> playing: ${(t3-t0).toFixed(1)} ms`);
}

/**
 * Shared navigation helper for initiating playback from UI screens.
 * Awaits playback initialization, then navigates to the Player screen.
 * Surfaces errors without navigating.
 */
export async function playAndOpenPlayer(videoId: string, router: Router, track?: import("./music").Track): Promise<void> {
  const currentReq = getNavRequestId();
  try {
    await loadAndPlayTrack(videoId, track);
    openPlayerSafe(router, videoId, currentReq);
  } catch (error) {
    console.error("[Playback] Failed to play track:", error);
    Alert.alert(
      "Playback Error", 
      error instanceof Error ? error.message : "Unable to load this track."
    );
  }
}

/**
 * Generic collection playback API.
 * Maps tracks to their dummy URLs for instant queue creation.
 * Only natively resolves the first track to avoid blocking.
 */
export async function playCollection(collection: Collection & { startIndex: number }, router: Router): Promise<void> {
  console.log(`[DIAGNOSTIC] playCollection called. Stack:`, new Error().stack);
    if (collection.type === "album" || collection.type === "playlist") return playLogicalCollection(collection, router);
  const currentReq = getNavRequestId();
  const playId = incrementPlayId();
  try {
    const queueTracks = await Promise.all(collection.tracks.map(async (track, i) => {
      let streamUrl = `songify-unresolved://${track.videoId}.mp4`;
      let mimeType: string | undefined = undefined;
      
      if (i === collection.startIndex) {
        const resolved = await resolveStreamSafely(track.videoId, undefined, {
          title: track.title,
          artist: track.artists?.[0] || 'Unknown Artist'
        });
        streamUrl = resolved.url;
        mimeType = resolved.mimeType;
      }

      return {
        ...track,
        streamUrl,
        mimeType,
        thumbnailUrl: track.thumbnailUrl || collection.artwork || null,
        album: collection.type === "album" ? collection.title : track.album,
      };
    }));
    if (getLatestPlayId() !== playId) {
      console.log(`[DIAGNOSTIC] playCollection aborted due to newer playId (was ${playId}, now ${getLatestPlayId()})`);
      return;
    }
    const source: PlaybackSource = collection.type === "search" ? "track" : collection.type;
    await playQueue(queueTracks, collection.startIndex, {
      source,
      collectionId: source === "track" ? null : collection.id,
      collectionTitle: source === "track" ? null : collection.title,
    }, playId);
    
    const firstVideoId = queueTracks[collection.startIndex]?.videoId;
    if (firstVideoId) {
      openPlayerSafe(router, firstVideoId, currentReq);
    }
  } catch (error) {
    console.error("[Playback] Failed to play collection:", error);
    Alert.alert(
      "Playback Error",
      error instanceof Error ? error.message : "Unable to load collection."
    );
  }
}
