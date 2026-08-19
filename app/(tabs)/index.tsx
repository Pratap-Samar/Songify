import { StyleSheet, Text, View, ScrollView } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { theme } from "@/constants/theme";
import { useResponsive } from "@/lib/useResponsive";
import { useHistory } from "@/lib/useHistory";
import { hexToRgba } from "@/lib/colorUtils";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { WebLineLoading } from "@/components/WebLineLoading";
import { useTabBarHeight } from "@/lib/TabBarHeightContext";
import { PressableScale } from "@/components/PressableScale";
import { useActiveTrack } from "@/hooks/usePlaybackState";
import { playAndOpenPlayer } from "@/lib/playback";

export default function HomeTab() {
  const router = useRouter();
  const { contentMaxWidth, titleSize, baseSize, spacing } = useResponsive();
  const { tabBarHeight } = useTabBarHeight();

  const { history, fetchHistory, loading } = useHistory();

  // Refresh history every time we focus the Home tab
  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [fetchHistory])
  );

  const { track: activeTrack } = useActiveTrack();
  const ambientArtwork = activeTrack?.thumbnailUrl || history[0]?.thumbnailUrl;

  return (
    <View style={style.container}>
      {ambientArtwork && (
        <View style={StyleSheet.absoluteFillObject}>
          <Image
            source={{ uri: ambientArtwork }}
            style={StyleSheet.absoluteFillObject}
            blurRadius={90}
            contentFit="cover"
          />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: theme.colors.bg.page, opacity: 0.85 }]} />
        </View>
      )}
      {loading && <WebLineLoading />}
      <ScrollView style={{ flex: 1, width: "100%" }} contentContainerStyle={{ alignItems: "center", paddingBottom: tabBarHeight + 20 }}>
        <View style={[style.content, { maxWidth: contentMaxWidth, padding: spacing }]}>
          <View style={style.topRow}>
            <View style={style.placeholderIcon}>
              <Ionicons name="musical-notes" size={24} color={theme.colors.text.secondary} />
            </View>
            <PressableScale style={style.searchBarMock} onPress={() => router.push("/search")}>
              <Ionicons name="search" size={20} color={theme.colors.text.secondary} />
              <Text style={[style.searchText, { fontSize: baseSize }]}>Search songs, artists, playlists...</Text>
            </PressableScale>
          </View>



          <Text style={[style.header, { fontSize: titleSize, marginTop: spacing * 1.5 }]}>Continue Listening</Text>
          
          {loading ? (
            <View style={style.historyList}>
              {[1, 2, 3, 4, 5].map((i) => (
                <View key={i} style={style.historyCard}>
                  <SkeletonLoader width={56} height={56} borderRadius={8} />
                  <View style={[style.cardMeta, { paddingLeft: 16 }]}>
                    <SkeletonLoader width="70%" height={16} style={{ marginBottom: 8 }} />
                    <SkeletonLoader width="40%" height={14} />
                  </View>
                </View>
              ))}
            </View>
          ) : history.length === 0 ? (
            <View style={style.emptyContainer}>
              <Text style={[style.emptyText, { fontSize: baseSize }]}>Play some music to build your listening history.</Text>
            </View>
          ) : (
            <View style={style.historyList}>
              {history.map((track) => (
                <PressableScale
                  key={track.videoId}
                  style={style.historyCard}
                  onPress={() => {
                    playAndOpenPlayer(track.videoId, router, track);
                  }}
                >
                  <View style={style.cardThumbnail}>
                    {track.thumbnailUrl ? (
                      <Image source={{ uri: track.thumbnailUrl }} style={style.cardImage} cachePolicy="disk" contentFit="cover" transition={150} />
                    ) : (
                      <Ionicons name="musical-notes" size={24} color={theme.colors.text.secondary} />
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
                </PressableScale>
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
    backgroundColor: theme.colors.bg.page,
    alignItems: "center",
  },
  content: {
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
    backgroundColor: theme.colors.bg.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    gap: 12,
  },
  placeholderIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: theme.colors.bg.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  searchText: {
    color: theme.colors.text.metadata,
  },
  header: {
    fontWeight: "bold",
    color: theme.colors.text.primary,
    marginBottom: 24,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    color: theme.colors.text.metadata,
    textAlign: "center",
  },
  historyList: {
    gap: 12,
  },
  historyCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.bg.surface,
    borderRadius: 12,
    padding: 12,
  },
  cardThumbnail: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: theme.colors.bg.page,
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
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  cardArtist: {
    color: theme.colors.text.metadata,
  },
});
