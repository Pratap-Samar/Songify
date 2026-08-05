import { Tabs } from "expo-router";
import { View, StyleSheet } from "react-native";
import { BottomTabBar } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import NowPlayingBar from "@/components/NowPlayingBar";
import { theme } from "@/constants/theme";
import { useResponsive } from "@/lib/useResponsive";

export default function TabLayout() {
  const { contentMaxWidth, spacing, baseSize } = useResponsive();

  return (
    <Tabs
      backBehavior="history"
      tabBar={(props) => (
        <View style={style.tabBarWrapper}>
          <View style={[style.tabBarContent, { maxWidth: contentMaxWidth }]}>
            <NowPlayingBar />
            <BottomTabBar {...props} />
          </View>
        </View>
      )}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.bg.surface,
          borderTopColor: "rgba(255, 255, 255, 0.05)",
        },
        tabBarLabelStyle: {
          fontSize: baseSize * 0.7, // Scale tab label size down relative to baseSize
        },
        tabBarIconStyle: {
          // Slightly scale icon size based on baseSize (which scales by tablet)
          width: baseSize * 1.5,
          height: baseSize * 1.5,
        },
        tabBarActiveTintColor: theme.colors.accent.primary,
        tabBarInactiveTintColor: theme.colors.text.secondary,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          href: null, // Hidden from tab bar but part of layout
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: "Library",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="library" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const style = StyleSheet.create({
  tabBarWrapper: {
    backgroundColor: theme.colors.bg.page,
    alignItems: "center", // center the tab bar on tablets
    width: "100%",
  },
  tabBarContent: {
    width: "100%",
    // Ensure the tab bar itself takes up space
    // Let NowPlayingBar and BottomTabBar layout normally
  },
});
