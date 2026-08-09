import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState, useMemo } from "react";
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePlaylists, type PlaylistTrackEntry } from "@/lib/usePlaylists";
import type { Playlist } from "@/lib/database";
import { searchTracks } from "@/lib/api";
import type { Track } from "@/lib/music";
import { theme } from "@/constants/theme";
import { useResponsive } from "@/lib/useResponsive";
import { useActiveTrack, useShuffleMode } from "@/hooks/usePlaybackState";
import { playCollection } from "@/lib/playback";
import PlaylistArt from "@/components/PlaylistArt";
import EditPlaylistArtModal from "@/components/EditPlaylistArtModal";
import NowPlayingBar from "@/components/NowPlayingBar";
import { subscribeToPlaylistChanges } from "@/lib/playlistEvents";

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
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [isEditingArt, setIsEditingArt] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState("");

  const { contentMaxWidth, titleSize, baseSize } = useResponsive();
  const shuffleEnabled = useShuffleMode();
  const { track: activeTrack, isPlaying } = useActiveTrack();

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
    }
  }, [playlistId, playlists]);

  useEffect(() => {
    loadTracks();
    return subscribeToPlaylistChanges(loadTracks);
  }, [loadTracks]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 3) {
      setSearchResults([]);
      return;
    }
    try {
      const results = await searchTracks(query.trim());
      setSearchResults(results.songs);
    } catch {
      setSearchResults([]);
    }
  };

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

  const handlePlayPlaylist = () => {
    if (!playlist || playlistTracks.length === 0) return;
    playCollection({
      type: "playlist",
      id: String(playlist.id),
      title: playlist.name,
      artwork: undefined, // Playlist art is rendered via PlaylistArt, not standard URL
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
      <TouchableOpacity style={style.headerBack} onPress={goBack}>
        <Ionicons name="chevron-back" size={28} color={theme.colors.text.primary} />
      </TouchableOpacity>
      
      <View style={style.artworkWrapper}>
        <PlaylistArt 
          playlist={playlist} 
          size={180} 
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
        <TouchableOpacity 
          onPress={() => !playlist.isSystem && setEditingTitle(true)}
          disabled={!!playlist.isSystem}
        >
          <Text style={[style.title, { fontSize: titleSize }]} numberOfLines={2}>
            {playlist.name}
          </Text>
        </TouchableOpacity>
      )}
      
      <Text style={[style.artist, { fontSize: baseSize, color: theme.colors.accent.link }]}>
        Playlist
      </Text>
      
      <Text style={[style.metadata, { fontSize: baseSize * 0.85 }]}>
        {playlistTracks.length} Songs
        {totalDurationStr ? ` • ${totalDurationStr}` : ""}
      </Text>

      <View style={style.controlsRow}>
        <TouchableOpacity style={style.playButton} onPress={handlePlayPlaylist}>
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

        <TouchableOpacity style={style.actionButton} onPress={() => setShowSearch(!showSearch)}>
          <Ionicons
            name="add"
            size={24}
            color={theme.colors.text.secondary}
          />
        </TouchableOpacity>
      </View>

      {/* Add Track Search Section */}
      {showSearch && (
        <View style={style.searchBar}>
          <TextInput
            style={style.searchInput}
            placeholder="Search to add..."
            placeholderTextColor={theme.colors.text.secondary}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.videoId}
            style={style.searchResults}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={style.searchResultItem}
                onPress={() => handleAddTrack(item)}
              >
                <Text numberOfLines={1} style={style.searchResultTitle}>
                  {item.title}
                </Text>
                <Text style={style.searchResultArtist}>
                  {item.artists.join(", ")}
                </Text>
              </TouchableOpacity>
            )}
            scrollEnabled={false}
          />
        </View>
      )}
    </View>
  );

  const TrackRowItem = ({ item, index, isCurrentlyPlaying, isPlaying, handlePlayTrack }: any) => {
    const titleColor = isCurrentlyPlaying ? theme.colors.accent.status : theme.colors.text.primary;
    return (
      <TouchableOpacity style={style.trackRow} onPress={() => handlePlayTrack(index)}>
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
              <Text
                style={[style.trackTitle, { fontSize: baseSize, color: titleColor }]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              <Text style={[style.trackArtist, { fontSize: baseSize * 0.85 }]} numberOfLines={1}>
                {item.artists}
              </Text>
            </View>
          </View>
        
          <Text style={style.trackDuration}>
            {formatDuration(item.durationMs)}
          </Text>
        </View>
        <TouchableOpacity style={style.downloadBtn} onPress={() => handleRemoveTrack(item.videoId)}>
          <Ionicons 
            name="close-circle" 
            size={24} 
            color={theme.colors.text.secondary} 
          />
        </TouchableOpacity>
      </TouchableOpacity>
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

  return (
    <View style={style.container}>
      <FlatList
        data={playlistTracks}
        keyExtractor={(item) => `${playlistId}-${item.videoId}`}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <Text style={style.empty}>No tracks in this playlist yet.</Text>
        }
        renderItem={renderTrack}
        contentContainerStyle={[style.listContent, { paddingBottom: 100 }]}
      />
      <EditPlaylistArtModal
        visible={isEditingArt}
        onClose={() => setIsEditingArt(false)}
        playlist={playlist}
      />
      <View style={[style.miniPlayerContainer, { maxWidth: contentMaxWidth }]}>
        <NowPlayingBar withSafeArea={true} />
      </View>
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
  artworkWrapper: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 10,
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
    color: theme.colors.text.secondary,
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 24,
    gap: 8,
  },
  playButtonText: {
    color: theme.colors.text.onPrimary,
    fontSize: 16,
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
    paddingHorizontal: 20,
  },
  trackNumberContainer: {
    width: 32,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  trackNumber: {
    color: theme.colors.text.secondary,
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
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  trackText: {
    flex: 1,
    justifyContent: 'center',
  },
  trackTitle: {
    color: theme.colors.text.primary,
    fontSize: 16,
    marginBottom: 4,
  },
  trackTitlePlaying: {
    color: theme.colors.accent.status,
  },
  trackArtist: {
    color: theme.colors.text.secondary,
    fontSize: 14,
  },
  trackDuration: {
    color: theme.colors.text.secondary,
    fontSize: 14,
    marginHorizontal: 12,
  },
  downloadBtn: {
    padding: 4,
  },
  empty: {
    textAlign: "center",
    color: theme.colors.text.secondary,
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
    fontSize: 14,
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
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  searchResultTitle: { fontSize: 14, fontWeight: "600", color: theme.colors.text.primary },
  searchResultArtist: { fontSize: 12, color: theme.colors.text.secondary },
});
