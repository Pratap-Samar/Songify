import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { Track } from "@/lib/music";
import { theme } from "@/constants/theme";

type LibraryProps = {
  songs: Track[];
  isSearching: boolean;
  error: string | null;
  query: string;
  onPressSong: (track: Track) => void;
  currentTrackId?: string;
};

export default function Library({ songs, isSearching, error, query, onPressSong, currentTrackId }: LibraryProps) {
  const showEmptyState = query.length >= 3 && !isSearching && !error && songs.length === 0;

  const renderItem = ({ item }: { item: Track }) => {
    const isSelected = item.videoId === currentTrackId;
    return (
      <TouchableOpacity 
        style={[style.songContainer, isSelected && style.songContainerSelected]} 
        onPress={() => onPressSong(item)} 
        activeOpacity={0.7}
      >
        <View style={style.songImgContainer}>
          {item.thumbnailUrl && <Image source={{ uri: item.thumbnailUrl }} style={style.songImg} />}
        </View>
        <View style={style.songDataContainer}>
          <Text numberOfLines={1} style={[style.songName, isSelected && style.songNameSelected]}>{item.title}</Text>
          <Text numberOfLines={1} style={[style.songArtist, isSelected && style.songArtistSelected]}>{item.artists.join(", ")}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      data={songs}
      renderItem={renderItem}
      keyExtractor={(item) => item.videoId}
      style={style.container}
      contentContainerStyle={songs.length === 0 ? style.emptyContainer : style.listContent}
      ListEmptyComponent={
        isSearching ? (
          <ActivityIndicator size="large" color={theme.colors.button} />
        ) : error ? (
          <Text style={[style.message, style.error]}>{error}</Text>
        ) : showEmptyState ? (
          <Text style={style.message}>No songs found for {query}.</Text>
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
    backgroundColor: theme.colors.card,
    marginHorizontal: 16,
    marginVertical: 5,
    flexDirection: "row",
    height: 100,
    borderRadius: 16,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  songContainerSelected: {
    backgroundColor: theme.colors.selectedRow,
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
    color: theme.colors.text,
    fontWeight: "600",
    fontSize: 15,
  },
  songNameSelected: {
    color: theme.colors.main,
  },
  songArtist: {
    color: theme.colors.subtext,
    fontSize: 13,
    marginTop: 4,
  },
  songArtistSelected: {
    color: theme.colors.shadow,
  },
  message: {
    color: theme.colors.subtext,
    fontSize: 15,
    margin: 24,
    textAlign: "center",
  },
  error: {
    color: theme.colors.notificationError,
  },
});