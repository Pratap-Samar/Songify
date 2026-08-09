import { ActivityIndicator, SectionList, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import type { Track, AlbumSearchItem } from "@/lib/music";
import { theme } from "@/constants/theme";
import { useTabBarHeight } from "@/lib/TabBarHeightContext";
import { PressableScale } from "./PressableScale";

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
        <PressableScale 
          style={style.songContainer} 
          onPress={() => onPressAlbum?.(album)} 
        >
          <View style={style.songImgContainer}>
            {album.thumbnailUrl && <Image source={{ uri: album.thumbnailUrl }} style={style.songImg} cachePolicy="disk" contentFit="cover" transition={150} />}
          </View>
          <View style={style.songDataContainer}>
            <Text numberOfLines={1} style={style.songName}>{album.title}</Text>
            <Text numberOfLines={1} style={style.songArtist}>
              {album.artists.join(", ")}{album.year ? ` • ${album.year}` : ""}
            </Text>
          </View>
        </PressableScale>
      );
    }

    const track = item as Track;
    const isSelected = track.videoId === currentTrackId;
    return (
      <PressableScale 
        style={[style.songContainer, isSelected && style.songContainerSelected]} 
        onPress={() => onPressSong(track)} 
      >
        <View style={style.songImgContainer}>
          {track.thumbnailUrl && <Image source={{ uri: track.thumbnailUrl }} style={style.songImg} cachePolicy="disk" contentFit="cover" transition={150} />}
        </View>
        <View style={style.songDataContainer}>
          <Text numberOfLines={1} style={[style.songName, isSelected && style.songNameSelected]}>{track.title}</Text>
          <Text numberOfLines={1} style={[style.songArtist, isSelected && style.songArtistSelected]}>{track.artists.join(", ")}</Text>
        </View>
      </PressableScale>
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
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  songContainer: {
    padding: 10,
    backgroundColor: theme.colors.bg.row,
    marginHorizontal: 16,
    marginVertical: 5,
    flexDirection: "row",
    height: 100,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border.default,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  songContainerSelected: {
    backgroundColor: theme.colors.bg.surface,
  },
  songDataContainer: {
    flex: 4,
    justifyContent: "center",
  },
  songImgContainer: {
    flex: 2,
    margin: 5,
    height: "100%",
  },
  songImg: {
    width: "80%",
    height: "80%",
    objectFit: "cover",
    borderRadius: 8,
  },
  songName: {
    color: theme.colors.text.primary,
    fontWeight: "600",
    fontSize: 15,
  },
  songNameSelected: {
    color: theme.colors.accent.primary,
  },
  songArtist: {
    color: theme.colors.text.muted,
    fontSize: 13,
    marginTop: 4,
  },
  songArtistSelected: {
    color: theme.colors.text.primary,
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
    fontSize: 18,
    fontWeight: "bold",
  },
});