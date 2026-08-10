import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import NowPlayingBar from "@/components/NowPlayingBar";
import { theme } from "@/constants/theme";
import { useResponsive } from "@/lib/useResponsive";
import { useTabBarHeight } from "@/lib/TabBarHeightContext";

type TabConfig = {
  name: string;
  path: any; // Route type
  activeIcon: keyof typeof Ionicons.glyphMap;
  inactiveIcon: keyof typeof Ionicons.glyphMap;
};

import { hexToRgba } from "@/lib/colorUtils";

const TABS: TabConfig[] = [
  { name: "Home", path: "/", activeIcon: "home", inactiveIcon: "home-outline" },
  { name: "Library", path: "/library", activeIcon: "albums", inactiveIcon: "albums-outline" },
  { name: "Search", path: "/search", activeIcon: "search", inactiveIcon: "search-outline" },
  { name: "Settings", path: "/settings", activeIcon: "options", inactiveIcon: "options-outline" },
];

export default function PersistentTabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { contentMaxWidth, baseSize } = useResponsive();
  const { tabBarHeight, setTabBarHeight } = useTabBarHeight();

  const handleTabPress = (path: any) => {
    // If we're already on this tab's root, do nothing
    if (pathname === path) return;

    // Use replace to prevent the stack from growing infinitely when switching tabs.
    // If the user pushed into an album (e.g. stack has 2 screens), replacing the top 
    // screen with a tab is standard flat-navigation behavior.
    if (router.canGoBack()) {
      router.dismissAll();
    }
    router.replace(path);
  };

  return (
    <View 
      style={style.wrapper} 
      onLayout={(e) => {
        const newHeight = e.nativeEvent.layout.height;
        if (Math.abs(newHeight - tabBarHeight) > 1) {
          setTabBarHeight(newHeight);
        }
      }}
    >
      <View style={[style.content, { maxWidth: contentMaxWidth }]}>
        <NowPlayingBar withSafeArea={false} />
        
        <View style={[style.tabBar, { paddingBottom: insets.bottom || 8 }]}>
          {TABS.map((tab) => {
            const isActive = pathname === tab.path || (tab.path !== "/" && pathname.startsWith(tab.path));
            return (
              <TouchableOpacity
                key={tab.name}
                style={[style.tabButton, isActive && style.tabButtonActive]}
                onPress={() => handleTabPress(tab.path)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={isActive ? tab.activeIcon : tab.inactiveIcon}
                  size={24}
                  color={isActive ? theme.colors.accent.primary : theme.colors.text.mutedMetadata}
                />
                <Text style={[style.tabLabel, { color: isActive ? theme.colors.text.primary : theme.colors.text.mutedMetadata }]}>
                  {tab.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const style = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.bg.page,
    alignItems: "center",
    width: "100%",
  },
  content: {
    width: "100%",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: theme.colors.bg.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.default,
    paddingTop: 8,
    minHeight: 56,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    marginHorizontal: 8,
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: hexToRgba(theme.colors.accent.primary, 0.1),
  },
  tabLabel: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "500",
  },
});
