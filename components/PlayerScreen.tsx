import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { getPlaybackTrack } from "@/lib/api";
import { theme } from "@/constants/theme";
import {
  addPlaybackStateListener,
  addProgressListener,
  addTrackChangeListener,
  playTrack,
  seekTo,
  skipToNext,
  skipToPrevious,
  togglePlayPause,
  getRepeatMode,
  setRepeatMode,
  getActiveTrack,
  getPlaybackState,
} from "@/lib/track-player";
import type { Track } from "@/lib/music";
import AddToPlaylistModal from "./AddToPlaylistModal";

function fmt(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function PlayerScreen({ videoId }: { videoId: string }) {
  const router = useRouter();
  const [track, setTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repeat, setRepeat] = useState<'off' | 'track' | 'queue'>('off');
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);

  // ── Progress state ──────────────────────────────────────────────
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [seekPct, setSeekPct] = useState(0);
  const barWidthRef = useRef(0);
  const durationRef = useRef(0);
  durationRef.current = duration;

  // Subscribe to playback progress
  useEffect(() => {
    const sub = addProgressListener((pos, dur) => {
      setPosition(pos);
      setDuration(dur);
    });
    return () => { sub.remove?.(); };
  }, []);

  // Sync repeat mode
  useEffect(() => {
    getRepeatMode().then(setRepeat);
  }, []);

  // ── Track loading ───────────────────────────────────────────────
  useEffect(() => {
    let active = true;

    async function load() {
      try {
        // 1. Check if the player is already playing this exact track
        const activeT = await getActiveTrack();
        if (activeT && (activeT as any).videoId === videoId) {
          if (!active) return;
          // Just attach to the existing state, don't restart playback!
          setTrack(activeT as unknown as Track);
          const state = await getPlaybackState();
          setIsPlaying(state === "Playing");
          return;
        }

        // 2. Otherwise, fetch and start fresh
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

  // ── Seek visual state ───────────────────────────────────────────
  const displayPct = seeking ? seekPct : (duration > 0 ? position / duration : 0);
  const displayPos = seeking ? seekPct * duration : position;

  const handleSeekStart = (locationX: number) => {
    if (duration <= 0) return;
    const pct = Math.max(0, Math.min(1, locationX / (barWidthRef.current || 1)));
    setSeekPct(pct);
    setSeeking(true);
  };

  const handleSeekMove = (locationX: number) => {
    if (!seeking) return;
    const pct = Math.max(0, Math.min(1, locationX / (barWidthRef.current || 1)));
    setSeekPct(pct);
  };

  const handleSeekEnd = () => {
    if (!seeking) return;
    setSeeking(false);
    const target = seekPct * durationRef.current;
    if (isFinite(target)) seekTo(target);
  };

  const toggleRepeatMode = async () => {
    const nextMode = repeat === 'off' ? 'queue' : repeat === 'queue' ? 'track' : 'off';
    await setRepeatMode(nextMode);
    setRepeat(nextMode);
  };

  // ── Render ──────────────────────────────────────────────────────
  return (
    <View style={style.container}>
      <View style={style.header}>
        <TouchableOpacity onPress={() => router.back()} style={style.iconButton}>
          <Ionicons name="chevron-down" size={32} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={style.headerTitle}>Now Playing</Text>
        <View style={{ width: 32 }} />
      </View>
      <View style={style.content}>
        {error ? (
          <View style={style.errorContainer}>
            <Ionicons name="alert-circle" size={48} color={theme.colors.notificationError} />
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
            <View style={style.artworkContainer}>
              {track?.thumbnailUrl && (
                <Image
                  source={{ uri: track.thumbnailUrl }}
                  style={style.artwork}
                />
              )}
            </View>
            <View style={style.textContainer}>
              <Text numberOfLines={1} style={style.title}>
                {track?.title ?? "Loading..."}
              </Text>
              <Text numberOfLines={1} style={style.artist}>
                {track?.artists.join(", ") ?? ""}
              </Text>
            </View>

            {/* ── Seek bar + time labels ──────────────────── */}
            <View style={style.seekContainer}>
              <View
                style={style.seekTrack}
                onLayout={(e) => { barWidthRef.current = e.nativeEvent.layout.width; }}
                onStartShouldSetResponder={() => duration > 0}
                onMoveShouldSetResponder={() => true}
                onResponderGrant={(e) => handleSeekStart(e.nativeEvent.locationX)}
                onResponderMove={(e) => handleSeekMove(e.nativeEvent.locationX)}
                onResponderRelease={handleSeekEnd}
                onResponderTerminate={handleSeekEnd}
              >
                <View style={[style.seekFill, { width: `${displayPct * 100}%` }]} />
                {seeking && (
                  <View style={[style.seekThumb, { left: `${displayPct * 100}%` }]} />
                )}
              </View>
              <View style={style.timeRow}>
                <Text style={style.timeText}>{fmt(displayPos)}</Text>
                <Text style={style.timeText}>
                  {duration > 0 ? `-${fmt(duration - displayPos)}` : fmt(0)}
                </Text>
              </View>
            </View>

            <View style={style.controls}>
              <TouchableOpacity onPress={toggleRepeatMode} style={style.secondaryBtn}>
                <Ionicons 
                  name={repeat === 'track' ? "repeat-outline" : "repeat"} 
                  size={24} 
                  color={repeat === 'off' ? theme.colors.subtext : theme.colors.button} 
                />
                {repeat === 'track' && <Text style={style.repeatOneBadge}>1</Text>}
              </TouchableOpacity>
              
              <TouchableOpacity onPress={skipToPrevious}>
                <Ionicons name="play-skip-back" size={40} color={theme.colors.text} />
              </TouchableOpacity>
              
              <TouchableOpacity onPress={togglePlayPause} style={style.playBtn}>
                <Ionicons
                  name={isPlaying ? "pause" : "play"}
                  size={40}
                  color={theme.colors.main}
                  style={{ marginLeft: isPlaying ? 0 : 4 }}
                />
              </TouchableOpacity>
              
              <TouchableOpacity onPress={skipToNext}>
                <Ionicons name="play-skip-forward" size={40} color={theme.colors.text} />
              </TouchableOpacity>
              
              <TouchableOpacity onPress={() => setShowPlaylistModal(true)} style={style.secondaryBtn}>
                <Ionicons name="add-circle-outline" size={26} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
      <AddToPlaylistModal 
        visible={showPlaylistModal} 
        track={track} 
        onClose={() => setShowPlaylistModal(false)} 
      />
    </View>
  );
}

const style = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.main,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  iconButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 32,
    paddingTop: 32,
  },
  artworkContainer: {
    width: "100%",
    aspectRatio: 1,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
    marginBottom: 40,
  },
  artwork: {
    width: "100%",
    height: "100%",
    borderRadius: 16,
  },
  textContainer: {
    alignSelf: "stretch",
    alignItems: "flex-start",
  },
  title: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: "700",
  },
  artist: {
    color: theme.colors.subtext,
    fontSize: 18,
    marginTop: 6,
  },
  seekContainer: {
    alignSelf: "stretch",
    marginTop: 32,
  },
  seekTrack: {
    height: 4,
    backgroundColor: theme.colors.buttonDisabled,
    borderRadius: 2,
    position: "relative",
    justifyContent: "center",
  },
  seekFill: {
    height: "100%",
    backgroundColor: theme.colors.button,
    borderRadius: 2,
    position: "absolute",
    left: 0,
    top: 0,
  },
  seekThumb: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#fff",
    position: "absolute",
    marginLeft: -6,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 3,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  timeText: {
    color: theme.colors.subtext,
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    alignSelf: "stretch",
    marginTop: 32,
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.button,
  },
  secondaryBtn: {
    padding: 8,
    position: "relative",
  },
  repeatOneBadge: {
    position: "absolute",
    top: 10,
    right: 5,
    fontSize: 9,
    fontWeight: "bold",
    color: theme.colors.button,
  },
  errorContainer: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  errorTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginTop: 16,
  },
  errorMessage: {
    color: theme.colors.subtext,
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
    marginHorizontal: 32,
  },
  retryBtn: {
    backgroundColor: theme.colors.button,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 24,
  },
  retryBtnText: {
    color: theme.colors.main,
    fontSize: 15,
    fontWeight: "700",
  },
});