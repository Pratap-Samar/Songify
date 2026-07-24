import { useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { usePlaylists } from "@/lib/usePlaylists";

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
        <Text>Loading playlists...</Text>
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
          placeholderTextColor="#8e8e93"
          onSubmitEditing={handleCreate}
        />
        <TouchableOpacity style={style.createBtn} onPress={handleCreate}>
          <Ionicons name="add" size={22} color="#fff" />
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
              <Ionicons name="musical-notes" size={20} color="#1DB954" />
              <Text style={style.itemTitle}>{item.name}</Text>
            </View>
            <TouchableOpacity onPress={() => remove(item.id)}>
              <Ionicons name="trash-outline" size={18} color="#888" />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const style = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F0EF",
    padding: 16,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: "#f0f1f3",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 15,
  },
  createBtn: {
    backgroundColor: "#1DB954",
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
    backgroundColor: "#f0f1f3",
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  itemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  empty: {
    textAlign: "center",
    color: "#888",
    marginTop: 40,
    fontSize: 15,
  },
});