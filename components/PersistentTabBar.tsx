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
  icon: keyof typeof Ionicons.glyphMap;
};

const TABS: TabConfig[] = [
  { name: "Home", path: "/", icon: "home" },
  { name: "Library", path: "/library", icon: "library" },
  { name: "Settings", path: "/settings", icon: "settings" },
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
        console.log("[PersistentTabBar] onLayout fired. newHeight:", newHeight, "currentHeight:", tabBarHeight);
        if (Math.abs(newHeight - tabBarHeight) > 1) {
          console.log("[PersistentTabBar] State update triggered!");
          setTabBarHeight(newHeight);
        }
      }}
    >
      <View style={[style.content, { maxWidth: contentMaxWidth }]}>
        <NowPlayingBar withSafeArea={false} />
        
        <View style={[style.tabBar, { paddingBottom: insets.bottom }]}>
          {TABS.map((tab) => {
            const isActive = pathname === tab.path || (tab.path !== "/" && pathname.startsWith(tab.path));
            return (
              <TouchableOpacity
                key={tab.name}
                style={style.tabButton}
                onPress={() => handleTabPress(tab.path)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={tab.icon}
                  size={baseSize * 1.5}
                  color={isActive ? theme.colors.accent.primary : theme.colors.text.secondary}
                />
                <Text
                  style={[
                    style.tabLabel,
                    { fontSize: baseSize * 0.7 },
                    { color: isActive ? theme.colors.accent.primary : theme.colors.text.secondary },
                  ]}
                >
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
    borderTopColor: "rgba(255, 255, 255, 0.05)",
    paddingTop: 8,
    paddingHorizontal: 16,
    minHeight: 56,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: {
    marginTop: 4,
    fontWeight: "500",
  },
});
