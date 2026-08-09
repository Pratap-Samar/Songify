type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeToPlaylistChanges(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function notifyPlaylistsChanged() {
  listeners.forEach((fn) => fn());
}
