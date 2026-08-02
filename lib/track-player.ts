import { Platform } from "react-native";
import TrackPlayer from "@javascriptcommon/react-native-track-player";
import { Capability, Event, State, RepeatMode } from "@javascriptcommon/react-native-track-player";
import type { Track } from "./music";

const isWeb = Platform.OS === "web";

// ── Web audio implementation (HTML5 Audio, no shaka) ──────────────
let webAudio: HTMLAudioElement | null = null;
let webCurrentTrack: (Track & { streamUrl: string }) | null = null;
let webState = "None";
let webRepeatMode: 'off' | 'track' | 'queue' = 'off';
let webQueue: (Track & { streamUrl: string })[] = [];
let webQueueIndex = -1;
const webStateListeners = new Set<(s: string) => void>();
const webTrackListeners = new Set<(t: Track & { streamUrl: string }) => void>();
const webProgressListeners = new Set<(position: number, duration: number) => void>();

function emitState(s: string) { webState = s; webStateListeners.forEach((cb) => cb(s)); }

function getAudio(): HTMLAudioElement {
  if (!webAudio) {
    const a = new Audio();
    a.crossOrigin = "anonymous";
    a.onplaying = () => emitState("Playing");
    a.onpause = () => emitState("Paused");
    a.onended = () => {
      // If repeat-one is active, and we haven't manually skipped to another track, restart it.
      if (webRepeatMode === 'track' && webCurrentTrack) {
        a.currentTime = 0;
        a.play().catch(() => {});
      } else {
        if (webQueueIndex < webQueue.length - 1) {
          skipToNext().catch(() => {});
        } else if (webRepeatMode === 'queue' && webQueue.length > 0) {
          skipToNext().catch(() => {});
        } else {
          emitState("Ended");
        }
      }
    };
    a.onerror = () => emitState("Error");
    a.onwaiting = () => emitState("Buffering");
    a.ontimeupdate = () => {
      webProgressListeners.forEach((cb) => cb(a.currentTime, a.duration || 0));
    };
    webAudio = a;
  }
  return webAudio;
}

async function webSetupPlayer() { getAudio(); }

async function webReset() {
  const a = getAudio();
  a.pause();
  a.removeAttribute("src");
  a.load();
  webCurrentTrack = null;
}

async function webAdd(items: { id: string; url: string; title: string; artist: string; artwork: string; duration: number }[]) {
  const item = items[0];
  if (!item) return;
  const a = getAudio();
  a.src = item.url;
  a.load();
  webCurrentTrack = {
    videoId: item.id,
    title: item.title,
    artists: item.artist ? [item.artist] : [],
    album: null,
    durationMs: item.duration || null,
    thumbnailUrl: item.artwork || null,
    streamUrl: item.url,
  };
  webTrackListeners.forEach((cb) => cb(webCurrentTrack!));
}

async function webPlay() {
  try { await getAudio().play(); } catch { /* user gesture required */ }
}

async function webPause() { getAudio().pause(); }

// ── Shared helpers ────────────────────────────────────────────────
function mapTrack(track: Track & { streamUrl: string }) {
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

// ── Exported API ──────────────────────────────────────────────────

export async function setupPlayer() {
  if (isWeb) return webSetupPlayer();
  try {
    await TrackPlayer.setupPlayer({});
    await TrackPlayer.updateOptions({
      capabilities: [Capability.Play, Capability.Pause, Capability.Stop, Capability.SeekTo, Capability.Skip, Capability.SkipToNext, Capability.SkipToPrevious],
      compactCapabilities: [Capability.Play, Capability.Pause, Capability.SeekTo, Capability.Skip],
      notificationCapabilities: [Capability.Play, Capability.Pause, Capability.Stop, Capability.SeekTo, Capability.Skip, Capability.SkipToNext, Capability.SkipToPrevious],
    });
  } catch { /* already set up */ }
}

export function getTrackPlayer() { return TrackPlayer; }

export { mapTrack as mapTrackToTrackPlayerItem };

export async function playTrack(track: Track & { streamUrl: string }) {
  await setupPlayer();
  if (isWeb) {
    await webReset();
    webQueue = [track];
    webQueueIndex = 0;
    await webAdd([mapTrack(track)]);
    await webPlay();
    return;
  }
  await TrackPlayer.reset();
  await TrackPlayer.add(mapTrack(track));
  await TrackPlayer.play();
}

export async function playOrUpdateQueue(tracks: (Track & { streamUrl: string })[], index = 0) {
  await setupPlayer();
  if (isWeb) {
    await webReset();
    webQueue = tracks;
    webQueueIndex = index;
    if (tracks[index]) {
      await webAdd([mapTrack(tracks[index])]);
      await webPlay();
    }
    return;
  }
  await TrackPlayer.reset();
  const ids = await TrackPlayer.add(tracks.map(mapTrack));
  if (typeof ids === "number" && ids >= 0) await TrackPlayer.skip(ids);
  else if (Array.isArray(ids) && ids.length > index) await TrackPlayer.skip(ids[index]);
  await TrackPlayer.play();
}

export async function skipToNext() {
  if (isWeb) {
    if (webQueue.length === 0) return;
    let nextIndex = webQueueIndex + 1;
    if (nextIndex >= webQueue.length) {
      if (webRepeatMode === 'queue') nextIndex = 0;
      else return;
    }
    webQueueIndex = nextIndex;
    const nextTrack = webQueue[nextIndex];
    if (nextTrack) {
      await webAdd([mapTrack(nextTrack)]);
      await webPlay();
    }
    return;
  }
  return TrackPlayer.skipToNext();
}

export async function skipToPrevious() {
  if (isWeb) {
    if (webQueue.length === 0) return;
    let prevIndex = webQueueIndex - 1;
    if (prevIndex < 0) prevIndex = 0;
    webQueueIndex = prevIndex;
    const prevTrack = webQueue[prevIndex];
    if (prevTrack) {
      await webAdd([mapTrack(prevTrack)]);
      await webPlay();
    }
    return;
  }
  return TrackPlayer.skipToPrevious();
}

export async function togglePlayPause() {
  if (isWeb) {
    if (webState === "Playing") { webPause(); }
    else { webPlay(); }
    return;
  }
  const state = await TrackPlayer.getState();
  if (state === State.Playing) await TrackPlayer.pause();
  else await TrackPlayer.play();
}

export async function seekTo(position: number) {
  if (isWeb) { getAudio().currentTime = position; return; }
  await TrackPlayer.seekTo(position);
}

export function addPlaybackStateListener(callback: (state: string) => void) {
  if (isWeb) {
    webStateListeners.add(callback);
    return { remove: () => webStateListeners.delete(callback) };
  }
  return TrackPlayer.addEventListener(Event.PlaybackState, (event) => { callback((event as { state: string }).state as string); });
}

export function addTrackChangeListener(callback: (track: Track & { streamUrl: string }) => void) {
  if (isWeb) {
    webTrackListeners.add(callback);
    return { remove: () => webTrackListeners.delete(callback) };
  }
  return TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, (event) => {
    const track = (event as { track: Track | undefined }).track;
    if (track) callback(track as unknown as Track & { streamUrl: string });
  });
}

export function addProgressListener(callback: (position: number, duration: number) => void) {
  if (isWeb) {
    webProgressListeners.add(callback);
    return { remove: () => webProgressListeners.delete(callback) };
  }
  return TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, (event) => {
    callback(event.position, event.duration);
  });
}

export async function getActiveTrack() {
  if (isWeb) return webCurrentTrack;
  const index = await TrackPlayer.getActiveTrackIndex();
  if (index === undefined || index === null) return null;
  return TrackPlayer.getTrack(index);
}

export async function getPlaybackState(): Promise<string> {
  if (isWeb) return webState;
  const state = await TrackPlayer.getState();
  if (state === State.Playing) return "Playing";
  if (state === State.Paused) return "Paused";
  if (state === State.Stopped) return "Stopped";
  if (state === State.Buffering) return "Buffering";
  return "None";
}

export async function setRepeatMode(mode: 'off' | 'track' | 'queue') {
  if (isWeb) {
    webRepeatMode = mode;
    return;
  }
  const rm = mode === 'track' ? RepeatMode.Track : mode === 'queue' ? RepeatMode.Queue : RepeatMode.Off;
  await TrackPlayer.setRepeatMode(rm);
}

export async function getRepeatMode(): Promise<'off' | 'track' | 'queue'> {
  if (isWeb) {
    return webRepeatMode;
  }
  const rm = await TrackPlayer.getRepeatMode();
  if (rm === RepeatMode.Track) return 'track';
  if (rm === RepeatMode.Queue) return 'queue';
  return 'off';
}
