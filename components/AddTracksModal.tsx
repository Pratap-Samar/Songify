import React, { useState, useEffect, useRef } from "react";
import { Modal, StyleSheet, Text, TextInput, View, FlatList, KeyboardAvoidingView, Platform, Pressable, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import type { Track } from "@/lib/music";
import { theme } from "@/constants/theme";
import { PressableScale } from "./PressableScale";
import { searchTracks } from "@/lib/api";
import { addTrackToPlaylist } from "@/lib/database";
import { useResponsive } from "@/lib/useResponsive";

type AddTracksModalProps = {
  visible: boolean;
  playlistId: number;
  existingTrackIds: Set<string>;
  onClose: () => void;
};

export default function AddTracksModal({ visible, playlistId, existingTrackIds, onClose }: AddTracksModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [addedTrackIds, setAddedTrackIds] = useState<Set<string>>(new Set());

  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const { baseSize } = useResponsive();

  useEffect(() => {
    if (!visible) {
      setSearchQuery("");
      setSearchResults([]);
      setAddedTrackIds(new Set());
    }
  }, [visible]);

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (text.trim().length < 2) {
      setSearchResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const results = await searchTracks(text.trim());
        setSearchResults(results.songs);
      } catch (e) {
        console.error("Search failed:", e);
        setSearchResults([]);
      } finally {
        setLoading(false);
      }
    }, 500);
  };

  const handleAddTrack = async (track: Track) => {
    // Optimistic UI update
    setAddedTrackIds((prev) => {
      const next = new Set(prev);
      next.add(track.videoId);
      return next;
    });

    try {
      await addTrackToPlaylist(playlistId, track);
    } catch (e) {
      console.error("[AddTracksModal] Failed to add track:", e);
      // Revert optimistic update
      setAddedTrackIds((prev) => {
        const next = new Set(prev);
        next.delete(track.videoId);
        return next;
      });
      Alert.alert("Error", "Failed to add track to playlist.");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <KeyboardAvoidingView 
        style={style.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={style.modalDismiss} onPress={onClose} />
        
        <View style={style.modalContent}>
          <LinearGradient colors={[theme.colors.bg.surface, theme.colors.bg.page]} style={style.gradientBg}>
            <View style={style.header}>
              <Text style={style.title}>Add to Playlist</Text>
              <PressableScale onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="close" size={24} color={theme.colors.text.primary} />
              </PressableScale>
            </View>

            <View style={style.searchContainer}>
              <Ionicons name="search" size={20} color={theme.colors.text.secondary} style={style.searchIcon} />
              <TextInput
                style={style.searchInput}
                placeholder="Search for songs..."
                placeholderTextColor={theme.colors.text.secondary}
                value={searchQuery}
                onChangeText={handleSearchChange}
                autoFocus
                returnKeyType="search"
              />
            </View>

            {loading ? (
              <View style={style.center}>
                <ActivityIndicator size="large" color={theme.colors.accent.primary} />
              </View>
            ) : (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.videoId}
                style={style.list}
                ListEmptyComponent={
                  searchQuery.trim().length >= 2 ? (
                    <Text style={style.empty}>No results found.</Text>
                  ) : null
                }
                renderItem={({ item }) => {
                  const isAdded = existingTrackIds.has(item.videoId) || addedTrackIds.has(item.videoId);

                  return (
                    <View style={style.trackRow}>
                      {item.thumbnailUrl && (
                        <Image source={{ uri: item.thumbnailUrl }} style={style.thumbnail} />
                      )}
                      <View style={style.trackInfo}>
                        <Text style={[style.trackTitle, { fontSize: baseSize }]} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={[style.trackArtist, { fontSize: baseSize * 0.85 }]} numberOfLines={1}>
                          {item.artists.join(", ")}
                        </Text>
                      </View>
                      
                      {isAdded ? (
                        <View style={style.iconContainer}>
                          <Ionicons name="checkmark-circle" size={26} color={theme.colors.accent.status} />
                        </View>
                      ) : (
                        <PressableScale 
                          style={style.iconContainer} 
                          onPress={() => handleAddTrack(item)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Ionicons name="add-circle" size={26} color={theme.colors.accent.primary} />
                        </PressableScale>
                      )}
                    </View>
                  );
                }}
              />
            )}
          </LinearGradient>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const style = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  modalDismiss: {
    flex: 1,
  },
  modalContent: {
    height: "85%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  gradientBg: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: theme.colors.text.primary,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.bg.row,
    marginHorizontal: 16,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border.default,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.text.primary,
    fontSize: 16,
    paddingVertical: 12,
  },
  list: {
    flex: 1,
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.default,
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: theme.colors.bg.row,
  },
  trackInfo: {
    flex: 1,
    justifyContent: "center",
  },
  trackTitle: {
    color: theme.colors.text.primary,
    fontWeight: "500",
    marginBottom: 4,
  },
  trackArtist: {
    color: theme.colors.text.secondary,
  },
  iconContainer: {
    padding: 4,
    marginLeft: 12,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  empty: {
    color: theme.colors.text.secondary,
    textAlign: "center",
    marginTop: 40,
    fontSize: 16,
  },
});
