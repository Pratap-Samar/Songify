import { useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { usePlaylists } from "@/lib/usePlaylists";
import { theme } from "@/constants/theme";

export default function PlaylistsScreen() {
  const router = useRouter();
  const { playlists, loading, create, remove } = usePlaylists();
  const [name, setName] = useState("");

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await create(trimmed);
    setName("");
  };

  if (loading) {
    return (
      <View style={style.center}>
        <Text style={{ color: theme.colors.text }}>Loading playlists...</Text>
      </View>
    );
  }

  return (
    <View style={style.container}>
      <View style={style.inputRow}>
        <TextInput
          style={style.input}
          value={name}
          onChangeText={setName}
          placeholder="New playlist name"
          placeholderTextColor={theme.colors.subtext}
          onSubmitEditing={handleCreate}
        />
        <TouchableOpacity style={style.createBtn} onPress={handleCreate}>
          <Ionicons name="add" size={22} color={theme.colors.main} />
        </TouchableOpacity>
      </View>
      <FlatList
        data={playlists}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={<Text style={style.empty}>No playlists yet. Create one above.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={style.item}
            onPress={() => router.push(`/playlist/${item.id}`)}
            activeOpacity={0.7}
          >
            <View style={style.itemLeft}>
              <Ionicons name="musical-notes" size={20} color={theme.colors.misc} />
              <Text style={style.itemTitle}>{item.name}</Text>
            </View>
            <TouchableOpacity onPress={() => remove(item.id)}>
              <Ionicons name="trash-outline" size={18} color={theme.colors.notificationError} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const style = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    padding: 16,
    overflow: "hidden",
    backgroundColor: theme.colors.main,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.main,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 15,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: "transparent",
  },
  createBtn: {
    backgroundColor: theme.colors.button,
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.card,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  itemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.colors.text,
  },
  empty: {
    textAlign: "center",
    color: theme.colors.subtext,
    marginTop: 40,
    fontSize: 15,
  },
});