import React, { useState } from "react";
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View, FlatList, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { usePlaylists } from "@/lib/usePlaylists";
import type { Track } from "@/lib/music";

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
          <LinearGradient colors={["#24283b", "#1f2335"]} style={style.gradientBg}>
            <View style={style.header}>
              <Text style={style.title}>Add to Playlist</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color="#c0caf5" />
              </TouchableOpacity>
            </View>

            <View style={style.inputRow}>
              <TextInput
                style={style.input}
                value={newPlaylistName}
                onChangeText={setNewPlaylistName}
                placeholder="New playlist name"
                placeholderTextColor="#565f89"
                onSubmitEditing={handleCreate}
              />
              <TouchableOpacity style={style.createBtn} onPress={handleCreate}>
                <Ionicons name="add" size={22} color="#1a1b26" />
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
                  <Ionicons name="musical-notes" size={20} color="#ff9e64" />
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
    color: "#c0caf5",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 15,
    color: "#c0caf5",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  createBtn: {
    backgroundColor: "#ff9e64",
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
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.02)",
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#c0caf5",
  },
  empty: {
    textAlign: "center",
    color: "#565f89",
    marginTop: 40,
    fontSize: 15,
  },
});
