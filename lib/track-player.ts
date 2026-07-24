import { Platform } from "react-native";
import TrackPlayer from "react-native-track-player";
import {
  Capability,
  Event,
  State,
} from "react-native-track-player";
import type { Track } from "./music";

const isWeb = Platform.OS === "web";

export async function setupPlayer() {
  if (isWeb) return;
  await TrackPlayer.setupPlayer({});
  await TrackPlayer.updateOptions({
    capabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.Stop,
      Capability.SeekTo,
      Capability.Skip,
      Capability.SkipToNext,
      Capability.SkipToPrevious,
    ],
    compactCapabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.SeekTo,
      Capability.Skip,
    ],
    notificationCapabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.Stop,
      Capability.SeekTo,
      Capability.Skip,
      Capability.SkipToNext,
      Capability.SkipToPrevious,
    ],
  });
}

export function getTrackPlayer(): typeof TrackPlayer {
  return TrackPlayer;
}

export function mapTrackToTrackPlayerItem(
  track: Track & { streamUrl: string }
) {
  return {
    id: track.videoId,
    url: track.streamUrl,
    title: track.title,
    artist: track.artists.join(", "),
    artwork: track.thumbnailUrl ?? "",
    duration: track.durationMs ?? 0,
    genre: "Music",
  };
}

export async function playTrack(track: Track & { streamUrl: string }) {
  if (isWeb) return;
  await setupPlayer();
  await TrackPlayer.reset();
  await TrackPlayer.add(mapTrackToTrackPlayerItem(track));
  await TrackPlayer.play();
}

export async function playOrUpdateQueue(
  tracks: (Track & { streamUrl: string })[],
  index = 0
) {
  if (isWeb) return;
  await setupPlayer();
  await TrackPlayer.reset();
  const addedIds = await TrackPlayer.add(
    tracks.map(mapTrackToTrackPlayerItem)
  );
  if (typeof addedIds === "number" && addedIds >= 0) {
    await TrackPlayer.skip(addedIds);
  } else if (Array.isArray(addedIds) && addedIds.length > index) {
    await TrackPlayer.skip(addedIds[index]);
  }
  await TrackPlayer.play();
}

export async function skipToNext() {
  if (isWeb) return;
  return TrackPlayer.skipToNext();
}

export async function skipToPrevious() {
  if (isWeb) return;
  return TrackPlayer.skipToPrevious();
}

export async function togglePlayPause() {
  if (isWeb) return;
  const state = await TrackPlayer.getState();
  if (state === State.Playing) {
    await TrackPlayer.pause();
  } else {
    await TrackPlayer.play();
  }
}

export async function seekTo(position: number) {
  if (isWeb) return;
  await TrackPlayer.seekTo(position);
}

export function addPlaybackStateListener(
  callback: (state: string) => void
) {
  if (isWeb) return { remove: () => {} };
  return TrackPlayer.addEventListener(
    Event.PlaybackState,
    (event) => {
      callback((event as { state: string }).state as string);
    }
  );
}

export function addTrackChangeListener(
  callback: (track: Track & { streamUrl: string }) => void
) {
  if (isWeb) return { remove: () => {} };
  return TrackPlayer.addEventListener(
    Event.PlaybackActiveTrackChanged,
    (event) => {
      const track = (event as { track: Track | undefined }).track;
      if (track) {
        callback(track as unknown as Track & { streamUrl: string });
      }
    }
  );
}