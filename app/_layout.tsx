import { Stack } from "expo-router";
import { StyleSheet, View, Platform } from "react-native";
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

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    initDb().then(() => setDbReady(true)).catch(console.error);
  }, []);

  if (!dbReady) return null;

  return (
    <View style={style.root}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right", // Native iOS style slide for all screens
        }}
      >
        <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
        <Stack.Screen
          name="player"
          options={{
            presentation: "modal",
            animation: "slide_from_bottom", // Spotify/Apple Music player slide-up effect
          }}
        />
      </Stack>
    </View>
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
