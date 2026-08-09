import { useEffect, useState, useCallback } from "react";
import {
  createPlaylist,
  deletePlaylist,
  getPlaylistTracks,
  getPlaylists,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
  renamePlaylist,
  type Playlist,
  type PlaylistTrack,
} from "@/lib/database";
import type { Track } from "@/lib/music";

export interface PlaylistTrackEntry extends Track {
  position: number;
}

function parsePlaylistTrack(track: PlaylistTrack): PlaylistTrackEntry {
  return {
    videoId: track.videoId,
    title: track.title,
    artists: JSON.parse(track.artists),
    album: track.album,
    durationMs: track.durationMs,
    thumbnailUrl: track.thumbnailUrl,
    position: track.position,
  };
}

import { subscribeToPlaylistChanges } from "./playlistEvents";

export function usePlaylists() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { initDb, getLikedPlaylistId } = await import("@/lib/database");
      await initDb();
      await getLikedPlaylistId(); // Ensure it exists
      
      const allPlaylists = await getPlaylists();
      
      // Pin to top
      const liked = allPlaylists.find(p => p.isSystem === 1 && p.name === "Liked Songs");
      const others = allPlaylists.filter(p => p.id !== liked?.id);
      
      if (liked) {
        setPlaylists([liked, ...others]);
      } else {
        setPlaylists(others);
      }
    } catch (e) {
      console.error("[usePlaylists] refresh failed:", e);
      setPlaylists([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    return subscribeToPlaylistChanges(refresh);
  }, []);

  const create = useCallback(async (name: string) => {
    const playlist = await createPlaylist(name);
    await refresh();
    return playlist;
  }, []);

  const rename = useCallback(async (id: number, name: string) => {
    await renamePlaylist(id, name);
    await refresh();
  }, []);

  const remove = useCallback(async (id: number) => {
    await deletePlaylist(id);
    await refresh();
  }, []);

  const addTrack = useCallback(async (playlistId: number, track: Track) => {
    await addTrackToPlaylist(playlistId, track);
  }, []);

  const removeTrack = useCallback(async (playlistId: number, videoId: string) => {
    await removeTrackFromPlaylist(playlistId, videoId);
  }, []);

  const getTracks = useCallback(async (playlistId: number): Promise<PlaylistTrackEntry[]> => {
    const tracks = await getPlaylistTracks(playlistId);
    return tracks.map(parsePlaylistTrack);
  }, []);

  return {
    playlists,
    loading,
    refresh,
    create,
    rename,
    remove,
    addTrack,
    removeTrack,
    getTracks,
  };
}