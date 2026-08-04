import { StyleSheet, Text, TouchableOpacity, View, GestureResponderEvent } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { theme } from "@/constants/theme";
import { useActiveTrack, usePlaybackProgress, usePlaybackControls, usePlaybackSession } from "@/hooks/usePlaybackState";

function ProgressBar() {
  const { position, duration } = usePlaybackProgress();
  const progress = duration > 0 ? position / duration : 0;

  return (
    <View style={style.progressTrack}>
      <View style={[style.progressFill, { width: `${progress * 100}%` }]} />
    </View>
  );
}

type NowPlayingBarProps = {
  onPress?: () => void;
};

export default function NowPlayingBar({
  onPress,
}: NowPlayingBarProps) {
  const router = useRouter();
  const { track: activeTrack } = useActiveTrack();
  const session = usePlaybackSession();
  const { isPlaying, togglePlayPause, skipToNext, skipToPrevious } = usePlaybackControls();

  const track = activeTrack;

  if (!track) return null; // Don't show the bar if there's no track at all

  const handleBarPress = () => {
    if (track) {
      router.push({ pathname: "/player", params: { videoId: track.videoId } });
    }
  };

  const handleAction = (e: GestureResponderEvent, action: () => void) => {
    e.stopPropagation?.();
    action();
  };

  const handleCollectionPress = (e: GestureResponderEvent) => {
    e.stopPropagation?.();
    if (session?.source === "album" && session.collectionId) {
      router.push(`/album/${session.collectionId}`);
    }
  };

  return (
    <View style={style.container}>
      <TouchableOpacity style={style.bar} onPress={handleBarPress} activeOpacity={0.85}>
        <View style={style.left}>
          {track.thumbnailUrl && (
            <Image source={{ uri: track.thumbnailUrl }} style={style.thumbnail} cachePolicy="disk" contentFit="cover" transition={150} />
          )}
          <View style={style.textContainer}>
            <Text numberOfLines={1} style={style.title}>
              {track.title ?? "No track selected"}
            </Text>
            <Text numberOfLines={1} style={style.artist}>
              {(track.artists ?? []).join(", ") || ""}
            </Text>
            {session?.source === "album" && session.collectionTitle && (
              <TouchableOpacity onPress={handleCollectionPress}>
                <Text numberOfLines={1} style={style.collectionTitle}>
                  {session.collectionTitle}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        <View style={style.right}>
          <TouchableOpacity onPress={(e) => handleAction(e, skipToPrevious)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="play-skip-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={(e) => handleAction(e, togglePlayPause)} style={style.playButton} hitSlop={{ top: 15, bottom: 15, left: 10, right: 10 }}>
            <Ionicons name={isPlaying ? "pause" : "play"} size={28} color={theme.colors.button} />
          </TouchableOpacity>
          <TouchableOpacity onPress={(e) => handleAction(e, skipToNext)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="play-skip-forward" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
      
      {/* Thin progress bar at the bottom */}
      <ProgressBar />
    </View>
  );
}

const style = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.player,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.05)",
  },
  progressTrack: {
    height: 2,
    backgroundColor: theme.colors.buttonDisabled,
    width: "100%",
  },
  progressFill: {
    height: "100%",
    backgroundColor: theme.colors.button,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 64,
  },
  left: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 6,
  },
  textContainer: {
    marginLeft: 12,
    flex: 1,
    justifyContent: "center",
  },
  title: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  artist: {
    color: theme.colors.subtext,
    fontSize: 12,
    marginTop: 2,
  },
  collectionTitle: {
    color: theme.colors.button,
    fontSize: 11,
    marginTop: 2,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  playButton: {
    marginHorizontal: 8,
  },
});
