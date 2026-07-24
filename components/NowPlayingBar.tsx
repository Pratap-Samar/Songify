import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  addPlaybackStateListener,
  addTrackChangeListener,
  skipToNext,
  skipToPrevious,
  togglePlayPause,
} from "@/lib/track-player";
import type { Track } from "@/lib/music";

type NowPlayingBarProps = {
  currentTrack: Track | null;
  onPress: () => void;
};

export default function NowPlayingBar({
  currentTrack,
  onPress,
}: NowPlayingBarProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const stateUnsub = addPlaybackStateListener((state) => {
      setIsPlaying(state === "Playing");
    });
    const trackUnsub = addTrackChangeListener(() => {
      setIsPlaying(true);
    });
    return () => {
      stateUnsub?.remove?.();
      trackUnsub?.remove?.();
    };
  }, []);

  return (
    <TouchableOpacity style={style.bar} onPress={onPress} activeOpacity={0.85}>
      <View style={style.left}>
        {currentTrack?.thumbnailUrl && (
          <Image source={{ uri: currentTrack.thumbnailUrl }} style={style.thumbnail} />
        )}
        <View style={style.textContainer}>
          <Text numberOfLines={1} style={style.title}>
            {currentTrack?.title ?? "No track selected"}
          </Text>
          <Text numberOfLines={1} style={style.artist}>
            {currentTrack?.artists.join(", ") ?? ""}
          </Text>
        </View>
      </View>
      <View style={style.right}>
        <TouchableOpacity onPress={skipToPrevious}>
          <Ionicons name="play-skip-back" size={28} color="#1DB954" />
        </TouchableOpacity>
        <TouchableOpacity onPress={togglePlayPause} style={style.playButton}>
          <Ionicons name={isPlaying ? "pause" : "play"} size={32} color="#1DB954" />
        </TouchableOpacity>
        <TouchableOpacity onPress={skipToNext}>
          <Ionicons name="play-skip-forward" size={28} color="#1DB954" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const style = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1a1a1a",
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
    width: 40,
    height: 40,
    borderRadius: 6,
  },
  textContainer: {
    marginLeft: 10,
    flex: 1,
  },
  title: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  artist: {
    color: "#aaa",
    fontSize: 12,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  playButton: {
    marginHorizontal: 8,
  },
});