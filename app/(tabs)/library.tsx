import { useState } from "react";
import { StyleSheet, Text, TextInput, View, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { usePlaylists } from "@/lib/usePlaylists";
import { useAlbums } from "@/lib/useAlbums";
import { theme } from "@/constants/theme";
import { useResponsive } from "@/lib/useResponsive";
import PlaylistArt from "@/components/PlaylistArt";
import { useTabBarHeight } from "@/lib/TabBarHeightContext";
import { PressableScale } from "@/components/PressableScale";

type FilterType = "playlists" | "albums" | "downloaded";

export default function LibraryTab() {
  const router = useRouter();
  const { playlists, loading, create, remove } = usePlaylists();
  const { albums: savedAlbums, loading: albumsLoading, remove: removeAlbum } = useAlbums();
  const [activeFilter, setActiveFilter] = useState<FilterType>("playlists");
  
  const { contentMaxWidth, spacing, titleSize, baseSize } = useResponsive();
  const { tabBarHeight } = useTabBarHeight();
  return (
    <View style={style.container}>
      {/* 1. Header Row */}
      <View style={[style.headerRow, { paddingHorizontal: spacing, paddingTop: 48, paddingBottom: spacing / 2 }]}>
        <View style={style.headerLeft}>
          <Text style={[style.headerTitle, { fontSize: titleSize }]}>Your Library</Text>
        </View>
        <View style={style.headerRight}>
          <PressableScale style={style.iconBtn} onPress={() => router.push("/search")}>
            <Ionicons name="search" size={24} color={theme.colors.text.primary} />
          </PressableScale>
        </View>
      </View>

      {/* 2. Filter Chip Row */}
      <View style={[style.chipContainer, { paddingHorizontal: spacing, paddingBottom: spacing }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={style.chipScroll}>
          {(["playlists", "albums", "downloaded"] as FilterType[]).map((filter) => {
            const isActive = activeFilter === filter;
            return (
              <PressableScale
                key={filter}
                style={[style.chip, isActive && style.chipActive]}
                onPress={() => setActiveFilter(filter)}
              >
                <Text style={[style.chipText, { fontSize: baseSize * 0.9 }, isActive && style.chipTextActive]}>
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </Text>
              </PressableScale>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView style={style.listScroll} contentContainerStyle={[style.listContent, { padding: spacing, paddingBottom: tabBarHeight + 20 }]}>
        <View style={[style.maxWidthContainer, { maxWidth: contentMaxWidth }]}>
          
          {/* Unified List Rendering */}
          {activeFilter === "playlists" && (
            <>
              {/* Pinned Create playlist row */}
              <PressableScale
                style={style.item}
                onPress={() => router.push("/create-playlist")}
              >
                <View style={style.itemLeft}>
                  <View style={style.thumbnail}>
                    <Ionicons name="add" size={32} color={theme.colors.text.primary} />
                  </View>
                  <View style={style.itemMeta}>
                    <Text style={[style.itemTitle, { fontSize: baseSize }]}>Create playlist</Text>
                  </View>
                </View>
              </PressableScale>

              {loading ? (
                <Text style={[style.empty, { fontSize: baseSize }]}>Loading playlists...</Text>
              ) : playlists.length === 0 ? (
                <Text style={[style.empty, { fontSize: baseSize }]}>No playlists yet — tap above to create your first one.</Text>
              ) : (
                playlists.map((item) => (
                  <PressableScale
                    key={item.id}
                    style={style.item}
                    onPress={() => router.push(`/playlist/${item.id}`)}
                  >
                    <View style={style.itemLeft}>
                      <View style={style.thumbnail}>
                        <PlaylistArt playlist={item} size={44} />
                      </View>
                      <View style={style.itemMeta}>
                        <Text style={[style.itemTitle, { fontSize: baseSize }]}>{item.name}</Text>
                        <Text style={[style.itemSubtitle, { fontSize: baseSize * 0.85 }]}>
                          {item.trackCount === 1 ? "1 song" : `${item.trackCount || 0} songs`}
                        </Text>
                      </View>
                    </View>
                    {!item.isSystem && (
                      <PressableScale onPress={() => remove(item.id)} style={style.deleteBtn}>
                        <Ionicons name="trash" size={18} color={theme.colors.text.secondary} />
                      </PressableScale>
                    )}
                  </PressableScale>
                ))
              )}
            </>
          )}

          {activeFilter === "albums" && (
            <>
              {albumsLoading ? (
                <Text style={[style.empty, { fontSize: baseSize }]}>Loading albums...</Text>
              ) : savedAlbums.length === 0 ? (
                <Text style={[style.empty, { fontSize: baseSize }]}>No saved albums yet — open an album and tap the + button.</Text>
              ) : (
                savedAlbums.map((album) => {
                  const artists = (() => { try { return JSON.parse(album.artists) as string[]; } catch { return [album.artists]; } })();
                  return (
                    <PressableScale
                      key={album.id}
                      style={style.item}
                      onPress={() => router.push(`/album/${album.id}`)}
                    >
                      <View style={style.itemLeft}>
                        <View style={style.thumbnail}>
                          {album.thumbnailUrl ? (
                            <Image
                              source={{ uri: album.thumbnailUrl }}
                              style={style.thumbnailImg}
                              cachePolicy="disk"
                              contentFit="cover"
                            />
                          ) : (
                            <Ionicons name="disc" size={28} color={theme.colors.text.secondary} />
                          )}
                        </View>
                        <View style={style.itemMeta}>
                          <Text style={[style.itemTitle, { fontSize: baseSize }]} numberOfLines={1}>{album.title}</Text>
                          <Text style={[style.itemSubtitle, { fontSize: baseSize * 0.85 }]} numberOfLines={1}>
                            {artists.join(", ")}{album.year ? ` • ${album.year}` : ""}
                          </Text>
                        </View>
                      </View>
                      <PressableScale onPress={() => removeAlbum(album.id)} style={style.deleteBtn}>
                        <Ionicons name="checkmark-circle" size={24} color={theme.colors.accent.primary} />
                      </PressableScale>
                    </PressableScale>
                  );
                })
              )}
            </>
          )}

          {activeFilter === "downloaded" && (
            <Text style={[style.empty, { fontSize: baseSize }]}>No downloaded content yet.</Text>
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
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontWeight: "bold",
    color: theme.colors.text.primary,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  iconBtn: {
    padding: 4,
  },
  chipContainer: {
    // Container for the horizontal scroll
  },
  chipScroll: {
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: theme.colors.bg.surface,
    borderWidth: 1,
    borderColor: "transparent",
  },
  chipActive: {
    backgroundColor: theme.colors.accent.primary,
  },
  chipText: {
    color: theme.colors.text.primary,
  },
  chipTextActive: {
    color: theme.colors.text.onPrimary,
    fontWeight: "600",
  },
  listScroll: {
    flex: 1,
  },
  listContent: {
    alignItems: "center", // center the maxWidthContainer
  },
  maxWidthContainer: {
    width: "100%",
  },

  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    marginBottom: 12,
    backgroundColor: theme.colors.bg.row,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border.default,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  itemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  thumbnail: {
    width: 64,
    height: 64,
    backgroundColor: theme.colors.bg.row,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  thumbnailImg: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
  },
  itemMeta: {
    flex: 1,
    justifyContent: "center",
  },
  itemTitle: {
    fontWeight: "600",
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  itemSubtitle: {
    color: theme.colors.text.muted,
  },
  deleteBtn: {
    padding: 8,
  },
  empty: {
    color: theme.colors.text.muted,
    marginTop: 24,
  },
});
