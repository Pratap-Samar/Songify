import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Image } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { theme } from "@/constants/theme";
import { useResponsive } from "@/lib/useResponsive";
import { useHistory } from "@/lib/useHistory";
import { playTrack } from "@/lib/track-player";

export default function HomeTab() {
  const router = useRouter();
  const { contentMaxWidth, titleSize, baseSize, spacing } = useResponsive();

  const { history, fetchHistory, loading } = useHistory();

  // Refresh history every time we focus the Home tab
  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [fetchHistory])
  );

  return (
    <View style={style.container}>
      <ScrollView style={{ flex: 1, width: "100%" }} contentContainerStyle={{ alignItems: "center" }}>
        <View style={[style.content, { maxWidth: contentMaxWidth, padding: spacing, paddingBottom: 100 }]}>
          <View style={style.topRow}>
            <View style={style.placeholderIcon}>
              <Ionicons name="musical-notes" size={24} color={theme.colors.subtext} />
            </View>
            <TouchableOpacity style={style.searchBarMock} onPress={() => router.push("/search")}>
              <Ionicons name="search" size={20} color={theme.colors.subtext} />
              <Text style={[style.searchText, { fontSize: baseSize }]}>Search songs, artists, playlists...</Text>
            </TouchableOpacity>
          </View>

          <Text style={[style.header, { fontSize: titleSize, marginTop: spacing * 1.5 }]}>Continue Listening</Text>
          
          {loading ? (
            <View style={style.emptyContainer}>
              <Text style={[style.emptyText, { fontSize: baseSize }]}>Loading...</Text>
            </View>
          ) : history.length === 0 ? (
            <View style={style.emptyContainer}>
              <Text style={[style.emptyText, { fontSize: baseSize }]}>Play some music to build your listening history.</Text>
            </View>
          ) : (
            <View style={style.historyList}>
              {history.map((track) => (
                <TouchableOpacity
                  key={track.videoId}
                  style={style.historyCard}
                  onPress={() => {
                    import("@/lib/playback").then(({ playAndOpenPlayer }) => {
                      playAndOpenPlayer(track.videoId, router);
                    });
                  }}
                  activeOpacity={0.7}
                >
                  <View style={style.cardThumbnail}>
                    {track.thumbnailUrl ? (
                      <Image source={{ uri: track.thumbnailUrl }} style={style.cardImage} />
                    ) : (
                      <Ionicons name="musical-notes" size={24} color={theme.colors.subtext} />
                    )}
                  </View>
                  <View style={style.cardMeta}>
                    <Text numberOfLines={1} style={[style.cardTitle, { fontSize: baseSize }]}>
                      {track.title}
                    </Text>
                    <Text numberOfLines={1} style={[style.cardArtist, { fontSize: baseSize * 0.85 }]}>
                      {(track.artists || []).join(", ")}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const style = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.main,
    alignItems: "center",
  },
  content: {
    flex: 1,
    width: "100%",
    paddingTop: 48,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  searchBarMock: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    gap: 12,
  },
  placeholderIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: theme.colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  searchText: {
    color: theme.colors.subtext,
  },
  header: {
    fontWeight: "bold",
    color: theme.colors.text,
    marginBottom: 24,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    color: theme.colors.subtext,
    textAlign: "center",
  },
  historyList: {
    gap: 12,
  },
  historyCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  cardThumbnail: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  cardMeta: {
    marginLeft: 12,
    flex: 1,
    justifyContent: "center",
  },
  cardTitle: {
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: 4,
  },
  cardArtist: {
    color: theme.colors.subtext,
  },
});
