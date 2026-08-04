import { getPlaybackTrack, getAudioProxyUrl } from "./api";
import { playQueue, generatePlayId, trace } from "./track-player";
import { Alert } from "react-native";
import type { Router } from "expo-router";
import type { Collection } from "./music";
import type { PlaybackSource } from "./playback-session";

/**
 * Loads a track's playback stream and immediately plays it.
 * This is used for Search, History, etc. where we only want to play a single track.
 * Must NOT contain navigation logic.
 */
export async function loadAndPlayTrack(videoId: string): Promise<void> {
  const opId = generatePlayId();
  const tapTs = new Date().toISOString();
  console.warn(`[PlayOp #${opId}] loadAndPlayTrack() | Track: ${videoId} | ${tapTs} | Tap / Request Start`);
  const result = await trace(opId, "loadAndPlayTrack", videoId, "getPlaybackTrack()", getPlaybackTrack(videoId));
  if (!result || !result.streamUrl) {
    throw new Error("Unable to resolve playback stream.");
  }
  await playQueue([result], 0, {
    source: "track",
    collectionId: null,
    collectionTitle: null,
  }, opId);
}

/**
 * Shared navigation helper for initiating playback from UI screens.
 * Awaits playback initialization, then navigates to the Player screen.
 * Surfaces errors without navigating.
 */
export async function playAndOpenPlayer(videoId: string, router: Router): Promise<void> {
  try {
    await loadAndPlayTrack(videoId);
    router.push({ pathname: "/player", params: { videoId } });
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
      router.push({ pathname: "/player", params: { videoId: firstVideoId } });
    }
  } catch (error) {
    console.error("[Playback] Failed to play collection:", error);
    Alert.alert(
      "Playback Error",
      error instanceof Error ? error.message : "Unable to load collection."
    );
  }
}
