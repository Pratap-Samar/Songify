import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";
import type { Playlist } from "@/lib/database";

type PlaylistArtProps = {
  playlist: Playlist;
  size?: number;
  onEdit?: () => void;
};

export default function PlaylistArt({ playlist, size = 44, onEdit }: PlaylistArtProps) {
  const hasColor = !!playlist.coverColor;
  const isLiked = playlist.isSystem === 1;

  // The icon size should be roughly 45% of the container size
  const iconSize = size * 0.45;
  // The edit button size should scale but not be too large
  const editSize = Math.max(16, size * 0.25);

  const iconName = playlist.coverIcon || "musical-notes";

  return (
    <View style={[style.container, { width: size, height: size }]}>
      {hasColor ? (
        <View style={[style.artWrapper, { backgroundColor: playlist.coverColor! }]}>
          <Ionicons 
            name={iconName as any} 
            size={iconSize} 
            color={playlist.coverColor === theme.colors.bg.surface || playlist.coverColor === theme.colors.bg.row ? theme.colors.text.primary : theme.colors.text.onPrimary} 
          />
        </View>
      ) : (
        <View style={style.placeholderWrapper}>
          <Ionicons name={iconName as any} size={iconSize} color={theme.colors.text.secondary} />
        </View>
      )}

      {onEdit && !isLiked && (
        <TouchableOpacity style={[style.editButton, { width: editSize + 8, height: editSize + 8 }]} onPress={onEdit}>
          <View style={style.editIconBg}>
            <Ionicons name="pencil" size={editSize * 0.7} color={theme.colors.text.primary} />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const style = StyleSheet.create({
  container: {
    position: "relative",
    borderRadius: 6,
  },
  artWrapper: {
    flex: 1,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderWrapper: {
    flex: 1,
    borderRadius: 6,
    backgroundColor: theme.colors.bg.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  editButton: {
    position: "absolute",
    bottom: -4,
    right: -4,
    justifyContent: "center",
    alignItems: "center",
  },
  editIconBg: {
    backgroundColor: theme.colors.bg.page,
    borderRadius: 12,
    padding: 4,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
});
