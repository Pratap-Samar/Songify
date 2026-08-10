import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { FlatList, StyleSheet, Text, TextInput, View, ActivityIndicator, Alert, Animated } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { PressableScale } from "@/components/PressableScale";
import MarqueeText from "@/components/MarqueeText";
import { darkenHex, hexToRgba } from "@/lib/colorUtils";
import { usePlaylists, type PlaylistTrackEntry } from "@/lib/usePlaylists";
import type { Playlist } from "@/lib/database";
import type { Track } from "@/lib/music";
import { theme } from "@/constants/theme";
import { useResponsive } from "@/lib/useResponsive";
import { useActiveTrack, useShuffleMode, usePlaybackSession, usePlaybackControls } from "@/hooks/usePlaybackState";
import { playCollection } from "@/lib/playback";
import { useTabBarHeight } from "@/lib/TabBarHeightContext";
import PlaylistArt from "@/components/PlaylistArt";
import EditPlaylistArtModal from "@/components/EditPlaylistArtModal";
import TrackPickerList from "@/components/TrackPickerList";
import { subscribeToPlaylistChanges } from "@/lib/playlistEvents";
import { deletePlaylist } from "@/lib/database";

function formatDuration(ms: number | null | undefined): string {
  if (!ms) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function PlaylistDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const playlistId = Number(id);
  const { playlists, getTracks, addTrack, removeTrack, rename, loading: globalLoading } = usePlaylists();
  
  const [playlistTracks, setPlaylistTracks] = useState<PlaylistTrackEntry[]>([]);
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  
  const [showSearch, setShowSearch] = useState(false);
  const [isEditingArt, setIsEditingArt] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState("");

  const { contentMaxWidth, titleSize, baseSize } = useResponsive();
  const shuffleEnabled = useShuffleMode();
  const { track: activeTrack, isPlaying } = useActiveTrack();
  const session = usePlaybackSession();
  const { togglePlayPause } = usePlaybackControls();
  const { tabBarHeight } = useTabBarHeight();

  const isThisCollectionActive = session?.collectionId === String(playlist?.id);
  const showPause = isThisCollectionActive && isPlaying;

  const handleMainPlay = () => {
    if (isThisCollectionActive) {
      togglePlayPause();
    } else {
      handlePlayPlaylist();
    }
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  const loadTracks = useCallback(async () => {
    const tracks = await getTracks(playlistId);
    setPlaylistTracks(tracks);
  }, [playlistId, getTracks]);

  useEffect(() => {
    const p = playlists.find((p) => p.id === playlistId);
    if (p) {
      setPlaylist(p);
      setTempTitle(p.name);
    } else if (!globalLoading) {
        // Playlist deleted or not found
    }
  }, [playlistId, playlists, globalLoading]);

  useEffect(() => {
    loadTracks();
    return subscribeToPlaylistChanges(loadTracks);
  }, [loadTracks]);


  const handleAddTrack = async (track: Track) => {
    await addTrack(playlistId, track);
    await loadTracks();
  };

  const handleRemoveTrack = async (videoId: string) => {
    await removeTrack(playlistId, videoId);
    await loadTracks();
  };

  const handleRename = async () => {
    const trimmed = tempTitle.trim();
    if (trimmed && playlist && trimmed !== playlist.name && !playlist.isSystem) {
      await rename(playlist.id, trimmed);
    } else if (playlist) {
      setTempTitle(playlist.name);
    }
    setEditingTitle(false);
  };

  const handleDeletePlaylist = () => {
    Alert.alert("Delete Playlist", "Are you sure you want to delete this playlist?", [
      { text: "Cancel" },
      { 
        text: "Delete", 
        style: "destructive", 
        onPress: async () => {
          await deletePlaylist(playlistId);
          router.back();
        } 
      },
    ]);
  };

  const handlePlayPlaylist = () => {
    if (!playlist || playlistTracks.length === 0) return;
    playCollection({
      type: "playlist",
      id: String(playlist.id),
      title: playlist.name,
      artwork: undefined,
      tracks: playlistTracks,
      startIndex: 0,
    }, router);
  };


  const handlePlayTrack = (index: number) => {
    if (!playlist || playlistTracks.length === 0) return;
    playCollection({
      type: "playlist",
      id: String(playlist.id),
      title: playlist.name,
      artwork: undefined,
      tracks: playlistTracks,
      startIndex: index,
    }, router);
  };

  const totalDurationMs = useMemo(() => {
    return playlistTracks.reduce((acc, t) => acc + (t.durationMs || 0), 0);
  }, [playlistTracks]);

  const totalDurationStr = useMemo(() => {
    if (totalDurationMs === 0) return "";
    const totalSeconds = Math.floor(totalDurationMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) return `${hours} hr ${minutes} min`;
    return `${minutes} min`;
  }, [totalDurationMs]);

  if (!playlist) {
    return (
      <View style={style.center}>
        <ActivityIndicator size="large" color={theme.colors.accent.primary} />
      </View>
    );
  }

  const renderHeader = () => (
    <View style={style.headerContainer}>
      <PressableScale style={style.headerBack} onPress={goBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
        <Ionicons name="chevron-back" size={32} color={theme.colors.text.primary} />
      </PressableScale>
      <PressableScale
        style={style.deleteBtn}
        onPress={handleDeletePlaylist}
        disabled={!!playlist.isSystem}
      >
        <Ionicons 
          name="trash" 
          size={24} 
          color={playlist.isSystem ? theme.colors.text.secondary : theme.colors.accent.status} 
          style={{ opacity: playlist.isSystem ? 0.3 : 1 }}
        />
      </PressableScale>
      
      <View style={style.artworkWrapper}>
        <PlaylistArt 
          playlist={playlist} 
          size={240} 
          onEdit={() => setIsEditingArt(true)} 
        />
      </View>

      {editingTitle && !playlist.isSystem ? (
        <TextInput
          style={[style.titleInput, { fontSize: titleSize }]}
          value={tempTitle}
          onChangeText={setTempTitle}
          onBlur={handleRename}
          onSubmitEditing={handleRename}
          autoFocus
          returnKeyType="done"
        />
      ) : (
        <PressableScale 
          onPress={() => !playlist.isSystem && setEditingTitle(true)}
          disabled={!!playlist.isSystem}
        >
          <Text style={[style.title, { fontSize: titleSize }]} numberOfLines={2}>
            {playlist.name}
          </Text>
        </PressableScale>
      )}
      
      <Text style={[style.artist, { fontSize: baseSize, color: theme.colors.accent.link }]}>
        Playlist
      </Text>
      
      <Text style={[style.metadata, { fontSize: baseSize * 0.85 }]}>
        {playlistTracks.length} Songs
        {totalDurationStr ? ` • ${totalDurationStr}` : ""}
      </Text>

      <View style={style.controlsRow}>
        <PressableScale onPress={handleMainPlay} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <View
            style={[style.playButton, { backgroundColor: theme.colors.accent.primary }]}
          >
            <Ionicons name={showPause ? "pause" : "play"} size={28} color={theme.colors.text.onPrimary} style={{ marginLeft: showPause ? 0 : 4 }} />
          </View>
        </PressableScale>
        <PressableScale 
          style={[style.actionButton, shuffleEnabled && { backgroundColor: hexToRgba(theme.colors.accent.secondary, 0.2), borderColor: 'transparent' }]} 
          onPress={async () => {
            import("expo-haptics").then(Haptics => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
            const { toggleShuffleMode } = await import('@/lib/track-player');
            await toggleShuffleMode();
          }}
        >
          <Ionicons name="shuffle" size={24} color={shuffleEnabled ? theme.colors.text.primary : theme.colors.text.secondary} />
        </PressableScale>

        <PressableScale style={style.actionButton} onPress={() => setShowSearch(!showSearch)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons
            name="add"
            size={24}
            color={theme.colors.text.secondary}
          />
        </PressableScale>
      </View>

      {/* Add Track Search Section */}
      {showSearch && (
        <View style={style.searchBar}>
          <TrackPickerList onSelectTrack={(track) => {
            handleAddTrack(track);
            setShowSearch(false);
          }} placeholder="Search to add..." />
        </View>
      )}
    </View>
  );

  const TrackRowItem = ({ item, index, isCurrentlyPlaying, isPlaying, handlePlayTrack }: any) => {
    const titleColor = isCurrentlyPlaying ? theme.colors.accent.status : theme.colors.text.primary;
    return (
      <PressableScale style={style.trackRow} onPress={() => handlePlayTrack(index)}>
        <View style={style.trackNumberContainer}>
          {isCurrentlyPlaying && isPlaying ? (
            <Ionicons name="stats-chart" size={16} color={theme.colors.accent.status} />
          ) : (
            <Text style={[style.trackNumber, isCurrentlyPlaying && { color: theme.colors.accent.status }]}>
              {index + 1}
            </Text>
          )}
        </View>
        <View style={style.trackContent}>
          <View style={style.trackLeft}>
            {item.thumbnailUrl && (
              <View style={style.thumbnailContainer}>
                <Image source={{ uri: item.thumbnailUrl }} style={style.thumbnail} />
              </View>
            )}
            <View style={style.trackText}>
              <MarqueeText
                style={[style.trackTitle, { fontSize: baseSize, color: titleColor }]}
                text={item.title}
                animate={isCurrentlyPlaying}
              />
              <Text style={[style.trackArtist, { fontSize: baseSize * 0.85 }]} numberOfLines={1}>
                {item.artists}
              </Text>
            </View>
          </View>
        
          <Text style={style.trackDuration}>
            {formatDuration(item.durationMs)}
          </Text>
        </View>
        <PressableScale style={style.downloadBtn} onPress={() => handleRemoveTrack(item.videoId)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons 
            name="close-circle" 
            size={24} 
            color={theme.colors.text.secondary} 
          />
        </PressableScale>
      </PressableScale>
    );
  };

  const renderTrack = ({ item, index }: { item: PlaylistTrackEntry; index: number }) => {
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

  // In the future, this can be `playlist?.artwork || undefined` when custom artwork is supported.
  const customArtwork = undefined;
  const ambientColor = playlist?.coverColor;

  return (
    <View style={style.container}>
      {customArtwork ? (
        <View style={StyleSheet.absoluteFillObject}>
          <Image
            source={{ uri: customArtwork }}
            style={StyleSheet.absoluteFillObject}
            blurRadius={80}
            contentFit="cover"
          />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: theme.colors.bg.page, opacity: 0.85 }]} />
        </View>
      ) : ambientColor ? (
        <View style={StyleSheet.absoluteFillObject}>
           <LinearGradient
            colors={[ambientColor, theme.colors.bg.page]}
            style={[StyleSheet.absoluteFillObject, { opacity: 0.15 }]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.5 }}
          />
        </View>
      ) : null}
      <FlatList
        data={playlistTracks}
        keyExtractor={(item) => `${playlistId}-${item.videoId}`}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <Text style={style.empty}>No tracks in this playlist yet.</Text>
        }
        renderItem={renderTrack}
        contentContainerStyle={[style.listContent, { paddingBottom: tabBarHeight + 20 }]}
      />
      <EditPlaylistArtModal
        visible={isEditingArt}
        onClose={() => setIsEditingArt(false)}
        playlist={playlist}
      />
    </View>
  );
}

const style = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.bg.page,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.bg.page,
  },
  listContent: {
    paddingBottom: 40,
    paddingHorizontal: 4,
  },
  miniPlayerContainer: {
    width: "100%",
    alignSelf: "center",
  },
  headerContainer: {
    alignItems: "center",
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerBack: {
    position: "absolute",
    top: 50,
    left: 16,
    zIndex: 10,
    padding: 8,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 20,
  },
  deleteBtn: {
    position: "absolute",
    top: 50,
    right: 16,
    zIndex: 10,
    padding: 8,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 20,
  },
  artworkWrapper: {
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    marginBottom: 24,
  },
  title: {
    fontWeight: "bold",
    color: theme.colors.text.primary,
    textAlign: "center",
    marginBottom: 4,
  },
  titleInput: {
    fontWeight: "bold",
    color: theme.colors.text.primary,
    textAlign: "center",
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.accent.primary,
    minWidth: 200,
  },
  artist: {
    fontWeight: "500",
    marginBottom: 8,
    textAlign: "center",
  },
  metadata: {
    color: theme.colors.text.metadata,
    textAlign: "center",
    marginBottom: 24,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    gap: 16,
  },
  playButton: {
    backgroundColor: theme.colors.accent.primary,
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: theme.colors.accent.primary,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  playButtonText: {
    color: theme.colors.text.onPrimary,
    fontSize: 15,
    fontWeight: "bold",
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.bg.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  trackNumberContainer: {
    width: 32,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  trackNumber: {
    color: theme.colors.text.muted,
    fontSize: 15,
  },
  trackNumberPlaying: {
    color: theme.colors.accent.status,
  },
  trackDetails: {
    flex: 1,
    justifyContent: "center",
  },
  trackContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trackLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbnailContainer: {
    marginRight: 12,
  },
  thumbnail: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: hexToRgba(theme.colors.bg.row, 0.5),
  },
  trackText: {
    flex: 1,
    justifyContent: 'center',
  },
  trackTitle: {
    color: theme.colors.text.primary,
    fontSize: 15,
    marginBottom: 4,
  },
  trackTitlePlaying: {
    color: theme.colors.accent.status,
  },
  trackArtist: {
    fontSize: 13,
    color: theme.colors.text.metadata,
  },
  trackDuration: {
    color: theme.colors.text.metadata,
    fontSize: 13,
    marginHorizontal: 12,
  },
  downloadBtn: {
    padding: 4,
  },
  empty: {
    textAlign: "center",
    color: theme.colors.text.muted,
    marginTop: 40,
    fontSize: 15,
  },
  searchBar: {
    width: "100%",
    marginTop: 24,
    padding: 12,
    backgroundColor: theme.colors.bg.surface,
    borderRadius: 12,
  },
  searchInput: {
    backgroundColor: "rgba(0, 0, 0, 0.15)",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    fontSize: 13,
    color: theme.colors.text.primary,
    borderWidth: 1,
    borderColor: "transparent",
  },
  searchResults: {
    marginTop: 8,
  },
  searchResultItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.default,
  },
  searchResultTitle: { fontSize: 15, fontWeight: "600", color: theme.colors.text.primary },
  searchResultArtist: { fontSize: 11, color: theme.colors.text.metadata },
});
