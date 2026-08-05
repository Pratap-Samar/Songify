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
import { useActiveTrack } from "@/hooks/usePlaybackState";
import NowPlayingBar from "@/components/NowPlayingBar";
import { addAlbum, removeAlbum, isAlbumSaved, initDb } from "@/lib/database";

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
  const { track: activeTrack, isPlaying } = useActiveTrack();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
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
        <ActivityIndicator size="large" color={theme.colors.button} />
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
        <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
      </TouchableOpacity>
      
      <View style={style.artworkWrapper}>
        {album.artwork ? (
          <Image source={{ uri: album.artwork }} style={style.artwork} cachePolicy="disk" contentFit="cover" transition={150} />
        ) : (
          <View style={style.artworkPlaceholder}>
            <Ionicons name="musical-notes" size={64} color={theme.colors.subtext} />
          </View>
        )}
      </View>

      <Text style={[style.title, { fontSize: titleSize }]} numberOfLines={2}>
        {album.title}
      </Text>
      
      <Text style={[style.artist, { fontSize: baseSize }]}>
        {album.artists.join(", ")}
      </Text>
      
      <Text style={[style.metadata, { fontSize: baseSize * 0.85 }]}>
        {album.year ? `${album.year} • ` : ""}
        {album.trackCount || album.tracks.length} Songs
        {album.duration ? ` • ${album.duration}` : ""}
      </Text>

      <View style={style.controlsRow}>
        <TouchableOpacity style={style.playButton} onPress={handlePlayAlbum}>
          <Ionicons name="play" size={24} color={theme.colors.main} />
          <Text style={style.playButtonText}>Play</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[style.actionButton, saved && style.actionButtonSaved]}
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
            name={saved ? "checkmark" : "add"}
            size={24}
            color={saved ? theme.colors.button : theme.colors.subtext}
          />
        </TouchableOpacity>
        <TouchableOpacity style={style.actionButton} disabled={true}>
          <Ionicons name="shuffle" size={24} color={theme.colors.subtext} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderTrack = ({ item, index }: { item: Track; index: number }) => {
    const isCurrentlyPlaying = activeTrack?.videoId === item.videoId;
    
    return (
      <TouchableOpacity style={style.trackRow} onPress={() => handlePlayTrack(index)}>
        <View style={style.trackNumberContainer}>
          {isCurrentlyPlaying && isPlaying ? (
            <Ionicons name="stats-chart" size={16} color={theme.colors.button} />
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
        
        <TouchableOpacity style={style.downloadBtn}>
          <Ionicons name="arrow-down-circle-outline" size={20} color={theme.colors.subtext} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={style.container}>
      <FlatList
        data={album.tracks}
        keyExtractor={(item, index) => `${item.videoId}-${index}`}
        ListHeaderComponent={renderHeader}
        renderItem={renderTrack}
        style={style.trackList}
        contentContainerStyle={[style.listContent, { maxWidth: contentMaxWidth, alignSelf: "center", width: "100%" }]}
        showsVerticalScrollIndicator={false}
      />
      <View style={[style.miniPlayerContainer, { maxWidth: contentMaxWidth }]}>
        <NowPlayingBar />
      </View>
    </SafeAreaView>
  );
}

const style = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.main,
  },
  center: {
    flex: 1,
    backgroundColor: theme.colors.main,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    color: theme.colors.notificationError,
    fontSize: 16,
    marginBottom: 16,
  },
  backBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: theme.colors.card,
    borderRadius: 8,
  },
  backBtnText: {
    color: theme.colors.text,
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
    backgroundColor: theme.colors.card,
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
    color: theme.colors.text,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  artist: {
    color: theme.colors.subtext,
    fontWeight: "600",
    marginBottom: 8,
  },
  metadata: {
    color: theme.colors.subtext,
    marginBottom: 24,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  playButton: {
    flexDirection: "row",
    backgroundColor: theme.colors.button,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: "center",
    gap: 8,
  },
  playButtonText: {
    color: theme.colors.main,
    fontWeight: "bold",
    fontSize: 16,
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.card,
    justifyContent: "center",
    alignItems: "center",
  },
  actionButtonSaved: {
    borderWidth: 1.5,
    borderColor: theme.colors.button,
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  trackNumberContainer: {
    width: 32,
    alignItems: "center",
  },
  trackNumber: {
    color: theme.colors.subtext,
    fontSize: 14,
  },
  trackNumberPlaying: {
    color: theme.colors.button,
    fontWeight: "bold",
  },
  trackDetails: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "center",
  },
  trackTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 4,
  },
  trackTitlePlaying: {
    color: theme.colors.button,
  },
  trackArtist: {
    color: theme.colors.subtext,
    fontSize: 13,
  },
  trackDuration: {
    color: theme.colors.subtext,
    fontSize: 13,
    marginRight: 12,
  },
  downloadBtn: {
    padding: 4,
  },
});
