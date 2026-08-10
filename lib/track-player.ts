import { Platform } from "react-native";
import TrackPlayer, { Capability, Event, State, RepeatMode, TrackType } from "@javascriptcommon/react-native-track-player";
import type { Track } from "./music";
import { addToHistory } from "./database";
import { logger } from "./logger";
import {
  getPlaybackSession,
  setPlaybackSession,
  updatePlaybackSessionIndex,
  type PlaybackSessionInput,
  type PlaybackTrack,
} from "./playback-session";

const isWeb = Platform.OS === "web";

// ── Web audio implementation (HTML5 Audio, no shaka) ──────────────
let webAudio: HTMLAudioElement | null = null;
let webCurrentTrack: (Track & { streamUrl: string }) | null = null;
let webState = "None";
let webRepeatMode: 'off' | 'track' | 'queue' = 'off';
let nativeRepeatMode: 'off' | 'track' | 'queue' = 'off';
let isShuffled = false;
let shuffleListeners = new Set<(shuffled: boolean) => void>();

export function getShuffleMode() { return isShuffled; }
export function addShuffleListener(cb: (s: boolean) => void) {
  shuffleListeners.add(cb);
  return { remove: () => shuffleListeners.delete(cb) };
}

export async function toggleShuffleMode() {
  isShuffled = !isShuffled;
  shuffleListeners.forEach((cb) => cb(isShuffled));
  if (isWeb) return;

  const currentSession = getPlaybackSession();
  if (!currentSession) return;

  const activeIndex = await TrackPlayer.getActiveTrackIndex();
  if (activeIndex === undefined || activeIndex === null) return;
  const queue = await TrackPlayer.getQueue();
  if (!queue || queue.length === 0) return;

  const activeTrack = queue[activeIndex];
  if (!activeTrack) return;

  // Find active track in original session queue
  const origIdx = currentSession.queue.findIndex(t => t.videoId === activeTrack.id);

  if (isShuffled) {
    // Remove upcoming tracks
    const trackIndexesToRemove = queue.map((_, i) => i).slice(activeIndex + 1);
    if (trackIndexesToRemove.length > 0) {
      await TrackPlayer.remove(trackIndexesToRemove);
    }

    const tracksToShuffle = origIdx !== -1 
      ? currentSession.queue.slice(origIdx + 1).map(t => mapTrack(t as any))
      : currentSession.queue.map(t => mapTrack(t as any));
      
    for (let i = tracksToShuffle.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tracksToShuffle[i], tracksToShuffle[j]] = [tracksToShuffle[j], tracksToShuffle[i]];
    }
    if (tracksToShuffle.length > 0) await TrackPlayer.add(tracksToShuffle);
  } else {
    if (origIdx !== -1) {
      // Remove all tracks EXCEPT the active one to fully rewrite the queue around it
      const indexesToRemove = queue.map((_, i) => i).filter(i => i !== activeIndex);
      if (indexesToRemove.length > 0) {
        await TrackPlayer.remove(indexesToRemove);
      }

      const after = currentSession.queue.slice(origIdx + 1).map(t => mapTrack(t as any));
      if (after.length > 0) {
        await TrackPlayer.add(after);
      }

      const before = currentSession.queue.slice(0, origIdx).map(t => mapTrack(t as any));
      if (before.length > 0) {
        // Insert tracks before the current track at index 0
        await TrackPlayer.add(before, 0);
      }
    }
  }
}

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
    url: track.streamUrl.includes('.mp4') ? track.streamUrl : track.streamUrl + '.mp4',
    title: track.title,
    artist: track.artists.join(", "),
    artwork: track.thumbnailUrl ?? "",
    duration: track.durationMs ? track.durationMs / 1000 : 0,
    genre: "Music",
    type: TrackType.Default,
  };
}

function unmapTrack(item: Record<string, unknown>): Track & { streamUrl: string } {
  if (!item) return null as unknown as Track & { streamUrl: string };
  return {
    videoId: item.id as string,
    streamUrl: item.url as string,
    title: item.title as string,
    artists: item.artist ? (item.artist as string).split(", ") : [],
    thumbnailUrl: (item.artwork as string) || null,
    durationMs: item.duration ? Math.floor((item.duration as number) * 1000) : null,
    album: null,
  };
}

// ── Exported API ──────────────────────────────────────────────────

let nativePlayerReady = false;
let setupPromise: Promise<void> | null = null;
let queueAdvanceTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleQueueAdvance(requireEndPosition: boolean) {
  if (isWeb || queueAdvanceTimer) return;

  queueAdvanceTimer = setTimeout(async () => {
    queueAdvanceTimer = null;
    const currentSession = getPlaybackSession();
    if (!currentSession || currentSession.queue.length === 0) return;

    const activeIndex = await TrackPlayer.getActiveTrackIndex();
    const { state } = await TrackPlayer.getPlaybackState();
    if (activeIndex !== currentSession.currentIndex) return;

    if (requireEndPosition || state === State.Paused) {
      const progress = await TrackPlayer.getProgress();
      if (state !== State.Paused || progress.duration <= 0 || progress.position < progress.duration - 0.5) return;
    } else if (state !== State.Ended) {
      return;
    }

    const isLastTrack = currentSession.currentIndex >= currentSession.queue.length - 1;
    if (nativeRepeatMode === 'off' && isLastTrack) return;

    const nextIndex = nativeRepeatMode === 'track'
      ? currentSession.currentIndex
      : isLastTrack
        ? 0
        : currentSession.currentIndex + 1;
    await TrackPlayer.skip(nextIndex);
    await TrackPlayer.play();
  }, 0);
}

export async function setupPlayer() {
  console.warn(`[DIAGNOSTICS] [Lifecycle] ${new Date().toISOString()} - setupPlayer() EXECUTED`);
  logger.debug("[TrackPlayer] setupPlayer called. isWeb:", isWeb, "nativePlayerReady:", nativePlayerReady);
  if (isWeb) return webSetupPlayer();
  if (nativePlayerReady) return;
  try {
    logger.debug("[TrackPlayer] Calling TrackPlayer.setupPlayer({})...");
    await TrackPlayer.setupPlayer({});
    logger.debug("[TrackPlayer] setupPlayer({}) succeeded. Calling updateOptions...");
    await TrackPlayer.updateOptions({
      progressUpdateEventInterval: 1,
      capabilities: [Capability.Play, Capability.Pause, Capability.Stop, Capability.SeekTo, Capability.Skip, Capability.SkipToNext, Capability.SkipToPrevious],
      compactCapabilities: [Capability.Play, Capability.Pause, Capability.SeekTo, Capability.Skip],
      notificationCapabilities: [Capability.Play, Capability.Pause, Capability.Stop, Capability.SeekTo, Capability.Skip, Capability.SkipToNext, Capability.SkipToPrevious],
    });
    logger.debug("[TrackPlayer] updateOptions succeeded. Player is ready.");

    TrackPlayer.addEventListener(Event.PlaybackState, (event) => {
      console.warn(`[PlayOp #${latestPlayId}] Event.PlaybackState | ${new Date().toISOString()} | State Changed: ${event.state}`);
      if (event.state === State.Ended) scheduleQueueAdvance(false);
      else if (event.state === State.Paused) scheduleQueueAdvance(true);
    });

    TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async (event) => {
      const ts = new Date().toISOString();
      const state = await TrackPlayer.getPlaybackState();
      const queue = await TrackPlayer.getQueue();
      console.warn(`[PlayOp #${latestPlayId}] Event.PlaybackQueueEnded | ${ts} | FIRED! payload: ${JSON.stringify(event)}, state: ${state}, qLen: ${queue?.length ?? 0}`);
      logger.debug("[TrackPlayer] PlaybackQueueEnded fired. Native repeat mode:", nativeRepeatMode);
    });

    nativePlayerReady = true;
    setupPromise = null;
  } catch (e: unknown) {
    const err = e as Error;
    // "The player has already been initialized" is harmless
    if (err?.message?.includes("already been initialized")) {
      logger.debug("[TrackPlayer] Player was already initialized (harmless).");
      nativePlayerReady = true;
      setupPromise = null;
    } else {
      console.error("[TrackPlayer] setupPlayer explicitly failed with error:", err, "Message:", err?.message);
      setupPromise = null;
      throw e;
    }
  }
}

/** Ensure setupPlayer runs exactly once and all callers share the same promise */
export async function ensureSetup() {
  logger.debug(`[TrackPlayer] ensureSetup() called at ${new Date().toISOString()}`);
  if (nativePlayerReady) {
    logger.debug("[TrackPlayer] ensureSetup: natively ready.");
    return;
  }
  if (!setupPromise) {
    logger.debug("[TrackPlayer] ensureSetup: initializing new setupPromise");
    setupPromise = setupPlayer();
  } else {
    logger.debug("[TrackPlayer] ensureSetup: returning existing setupPromise");
  }
  return setupPromise;
}

let latestPlayId = 0;

export function getTrackPlayer() { return TrackPlayer; }

export { mapTrack as mapTrackToTrackPlayerItem };

export function generatePlayId() { return ++latestPlayId; }
export function getLatestPlayId() { return latestPlayId; }

export async function trace<T>(opId: number, func: string, trackId: string, apiName: string, promise: Promise<T>): Promise<T> {
  const t0 = Date.now();
  console.warn(`[PlayOp #${opId}] ${func}() | Track: ${trackId} | ${new Date().toISOString()} | PROMISE START: ${apiName}`);
  try {
    const result = await promise;
    console.warn(`[PlayOp #${opId}] ${func}() | Track: ${trackId} | ${new Date().toISOString()} | PROMISE COMPLETE: ${apiName} | duration: ${Date.now() - t0}ms`);
    return result;
  } catch (e: any) {
    console.warn(`[PlayOp #${opId}] ${func}() | Track: ${trackId} | ${new Date().toISOString()} | PROMISE ERROR: ${apiName} | duration: ${Date.now() - t0}ms | err: ${e?.message}`);
    throw e;
  }
}

async function logQueueState(opId: number, funcName: string, message: string) {
  if (isWeb) return;
  const q = await TrackPlayer.getQueue();
  const index = await TrackPlayer.getActiveTrackIndex();
  const track = await TrackPlayer.getActiveTrack();
  const state = await TrackPlayer.getPlaybackState();
  const qIds = q ? q.map(t => t.id).join(", ") : "empty";
  console.warn(`[PlayOp #${opId}] ${funcName}() | Track: ${track?.id ?? 'none'} | ${new Date().toISOString()} | ${message} | State: ${state}, QLen: ${q?.length ?? 0}, Idx: ${index}, Queue: [${qIds}]`);
}

class Mutex {
  private mutex = Promise.resolve();
  lock(): Promise<() => void> {
    let begin: (unlock: () => void) => void = () => {};
    this.mutex = this.mutex.then(() => new Promise(begin));
    return new Promise((res) => {
      begin = res;
    });
  }
}
const playerMutex = new Mutex();

export async function playQueue(
  tracks: PlaybackTrack[],
  index = 0,
  sessionInput: PlaybackSessionInput,
  opId?: number,
) {
  if (queueAdvanceTimer) {
    clearTimeout(queueAdvanceTimer);
    queueAdvanceTimer = null;
  }
  const current = tracks[index];
  if (current) {
    logger.debug(`[TrackPlayer] playQueue called. Active track: "${current.title}"`);
    const safeTrack = { ...current, title: current.title || "Unknown Title", artists: current.artists || [] } as unknown as Track;
    addToHistory(safeTrack).catch((e) => console.error("[TrackPlayer] History error:", e));
  }

  const playId = opId ?? ++latestPlayId;
  latestPlayId = playId;
  const rootVideoId = current?.videoId || "unknown";
  console.warn(`[PlayOp #${playId}] playQueue() | Track: ${rootVideoId} | ${new Date().toISOString()} | Play ID Bound`);

  const unlock = await playerMutex.lock();
  try {
    if (isWeb) {
      await webSetupPlayer();
      if (latestPlayId !== playId) return;
      await webReset();
      webQueue = tracks;
      webQueueIndex = index;
      if (tracks[index]) {
        await webAdd([mapTrack(tracks[index])]);
        if (latestPlayId !== playId) return;
        setPlaybackSession(sessionInput, tracks, index);
        await webPlay();
      }
      return;
    }
    await ensureSetup();
    if (latestPlayId !== playId) return;
    await trace(playId, "playQueue", rootVideoId, "TrackPlayer.reset()", TrackPlayer.reset());
    await logQueueState(playId, "playQueue", "After Queue Reset");
    if (latestPlayId !== playId) return;
    
    const mappedTracks = tracks.map(mapTrack);
    
    if (sessionInput.source === "track" && nativeRepeatMode === "queue") {
      nativeRepeatMode = "off";
    }
    await TrackPlayer.setRepeatMode(RepeatMode.Off);
    
    const firstTrack = mappedTracks[index];
    const otherTracksBefore = mappedTracks.slice(0, index);
    const otherTracksAfter = mappedTracks.slice(index + 1);

    if (firstTrack) {
      await trace(playId, "playQueue", rootVideoId, "TrackPlayer.add([first])", TrackPlayer.add([firstTrack]));
      await logQueueState(playId, "playQueue", "After Initial Queue Add");

      if (latestPlayId !== playId) return;
      // Start playing immediately to avoid flashing through earlier tracks
      await trace(playId, "playQueue", rootVideoId, "TrackPlayer.play()", TrackPlayer.play());

      if (latestPlayId !== playId) return;
      let finalAfter = otherTracksAfter;
      if (isShuffled) {
        finalAfter = [...otherTracksAfter];
        for (let i = finalAfter.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [finalAfter[i], finalAfter[j]] = [finalAfter[j], finalAfter[i]];
        }
      }
      if (finalAfter.length > 0) {
        await trace(playId, "playQueue", rootVideoId, "TrackPlayer.add(after)", TrackPlayer.add(finalAfter));
      }
      if (otherTracksBefore.length > 0) {
        await trace(playId, "playQueue", rootVideoId, "TrackPlayer.add(before, 0)", TrackPlayer.add(otherTracksBefore, 0));
      }
    }
    
    if (latestPlayId !== playId) return;
    setPlaybackSession(sessionInput, tracks, index);
    await logQueueState(playId, "playQueue", "After Queue Play");
  } finally {
    unlock();
  }
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
    updatePlaybackSessionIndex(nextIndex);
    const nextTrack = webQueue[nextIndex];
    if (nextTrack) {
      await webAdd([mapTrack(nextTrack)]);
      await webPlay();
    }
    return;
  }
  await ensureSetup();
  let queue = await TrackPlayer.getQueue();
  let index = await TrackPlayer.getActiveTrackIndex();
  
  if (!queue || queue.length === 0) {
    const session = getPlaybackSession();
    if (session && session.queue && session.queue.length > 0) {
      let nextIndex = session.currentIndex + 1;
      if (nextIndex >= session.queue.length) {
        if (nativeRepeatMode === 'queue') nextIndex = 0;
        else return;
      }
      await playQueue(session.queue, nextIndex, {
        source: session.source,
        collectionId: session.collectionId,
        collectionTitle: session.collectionTitle
      });
      return;
    }
  }

  if (index !== undefined && queue && index === queue.length - 1 && nativeRepeatMode === 'queue') {
    return TrackPlayer.skip(0);
  }
  return TrackPlayer.skipToNext();
}

export async function skipToPrevious() {
  if (isWeb) {
    if (webQueue.length === 0) return;
    let prevIndex = webQueueIndex - 1;
    if (prevIndex < 0) prevIndex = 0;
    webQueueIndex = prevIndex;
    updatePlaybackSessionIndex(prevIndex);
    const prevTrack = webQueue[prevIndex];
    if (prevTrack) {
      await webAdd([mapTrack(prevTrack)]);
      await webPlay();
    }
    return;
  }
  await ensureSetup();
  let queue = await TrackPlayer.getQueue();
  let index = await TrackPlayer.getActiveTrackIndex();
  
  if (!queue || queue.length === 0) {
    const session = getPlaybackSession();
    if (session && session.queue && session.queue.length > 0) {
      let prevIndex = session.currentIndex - 1;
      if (prevIndex < 0) prevIndex = 0;
      await playQueue(session.queue, prevIndex, {
        source: session.source,
        collectionId: session.collectionId,
        collectionTitle: session.collectionTitle
      });
      return;
    }
  }

  if (index === 0 && nativeRepeatMode === 'queue' && queue?.length) {
    return TrackPlayer.skip(queue.length - 1);
  }
  return TrackPlayer.skipToPrevious();
}

export async function togglePlayPause() {
  if (playPausePromise) return playPausePromise;

  playPausePromise = togglePlayPauseInternal();
  try {
    await playPausePromise;
  } finally {
    playPausePromise = null;
  }
}

let playPausePromise: Promise<void> | null = null;

async function togglePlayPauseInternal() {
  if (isWeb) {
    if (webState === "Playing") { webPause(); }
    else { webPlay(); }
    return;
  }
  await ensureSetup();
  const queue = await TrackPlayer.getQueue();
  
  if (!queue || queue.length === 0) {
    const session = getPlaybackSession();
    if (session && session.queue && session.queue.length > 0) {
      await playQueue(session.queue, session.currentIndex, {
        source: session.source,
        collectionId: session.collectionId,
        collectionTitle: session.collectionTitle
      });
      return;
    }
  }

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
      const payload = event as { index?: number; track?: Record<string, unknown> };
      const track = payload.track;
      if (payload.index !== undefined) updatePlaybackSessionIndex(payload.index);
      if (track) {
        const unmapped = unmapTrack(track);
        callback(unmapped);
        
        if (unmapped.durationMs && unmapped.durationMs > 0) {
           import("./database").then(({ updateTrackDuration }) => {
             updateTrackDuration(unmapped.videoId, unmapped.durationMs!).catch(console.error);
           });
        }
      }
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
  // NOTE: We intentionally disable native RepeatMode and manage it manually in `scheduleQueueAdvance`.
  // Native queue looping bypasses our custom `addToHistory` tracking and session state updates.
  await TrackPlayer.setRepeatMode(RepeatMode.Off);
}

export async function getRepeatMode(): Promise<'off' | 'track' | 'queue'> {
  if (isWeb) {
    return webRepeatMode;
  }
  return nativeRepeatMode;
}
