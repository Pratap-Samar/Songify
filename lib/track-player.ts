import { Platform } from "react-native";
import TrackPlayer, { Capability, Event, State, RepeatMode, TrackType } from "@javascriptcommon/react-native-track-player";
import type { Track, PlaybackTrack } from "./music";
import { addToHistory } from "./database";
import { logger } from "./logger";
import {
  getPlaybackSession,
  setPlaybackSession,
  updatePlaybackSessionIndex,
  type PlaybackSessionInput
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
    if (!currentSession || !currentSession.queue || currentSession.queue.length <= 1) return;

    const activeIndex = await TrackPlayer.getActiveTrackIndex();
    if (activeIndex === undefined || activeIndex === null) return;
    const queue = await TrackPlayer.getQueue();
    if (!queue || queue.length === 0) return;

    const activeTrack = queue[activeIndex];
    if (!activeTrack) return;

    const currentTrackId = activeTrack.id;

    if (isShuffled) {
      const originalQueue = currentSession.originalQueue || [...currentSession.queue];
      let newQueue = [...originalQueue];
      
      const currentTrackIndex = newQueue.findIndex(t => t.videoId === currentTrackId);
      const currentTrackObj = currentTrackIndex !== -1 ? newQueue.splice(currentTrackIndex, 1)[0] : null;
      
      for (let i = newQueue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newQueue[i], newQueue[j]] = [newQueue[j], newQueue[i]];
      }
      
      if (currentTrackObj) {
        newQueue.unshift(currentTrackObj);
      }
      
      import('./playback-session').then(({ updatePlaybackSessionQueue }) => {
        updatePlaybackSessionQueue(newQueue, 0, originalQueue);
      });
    } else {
      if (currentSession.originalQueue) {
        const newQueue = [...currentSession.originalQueue];
        const newIndex = newQueue.findIndex(t => t.videoId === currentTrackId);
        import('./playback-session').then(({ updatePlaybackSessionQueue }) => {
          updatePlaybackSessionQueue(newQueue, newIndex !== -1 ? newIndex : 0, undefined);
        });
      }
    }

    // Always clear the upcoming native queue so JIT re-resolves the next track from the newly ordered session
    const trackIndexesToRemove = queue.map((_, i) => i).slice(activeIndex + 1);
    if (trackIndexesToRemove.length > 0) {
      await TrackPlayer.remove(trackIndexesToRemove);
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
function mapTrack(track: Track & { streamUrl: string; _sessionIndex?: number; mimeType?: string }) {
  return {
    id: track.videoId,
    url: track.streamUrl,
    title: track.title,
    artist: track.artists.join(", "),
    artwork: track.thumbnailUrl ?? "",
    duration: track.durationMs ? track.durationMs / 1000 : 0,
    genre: "Music",
    type: TrackType.Default,
    contentType: track.mimeType || 'audio/mp4',
    _sessionIndex: track._sessionIndex,
  };
}

function unmapTrack(item: Record<string, unknown>): Track & { streamUrl: string; _sessionIndex?: number } {
  if (!item) return null as unknown as Track & { streamUrl: string };
  return {
    videoId: item.id as string,
    streamUrl: item.url as string,
    title: item.title as string,
    artists: item.artist ? (item.artist as string).split(", ") : [],
    thumbnailUrl: (item.artwork as string) || null,
    durationMs: item.duration ? Math.floor((item.duration as number) * 1000) : null,
    album: null,
    _sessionIndex: item._sessionIndex as number | undefined,
  };
}

// ── Exported API ──────────────────────────────────────────────────

let nativePlayerReady = false;
let setupPromise: Promise<void> | null = null;
let queueAdvanceTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleQueueAdvance(requireEndPosition: boolean) {
  if (isWeb || queueAdvanceTimer) return;

  const playId = latestPlayId;
  queueAdvanceTimer = setTimeout(async () => {
    queueAdvanceTimer = null;
    if (latestPlayId !== playId) return;
    const currentSession = getPlaybackSession();
    if (!currentSession || currentSession.queue.length === 0) return;

    const { state } = await TrackPlayer.getPlaybackState();

    if (requireEndPosition || state === State.Paused) {
      const progress = await TrackPlayer.getProgress();
      if (state !== State.Paused || progress.duration <= 0 || progress.position < progress.duration - 0.5) return;
    } else if (state !== State.Ended) {
      return;
    }

    await skipToNext(true);
  }, 0);
}

export async function setupPlayer() {
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
      logger.debug(`[TrackPlayer] State: ${event.state}`);

      if (isResettingQueue && (event.state === State.Ended || event.state === State.Stopped)) {
        logger.debug(`[TrackPlayer] Ignored ${event.state} because queue is resetting`);
        return;
      }

      if (event.state === State.Ended) return; // Handled by PlaybackQueueEnded
      else if (event.state === State.Paused) scheduleQueueAdvance(true);
      
      // Safe to mutate the queue for the NEXT track only when the active track is fully buffered/playing
      if (event.state === State.Ready || event.state === State.Playing) {
        jitEnsureNextTrackInQueue(event.state === State.Ready ? "Ready" : "Playing").catch(e => console.error("[TrackPlayer] JIT error:", e));
      }
    });

    TrackPlayer.addEventListener(Event.PlaybackError, async (event) => {
      logger.debug(`[TrackPlayer] PlaybackError: ${event.message}`);
      try {
        const index = await TrackPlayer.getActiveTrackIndex();
        if (index === undefined || index === null) return;
        const track = await TrackPlayer.getTrack(index);
        
        if (!track || !track.id) return;

        // Prevent infinite loops if re-resolution fails repeatedly
        const attempts = ((track._recoveryAttempts as number) || 0);
        if (attempts >= 3) {
           logger.debug(`[TrackPlayer] Track ${track.id} failed after 3 recovery attempts. Giving up.`);
           skipToNext(true).catch(e => console.error(e));
           return;
        }

        logger.debug(`[TrackPlayer] Attempting recovery for track ${track.id} (Attempt ${attempts + 1})...`);
        const { resolveStreamSafely } = await import("./playback");
        
        const playId = latestPlayId;
        
        try {
           const trackMeta = track.title ? {
             title: track.title.toString(),
             artist: track.artist?.toString() || 'Unknown Artist'
           } : undefined;
           const resolved = await resolveStreamSafely(track.id, undefined, trackMeta);
           const newUrl = resolved.url;
           
           const currentSession = getPlaybackSession();
           if (latestPlayId === playId && currentSession && currentSession.queue && currentSession.currentIndex !== undefined) {
             // Update the session queue with the resolved URL and attempts
             const sTrack = currentSession.queue[currentSession.currentIndex];
             if (sTrack && sTrack.videoId === track.id) {
               sTrack.streamUrl = newUrl;
               sTrack.mimeType = resolved.mimeType;
               (sTrack as any)._recoveryAttempts = attempts + 1;
               
               if (currentSession.source === "album" || currentSession.source === "playlist") {
                  await _playLogicalCollectionTrack(currentSession.currentIndex, playId, attempts + 1);
                  return;
                }
                // Re-play the queue from this index safely
               await playQueue(currentSession.queue, currentSession.currentIndex, currentSession);
               return;
             }
           } else {
             logger.debug(`[TrackPlayer] Aborted recovery for ${track.id} due to session change`);
             return;
           }

           const newTrack = { 
               ...track, 
               url: newUrl,
               contentType: resolved.mimeType || 'audio/mp4',
               _recoveryAttempts: attempts + 1 
           };
           // Replace track to inject the fresh URL
           await TrackPlayer.add([newTrack], index + 1);
           await TrackPlayer.skip(index + 1);
           await TrackPlayer.remove([index]);
           await TrackPlayer.play();
        } catch (resolveError) {
           logger.error(`[TrackPlayer] Recovery resolution failed for ${track.id}:`, resolveError);
           if (latestPlayId === playId) {
             // Update attempts even if it failed so we don't infinite loop if it keeps throwing PlaybackError
             const failedTrack = { ...track, _recoveryAttempts: attempts + 1 };
             await TrackPlayer.add([failedTrack], index + 1);
             await TrackPlayer.skip(index + 1);
             await TrackPlayer.remove([index]);
           }
        }
      } catch (e) {
        console.error("[TrackPlayer] Error handling fallback:", e);
      }
    });

    TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async (event) => {
        logger.debug("[TrackPlayer] PlaybackQueueEnded fired. Native repeat mode:", nativeRepeatMode);
        if (isResettingQueue) return;
        await skipToNext(true).catch(e => console.error(e));
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
  if (nativePlayerReady) {
    return;
  }
  if (!setupPromise) {
    setupPromise = setupPlayer();
  }
  return setupPromise;
}

let latestPlayId = 0;

export function getTrackPlayer() { return TrackPlayer; }

export { mapTrack as mapTrackToTrackPlayerItem };

export function getLatestPlayId() { return latestPlayId; }
export function incrementPlayId() { return ++latestPlayId; }

let isResettingQueue = false;

export async function playStandaloneTrack(track: PlaybackTrack, playId: number) {
  if (queueAdvanceTimer) {
    clearTimeout(queueAdvanceTimer);
    queueAdvanceTimer = null;
  }
  
  logger.debug(`[TrackPlayer] playStandaloneTrack called. Active track: "${track.title}"`);
  const safeTrack = { ...track, title: track.title || "Unknown Title", artists: track.artists || [] } as unknown as import("./music").Track;
  

  addToHistory(safeTrack).catch((e) => console.error("[TrackPlayer] History error:", e));
  logger.debug(`[PLAY_REQUEST] Standalone playId: ${playId} (latest: ${latestPlayId}) videoId: ${track.videoId}`);
  
  try {
    if (isWeb) {
      await webSetupPlayer();
      if (latestPlayId !== playId) return;
      setPlaybackSession({ source: "track", collectionId: null, collectionTitle: null }, [track], 0);
      await webReset();
      webQueue = [track];
      webQueueIndex = 0;
      await webAdd([mapTrack({ ...track, _sessionIndex: 0 })]);
      if (latestPlayId !== playId) return;
      await webPlay();
      return;
    }
    
    logger.debug(`[DIAGNOSTIC] playStandaloneTrack: Calling ensureSetup for playId: ${playId}`);
    await ensureSetup();
    if (latestPlayId !== playId) {
      logger.debug(`[DIAGNOSTIC] playStandaloneTrack: Aborting early after ensureSetup (latestPlayId: ${latestPlayId} !== ${playId})`);
      return;
    }
    
    logger.debug(`[DIAGNOSTIC] playStandaloneTrack: Setting PlaybackSession for playId: ${playId}`);
    setPlaybackSession({ source: "track", collectionId: null, collectionTitle: null }, [track], 0);
    
    try {
      isResettingQueue = true;
      logger.debug(`[DIAGNOSTIC] playStandaloneTrack: Calling TrackPlayer.reset() for playId: ${playId}`);
      await TrackPlayer.reset();
      logger.debug(`[DIAGNOSTIC] playStandaloneTrack: Finished TrackPlayer.reset() for playId: ${playId}`);
    } finally {
      isResettingQueue = false;
    }
    
    if (latestPlayId !== playId) {
      logger.debug(`[DIAGNOSTIC] playStandaloneTrack: Aborting early after reset (latestPlayId: ${latestPlayId} !== ${playId})`);
      return;
    }
    
    logger.debug(`[DIAGNOSTIC] playStandaloneTrack: Calling TrackPlayer.setRepeatMode(Off) for playId: ${playId}`);
    await TrackPlayer.setRepeatMode(RepeatMode.Off);
    const mappedTrack = mapTrack({ ...track, _sessionIndex: 0 });
    
    logger.debug(`[DIAGNOSTIC] playStandaloneTrack: Calling TrackPlayer.add() for playId: ${playId}`);
    await TrackPlayer.add([mappedTrack]);
    
    if (latestPlayId !== playId) {
       logger.debug(`[DIAGNOSTIC] playStandaloneTrack: Aborting early after add (latestPlayId: ${latestPlayId} !== ${playId})`);
       return;
    }
    
    logger.debug(`[DIAGNOSTIC] playStandaloneTrack: Calling TrackPlayer.play() for playId: ${playId}`);
    await TrackPlayer.play();
    logger.debug(`[DIAGNOSTIC] playStandaloneTrack: Finished TrackPlayer.play() for playId: ${playId}`);
  } catch (error) {
    logger.debug(`[DIAGNOSTIC] playStandaloneTrack: EXCEPTION for playId: ${playId}: ${error}`);
    throw error;
  } finally {
  }
}


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
    logger.debug(`[TrackPlayer] playQueue called. Active track: "${current.title}", Stack: ${new Error().stack}`);
    const safeTrack = { ...current, title: current.title || "Unknown Title", artists: current.artists || [] } as unknown as Track;
    
  }

  const playId = opId ?? ++latestPlayId;
  logger.debug(`[PLAY_REQUEST]
  playId: ${playId} (latest: ${latestPlayId})
  videoId: ${tracks[index]?.videoId}
  title: ${tracks[index]?.title}
  source: ${sessionInput.source}
  collectionId: ${sessionInput.collectionId}
  collectionTitle: ${sessionInput.collectionTitle}
  current PlaybackSession: ${JSON.stringify(getPlaybackSession()?.collectionTitle)}
  timestamp: ${Date.now()}
  caller context: ${new Error().stack}`);
  latestPlayId = playId;

    if (isWeb) {
      await webSetupPlayer();
      if (latestPlayId !== playId) return;
      setPlaybackSession(sessionInput, tracks, index);
      await webReset();
      webQueue = tracks;
      webQueueIndex = index;
      if (tracks[index]) {
        await webAdd([mapTrack({ ...tracks[index], _sessionIndex: index })]);
        if (latestPlayId !== playId) return;
        await webPlay();
      }
      return;
    }
    await ensureSetup();
    if (latestPlayId !== playId) return;
    setPlaybackSession(sessionInput, tracks, index);
    
    try {
      isResettingQueue = true;
      await TrackPlayer.reset();
    } finally {
      isResettingQueue = false;
    }
    
    if (latestPlayId !== playId) return;
    
    const mappedTracks = tracks.map((t, i) => mapTrack({ ...t, _sessionIndex: i }));
    
    if (sessionInput.source === "track" && nativeRepeatMode === "queue") {
      nativeRepeatMode = "off";
    }
    await TrackPlayer.setRepeatMode(RepeatMode.Off);
    
    const firstTrack = mappedTracks[index];

    if (firstTrack) {
      await TrackPlayer.add([firstTrack]);

      if (latestPlayId !== playId) return;
      // Start playing immediately to avoid flashing through earlier tracks
      await TrackPlayer.play();
    }
}

export async function skipToNext(isAutoAdvance = false) {
  console.log(`[DIAGNOSTIC] skipToNext called. Stack:`, new Error().stack);
  const session = getPlaybackSession();
  if (session && (session.source === "album" || session.source === "playlist")) {
    let nextIndex = session.currentIndex + 1;
    if (isAutoAdvance && nativeRepeatMode === 'track') {
      nextIndex = session.currentIndex;
    } else if (nextIndex >= session.queue.length) {
      if (nativeRepeatMode === 'queue') nextIndex = 0;
      else return; // end of album
    }
    const playId = ++latestPlayId;
    return _playLogicalCollectionTrack(nextIndex, playId);
  }
  if (session && session.source === "track") {
    if (isAutoAdvance) {
      if (nativeRepeatMode === 'track' || nativeRepeatMode === 'queue') {
        if (!isWeb) {
            const index = await TrackPlayer.getActiveTrackIndex();
            if (index !== undefined && index !== null) {
                const track = await TrackPlayer.getTrack(index);
                if (track) {
                   isResettingQueue = true;
                   await TrackPlayer.reset();
                   await TrackPlayer.add([track]);
                   isResettingQueue = false;
                   await TrackPlayer.play();
                }
            }
          } else {
            getAudio().currentTime = 0;
            await webPlay();
          }
      }
    } else {
      if (!isWeb) {
            const index = await TrackPlayer.getActiveTrackIndex();
            if (index !== undefined && index !== null) {
                const track = await TrackPlayer.getTrack(index);
                if (track) {
                   isResettingQueue = true;
                   await TrackPlayer.reset();
                   await TrackPlayer.add([track]);
                   isResettingQueue = false;
                   await TrackPlayer.play();
                }
            }
          } else {
            getAudio().currentTime = 0;
            await webPlay();
          }
    }
    return;
  }
  if (isWeb) {
    if (webQueue.length === 0) return;
    if (webQueue.length === 1) {
      const audio = getAudio();
      audio.currentTime = 0;
      await webPlay();
      return;
    }
    let nextIndex = webQueueIndex + 1;
    if (isAutoAdvance && webRepeatMode === 'track') {
      nextIndex = webQueueIndex;
    } else if (nextIndex >= webQueue.length) {
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
      if (isAutoAdvance && nativeRepeatMode === 'track') {
        nextIndex = session.currentIndex;
      } else if (nextIndex >= session.queue.length) {
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

  if (index !== undefined && queue && index >= queue.length - 1) {
    const session = getPlaybackSession();
    if (session && session.queue && session.queue.length > 0) {
      let nextIndex = session.currentIndex + 1;
      if (isAutoAdvance && nativeRepeatMode === 'track') {
        nextIndex = session.currentIndex;
      } else if (nextIndex >= session.queue.length) {
        if (nativeRepeatMode === 'queue') nextIndex = 0;
        else return;
      }
      return playQueue(session.queue, nextIndex, session);
    }
  }

  if (isAutoAdvance && nativeRepeatMode === 'track') {
    const session = getPlaybackSession();
    if (session) {
      return playQueue(session.queue, session.currentIndex, session);
    }
  }
  return TrackPlayer.skipToNext();
}

export async function skipToPrevious() {
  console.log(`[DIAGNOSTIC] skipToPrevious called. Stack:`, new Error().stack);
  const session = getPlaybackSession();
  if (session && (session.source === "album" || session.source === "playlist")) {
    let prevIndex = session.currentIndex - 1;
    if (prevIndex < 0) {
      if (nativeRepeatMode === 'queue') prevIndex = session.queue.length - 1;
      else prevIndex = 0;
    }
    const playId = ++latestPlayId;
    return _playLogicalCollectionTrack(prevIndex, playId);
  }
  if (session && session.source === "track") {
    if (!isWeb) {
            const index = await TrackPlayer.getActiveTrackIndex();
            if (index !== undefined && index !== null) {
                const track = await TrackPlayer.getTrack(index);
                if (track) {
                   isResettingQueue = true;
                   await TrackPlayer.reset();
                   await TrackPlayer.add([track]);
                   isResettingQueue = false;
                   await TrackPlayer.play();
                }
            }
          } else {
            getAudio().currentTime = 0;
            await webPlay();
          }
    return;
  }
  if (isWeb) {
    if (webQueue.length === 0) return;
    if (webQueue.length === 1) {
      const audio = getAudio();
      audio.currentTime = 0;
      await webPlay();
      return;
    }
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

  if (index === 0) {
    const session = getPlaybackSession();
    if (session && session.queue && session.queue.length > 0) {
      let prevIndex = session.currentIndex - 1;
      if (prevIndex < 0) {
        if (nativeRepeatMode === 'queue') prevIndex = session.queue.length - 1;
        else prevIndex = 0;
      }
      return playQueue(session.queue, prevIndex, session);
    }
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
    else {
      if (webState === "Ended" || webState === "Stopped") {
         getAudio().currentTime = 0;
      }
      webPlay();
    }
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
  if (state === State.Playing) {
    await TrackPlayer.pause();
  } else {
    if (state === State.Ended || state === State.Stopped) {
      await TrackPlayer.seekTo(0);
    }
    await TrackPlayer.play();
  }
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
      if (track) {
        const unmapped = unmapTrack(track);
        
        // Use the preserved session index if available, otherwise fallback
        const sessionIndex = unmapped._sessionIndex !== undefined ? unmapped._sessionIndex : payload.index;
        if (sessionIndex !== undefined) {
          updatePlaybackSessionIndex(sessionIndex);
          
        }

        callback(unmapped);
        
        if (unmapped.durationMs && unmapped.durationMs > 0) {
           import("./database").then(({ updateTrackDuration }) => {
             updateTrackDuration(unmapped.videoId, unmapped.durationMs!).catch(console.error);
           });
        }
      } else if (payload.index !== undefined) {
        updatePlaybackSessionIndex(payload.index);
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
    // Enable seamless native loop for RepeatMode.Track (Track looping).
    // For RepeatMode.Queue, we leave it Off and handle it logically via PlaybackQueueEnded
    // because logical queues can be 50+ items and native queue is bounded.
    const isStandalone = getPlaybackSession()?.source === "track";
    if (isStandalone && mode === 'queue') {
       await TrackPlayer.setRepeatMode(RepeatMode.Track);
    } else {
       await TrackPlayer.setRepeatMode(mode === 'track' ? RepeatMode.Track : RepeatMode.Off);
    }
}

export async function getRepeatMode(): Promise<'off' | 'track' | 'queue'> {
  if (isWeb) {
    return webRepeatMode;
  }
  return nativeRepeatMode;
}

let jitInFlight = { generation: -1, index: -1 };

export async function jitEnsureNextTrackInQueue(trigger: string = "unknown") {
  if (isWeb) return;

  const session = getPlaybackSession();
  if (!session || !session.queue || session.queue.length === 0) return;
  if (session.source === "track") return; // Standalone MUST remain JIT-free

  let nextIndex = session.currentIndex + 1;
  if (nextIndex >= session.queue.length) {
    if (nativeRepeatMode === "queue") nextIndex = 0;
    else return;
  }

  const playId = latestPlayId;

  if (jitInFlight.generation === playId && jitInFlight.index === nextIndex) {
    logger.debug(`[JIT] DUPLICATE generation=${playId} logicalIndex=${nextIndex} trigger=${trigger}`);
    return;
  }

  try {
    jitInFlight = { generation: playId, index: nextIndex };
    logger.debug(`[JIT] START generation=${playId} logicalIndex=${nextIndex} trigger=${trigger}`);
    
    // Check if we already have the next track in TrackPlayer
    const nativeQueue = await TrackPlayer.getQueue();
    const activeIndex = await TrackPlayer.getActiveTrackIndex();
    
    if (nativeQueue && activeIndex !== undefined && activeIndex !== null) {
      if (nativeQueue.length > activeIndex + 1) {
        const nextNativeTrack = nativeQueue[activeIndex + 1];
        if (nextNativeTrack._sessionIndex === nextIndex) {
           logger.debug(`[JIT] SKIPPED generation=${playId} logicalIndex=${nextIndex} trigger=${trigger} (Already in native queue)`);
           return; 
        }
      }
    }

    const nextTrack = session.queue[nextIndex];
    if (!nextTrack) return;
    
    const { resolveStreamSafely } = await import("./playback");
    const resolved = await resolveStreamSafely(nextTrack.videoId, nextTrack.streamUrl, {
      title: nextTrack.title,
      artist: nextTrack.artists?.[0] || 'Unknown Artist'
    });
    
    if (latestPlayId !== playId) {
       logger.debug(`[JIT] STALE generation=${playId} currentGeneration=${latestPlayId} logicalIndex=${nextIndex}`);
       return;
    }

    nextTrack.streamUrl = resolved.url;
    if (resolved.mimeType) nextTrack.mimeType = resolved.mimeType;

    const currentSession = getPlaybackSession();
    const isConsecutiveIndex = currentSession && (currentSession.currentIndex + 1 === nextIndex || (nativeRepeatMode === "queue" && currentSession.currentIndex === currentSession.queue.length - 1 && nextIndex === 0));

    if (latestPlayId === playId && isConsecutiveIndex) {
      logger.debug(`[JIT] RESOLVED generation=${playId} logicalIndex=${nextIndex} videoId=${nextTrack.videoId}`);
      // Stage 1: Do not insert into native queue yet. Just cache the streamUrl.
      logger.debug(`[JIT] PRECACHED generation=${playId} logicalIndex=${nextIndex} videoId=${nextTrack.videoId} (Stage 1)`);
    } else {
      logger.debug(`[JIT] STALE generation=${playId} logicalIndex=${nextIndex}`);
    }

  } catch (error) {
    logger.debug(`[JIT] FAILED generation=${playId} logicalIndex=${nextIndex} error=${error}`);
  } finally {
    if (jitInFlight.generation === playId && jitInFlight.index === nextIndex) {
      jitInFlight = { generation: -1, index: -1 };
    }
  }
}

export async function togglePlayback() {
  const { state } = await TrackPlayer.getPlaybackState();
  if (state === State.Playing) {
    await TrackPlayer.pause();
  } else {
    if (state === State.Ended || state === State.Stopped) {
      await TrackPlayer.seekTo(0);
    }
    await TrackPlayer.play();
  }
}


export async function playLogicalCollection(collection: import("./music").Collection & { startIndex: number }, router: import("expo-router").Router) {
  const { getNavRequestId, openPlayerSafe } = await import("./playback");
  const currentReq = getNavRequestId();
  const playId = ++latestPlayId;
  logger.debug(`[COLLECTION_PLAY_REQUEST] playId: ${playId} albumId: ${collection.id} startIndex: ${collection.startIndex}`);

  const tracks = collection.tracks.map(t => ({
    ...t,
    album: collection.title,
    thumbnailUrl: t.thumbnailUrl || collection.artwork || null,
  })) as PlaybackTrack[];
  
  setPlaybackSession({
      source: collection.type === "playlist" ? "playlist" : "album",
      collectionId: collection.id,
      collectionTitle: collection.title
    }, tracks, collection.startIndex);

  await _playLogicalCollectionTrack(collection.startIndex, playId);
  openPlayerSafe(router, tracks[collection.startIndex].videoId, currentReq);
}

async function _playLogicalCollectionTrack(index: number, playId: number, recoveryAttempts: number = 0) {
  const session = getPlaybackSession();
  if (!session || !session.queue) return;
  const track = session.queue[index];
  if (!track) return;
  
  if (latestPlayId === playId) setResolvingTrackId(track.videoId);

  try {
    const { resolveStreamSafely } = await import("./playback");
    const resolved = await resolveStreamSafely(track.videoId, track.streamUrl, {
      title: track.title,
      artist: track.artists?.[0] || "Unknown Artist"
    });
    
    if (latestPlayId !== playId) {
      logger.debug(`[COLLECTION_STALE] generation=${playId} currentGeneration=${latestPlayId}`);
      return;
    }
    
    updatePlaybackSessionIndex(index);
    track.streamUrl = resolved.url;
    track.mimeType = resolved.mimeType;

    if (isWeb) {
      setResolvingTrackId(null);
      return;
    }
    
    await ensureSetup();
    if (latestPlayId !== playId) return;

    try {
      isResettingQueue = true;
      await TrackPlayer.reset();
    } finally {
      isResettingQueue = false;
    }
    if (latestPlayId !== playId) return;

    const mapped = mapTrack({ ...track, _sessionIndex: index } as any);
    (mapped as any)._recoveryAttempts = recoveryAttempts;
    await TrackPlayer.add([mapped]);

    if (latestPlayId !== playId) return;
    await TrackPlayer.play();
  } catch (e) {
    logger.debug(`[COLLECTION_ERROR] _playLogicalCollectionTrack generation=${playId} error=${e}`);
  } finally {
    if (latestPlayId === playId) setResolvingTrackId(null);
  }
}

let currentResolvingTrackId: string | null = null;
const resolvingListeners = new Set<(id: string | null) => void>();
export function setResolvingTrackId(id: string | null) { currentResolvingTrackId = id; resolvingListeners.forEach(l => l(id)); }
export function addResolvingTrackListener(cb: (id: string | null) => void) { resolvingListeners.add(cb); return { remove: () => resolvingListeners.delete(cb) }; }
export function getResolvingTrackId() { return currentResolvingTrackId; }

