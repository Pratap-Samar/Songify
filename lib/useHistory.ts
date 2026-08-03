import { useState, useCallback, useEffect } from "react";
import { subscribeToHistoryChanges } from "./historyEvents";
import { getHistory, addToHistory } from "./database";
import type { Track } from "./music";

export function useHistory() {
  const [history, setHistory] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getHistory(20);
      setHistory(data);
    } catch (e) {
      console.error("Error fetching history:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
    return subscribeToHistoryChanges(fetchHistory);
  }, [fetchHistory]);

  const addTrack = useCallback(async (track: Track) => {
    try {
      await addToHistory(track);
    } catch (e) {
      console.error("Error adding to history:", e);
    }
  }, []);

  return { history, loading, fetchHistory, addTrack };
}

