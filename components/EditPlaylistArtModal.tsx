import React, { useState, useEffect } from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity, TouchableWithoutFeedback, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";
import PlaylistArt from "./PlaylistArt";
import type { Playlist } from "@/lib/database";
import { updatePlaylistArt } from "@/lib/database";
import { useResponsive } from "@/lib/useResponsive";

const COLORS = [
  theme.colors.accent.primary,
  theme.colors.accent.secondary,
  theme.colors.accent.link,
  theme.colors.accent.premium,
  theme.colors.bg.surface,
  theme.colors.bg.row,
];

type EditPlaylistArtModalProps = {
  visible: boolean;
  onClose: () => void;
  playlist: Playlist | null;
};

export default function EditPlaylistArtModal({ visible, onClose, playlist }: EditPlaylistArtModalProps) {
  const [emoji, setEmoji] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [saving, setSaving] = useState(false);
  const { contentMaxWidth } = useResponsive();

  useEffect(() => {
    if (visible && playlist) {
      setEmoji(playlist.coverEmoji || "");
      setColor(playlist.coverColor || COLORS[0]);
    }
  }, [visible, playlist]);

  if (!playlist) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updatePlaylistArt(playlist.id, emoji || null, color);
      onClose();
    } catch (e) {
      console.error("[EditPlaylistArtModal] save failed:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleEmojiChange = (text: string) => {
    // Extract first full grapheme cluster to safely handle complex compound emojis
    const graphemes = Array.from(text);
    if (graphemes.length > 0) {
      setEmoji(graphemes[0]);
    } else {
      setEmoji("");
    }
  };

  // Preview object matching the Playlist interface for the PlaylistArt component
  const previewPlaylist: Playlist = {
    ...playlist,
    coverEmoji: emoji || null,
    coverColor: color,
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={style.overlay}>
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView 
              behavior={Platform.OS === "ios" ? "padding" : "height"} 
              style={[style.sheet, { maxWidth: contentMaxWidth, alignSelf: "center", width: "100%" }]}
            >
              <View style={style.header}>
                <Text style={style.title}>Edit Playlist Art</Text>
                <TouchableOpacity onPress={onClose} style={style.closeBtn}>
                  <Ionicons name="close" size={24} color={theme.colors.text.secondary} />
                </TouchableOpacity>
              </View>

              <View style={style.previewContainer}>
                <PlaylistArt playlist={previewPlaylist} size={140} />
              </View>

              <Text style={style.label}>Choose an Emoji</Text>
              <View style={style.emojiInputContainer}>
                <TextInput
                  style={style.emojiInput}
                  value={emoji}
                  onChangeText={handleEmojiChange}
                  placeholder="😀"
                  placeholderTextColor={theme.colors.text.secondary}
                  autoCorrect={false}
                  selectTextOnFocus
                />
              </View>

              <Text style={style.label}>Choose a Color</Text>
              <View style={style.colorGrid}>
                {COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      style.colorSwatch,
                      { backgroundColor: c },
                      color === c && style.colorSwatchSelected,
                    ]}
                    onPress={() => setColor(c)}
                  >
                    {color === c && (
                      <Ionicons 
                        name="checkmark" 
                        size={20} 
                        color={c === theme.colors.bg.surface || c === theme.colors.bg.row ? theme.colors.text.primary : theme.colors.text.onPrimary} 
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={style.saveButton} onPress={handleSave} disabled={saving}>
                <Text style={style.saveButtonText}>{saving ? "Saving..." : "Save"}</Text>
              </TouchableOpacity>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const style = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: theme.colors.bg.page,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: theme.colors.text.primary,
  },
  closeBtn: {
    padding: 4,
  },
  previewContainer: {
    alignItems: "center",
    marginVertical: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.text.primary,
    marginBottom: 12,
    marginTop: 16,
  },
  emojiInputContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  emojiInput: {
    fontSize: 48,
    textAlign: "center",
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: theme.colors.bg.surface,
    color: theme.colors.text.primary,
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 32,
  },
  colorSwatch: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorSwatchSelected: {
    borderColor: theme.colors.text.primary,
  },
  saveButton: {
    backgroundColor: theme.colors.accent.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  saveButtonText: {
    color: theme.colors.text.onPrimary,
    fontSize: 16,
    fontWeight: "600",
  },
});
