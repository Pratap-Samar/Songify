type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeToAlbumsChanged(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function notifyAlbumsChanged() {
  listeners.forEach((fn) => fn());
}
