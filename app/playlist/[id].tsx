import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePlaylists, type PlaylistTrackEntry } from "@/lib/usePlaylists";
import { searchTracks } from "@/lib/api";
import type { Track } from "@/lib/music";
import { theme } from "@/constants/theme";

export default function PlaylistDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const playlistId = Number(id);
  const { playlists, getTracks, addTrack, removeTrack, rename, loading } = usePlaylists();
  const [playlistTracks, setPlaylistTracks] = useState<PlaylistTrackEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [playlistName, setPlaylistName] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  const loadTracks = useCallback(async () => {
    const tracks = await getTracks(playlistId);
    setPlaylistTracks(tracks);
    const playlist = playlists.find((p) => p.id === playlistId);
    if (playlist) setPlaylistName(playlist.name);
  }, [playlistId, playlists, getTracks]);

  useEffect(() => {
    loadTracks();
  }, [playlistId, playlists, loadTracks]);

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

  const handleRename = async (newName: string) => {
    const trimmed = newName.trim();
    if (trimmed && trimmed !== playlistName && !loading) {
      const playlist = playlists.find((p) => p.id === playlistId);
      if (playlist) {
        await rename(playlist.id, trimmed);
        setPlaylistName(trimmed);
      }
    }
  };

  useEffect(() => {
    const load = async () => {
      const tracks = await getTracks(playlistId);
      setPlaylistTracks(tracks);
      const playlist = playlists.find((p) => p.id === playlistId);
      if (playlist) setPlaylistName(playlist.name);
    };
    load();
  }, [playlistId, playlists, getTracks, loadTracks]);

  return (
    <View style={style.container}>
      <View style={style.header}>
        <TouchableOpacity onPress={goBack}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <TextInput
          style={style.titleInput}
          value={playlistName}
          onChangeText={setPlaylistName}
          onBlur={() => handleRename(playlistName)}
          placeholder="Playlist name"
          placeholderTextColor={theme.colors.text.secondary}
        />
      </View>
      <FlatList
        data={playlistTracks}
        keyExtractor={(item) => `${playlistId}-${item.videoId}`}
        ListHeaderComponent={
          <TouchableOpacity
            style={style.searchToggle}
            onPress={() => setShowSearch(!showSearch)}
          >
            <Ionicons name="add" size={20} color={theme.colors.accent.link} />
            <Text style={style.searchToggleText}>Add track</Text>
          </TouchableOpacity>
        }
        ListHeaderComponentStyle={style.searchSection}
        ListEmptyComponent={
          <Text style={style.empty}>No tracks in this playlist yet.</Text>
        }
        renderItem={({ item, index }) => (
          <View style={style.trackItem}>
            <View style={style.trackInfo}>
              {item.thumbnailUrl && (
                <Image
                  source={{ uri: item.thumbnailUrl }}
                  style={style.trackThumb}
                />
              )}
              <View style={style.trackText}>
                <Text numberOfLines={1} style={style.trackTitle}>
                  {item.title}
                </Text>
                <Text numberOfLines={1} style={style.trackArtist}>
                  {item.artists.join(", ")}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => handleRemoveTrack(item.videoId)}>
              <Ionicons name="close-circle" size={22} color={theme.colors.text.secondary} />
            </TouchableOpacity>
          </View>
        )}
      />
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
          />
        </View>
      )}
    </View>
  );
}

const style = StyleSheet.create({
  container: { 
    ...StyleSheet.absoluteFillObject, 
    overflow: "hidden",
    backgroundColor: theme.colors.bg.page,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  titleInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.text.primary,
  },
  searchSection: { paddingHorizontal: 16, paddingBottom: 8 },
  searchToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
  },
  searchToggleText: { color: theme.colors.accent.link, fontSize: 14, fontWeight: "600" },
  searchBar: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
    padding: 12,
    backgroundColor: theme.colors.bg.surface,
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
    maxHeight: 200,
    marginTop: 8,
  },
  searchResultItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  searchResultTitle: { fontSize: 14, fontWeight: "600", color: theme.colors.text.primary },
  searchResultArtist: { fontSize: 12, color: theme.colors.text.secondary },
  trackItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.bg.row,
    padding: 10,
    marginHorizontal: 16,
    marginBottom: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  trackInfo: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  trackThumb: { width: 44, height: 44, borderRadius: 6 },
  trackText: { flex: 1 },
  trackTitle: { fontSize: 14, fontWeight: "600", color: theme.colors.text.primary },
  trackArtist: { fontSize: 12, color: theme.colors.text.secondary },
  empty: { textAlign: "center", color: theme.colors.text.secondary, marginTop: 40, fontSize: 15 },
});
