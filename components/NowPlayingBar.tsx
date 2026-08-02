import { Image, StyleSheet, Text, TouchableOpacity, View, GestureResponderEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { theme } from "@/constants/theme";
import {
  addPlaybackStateListener,
  addTrackChangeListener,
  addProgressListener,
  getActiveTrack,
  skipToNext,
  skipToPrevious,
  togglePlayPause,
} from "@/lib/track-player";
import type { Track } from "@/lib/music";

type NowPlayingBarProps = {
  // We keep the prop for backwards compatibility with App.tsx, but override it with real player state
  currentTrack?: Track | null;
  onPress?: () => void;
};

export default function NowPlayingBar({
  currentTrack: propTrack,
  onPress,
}: NowPlayingBarProps) {
  const router = useRouter();
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTrack, setActiveTrack] = useState<Track | null>(propTrack ?? null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let active = true;

    // 1. Initial sync with the player
    getActiveTrack().then((t) => {
      if (active && t) {
        setActiveTrack(t as unknown as Track);
      }
    });

    // 2. Listen to state changes (play/pause)
    const stateUnsub = addPlaybackStateListener((state) => {
      if (!active) return;
      setIsPlaying(state === "Playing");
    });

    // 3. Listen to track changes
    const trackUnsub = addTrackChangeListener((t) => {
      if (!active) return;
      setActiveTrack(t);
      setIsPlaying(true);
    });

    // 4. Listen to progress for the progress bar
    const progressUnsub = addProgressListener((pos, dur) => {
      if (!active) return;
      setProgress(dur > 0 ? pos / dur : 0);
    });

    return () => {
      active = false;
      stateUnsub?.remove?.();
      trackUnsub?.remove?.();
      progressUnsub?.remove?.();
    };
  }, []);

  // Use the activeTrack from the player if available, fallback to the prop
  const track = activeTrack ?? propTrack;

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

  return (
    <View style={style.container}>
      {/* Thin progress bar at the top */}
      <View style={style.progressTrack}>
        <View style={[style.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <TouchableOpacity style={style.bar} onPress={handleBarPress} activeOpacity={0.85}>
        <View style={style.left}>
          {track.thumbnailUrl && (
            <Image source={{ uri: track.thumbnailUrl }} style={style.thumbnail} />
          )}
          <View style={style.textContainer}>
            <Text numberOfLines={1} style={style.title}>
              {track.title ?? "No track selected"}
            </Text>
            <Text numberOfLines={1} style={style.artist}>
              {track.artists?.join(", ") ?? ""}
            </Text>
          </View>
        </View>
        <View style={style.right}>
          <TouchableOpacity onPress={(e) => handleAction(e, skipToPrevious)}>
            <Ionicons name="play-skip-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={(e) => handleAction(e, togglePlayPause)} style={style.playButton}>
            <Ionicons name={isPlaying ? "pause" : "play"} size={28} color={theme.colors.button} />
          </TouchableOpacity>
          <TouchableOpacity onPress={(e) => handleAction(e, skipToNext)}>
            <Ionicons name="play-skip-forward" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    height: 60,
  },
  left: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  thumbnail: {
    width: 44,
    height: 44,
    borderRadius: 8,
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
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  playButton: {
    marginHorizontal: 8,
  },
});