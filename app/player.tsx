import { useLocalSearchParams } from "expo-router";
import { View, Text } from "react-native";
import PlayerScreen from "@/components/PlayerScreen";

export default function PlayerScreenRoute() {
  const { videoId } = useLocalSearchParams<{ videoId: string }>();

  if (!videoId) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>No track selected</Text>
      </View>
    );
  }

  return <PlayerScreen videoId={videoId} />;
}