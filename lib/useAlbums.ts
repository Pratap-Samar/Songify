import { useCallback, useEffect, useRef, useState } from "react";
import { initDb, addAlbum, removeAlbum, getAlbums, isAlbumSaved, type SavedAlbum } from "./database";
import { subscribeToAlbumsChanged } from "./albumEvents";

export function useAlbums() {
  const [albums, setAlbums] = useState<SavedAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const ready = useRef(false);

  const refresh = useCallback(async () => {
    await initDb();               // no-op if already resolved; safe to call multiple times
    const rows = await getAlbums();
    setAlbums(rows);
  }, []);

   useEffect(() => {
    let mounted = true;
    (async () => {
      await initDb();
      ready.current = true;
      if (mounted) {
        await refresh();
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
      return;
    };
  }, [refresh]);

  useEffect(() => {
    return subscribeToAlbumsChanged(refresh);
  }, [refresh]);

  const save = useCallback(
    async (
      id: string,
      title: string,
      artists: string[],
      thumbnailUrl: string | null,
      year: string | null
    ) => {
      await initDb();
      await addAlbum(id, title, artists, thumbnailUrl, year);
      await refresh();
    },
    [refresh]
  );

  const remove = useCallback(async (id: string) => {
    await initDb();
    await removeAlbum(id);
    await refresh();
  }, [refresh]);

  const checkSaved = useCallback(async (id: string): Promise<boolean> => {
    await initDb();
    return isAlbumSaved(id);
  }, []);

  return { albums, loading, save, remove, checkSaved, refresh };
}
