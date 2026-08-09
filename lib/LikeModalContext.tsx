import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { getLikedTrackIds, addTrackToPlaylist, getLikedPlaylistId, initDb } from "./database";
import { subscribeToPlaylistChanges } from "./playlistEvents";
import type { Track } from "./music";
import AddToPlaylistModal from "@/components/AddToPlaylistModal";

interface LikeModalContextValue {
  openLikeModal: (track: Track) => Promise<void>;
  isLiked: (videoId: string) => boolean;
}

const LikeModalContext = createContext<LikeModalContextValue | null>(null);

export function LikeModalProvider({ children }: { children: React.ReactNode }) {
  const [likedTrackIds, setLikedTrackIds] = useState<Set<string>>(new Set());
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTrack, setModalTrack] = useState<Track | null>(null);

  const fetchLikedTracks = useCallback(async () => {
    try {
      await initDb();
      const ids = await getLikedTrackIds();
      setLikedTrackIds(ids);
    } catch (e) {
      console.error("[LikeModalProvider] Failed to fetch liked tracks:", e);
    }
  }, []);

  useEffect(() => {
    fetchLikedTracks();
    return subscribeToPlaylistChanges(fetchLikedTracks);
  }, [fetchLikedTracks]);

  const openLikeModal = useCallback(async (track: Track) => {
    try {
      // Optimistically assume it's liked if we are about to add it
      let isAlreadyLiked = likedTrackIds.has(track.videoId);
      
      if (!isAlreadyLiked) {
        // Auto-add immediately if not liked
        const playlistId = await getLikedPlaylistId();
        await addTrackToPlaylist(playlistId, track); // This will fire playlistEvents and refresh cache
        setLikedTrackIds((prev) => new Set(prev).add(track.videoId));
      }
      
      setModalTrack(track);
      setModalVisible(true);
    } catch (e) {
      console.error("[LikeModalProvider] Failed to open like modal:", e);
    }
  }, [likedTrackIds]);

  const isLiked = useCallback((videoId: string) => {
    return likedTrackIds.has(videoId);
  }, [likedTrackIds]);

  const contextValue = useMemo(() => ({
    openLikeModal,
    isLiked,
  }), [openLikeModal, isLiked]);

  return (
    <LikeModalContext.Provider value={contextValue}>
      {children}
      <AddToPlaylistModal
        visible={modalVisible}
        track={modalTrack}
        onClose={() => {
          setModalVisible(false);
          setModalTrack(null);
        }}
      />
    </LikeModalContext.Provider>
  );
}

export function useLikeModal() {
  const context = useContext(LikeModalContext);
  if (!context) {
    throw new Error("useLikeModal must be used within a LikeModalProvider");
  }
  return context;
}
