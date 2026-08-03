import { useState, useEffect } from "react";
import {
  addPlaybackStateListener,
  addTrackChangeListener,
  addProgressListener,
  getActiveTrack,
  getPlaybackState,
} from "@/lib/track-player";
import type { Track } from "@/lib/music";

export function usePlaybackState() {
  const [track, setTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
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

    const progressUnsub = addProgressListener((pos, dur) => {
      if (!active) return;
      setPosition(pos);
      setDuration(dur);
    });

    return () => {
      active = false;
      stateUnsub?.remove?.();
      trackUnsub?.remove?.();
      progressUnsub?.remove?.();
    };
  }, []);

  return { track, isPlaying, position, duration, error };
}
