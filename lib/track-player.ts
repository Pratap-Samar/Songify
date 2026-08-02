import { Platform } from "react-native";
import TrackPlayer, { Capability, Event, State, RepeatMode } from "@javascriptcommon/react-native-track-player";
import type { Track } from "./music";

const isWeb = Platform.OS === "web";

// ── Web audio implementation (HTML5 Audio, no shaka) ──────────────
let webAudio: HTMLAudioElement | null = null;
let webCurrentTrack: (Track & { streamUrl: string }) | null = null;
let webState = "None";
let webRepeatMode: 'off' | 'track' | 'queue' = 'off';
let nativeRepeatMode: 'off' | 'track' | 'queue' = 'off';
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
    duration: track.durationMs ? track.durationMs / 1000 : 0,
    genre: "Music",
  };
}

function unmapTrack(item: any): Track & { streamUrl: string } {
  if (!item) return item;
  return {
    videoId: item.id,
    streamUrl: item.url,
    title: item.title,
    artists: item.artist ? item.artist.split(", ") : [],
    thumbnailUrl: item.artwork || null,
    durationMs: item.duration || null,
    album: null,
  };
}

// ── Exported API ──────────────────────────────────────────────────

let nativePlayerReady = false;
let setupPromise: Promise<void> | null = null;

export async function setupPlayer() {
  console.log("[TrackPlayer] setupPlayer called. isWeb:", isWeb, "nativePlayerReady:", nativePlayerReady);
  if (isWeb) return webSetupPlayer();
  if (nativePlayerReady) return;
  try {
    console.log("[TrackPlayer] Calling TrackPlayer.setupPlayer({})...");
    await TrackPlayer.setupPlayer({});
    console.log("[TrackPlayer] setupPlayer({}) succeeded. Calling updateOptions...");
    await TrackPlayer.updateOptions({
      progressUpdateEventInterval: 1,
      capabilities: [Capability.Play, Capability.Pause, Capability.Stop, Capability.SeekTo, Capability.Skip, Capability.SkipToNext, Capability.SkipToPrevious],
      compactCapabilities: [Capability.Play, Capability.Pause, Capability.SeekTo, Capability.Skip],
      notificationCapabilities: [Capability.Play, Capability.Pause, Capability.Stop, Capability.SeekTo, Capability.Skip, Capability.SkipToNext, Capability.SkipToPrevious],
    });
    console.log("[TrackPlayer] updateOptions succeeded. Player is ready.");

    TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async (event) => {
      console.log("[TrackPlayer] PlaybackQueueEnded fired. nativeRepeatMode:", nativeRepeatMode);
      if (nativeRepeatMode === 'track' || nativeRepeatMode === 'queue') {
        const queue = await TrackPlayer.getQueue();
        if (queue && queue.length > 0) {
          console.log("[TrackPlayer] Looping playback via JS fallback. Skipping to 0...");
          await TrackPlayer.skip(0);
          await TrackPlayer.play();
        }
      }
    });

    nativePlayerReady = true;
    setupPromise = null;
  } catch (e: any) {
    // "The player has already been initialized" is harmless
    if (e?.message?.includes("already been initialized")) {
      console.log("[TrackPlayer] Player was already initialized (harmless).");
      nativePlayerReady = true;
      setupPromise = null;
    } else {
      console.error("[TrackPlayer] setupPlayer explicitly failed with error:", e, "Message:", e?.message);
      setupPromise = null;
      throw e;
    }
  }
}

/** Ensure setupPlayer runs exactly once and all callers share the same promise */
function ensureSetup(): Promise<void> {
  if (nativePlayerReady) return Promise.resolve();
  if (!setupPromise) {
    console.log("[TrackPlayer] ensureSetup: initializing new setupPromise");
    setupPromise = setupPlayer();
  } else {
    console.log("[TrackPlayer] ensureSetup: returning existing setupPromise");
  }
  return setupPromise;
}

export function getTrackPlayer() { return TrackPlayer; }

export { mapTrack as mapTrackToTrackPlayerItem };

export async function playTrack(track: Track & { streamUrl: string }) {
  if (isWeb) {
    await webSetupPlayer();
    await webReset();
    webQueue = [track];
    webQueueIndex = 0;
    await webAdd([mapTrack(track)]);
    await webPlay();
    return;
  }
  await ensureSetup();
  await TrackPlayer.reset();
  const mapped = mapTrack(track);
  await TrackPlayer.add(mapped);
  
  // ALWAYS use RepeatMode.Off natively to ensure PlaybackQueueEnded fires.
  // Our JS fallback in PlaybackQueueEnded will manually loop the track.
  await TrackPlayer.setRepeatMode(RepeatMode.Off);
  
  await TrackPlayer.play();
}

export async function playOrUpdateQueue(tracks: (Track & { streamUrl: string })[], index = 0) {
  if (isWeb) {
    await webSetupPlayer();
    await webReset();
    webQueue = tracks;
    webQueueIndex = index;
    if (tracks[index]) {
      await webAdd([mapTrack(tracks[index])]);
      await webPlay();
    }
    return;
  }
  await ensureSetup();
  await TrackPlayer.reset();
  const mappedTracks = tracks.map(mapTrack);
  const ids = await TrackPlayer.add(mappedTracks);
  
  // ALWAYS use RepeatMode.Off natively to ensure PlaybackQueueEnded fires.
  // Our JS fallback in PlaybackQueueEnded will manually loop the track.
  await TrackPlayer.setRepeatMode(RepeatMode.Off);
  
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
  await ensureSetup();
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
  await ensureSetup();
  return TrackPlayer.skipToPrevious();
}

export async function togglePlayPause() {
  if (isWeb) {
    if (webState === "Playing") { webPause(); }
    else { webPlay(); }
    return;
  }
  await ensureSetup();
  const { state } = await TrackPlayer.getPlaybackState();
  if (state === State.Playing) await TrackPlayer.pause();
  else await TrackPlayer.play();
}

export async function seekTo(position: number) {
  if (isWeb) { getAudio().currentTime = position; return; }
  await ensureSetup();
  await TrackPlayer.seekTo(position);
}

export function addPlaybackStateListener(callback: (state: string) => void) {
  if (isWeb) {
    webStateListeners.add(callback);
    return { remove: () => webStateListeners.delete(callback) };
  }
  // Defer native listener until player is initialized
  let nativeSub: { remove: () => void } | null = null;
  let cancelled = false;
  ensureSetup().then(() => {
    if (cancelled) return;
    nativeSub = TrackPlayer.addEventListener(Event.PlaybackState, (event) => {
      const rawState = (event as { state: string }).state;
      let mappedState = "None";
      if (rawState === State.Playing) mappedState = "Playing";
      else if (rawState === State.Paused) mappedState = "Paused";
      else if (rawState === State.Stopped) mappedState = "Stopped";
      else if (rawState === State.Buffering) mappedState = "Buffering";
      callback(mappedState);
    });
  });
  return { remove: () => { cancelled = true; nativeSub?.remove?.(); } };
}

export function addTrackChangeListener(callback: (track: Track & { streamUrl: string }) => void) {
  if (isWeb) {
    webTrackListeners.add(callback);
    return { remove: () => webTrackListeners.delete(callback) };
  }
  let nativeSub: { remove: () => void } | null = null;
  let cancelled = false;
  ensureSetup().then(() => {
    if (cancelled) return;
    nativeSub = TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, (event) => {
      const track = (event as { track: any }).track;
      if (track) callback(unmapTrack(track));
    });
  });
  return { remove: () => { cancelled = true; nativeSub?.remove?.(); } };
}

export function addProgressListener(callback: (position: number, duration: number) => void) {
  if (isWeb) {
    webProgressListeners.add(callback);
    return { remove: () => webProgressListeners.delete(callback) };
  }
  let nativeSub: { remove: () => void } | null = null;
  let cancelled = false;
  ensureSetup().then(() => {
    if (cancelled) return;
    nativeSub = TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, (event) => {
      callback(event.position, event.duration);
    });
  });
  return { remove: () => { cancelled = true; nativeSub?.remove?.(); } };
}

export async function getActiveTrack() {
  if (isWeb) return webCurrentTrack;
  await ensureSetup();
  const index = await TrackPlayer.getActiveTrackIndex();
  if (index === undefined || index === null) return null;
  const nativeTrack = await TrackPlayer.getTrack(index);
  return nativeTrack ? unmapTrack(nativeTrack) : null;
}

export async function getPlaybackState(): Promise<string> {
  if (isWeb) return webState;
  await ensureSetup();
  const { state } = await TrackPlayer.getPlaybackState();
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
  await ensureSetup();
  nativeRepeatMode = mode;
  
  // ALWAYS use RepeatMode.Off natively to ensure PlaybackQueueEnded fires.
  // Our JS fallback in PlaybackQueueEnded will manually loop the track.
  await TrackPlayer.setRepeatMode(RepeatMode.Off);
}

export async function getRepeatMode(): Promise<'off' | 'track' | 'queue'> {
  if (isWeb) {
    return webRepeatMode;
  }
  return nativeRepeatMode;
}
