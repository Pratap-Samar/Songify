import { Slot } from "expo-router";
import { StyleSheet, View, Platform } from "react-native";
import TrackPlayer from "@javascriptcommon/react-native-track-player";

if (Platform.OS !== "web") {
  TrackPlayer.registerPlaybackService(() => require("../playback-service"));
}

export default function RootLayout() {
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
