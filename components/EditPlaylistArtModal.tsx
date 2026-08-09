import React, { useState, useEffect } from "react";
import { Modal, View, Text, StyleSheet, TouchableWithoutFeedback, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";
import PlaylistArt from "./PlaylistArt";
import type { Playlist } from "@/lib/database";
import { updatePlaylistArt } from "@/lib/database";
import { useResponsive } from "@/lib/useResponsive";
import { PressableScale } from "./PressableScale";

const COLORS = [
  theme.colors.accent.primary,
  theme.colors.accent.secondary,
  theme.colors.accent.link,
  theme.colors.accent.premium,
  theme.colors.accent.like,
  theme.colors.accent.status,
  theme.colors.text.primary,
  "#f7768e", // Tokyo Night red
  "#000000", // Black
  theme.colors.bg.row, // Background
  "#ff8c00", // Dark Orange
  "#ff1493", // Deep Pink
  "#00fa9a", // Medium Spring Green
  "#1e90ff", // Dodger Blue
  "#8a2be2", // Blue Violet
  "#ffffff", // White
];

const ICONS = [
  "musical-notes",
  "headset",
  "radio",
  "flame",
  "star",
  "moon",
  "sunny",
  "disc",
  "car",
  "cafe",
  "fitness",
  "book",
  "airplane",
  "boat",
  "bicycle",
  "bonfire",
  "business",
  "camera",
  "color-palette",
  "game-controller",
  "globe",
  "heart-outline",
  "leaf",
  "paw",
] as const;

type EditPlaylistArtModalProps = {
  visible: boolean;
  onClose: () => void;
  playlist: Playlist | null;
};

export default function EditPlaylistArtModal({ visible, onClose, playlist }: EditPlaylistArtModalProps) {
  const [icon, setIcon] = useState(ICONS[0] as string);
  const [color, setColor] = useState(COLORS[0]);
  const [saving, setSaving] = useState(false);
  const { contentMaxWidth } = useResponsive();

  useEffect(() => {
    if (visible && playlist) {
      setIcon(playlist.coverIcon || playlist.coverEmoji || ICONS[0]);
      setColor(playlist.coverColor || COLORS[0]);
    }
  }, [visible, playlist]);

  if (!playlist) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updatePlaylistArt(playlist.id, icon, color);
      onClose();
    } catch (e) {
      console.error("[EditPlaylistArtModal] save failed:", e);
    } finally {
      setSaving(false);
    }
  };

  // Preview object matching the Playlist interface for the PlaylistArt component
  const previewPlaylist: Playlist = {
    ...playlist,
    coverIcon: icon,
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
                <PressableScale onPress={onClose} style={style.closeBtn}>
                  <Ionicons name="close" size={24} color={theme.colors.text.secondary} />
                </PressableScale>
              </View>

              <View style={style.previewContainer}>
                <PlaylistArt playlist={previewPlaylist} size={140} />
              </View>

              <Text style={style.label}>Choose an Icon</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={style.iconScroll} contentContainerStyle={style.iconContainer}>
                {ICONS.map((i) => (
                  <PressableScale
                    key={i}
                    style={[
                      style.iconSwatch,
                      icon === i && style.iconSwatchSelected,
                    ]}
                    onPress={() => setIcon(i)}
                  >
                    <Ionicons 
                      name={i as any} 
                      size={28} 
                      color={icon === i ? theme.colors.text.primary : theme.colors.text.secondary} 
                    />
                  </PressableScale>
                ))}
              </ScrollView>

              <Text style={style.label}>Choose a Color</Text>
              <View style={style.colorGrid}>
                {COLORS.map((c) => (
                  <PressableScale
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
                  </PressableScale>
                ))}
              </View>

              <PressableScale style={style.saveButton} onPress={handleSave} disabled={saving}>
                <Text style={style.saveButtonText}>{saving ? "Saving..." : "Save"}</Text>
              </PressableScale>
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
  iconScroll: {
    marginBottom: 16,
  },
  iconContainer: {
    flexDirection: "row",
    gap: 12,
  },
  iconSwatch: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: theme.colors.bg.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  iconSwatchSelected: {
    borderColor: theme.colors.text.primary,
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
