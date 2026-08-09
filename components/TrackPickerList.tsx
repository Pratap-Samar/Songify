import React, { useState } from "react";
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { searchTracks } from "@/lib/api";
import type { Track } from "@/lib/music";
import { theme } from "@/constants/theme";

interface TrackPickerListProps {
  onSelectTrack: (track: Track) => void;
  style?: StyleProp<ViewStyle>;
  placeholder?: string;
}

export default function TrackPickerList({ onSelectTrack, style, placeholder = "Search for a track..." }: TrackPickerListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Track[]>([]);

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

  return (
    <View style={[styles.container, style]}>
      <TextInput
        style={styles.searchInput}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.text.secondary}
        value={searchQuery}
        onChangeText={handleSearch}
      />
      <FlatList
        data={searchResults}
        keyExtractor={(item) => item.videoId}
        style={styles.searchResults}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.searchResultItem}
            onPress={() => onSelectTrack(item)}
          >
            <Text numberOfLines={1} style={styles.searchResultTitle}>
              {item.title}
            </Text>
            <Text style={styles.searchResultArtist}>
              {item.artists.join(", ")}
            </Text>
          </TouchableOpacity>
        )}
        scrollEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  searchInput: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    color: theme.colors.text.primary,
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 8,
  },
  searchResults: {
    maxHeight: 300,
  },
  searchResultItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  searchResultTitle: {
    color: theme.colors.text.primary,
    fontSize: 16,
    marginBottom: 4,
  },
  searchResultArtist: {
    color: theme.colors.text.secondary,
    fontSize: 14,
  },
});
