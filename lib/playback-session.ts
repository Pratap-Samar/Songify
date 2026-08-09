import type { Track } from "./music";
import { clearPlaybackSession as clearPersistedPlaybackSession, savePlaybackSession } from "./database";
import { prefetchAudioUrl } from "./api";

export type PlaybackSource = "track" | "album" | "playlist" | "downloads" | "liked";

export type PlaybackTrack = Track & { streamUrl: string };

export type PlaybackSession = {
  source: PlaybackSource;
  collectionId: string | null;
  collectionTitle: string | null;
  queue: PlaybackTrack[];
  currentIndex: number;
};

export type PlaybackSessionInput = Pick<
  PlaybackSession,
  "source" | "collectionId" | "collectionTitle"
>;

let session: PlaybackSession | null = null;
const listeners = new Set<(value: PlaybackSession | null) => void>();

export function getPlaybackSession() {
  return session;
}

export function subscribePlaybackSession(listener: (value: PlaybackSession | null) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Queue to serialize DB writes and avoid "database is locked" errors
let persistenceQueue = Promise.resolve();

function enqueuePersistence(operation: () => Promise<void>, errorMessage: string) {
  persistenceQueue = persistenceQueue.then(operation).catch((error) => {
    console.error(`[PlaybackSession] ${errorMessage}:`, error);
  });
}

export function setPlaybackSession(
  input: PlaybackSessionInput,
  queue: PlaybackTrack[],
  currentIndex: number,
) {
  session = { ...input, queue, currentIndex };
  listeners.forEach((listener) => listener(session));
  prefetchNext(session);
  
  const currentSession = session;
  enqueuePersistence(
    () => savePlaybackSession(currentSession),
    "Failed to persist session"
  );
}

export function updatePlaybackSessionIndex(currentIndex: number) {
  if (!session || session.currentIndex === currentIndex) return;
  session = { ...session, currentIndex };
  listeners.forEach((listener) => listener(session));
  prefetchNext(session);
  
  const currentSession = session;
  enqueuePersistence(
    () => savePlaybackSession(currentSession),
    "Failed to persist session index"
  );
}

function prefetchNext(value: PlaybackSession) {
  const nextTrack = value.queue[value.currentIndex + 1];
  if (nextTrack) prefetchAudioUrl(nextTrack.videoId);
}

export function clearPlaybackSession() {
  if (session) {
    session = null;
    listeners.forEach((listener) => listener(null));
  }
  
  enqueuePersistence(
    () => clearPersistedPlaybackSession(),
    "Failed to clear persisted session"
  );
}
