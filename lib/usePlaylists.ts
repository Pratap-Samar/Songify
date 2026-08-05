import { useEffect, useState } from "react";
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

export function usePlaylists() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const { initDb } = await import("@/lib/database");
      await initDb();
      setPlaylists(await getPlaylists());
    } catch (e) {
      console.error("[usePlaylists] refresh failed:", e);
      setPlaylists([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const create = async (name: string) => {
    const playlist = await createPlaylist(name);
    await refresh();
    return playlist;
  };

  const rename = async (id: number, name: string) => {
    await renamePlaylist(id, name);
    await refresh();
  };

  const remove = async (id: number) => {
    await deletePlaylist(id);
    await refresh();
  };

  const addTrack = async (playlistId: number, track: Track) => {
    await addTrackToPlaylist(playlistId, track);
  };

  const removeTrack = async (playlistId: number, videoId: string) => {
    await removeTrackFromPlaylist(playlistId, videoId);
  };

  const getTracks = async (playlistId: number): Promise<PlaylistTrackEntry[]> => {
    const tracks = await getPlaylistTracks(playlistId);
    return tracks.map(parsePlaylistTrack);
  };

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