import { StyleSheet, Text, View, GestureResponderEvent, AppState } from "react-native";
import { useState, useEffect, useRef } from "react";
import { PressableScale } from "./PressableScale";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { theme } from "@/constants/theme";
import MarqueeText from "./MarqueeText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useActiveTrack, usePlaybackProgress, usePlaybackControls, usePlaybackSession } from "@/hooks/usePlaybackState";
import { openPlayerSafe } from "@/lib/playback";

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
  withSafeArea?: boolean;
};

export default function NowPlayingBar({
  onPress,
  withSafeArea = false,
}: NowPlayingBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { track: activeTrack } = useActiveTrack();
  const session = usePlaybackSession();
  const { isPlaying, togglePlayPause, skipToNext, skipToPrevious } = usePlaybackControls();

  // Inactivity timeout (24 hours)
  const [isVisible, setIsVisible] = useState(true);
  const inactivityTimer = useRef<any>(null);

  const resetInactivity = () => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => setIsVisible(false), 24 * 60 * 60 * 1000);
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        setIsVisible(true);
        resetInactivity();
      } else {
        resetInactivity();
      }
    });
    resetInactivity();
    return () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      subscription.remove();
    };
  }, []);

  const track = activeTrack;

  if (!track || !isVisible) return null; // Hide bar if no track or inactive

  const handleBarPress = () => {
    resetInactivity();
    if (track) {
      openPlayerSafe(router, track.videoId);
    }
  };

  const handleAction = (e: GestureResponderEvent, action: () => void) => {
    e.stopPropagation?.();
    resetInactivity();
    action();
  };

  const handleCollectionPress = (e: GestureResponderEvent) => {
    e.stopPropagation?.();
    if (session?.collectionId) {
      if (session.source === "album") router.push(`/album/${session.collectionId}`);
      else if (session.source === "playlist") router.push(`/playlist/${session.collectionId}`);
    }
  };

  return (
    <View style={[style.container, withSafeArea && { paddingBottom: insets.bottom }]}>
      <PressableScale style={style.bar} onPress={handleBarPress}>
        <View style={style.left}>
          {track.thumbnailUrl && (
            <Image source={{ uri: track.thumbnailUrl }} style={style.thumbnail} cachePolicy="disk" contentFit="cover" transition={150} />
          )}
          <View style={style.textContainer}>
            <MarqueeText animate={true} text={track.title ?? "No track selected"} style={style.title} />
            <Text numberOfLines={1} style={style.artist}>
              {(track.artists ?? []).join(", ") || ""}
            </Text>
            {(session?.source === "album" || session?.source === "playlist") && session.collectionTitle && (
              <PressableScale onPress={handleCollectionPress}>
                <Text numberOfLines={1} style={style.collectionTitle}>
                  {session.collectionTitle}
                </Text>
              </PressableScale>
            )}
          </View>
        </View>
        <View style={style.right}>
          <PressableScale onPress={(e) => handleAction(e, skipToPrevious)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="play-skip-back" size={24} color={theme.colors.text.primary} />
          </PressableScale>
          <PressableScale onPress={(e) => handleAction(e, togglePlayPause)} style={style.playButton} hitSlop={{ top: 15, bottom: 15, left: 10, right: 10 }}>
            <Ionicons name={isPlaying ? "pause" : "play"} size={32} color={theme.colors.accent.primary} />
          </PressableScale>
          <PressableScale onPress={(e) => handleAction(e, skipToNext)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="play-skip-forward" size={24} color={theme.colors.text.primary} />
          </PressableScale>
        </View>
      </PressableScale>
      
      {/* Thin progress bar at the bottom */}
      <ProgressBar />
    </View>
  );
}

const style = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.bg.elevated,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.default,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  progressTrack: {
    height: 2,
    backgroundColor: theme.colors.border.strong,
    width: "100%",
  },
  progressFill: {
    height: "100%",
    backgroundColor: theme.colors.accent.primary,
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
    borderRadius: 8,
  },
  textContainer: {
    marginLeft: 12,
    flex: 1,
    justifyContent: "center",
  },
  title: {
    color: theme.colors.text.primary,
    fontSize: 15,
    fontWeight: "600",
  },
  artist: {
    color: theme.colors.text.metadata,
    fontSize: 11,
    marginTop: 2,
  },
  collectionTitle: {
    color: theme.colors.accent.link,
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
