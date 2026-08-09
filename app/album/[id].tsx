import React, { useEffect, useState } from "react";
import { StyleSheet, View, Text, FlatList, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getAlbum } from "@/lib/api";
import { playCollection } from "@/lib/playback";
import type { Album, Track } from "@/lib/music";
import { theme } from "@/constants/theme";
import { useResponsive } from "@/lib/useResponsive";
import { useActiveTrack, useShuffleMode } from "@/hooks/usePlaybackState";
import { getShuffleMode } from "@/lib/track-player";
import { useTabBarHeight } from "@/lib/TabBarHeightContext";

import { addAlbum, removeAlbum, isAlbumSaved, initDb } from "@/lib/database";
import { useLikeModal } from "@/lib/LikeModalContext";

function formatDuration(ms: number | null | undefined): string {
  if (!ms) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function AlbumScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [album, setAlbum] = useState<Album | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { contentMaxWidth, titleSize, baseSize } = useResponsive();
  const shuffleEnabled = useShuffleMode();
  const { track: activeTrack, isPlaying } = useActiveTrack();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const { openLikeModal, isLiked } = useLikeModal();
  const { tabBarHeight } = useTabBarHeight();
  
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    
    getAlbum(id)
      .then((data) => {
        if (mounted) {
          setAlbum(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load album");
          setLoading(false);
        }
      });
      
    return () => { mounted = false; };
  }, [id]);

  // Check whether this album is already saved (always await initDb first)
  useEffect(() => {
    if (!album) return;
    let mounted = true;
    (async () => {
      try {
        await initDb();
        const alreadySaved = await isAlbumSaved(album.id);
        if (mounted) setSaved(alreadySaved);
      } catch {
        if (mounted) setSaved(false);
      }
    })();
    return () => { mounted = false; };
  }, [album]);

  if (loading) {
    return (
      <View style={style.center}>
        <ActivityIndicator size="large" color={theme.colors.accent.primary} />
      </View>
    );
  }

  if (error || !album) {
    return (
      <View style={style.center}>
        <Text style={style.errorText}>{error || "Album not found"}</Text>
        <TouchableOpacity style={style.backBtn} onPress={goBack}>
          <Text style={style.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handlePlayAlbum = () => {
    playCollection({
      type: "album",
      id: album.id,
      title: album.title,
      artwork: album.artwork,
      tracks: album.tracks,
      startIndex: 0,
    }, router);
  };

  const handlePlayTrack = (index: number) => {
    playCollection({
      type: "album",
      id: album.id,
      title: album.title,
      artwork: album.artwork,
      tracks: album.tracks,
      startIndex: index,
    }, router);
  };


  const renderHeader = () => (
    <View style={style.headerContainer}>
      <TouchableOpacity style={style.headerBack} onPress={goBack}>
        <Ionicons name="chevron-back" size={28} color={theme.colors.text.primary} />
      </TouchableOpacity>
      
      <View style={style.artworkWrapper}>
        {album.artwork ? (
          <Image source={{ uri: album.artwork }} style={style.artwork} cachePolicy="disk" contentFit="cover" transition={150} />
        ) : (
          <View style={style.artworkPlaceholder}>
            <Ionicons name="musical-notes" size={64} color={theme.colors.text.secondary} />
          </View>
        )}
      </View>

      <Text style={[style.title, { fontSize: titleSize }]} numberOfLines={2}>
        {album.title}
      </Text>
      
      <Text style={[style.artist, { fontSize: baseSize, color: theme.colors.accent.link }]}>
        {album.artists.join(", ")}
      </Text>
      
      <Text style={[style.metadata, { fontSize: baseSize * 0.85 }]}>
        {album.year ? `${album.year} • ` : ""}
        {album.trackCount || album.tracks.length} Songs
        {album.duration ? ` • ${album.duration}` : ""}
      </Text>

      <View style={style.controlsRow}>
        <TouchableOpacity style={style.playButton} onPress={handlePlayAlbum}>
          <Ionicons name="play" size={24} color={theme.colors.text.onPrimary} />
          <Text style={style.playButtonText}>Play</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[style.actionButton, shuffleEnabled && { borderColor: theme.colors.accent.primary }]}
          onPress={async () => {
            const { toggleShuffleMode } = await import('@/lib/track-player');
            await toggleShuffleMode();
          }}
        >
          <Ionicons name="shuffle" size={24} color={shuffleEnabled ? theme.colors.accent.primary : theme.colors.text.secondary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={style.actionButton}
          onPress={async () => {
            if (saving || !album) return;
            setSaving(true);
            try {
              await initDb();
              if (saved) {
                await removeAlbum(album.id);
                setSaved(false);
              } else {
                await addAlbum(
                  album.id,
                  album.title,
                  album.artists,
                  album.artwork ?? null,
                  album.year ?? null
                );
                setSaved(true);
              }
            } catch (e) {
              console.error("[AlbumScreen] add/remove album failed:", e);
            } finally {
              setSaving(false);
            }
          }}
          disabled={saving}
        >
          <Ionicons
            name={saved ? "checkmark-circle" : "add"}
            size={24}
            color={saved ? theme.colors.accent.status : theme.colors.text.secondary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );

  const TrackRowItem = ({ item, index, isCurrentlyPlaying, isPlaying, handlePlayTrack }: any) => {
    const liked = isLiked(item.videoId);

    return (
      <TouchableOpacity style={style.trackRow} onPress={() => handlePlayTrack(index)}>
        <View style={style.trackNumberContainer}>
          {isCurrentlyPlaying && isPlaying ? (
            <Ionicons name="stats-chart" size={16} color={theme.colors.accent.status} />
          ) : (
            <Text style={[style.trackNumber, isCurrentlyPlaying && style.trackNumberPlaying]}>
              {index + 1}
            </Text>
          )}
        </View>
        
        <View style={style.trackDetails}>
          <Text style={[style.trackTitle, isCurrentlyPlaying && style.trackTitlePlaying]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={style.trackArtist} numberOfLines={1}>
            {item.artists.join(", ")}
          </Text>
        </View>
        
        <Text style={style.trackDuration}>
          {formatDuration(item.durationMs)}
        </Text>
        
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity style={style.downloadBtn} onPress={() => openLikeModal(item)}>
            <Ionicons 
              name={liked ? "heart" : "heart-outline"} 
              size={24} 
              color={liked ? theme.colors.accent.like : theme.colors.text.secondary} 
              style={liked ? { textShadowColor: '#ffffff', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 2 } : {}}
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderTrack = ({ item, index }: { item: Track; index: number }) => {
    const isCurrentlyPlaying = activeTrack?.videoId === item.videoId;
    return (
      <TrackRowItem 
        item={item} 
        index={index} 
        isCurrentlyPlaying={isCurrentlyPlaying} 
        isPlaying={isPlaying} 
        handlePlayTrack={handlePlayTrack} 
      />
    );
  };

  return (
    <SafeAreaView edges={["top"]} style={style.container}>
      <FlatList
        data={album.tracks}
        keyExtractor={(item, index) => `${item.videoId}-${index}`}
        ListHeaderComponent={renderHeader}
        renderItem={renderTrack}
        style={style.trackList}
        contentContainerStyle={[style.listContent, { maxWidth: contentMaxWidth, alignSelf: "center", width: "100%", paddingBottom: tabBarHeight + 20 }]}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const style = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg.page,
  },
  center: {
    flex: 1,
    backgroundColor: theme.colors.bg.page,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    color: theme.colors.text.primary,
    fontSize: 16,
    marginBottom: 16,
  },
  backBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: theme.colors.bg.surface,
    borderRadius: 8,
  },
  backBtnText: {
    color: theme.colors.text.primary,
    fontWeight: "bold",
  },
  listContent: {
    paddingBottom: 16,
  },
  trackList: {
    flex: 1,
  },
  miniPlayerContainer: {
    width: "100%",
    alignSelf: "center",
  },
  headerContainer: {
    alignItems: "center",
    padding: 24,
    paddingTop: 12,
  },
  headerBack: {
    position: "absolute",
    top: 12,
    left: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 20,
  },
  artworkWrapper: {
    width: 200,
    height: 200,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 24,
    backgroundColor: theme.colors.bg.surface,
  },
  artwork: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
  },
  artworkPlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    color: theme.colors.text.primary,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  artist: {
    color: theme.colors.text.secondary,
    fontWeight: "600",
    marginBottom: 8,
  },
  metadata: {
    color: theme.colors.text.secondary,
    marginBottom: 24,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  playButton: {
    flexDirection: "row",
    backgroundColor: theme.colors.accent.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: "center",
    gap: 8,
  },
  playButtonText: {
    color: theme.colors.text.onPrimary,
    fontWeight: "bold",
    fontSize: 16,
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.bg.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  actionButtonDisabled: {
    backgroundColor: theme.colors.disabled.bg,
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.bg.row,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border.default,
  },
  trackNumberContainer: {
    width: 32,
    alignItems: "center",
  },
  trackNumber: {
    color: theme.colors.text.secondary,
    fontSize: 14,
  },
  trackNumberPlaying: {
    color: theme.colors.accent.primary,
    fontWeight: "bold",
  },
  trackDetails: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "center",
  },
  trackTitle: {
    color: theme.colors.text.primary,
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 4,
  },
  trackTitlePlaying: {
    color: theme.colors.accent.primary,
  },
  trackArtist: {
    color: theme.colors.text.secondary,
    fontSize: 13,
  },
  trackDuration: {
    color: theme.colors.text.secondary,
    fontSize: 13,
    marginRight: 12,
  },
  downloadBtn: {
    padding: 4,
  },
});
