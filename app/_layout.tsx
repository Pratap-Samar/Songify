import { Slot } from "expo-router";
import { StyleSheet, View, Platform } from "react-native";
import TrackPlayer from "@javascriptcommon/react-native-track-player";

if (Platform.OS !== "web") {
  console.log("[App Layout] Calling TrackPlayer.registerPlaybackService...");
  TrackPlayer.registerPlaybackService(() => {
    console.log("[App Layout] Playback service is actually executing!");
    return require("../playback-service");
  });
  console.log("[App Layout] TrackPlayer.registerPlaybackService completed.");
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
      <Slot />
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
