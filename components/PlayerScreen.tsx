import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { getPlaybackTrack } from "@/lib/api";
import {
  addPlaybackStateListener,
  addTrackChangeListener,
  playTrack,
  skipToNext,
  skipToPrevious,
  togglePlayPause,
} from "@/lib/track-player";
import type { Track } from "@/lib/music";

export default function PlayerScreen({ videoId }: { videoId: string }) {
  const router = useRouter();
  const [track, setTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const result = await getPlaybackTrack(videoId);
        if (!active) return;
        setTrack(result);
        await playTrack(result);
        setIsPlaying(true);
      } catch (e) {
        if (active) {
          setError(
            e instanceof Error
              ? e.message
              : "Unable to load this track."
          );
        }
      }
    }

    load();

    const stateUnsub = addPlaybackStateListener((state) => {
      if (!active) return;
      setIsPlaying(state === "Playing");
      if (state === "Stopped" || state === "None") setIsPlaying(false);
    });

    const trackUnsub = addTrackChangeListener((t) => {
      if (!active) return;
      setTrack(t);
      setIsPlaying(true);
    });

    return () => {
      active = false;
      stateUnsub?.remove?.();
      trackUnsub?.remove?.();
    };
  }, [videoId]);

  return (
    <View style={style.container}>
      <View style={style.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1DB954" />
        </TouchableOpacity>
        <Text style={style.headerTitle}>Now Playing</Text>
      </View>
      <View style={style.content}>
        {error ? (
          <View style={style.errorContainer}>
            <Ionicons name="alert-circle" size={48} color="#ff4444" />
            <Text style={style.errorTitle}>Could not load track</Text>
            <Text style={style.errorMessage}>{error}</Text>
            <TouchableOpacity
              style={style.retryBtn}
              onPress={() => router.back()}
            >
              <Text style={style.retryBtnText}>Go back</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {track?.thumbnailUrl && (
              <Image
                source={{ uri: track.thumbnailUrl }}
                style={style.artwork}
              />
            )}
            <Text numberOfLines={1} style={style.title}>
              {track?.title ?? "Loading..."}
            </Text>
            <Text numberOfLines={1} style={style.artist}>
              {track?.artists.join(", ") ?? ""}
            </Text>
            <View style={style.controls}>
              <TouchableOpacity onPress={skipToPrevious}>
                <Ionicons name="play-skip-back" size={40} color="#1DB954" />
              </TouchableOpacity>
              <TouchableOpacity onPress={togglePlayPause} style={style.playBtn}>
                <Ionicons
                  name={isPlaying ? "pause" : "play"}
                  size={48}
                  color="#1DB954"
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={skipToNext}>
                <Ionicons name="play-skip-forward" size={40} color="#1DB954" />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const style = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  artwork: {
    width: 260,
    height: 260,
    borderRadius: 12,
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginTop: 24,
    textAlign: "center",
  },
  artist: {
    color: "#aaa",
    fontSize: 16,
    marginTop: 8,
  },
  time: {
    color: "#ccc",
    fontSize: 13,
    marginTop: 12,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 32,
    gap: 32,
  },
  playBtn: {
    backgroundColor: "#1DB954",
    borderRadius: 30,
    padding: 14,
  },
  errorContainer: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  errorTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 16,
  },
  errorMessage: {
    color: "#aaa",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
    marginHorizontal: 32,
  },
  retryBtn: {
    backgroundColor: "#1DB954",
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 24,
  },
  retryBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
});