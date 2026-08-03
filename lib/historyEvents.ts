type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeToHistoryChanges(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function notifyHistoryChanged() {
  listeners.forEach((fn) => fn());
}

