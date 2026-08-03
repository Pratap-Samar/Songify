import { getPlaybackTrack } from "./api";
import { playTrack } from "./track-player";
import { Alert } from "react-native";
import type { Router } from "expo-router";

/**
 * The single playback pipeline for the application.
 * Fetches fresh playback metadata and stream URL, then starts playback.
 * 
 * Must NOT contain navigation logic.
 */
export async function loadAndPlayTrack(videoId: string): Promise<void> {
  const result = await getPlaybackTrack(videoId);
  if (!result || !result.streamUrl) {
    throw new Error("Unable to resolve playback stream.");
  }
  await playTrack(result);
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
