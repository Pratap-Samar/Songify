import React, { useState } from "react";
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View, FlatList, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { usePlaylists } from "@/lib/usePlaylists";
import type { Track } from "@/lib/music";
import { theme } from "@/constants/theme";

type AddToPlaylistModalProps = {
  visible: boolean;
  track: Track | null;
  onClose: () => void;
};

export default function AddToPlaylistModal({ visible, track, onClose }: AddToPlaylistModalProps) {
  const { playlists, addTrack, create } = usePlaylists();
  const [newPlaylistName, setNewPlaylistName] = useState("");

  const handleAdd = async (playlistId: number) => {
    if (track) {
      await addTrack(playlistId, track);
      onClose();
    }
  };

  const handleCreate = async () => {
    const trimmed = newPlaylistName.trim();
    if (trimmed && track) {
      const newPlaylist = await create(trimmed);
      if (newPlaylist) {
        await addTrack(newPlaylist.id, track);
        setNewPlaylistName("");
        onClose();
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
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={style.item}
                  onPress={() => handleAdd(item.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="musical-notes" size={20} color={theme.colors.accent.primary} />
                  <Text style={style.itemTitle}>{item.name}</Text>
                </TouchableOpacity>
              )}
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
  itemTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: theme.colors.text.primary,
  },
  empty: {
    textAlign: "center",
    color: theme.colors.text.secondary,
    marginTop: 40,
    fontSize: 15,
  },
});
