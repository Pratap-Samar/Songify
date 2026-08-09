import { Stack } from "expo-router";
import { StyleSheet, View, Platform, PermissionsAndroid } from "react-native";
import TrackPlayer from "@javascriptcommon/react-native-track-player";

import { logger } from "@/lib/logger";

if (Platform.OS !== "web") {
  logger.debug("[App Layout] Calling TrackPlayer.registerPlaybackService...");
  TrackPlayer.registerPlaybackService(() => {
    logger.debug("[App Layout] Playback service is actually executing!");
    return require("../playback-service");
  });
  logger.debug("[App Layout] TrackPlayer.registerPlaybackService completed.");
}

import { useEffect, useState } from "react";
import { initDb } from "@/lib/database";

async function requestNotificationPermission() {
  if (Platform.OS !== "android") return;
  try {
    // Android 13+ (API 33) requires runtime POST_NOTIFICATIONS permission
    const granted = await PermissionsAndroid.request(
      "android.permission.POST_NOTIFICATIONS" as any,
    );
    logger.debug("[Permissions] POST_NOTIFICATIONS result:", granted);
  } catch (err) {
    logger.debug("[Permissions] POST_NOTIFICATIONS request failed:", err);
  }
}

import { LikeModalProvider } from "@/lib/LikeModalContext";
import { TabBarHeightProvider } from "@/lib/TabBarHeightContext";
import PersistentTabBar from "@/components/PersistentTabBar";
import { usePathname } from "expo-router";

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    initDb().then(() => setDbReady(true)).catch(console.error);
    requestNotificationPermission();
  }, []);

  if (!dbReady) return null;

  return (
    <LikeModalProvider>
      <TabBarHeightProvider>
        <View style={style.root}>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: "slide_from_right", // Native iOS style slide for all screens
            }}
          >
            <Stack.Screen
              name="player"
              options={{
                presentation: "modal",
                animation: "slide_from_bottom", // Spotify/Apple Music player slide-up effect
              }}
            />
            <Stack.Screen
              name="create-playlist"
              options={{
                presentation: "modal",
                animation: "slide_from_bottom",
              }}
            />
          </Stack>
          {!pathname.startsWith('/player') && !pathname.startsWith('/create-playlist') && <PersistentTabBar />}
        </View>
      </TabBarHeightProvider>
    </LikeModalProvider>
  );
}

const style = StyleSheet.create({
  root: {
    flex: 1,
    height: "100%",
    minHeight: 0,
    overflow: "hidden",
  },
});
