import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { usePlaylists } from "@/lib/usePlaylists";
import { theme } from "@/constants/theme";
import { useResponsive } from "@/lib/useResponsive";

type FilterType = "playlists" | "albums" | "downloaded";

export default function LibraryTab() {
  const router = useRouter();
  const { playlists, loading, create, remove } = usePlaylists();
  const [activeFilter, setActiveFilter] = useState<FilterType>("playlists");
  
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  
  const { contentMaxWidth, spacing, titleSize, baseSize } = useResponsive();

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setIsCreating(false);
      return;
    }
    await create(trimmed);
    setName("");
    setIsCreating(false);
  };

  return (
    <View style={style.container}>
      {/* 1. Header Row */}
      <View style={[style.headerRow, { paddingHorizontal: spacing, paddingTop: 48, paddingBottom: spacing / 2 }]}>
        <View style={style.headerLeft}>
          <Text style={[style.headerTitle, { fontSize: titleSize }]}>Your Library</Text>
        </View>
        <View style={style.headerRight}>
          <TouchableOpacity style={style.iconBtn} onPress={() => router.push("/search")}>
            <Ionicons name="search" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Filter Chip Row */}
      <View style={[style.chipContainer, { paddingHorizontal: spacing, paddingBottom: spacing }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={style.chipScroll}>
          {(["playlists", "albums", "downloaded"] as FilterType[]).map((filter) => {
            const isActive = activeFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                style={[style.chip, isActive && style.chipActive]}
                onPress={() => setActiveFilter(filter)}
                activeOpacity={0.8}
              >
                <Text style={[style.chipText, { fontSize: baseSize * 0.9 }, isActive && style.chipTextActive]}>
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView style={style.listScroll} contentContainerStyle={[style.listContent, { padding: spacing, paddingBottom: 100 }]}>
        <View style={[style.maxWidthContainer, { maxWidth: contentMaxWidth }]}>
          
          {/* Creation input if active */}
          {isCreating && (
            <View style={[style.inputRow, { marginBottom: spacing }]}>
              <TextInput
                style={[style.input, { fontSize: baseSize }]}
                value={name}
                onChangeText={setName}
                placeholder="New playlist name"
                placeholderTextColor={theme.colors.subtext}
                onSubmitEditing={handleCreate}
                autoFocus
              />
              <TouchableOpacity style={style.createBtn} onPress={handleCreate}>
                <Ionicons name="checkmark" size={22} color={theme.colors.main} />
              </TouchableOpacity>
            </View>
          )}

          {/* Unified List Rendering */}
          {activeFilter === "playlists" && (
            <>
              {/* Pinned Create playlist row */}
              <TouchableOpacity
                style={style.item}
                onPress={() => setIsCreating(!isCreating)}
                activeOpacity={0.7}
              >
                <View style={style.itemLeft}>
                  <View style={style.thumbnail}>
                    <Ionicons name="add" size={32} color={theme.colors.text} />
                  </View>
                  <View style={style.itemMeta}>
                    <Text style={[style.itemTitle, { fontSize: baseSize }]}>Create playlist</Text>
                  </View>
                </View>
              </TouchableOpacity>

              {loading ? (
                <Text style={[style.empty, { fontSize: baseSize }]}>Loading playlists...</Text>
              ) : playlists.length === 0 ? (
                <Text style={[style.empty, { fontSize: baseSize }]}>No playlists yet — tap above to create your first one.</Text>
              ) : (
                playlists.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={style.item}
                    onPress={() => router.push(`/playlist/${item.id}`)}
                    activeOpacity={0.7}
                  >
                    <View style={style.itemLeft}>
                      <View style={style.thumbnail}>
                        <Ionicons name="musical-notes" size={24} color={theme.colors.subtext} />
                      </View>
                      <View style={style.itemMeta}>
                        <Text style={[style.itemTitle, { fontSize: baseSize }]}>{item.name}</Text>
                        <Text style={[style.itemSubtitle, { fontSize: baseSize * 0.85 }]}>Playlist</Text>
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => remove(item.id)} style={style.deleteBtn}>
                      <Ionicons name="trash-outline" size={18} color={theme.colors.notificationError} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))
              )}
            </>
          )}

          {activeFilter === "albums" && (
            <Text style={[style.empty, { fontSize: baseSize }]}>No saved albums yet.</Text>
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
    backgroundColor: theme.colors.main,
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
    color: theme.colors.text,
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
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: "transparent",
  },
  chipActive: {
    backgroundColor: theme.colors.button,
  },
  chipText: {
    color: theme.colors.text,
  },
  chipTextActive: {
    color: theme.colors.main,
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
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    color: theme.colors.text,
  },
  createBtn: {
    backgroundColor: theme.colors.button,
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    marginBottom: 8,
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
    backgroundColor: theme.colors.card,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  itemMeta: {
    flex: 1,
    justifyContent: "center",
  },
  itemTitle: {
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: 4,
  },
  itemSubtitle: {
    color: theme.colors.subtext,
  },
  deleteBtn: {
    padding: 8,
  },
  empty: {
    color: theme.colors.subtext,
    marginTop: 24,
  },
});
