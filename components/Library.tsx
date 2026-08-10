import { ActivityIndicator, SectionList, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import type { Track, AlbumSearchItem } from "@/lib/music";
import { theme } from "@/constants/theme";
import { useTabBarHeight } from "@/lib/TabBarHeightContext";
import { TrackRow } from "./TrackRow";

type LibraryProps = {
  songs: Track[];
  albums?: AlbumSearchItem[];
  isSearching: boolean;
  error: string | null;
  query: string;
  onPressSong: (track: Track) => void;
  onPressAlbum?: (album: AlbumSearchItem) => void;
  currentTrackId?: string;
};

export default function Library({ songs, albums = [], isSearching, error, query, onPressSong, onPressAlbum, currentTrackId }: LibraryProps) {
  const showEmptyState = query.length >= 3 && !isSearching && !error && songs.length === 0 && albums.length === 0;
  const { tabBarHeight } = useTabBarHeight();

  const sections = [];
  if (songs.length > 0) {
    sections.push({ title: "Songs", data: songs });
  }
  if (albums.length > 0) {
    sections.push({ title: "Albums", data: albums });
  }

  const renderItem = ({ item, section }: { item: Track | AlbumSearchItem, section: { title: string } }) => {
    if (section.title === "Albums") {
      const album = item as AlbumSearchItem;
      return (
        <TrackRow
          title={album.title}
          subtitle={`${album.artists.join(", ")}${album.year ? ` • ${album.year}` : ""}`}
          thumbnailUrl={album.thumbnailUrl}
          onPress={() => onPressAlbum?.(album)}
        />
      );
    }

    const track = item as Track;
    const isSelected = track.videoId === currentTrackId;
    return (
      <TrackRow
        title={track.title}
        subtitle={track.artists.join(", ")}
        thumbnailUrl={track.thumbnailUrl}
        isSelected={isSelected}
        onPress={() => onPressSong(track)}
      />
    );
  };

  const renderSectionHeader = ({ section }: { section: { title: string } }) => (
    <View style={style.sectionHeaderContainer}>
      <Text style={style.sectionHeaderTitle}>{section.title}</Text>
    </View>
  );

  return (
    <SectionList
      sections={sections}
      renderItem={renderItem}
      renderSectionHeader={renderSectionHeader}
      keyExtractor={(item) => ('id' in item ? item.id : item.videoId)}
      style={style.container}
      contentContainerStyle={sections.length === 0 ? style.emptyContainer : [style.listContent, { paddingBottom: tabBarHeight + 20 }]}
      ListEmptyComponent={
        isSearching ? (
          <ActivityIndicator size="large" color={theme.colors.accent.primary} />
        ) : error ? (
          <Text style={[style.message, style.error]}>{error}</Text>
        ) : showEmptyState ? (
          <Text style={style.message}>No results found for {query}.</Text>
        ) : null
      }
    />
  );
}

const style = StyleSheet.create({
  container: {
    flex: 1,
    height: "100%",
    minHeight: 0,
  },
  listContent: {
    paddingBottom: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
  },
  message: {
    color: theme.colors.text.muted,
    fontSize: 15,
    margin: 24,
    textAlign: "center",
  },
  error: {
    color: theme.colors.text.primary,
  },
  sectionHeaderContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 8,
    backgroundColor: theme.colors.bg.page,
  },
  sectionHeaderTitle: {
    color: theme.colors.text.primary,
    fontSize: 17,
    fontWeight: "bold",
  },
});