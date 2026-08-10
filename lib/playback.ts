import { getPlaybackTrack, getAudioProxyUrl } from "./api";
import { playQueue } from "./track-player";
import { Alert } from "react-native";
import type { Router } from "expo-router";
import type { Collection } from "./music";
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

/**
 * Loads a track's playback stream and immediately plays it.
 * This is used for Search, History, etc. where we only want to play a single track.
 * Must NOT contain navigation logic.
 */
export async function loadAndPlayTrack(videoId: string): Promise<void> {
  const result = await getPlaybackTrack(videoId);
  if (!result || !result.streamUrl) {
    throw new Error("Unable to resolve playback stream.");
  }
  await playQueue([result], 0, {
    source: "track",
    collectionId: null,
    collectionTitle: null,
  });
}

/**
 * Shared navigation helper for initiating playback from UI screens.
 * Awaits playback initialization, then navigates to the Player screen.
 * Surfaces errors without navigating.
 */
export async function playAndOpenPlayer(videoId: string, router: Router): Promise<void> {
  const currentReq = getNavRequestId();
  try {
    await loadAndPlayTrack(videoId);
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
 * Maps tracks to their proxy URLs for instant queue creation.
 */
export async function playCollection(collection: Collection & { startIndex: number }, router: Router): Promise<void> {
  const currentReq = getNavRequestId();
  try {
    const queueTracks = collection.tracks.map((track) => ({
      ...track,
      streamUrl: getAudioProxyUrl(track.videoId),
      thumbnailUrl: track.thumbnailUrl || collection.artwork || null,
      album: collection.type === "album" ? collection.title : track.album,
    }));
    const source: PlaybackSource = collection.type === "search" ? "track" : collection.type;
    await playQueue(queueTracks, collection.startIndex, {
      source,
      collectionId: source === "track" ? null : collection.id,
      collectionTitle: source === "track" ? null : collection.title,
    });
    
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
