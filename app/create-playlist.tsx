import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { theme } from "@/constants/theme";
import { useResponsive } from "@/lib/useResponsive";
import { createPlaylist } from "@/lib/database";
import { usePlaylists } from "@/lib/usePlaylists";
import PlaylistArt from "@/components/PlaylistArt";
import TrackPickerList from "@/components/TrackPickerList";
import { PressableScale } from "@/components/PressableScale";
import type { Track } from "@/lib/music";

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

export default function CreatePlaylistScreen() {
  const router = useRouter();
  const { addTrack } = usePlaylists();
  const { contentMaxWidth } = useResponsive();

  const [name, setName] = useState("");
  const [icon, setIcon] = useState(ICONS[0] as string);
  const [color, setColor] = useState(COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [selectedTracks, setSelectedTracks] = useState<Track[]>([]);

  const handleAddTrack = (track: Track) => {
    if (!selectedTracks.find(t => t.videoId === track.videoId)) {
      setSelectedTracks([...selectedTracks, track]);
    }
  };

  const handleRemoveTrack = (videoId: string) => {
    setSelectedTracks(selectedTracks.filter(t => t.videoId !== videoId));
  };

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setSaving(true);
    try {
      const playlist = await createPlaylist(trimmedName, 0, icon, color);
      
      // Add all selected tracks to the new playlist
      for (const track of selectedTracks) {
        await addTrack(playlist.id, track);
      }
      
      router.dismissAll();
      router.replace(`/playlist/${playlist.id}`);
    } catch (e) {
      console.error("[CreatePlaylist] failed:", e);
      setSaving(false);
    }
  };

  const previewPlaylist: any = {
    id: 0,
    name: name || "New Playlist",
    isSystem: 0,
    coverIcon: icon,
    coverColor: color,
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"} 
        style={styles.keyboardView}
      >
        <View style={[styles.header, { maxWidth: contentMaxWidth }]}>
          <PressableScale onPress={() => router.back()} style={styles.headerBtn}>
            <Text style={styles.headerBtnTextCancel}>Cancel</Text>
          </PressableScale>
          <Text style={styles.title}>New Playlist</Text>
          <PressableScale 
            onPress={handleCreate} 
            style={[styles.headerBtn, !name.trim() && styles.headerBtnDisabled]}
            disabled={!name.trim() || saving}
          >
            <Text style={[styles.headerBtnTextSave, !name.trim() && styles.headerBtnTextDisabled]}>
              {saving ? "Creating..." : "Create"}
            </Text>
          </PressableScale>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { maxWidth: contentMaxWidth }]}>
          
          <View style={styles.previewContainer}>
            <PlaylistArt playlist={previewPlaylist} size={160} />
          </View>

          <View style={styles.inputSection}>
            <TextInput
              style={styles.nameInput}
              placeholder="Playlist Name"
              placeholderTextColor={theme.colors.text.secondary}
              value={name}
              onChangeText={setName}
              autoFocus
            />
          </View>

          <Text style={styles.label}>Choose an Icon</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.iconScroll} contentContainerStyle={styles.iconContainer}>
            {ICONS.map((i) => (
              <PressableScale
                key={i}
                style={[
                  styles.iconSwatch,
                  icon === i && styles.iconSwatchSelected,
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

          <Text style={styles.label}>Choose a Color</Text>
          <View style={styles.colorGrid}>
            {COLORS.map((c) => (
              <PressableScale
                key={c}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: c },
                  color === c && styles.colorSwatchSelected,
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

          <View style={styles.tracksSection}>
            <Text style={styles.label}>Add Tracks ({selectedTracks.length})</Text>
            
            {selectedTracks.length > 0 && (
              <View style={styles.selectedTracksContainer}>
                {selectedTracks.map(track => (
                  <View key={track.videoId} style={styles.selectedTrackRow}>
                    <View style={styles.selectedTrackInfo}>
                      <Text style={styles.selectedTrackTitle} numberOfLines={1}>{track.title}</Text>
                      <Text style={styles.selectedTrackArtist} numberOfLines={1}>{track.artists.join(", ")}</Text>
                    </View>
                    <PressableScale onPress={() => handleRemoveTrack(track.videoId)} style={styles.removeBtn}>
                      <Ionicons name="remove-circle" size={24} color={theme.colors.accent.primary} />
                    </PressableScale>
                  </View>
                ))}
              </View>
            )}

            <TrackPickerList 
              onSelectTrack={handleAddTrack} 
              placeholder="Search to add tracks..." 
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg.page,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
    width: "100%",
    alignSelf: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: theme.colors.text.primary,
  },
  headerBtn: {
    padding: 8,
  },
  headerBtnDisabled: {
    opacity: 0.5,
  },
  headerBtnTextCancel: {
    fontSize: 16,
    color: theme.colors.text.secondary,
  },
  headerBtnTextSave: {
    fontSize: 16,
    fontWeight: "bold",
    color: theme.colors.accent.primary,
  },
  headerBtnTextDisabled: {
    color: theme.colors.text.secondary,
  },
  scrollView: {
    flex: 1,
    width: "100%",
  },
  scrollContent: {
    alignSelf: "center",
    width: "100%",
    padding: 24,
    paddingBottom: 40,
  },
  previewContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  inputSection: {
    marginBottom: 24,
  },
  nameInput: {
    fontSize: 24,
    fontWeight: "bold",
    color: theme.colors.text.primary,
    borderBottomWidth: 2,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
    paddingVertical: 8,
    textAlign: "center",
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
    marginBottom: 24,
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
  tracksSection: {
    marginTop: 8,
  },
  selectedTracksContainer: {
    marginBottom: 16,
    backgroundColor: theme.colors.bg.surface,
    borderRadius: 12,
    padding: 12,
  },
  selectedTrackRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  selectedTrackInfo: {
    flex: 1,
    marginRight: 12,
  },
  selectedTrackTitle: {
    color: theme.colors.text.primary,
    fontSize: 16,
    marginBottom: 4,
  },
  selectedTrackArtist: {
    color: theme.colors.text.secondary,
    fontSize: 14,
  },
  removeBtn: {
    padding: 4,
  },
});
