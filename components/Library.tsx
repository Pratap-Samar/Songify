import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { Track } from "@/lib/music";

type LibraryProps = {
  songs: Track[];
  isSearching: boolean;
  error: string | null;
  query: string;
  onPressSong: (track: Track) => void;
};

export default function Library({ songs, isSearching, error, query, onPressSong }: LibraryProps) {
  const showEmptyState = query.length >= 3 && !isSearching && !error && songs.length === 0;

  return (
    <View style={style.container}>
      {isSearching && <ActivityIndicator size="large" color="#1DB954" />}
      {error && <Text style={style.message}>{error}</Text>}
      {showEmptyState && <Text style={style.message}>No songs found for {query}.</Text>}
      {songs.map((song) => (
        <TouchableOpacity style={style.songContainer} key={song.videoId} onPress={() => onPressSong(song)} activeOpacity={0.7}>
          <View style={style.songImgContainer}>
            {song.thumbnailUrl && <Image source={{ uri: song.thumbnailUrl }} style={style.songImg} />}
          </View>
          <View style={style.songDataContainer}>
            <Text numberOfLines={1} style={style.songName}>{song.title}</Text>
            <Text numberOfLines={1} style={style.songArtist}>{song.artists.join(", ")}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const style = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    paddingTop: 8,
  },
  songContainer: {
    padding: 10,
    backgroundColor: "#f0f1f3",
    width: "80%",
    margin: 5,
    flexDirection: "row",
    height: 100,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  songDataContainer: {
    flex: 4,
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
    fontWeight: "600",
    fontSize: 15,
  },
  songArtist: {
    fontSize: 13,
  },
  message: {
    color: "#555",
    fontSize: 15,
    margin: 24,
    textAlign: "center",
  },
});