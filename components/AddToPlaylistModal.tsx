import React, { useState, useEffect } from "react";
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View, FlatList, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { usePlaylists } from "@/lib/usePlaylists";
import { getPlaylistIdsForTrack, addTrackToPlaylist, removeTrackFromPlaylist } from "@/lib/database";
import type { Track } from "@/lib/music";
import { theme } from "@/constants/theme";
import PlaylistArt from "./PlaylistArt";

type AddToPlaylistModalProps = {
  visible: boolean;
  track: Track | null;
  onClose: () => void;
};

export default function AddToPlaylistModal({ visible, track, onClose }: AddToPlaylistModalProps) {
  const { playlists, create } = usePlaylists();
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (visible && track) {
      getPlaylistIdsForTrack(track.videoId).then((ids) => {
        setSelectedPlaylistIds(ids);
      });
    } else {
      setSelectedPlaylistIds(new Set());
    }
  }, [visible, track]);

  const togglePlaylist = async (playlistId: number) => {
    if (!track) return;
    
    // Optimistic UI update
    const isSelected = selectedPlaylistIds.has(playlistId);
    setSelectedPlaylistIds(prev => {
      const next = new Set(prev);
      if (isSelected) next.delete(playlistId);
      else next.add(playlistId);
      return next;
    });

    // Background DB write
    try {
      if (isSelected) {
        await removeTrackFromPlaylist(playlistId, track.videoId);
      } else {
        await addTrackToPlaylist(playlistId, track);
      }
    } catch (e) {
      console.error("[AddToPlaylistModal] Failed to toggle track in playlist:", e);
      // Revert optimistic update on error
      setSelectedPlaylistIds(prev => {
        const next = new Set(prev);
        if (isSelected) next.add(playlistId);
        else next.delete(playlistId);
        return next;
      });
    }
  };

  const handleCreate = async () => {
    const trimmed = newPlaylistName.trim();
    if (trimmed && track) {
      const newPlaylist = await create(trimmed);
      if (newPlaylist) {
        // Optimistically add the new ID
        setSelectedPlaylistIds(prev => new Set(prev).add(newPlaylist.id));
        await addTrackToPlaylist(newPlaylist.id, track);
        setNewPlaylistName("");
      }
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <KeyboardAvoidingView 
        style={style.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableOpacity style={style.modalDismiss} activeOpacity={1} onPress={onClose} />
        
        <View style={style.modalContent}>
          <LinearGradient colors={[theme.colors.bg.surface, theme.colors.bg.page]} style={style.gradientBg}>
            <View style={style.header}>
              <Text style={style.title}>Add to Playlist</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color={theme.colors.text.primary} />
              </TouchableOpacity>
            </View>

            <View style={style.inputRow}>
              <TextInput
                style={style.input}
                value={newPlaylistName}
                onChangeText={setNewPlaylistName}
                placeholder="New playlist name"
                placeholderTextColor={theme.colors.text.secondary}
                onSubmitEditing={handleCreate}
              />
              <TouchableOpacity style={style.createBtn} onPress={handleCreate}>
                <Ionicons name="add" size={22} color={theme.colors.text.onPrimary} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={playlists}
              keyExtractor={(item) => String(item.id)}
              style={style.list}
              ListEmptyComponent={<Text style={style.empty}>No playlists yet.</Text>}
              renderItem={({ item }) => {
                const isSelected = selectedPlaylistIds.has(item.id);
                const isLikedSongs = item.isSystem === 1 && item.name === "Liked Songs";

                return (
                  <TouchableOpacity
                    style={[style.item, isSelected && style.itemSelected]}
                    onPress={() => togglePlaylist(item.id)}
                    activeOpacity={0.7}
                  >
                    {isLikedSongs ? (
                      <Ionicons 
                        name={isSelected ? "heart" : "heart-outline"} 
                        size={22} 
                        color={isSelected ? theme.colors.accent.primary : theme.colors.text.secondary} 
                      />
                    ) : (
                      <Ionicons 
                        name={isSelected ? "checkmark-circle" : "ellipse-outline"} 
                        size={22} 
                        color={isSelected ? theme.colors.accent.primary : theme.colors.text.secondary} 
                      />
                    )}
                    <PlaylistArt playlist={item} size={36} />
                    <Text style={[style.itemTitle, isSelected && style.itemTitleSelected]}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
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
    height: "60%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  gradientBg: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.text.primary,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.bg.row,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 15,
    color: theme.colors.text.primary,
    borderWidth: 1,
    borderColor: "transparent",
  },
  createBtn: {
    backgroundColor: theme.colors.accent.primary,
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  list: {
    flex: 1,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.colors.bg.row,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  itemSelected: {
    borderColor: theme.colors.accent.primary + "40",
    backgroundColor: theme.colors.accent.primary + "10",
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: theme.colors.text.primary,
  },
  itemTitleSelected: {
    color: theme.colors.accent.primary,
  },
  empty: {
    textAlign: "center",
    color: theme.colors.text.secondary,
    marginTop: 40,
    fontSize: 15,
  },
});
