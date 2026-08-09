import React from "react";
import { StyleSheet, Text, View, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";
import { useResponsive } from "@/lib/useResponsive";
import { useTabBarHeight } from "@/lib/TabBarHeightContext";
import { PressableScale } from "@/components/PressableScale";

export default function SettingsTab() {
  const router = useRouter();
  const { contentMaxWidth, spacing, titleSize, baseSize } = useResponsive();
  const { tabBarHeight } = useTabBarHeight();

  const settingsItems = [
    { label: "Playback", icon: "play-circle", action: () => {} },
    { label: "Appearance", icon: "color-palette", action: () => {} },
    { label: "Storage", icon: "server", action: () => {} },
    { label: "About", icon: "information-circle", action: () => router.push("/about") },
  ];

  return (
    <ScrollView style={style.container} contentContainerStyle={[style.content, { padding: spacing, paddingBottom: tabBarHeight + 20 }]}>
      <View style={[style.maxWidthContainer, { maxWidth: contentMaxWidth }]}>
        <Text style={[style.header, { fontSize: titleSize, marginBottom: spacing * 1.5 }]}>Settings</Text>

        <View style={style.list}>
          {settingsItems.map((item, index) => (
            <PressableScale key={index} style={style.item} onPress={item.action}>
              <View style={style.itemLeft}>
                <Ionicons name={item.icon as any} size={24} color={theme.colors.text.primary} />
                <Text style={[style.itemLabel, { fontSize: baseSize }]}>{item.label}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.text.muted} />
            </PressableScale>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const style = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.bg.page,
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
    color: theme.colors.text.primary,
  },
  list: {
    backgroundColor: theme.colors.bg.row,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.border.default,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.default,
  },
  itemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  itemLabel: {
    color: theme.colors.text.primary,
  },
});
