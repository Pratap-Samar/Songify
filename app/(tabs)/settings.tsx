import React from "react";
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";
import { useResponsive } from "@/lib/useResponsive";

export default function SettingsTab() {
  const router = useRouter();
  const { contentMaxWidth, spacing, titleSize, baseSize } = useResponsive();

  const settingsItems = [
    { label: "Playback", icon: "play-circle-outline", action: () => {} },
    { label: "Appearance", icon: "color-palette-outline", action: () => {} },
    { label: "Storage", icon: "server-outline", action: () => {} },
    { label: "About", icon: "information-circle-outline", action: () => router.push("/about") },
  ];

  return (
    <ScrollView style={style.container} contentContainerStyle={[style.content, { padding: spacing, paddingBottom: 100 }]}>
      <View style={[style.maxWidthContainer, { maxWidth: contentMaxWidth }]}>
        <Text style={[style.header, { fontSize: titleSize, marginBottom: spacing * 1.5 }]}>Settings</Text>

        <View style={style.list}>
          {settingsItems.map((item, index) => (
            <TouchableOpacity key={index} style={style.item} onPress={item.action} activeOpacity={0.7}>
              <View style={style.itemLeft}>
                <Ionicons name={item.icon as any} size={24} color={theme.colors.text} />
                <Text style={[style.itemLabel, { fontSize: baseSize }]}>{item.label}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.subtext} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const style = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.main,
  },
  content: {
    paddingTop: 48,
    alignItems: "center",
  },
  maxWidthContainer: {
    width: "100%",
  },
  header: {
    fontWeight: "bold",
    color: theme.colors.text,
  },
  list: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    overflow: "hidden",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  itemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  itemLabel: {
    color: theme.colors.text,
  },
});
