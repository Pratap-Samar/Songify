import { useState, useEffect } from "react";
import {
  addPlaybackStateListener,
  addTrackChangeListener,
  addProgressListener,
  getActiveTrack,
  getPlaybackState,
  getRepeatMode,
  setRepeatMode as setNativeRepeatMode,
  togglePlayPause as nativeTogglePlayPause,
  skipToNext as nativeSkipToNext,
  skipToPrevious as nativeSkipToPrevious,
  getShuffleMode,
  addShuffleListener,
} from "@/lib/track-player";
import type { Track } from "@/lib/music";
import { getPlaybackSession, subscribePlaybackSession } from "@/lib/playback-session";

export function useActiveTrack() {
  const [track, setTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function syncInitialState() {
      try {
        const activeT = await getActiveTrack();
        if (activeT && active) {
          setTrack(activeT as unknown as Track);
          const state = await getPlaybackState();
          setIsPlaying(state === "Playing");
        }
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : "Unable to sync player state.");
        }
      }
    }

    syncInitialState();

    const stateUnsub = addPlaybackStateListener((state) => {
      if (!active) return;
      setIsPlaying(state === "Playing");
      if (state === "Stopped" || state === "None") setIsPlaying(false);
    });

    const trackUnsub = addTrackChangeListener((t) => {
      if (!active) return;
      setTrack(t);
      setIsPlaying(true);
    });

    return () => {
      active = false;
      stateUnsub?.remove?.();
      trackUnsub?.remove?.();
    };
  }, []);

  return { track, isPlaying, error };
}

export function usePlaybackProgress() {
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    let active = true;

    const progressUnsub = addProgressListener((pos, dur) => {
      if (!active) return;
      setPosition(pos);
      setDuration(dur);
    });

    return () => {
      active = false;
      progressUnsub?.remove?.();
    };
  }, []);

  return { position, duration };
}

export function useShuffleMode() {
  const [isShuffled, setIsShuffled] = useState(getShuffleMode);

  useEffect(() => {
    let active = true;
    const unsub = addShuffleListener((shuffled) => {
      if (active) setIsShuffled(shuffled);
    });
    return () => {
      active = false;
      unsub?.remove?.();
    };
  }, []);

  return isShuffled;
}

export function usePlaybackSession() {
  const [session, setSession] = useState(getPlaybackSession);

  // Load persisted session on mount
  useEffect(() => {
    async function loadSavedSession() {
      const { getSavedPlaybackSession } = await import('@/lib/database');
      const saved = await getSavedPlaybackSession();
      if (saved) {
        const { setPlaybackSession } = await import('@/lib/playback-session');
        const sanitizedQueue = saved.queue.map(track => {
          return {
            ...track,
            streamUrl: `songify-unresolved://${track.videoId}.mp4`
          };
        });

        setPlaybackSession(
          {
            source: saved.source,
            collectionId: saved.collectionId,
            collectionTitle: saved.collectionTitle,
          },
          sanitizedQueue,
          saved.currentIndex
        );
      }
    }
    loadSavedSession();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribePlaybackSession(setSession);
    return () => {
      unsubscribe();
    };
  }, []);

  return session;
}




export function usePlaybackControls() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [repeatMode, setRepeatModeState] = useState<"off" | "track" | "queue">("off");
  const shuffleEnabled = useShuffleMode();
  const session = usePlaybackSession();

  useEffect(() => {
    let active = true;

    async function syncInitialState() {
      const state = await getPlaybackState();
      if (active) setIsPlaying(state === "Playing");
      
      const rMode = await getRepeatMode();
      if (active) setRepeatModeState(rMode);
    }
    syncInitialState();

    const stateUnsub = addPlaybackStateListener((state) => {
      if (!active) return;
      setIsPlaying(state === "Playing");
      if (state === "Stopped" || state === "None") setIsPlaying(false);
    });

    return () => {
      active = false;
      stateUnsub?.remove?.();
    };
  }, []);

  useEffect(() => {
    if (session?.source === "track" && repeatMode === "queue") {
      setRepeatModeState("off");
    }
  }, [session?.source, repeatMode]);

  const togglePlayPause = async () => {
    await nativeTogglePlayPause();
  };

  const skipToNext = async () => {
    await nativeSkipToNext();
  };

  const skipToPrevious = async () => {
    await nativeSkipToPrevious();
  };

  const toggleRepeatMode = async () => {
    const isSolo = getPlaybackSession()?.source === "track";
    const nextMode = isSolo
      ? repeatMode === "off" ? "track" : "off"
      : repeatMode === "off" ? "queue" : repeatMode === "queue" ? "track" : "off";
    setRepeatModeState(nextMode);
    await setNativeRepeatMode(nextMode);
  };

  const toggleShuffle = async () => {
    const { toggleShuffleMode } = await import('@/lib/track-player');
    await toggleShuffleMode();
  };

  return {
    isPlaying,
    repeatMode,
    shuffleEnabled,
    togglePlayPause,
    skipToNext,
    skipToPrevious,
    toggleRepeatMode,
    toggleShuffle,
  };
}
