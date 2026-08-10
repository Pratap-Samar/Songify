import { StyleSheet, Text, View, useWindowDimensions, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { PressableScale } from "./PressableScale";
import { hexToRgba } from "@/lib/colorUtils";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet as RNStyleSheet } from "react-native";
import { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { theme } from "@/constants/theme";
import { useActiveTrack, usePlaybackProgress, usePlaybackControls, usePlaybackSession } from "@/hooks/usePlaybackState";
import { seekTo } from "@/lib/track-player";
import type { Track } from "@/lib/music";
import { useLikeModal } from "@/lib/LikeModalContext";
function fmt(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function PlayerScreen({ videoId }: { videoId: string }) {
  const router = useRouter();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { track, error } = useActiveTrack();
  const session = usePlaybackSession();
  const { position, duration } = usePlaybackProgress();
  const { isPlaying, togglePlayPause, skipToNext, skipToPrevious, repeatMode, toggleRepeatMode } = usePlaybackControls();
  const { openLikeModal, isLiked } = useLikeModal();
  const liked = track ? isLiked(track.videoId) : false;
  // ── Download state (mock) ───────────────────────────────────────
  const [downloadState, setDownloadState] = useState<'none' | 'downloading' | 'downloaded'>('none');

  // Reset download state when track changes
  useEffect(() => {
    setDownloadState('none');
  }, [track?.videoId]);

  // ── Seek visual state ───────────────────────────────────────────
  const [seeking, setSeeking] = useState(false);
  const [seekPct, setSeekPct] = useState(0);
  const barWidthRef = useRef(0);
  const durationRef = useRef(0);
  durationRef.current = duration;

  const ringOpacity = useRef(new Animated.Value(0)).current;

  const interpolatedBorderColor = ringOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', theme.colors.accent.link]
  });

  useEffect(() => {
    Animated.timing(ringOpacity, {
      toValue: isPlaying ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isPlaying]);

  // Sync repeat mode (now handled by hook)

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



  // ── Layout Calculations ─────────────────────────────────────────
  // Artwork should be roughly 70-80% of width, max 320.
  const artworkSize = Math.min(screenWidth * 0.75, 340);
  
  // Compact layout adjustments for smaller screens
  const isCompact = screenHeight < 700;



  // ── Render ──────────────────────────────────────────────────────
  return (
    <View style={[style.container, { backgroundColor: theme.colors.bg.page }]}>
      {track?.thumbnailUrl && (
        <View style={StyleSheet.absoluteFillObject}>
          <Image
            source={{ uri: track.thumbnailUrl.replace("w120-h120", "w600-h600") }}
            style={StyleSheet.absoluteFillObject}
            blurRadius={90}
            contentFit="cover"
          />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: theme.colors.bg.page, opacity: 0.90 }]} />
        </View>
      )}
      <View style={[style.header, isCompact && { paddingTop: 24, paddingBottom: 8 }]}>
        <PressableScale onPress={() => router.canGoBack() ? router.back() : router.replace("/")} style={style.iconButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-down" size={32} color={theme.colors.text.primary} />
        </PressableScale>
        <View style={style.headerCenter}>
          <Text style={style.headerTitle}>Now Playing</Text>
          {session?.source === "album" && session.collectionId && session.collectionTitle && (
            <PressableScale onPress={() => router.push(`/album/${session.collectionId}`)}>
              <Text numberOfLines={1} style={[style.headerCollectionTitle, { color: theme.colors.accent.link }]}>
                {session.collectionTitle}
              </Text>
            </PressableScale>
          )}
        </View>
        <View style={{ width: 32 }} />
      </View>
      <View style={[style.content, isCompact ? { paddingTop: 24 } : { paddingTop: 20 }]}>
        {error ? (
          <View style={style.errorContainer}>
            <Ionicons name="alert-circle" size={48} color={theme.colors.text.secondary} />
            <Text style={style.errorTitle}>Could not load track</Text>
            <Text style={style.errorMessage}>{error}</Text>
            <PressableScale
              style={style.retryBtn}
              onPress={() => router.canGoBack() ? router.back() : router.replace("/")}
            >
              <Text style={style.retryBtnText}>Go back</Text>
            </PressableScale>
          </View>
        ) : (
          <View style={style.playerLayout}>
              <View style={[style.artworkShadowContainer, { marginBottom: isCompact ? 48 : 96 }]}>
                <Animated.View style={[style.artworkWrapper, { width: artworkSize, height: artworkSize, borderColor: interpolatedBorderColor }]}>
                  {track?.thumbnailUrl && (
                    <Image
                      source={{ uri: track.thumbnailUrl.replace("w120-h120", "w600-h600") }}
                      style={style.artwork}
                      cachePolicy="disk" contentFit="cover" transition={150}
                    />
                  )}
                </Animated.View>
              </View>
            <View style={style.bottomSection}>
              <View style={style.titleRow}>
                <View style={style.textWrapper}>
                  <Text numberOfLines={1} style={[style.title, isCompact && { fontSize: 20 }]}>
                    {track?.title ?? "Loading..."}
                  </Text>
                  <Text numberOfLines={1} style={[style.artist, isCompact && { fontSize: 16 }]}>
                    {(track?.artists ?? []).join(", ") || ""}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <PressableScale
                    style={style.downloadBtn}
                    onPress={() => {
                      if (downloadState === 'none') {
                        setDownloadState('downloading');
                        // Simulate download for now
                        setTimeout(() => setDownloadState('downloaded'), 1500);
                      }
                    }}
                  >
                    {downloadState === 'downloading' ? (
                      <ActivityIndicator size="small" color={theme.colors.text.primary} />
                    ) : (
                      <Ionicons 
                        name={downloadState === 'downloaded' ? 'checkmark-circle' : 'download'} 
                        size={26} 
                        color={downloadState === 'downloaded' ? theme.colors.accent.status : theme.colors.text.primary} 
                      />
                    )}
                  </PressableScale>
                </View>
              </View>

              {/* ── Seek bar + time labels ──────────────────── */}
              <View style={[style.seekContainer, isCompact && { marginTop: 16 }]}>
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
                  <View style={[style.seekThumb, { left: `${displayPct * 100}%` }]} />
                </View>
                <View style={style.timeRow}>
                  <Text style={style.timeText}>{fmt(displayPos)}</Text>
                  <Text style={style.timeText}>
                    {duration > 0 ? `-${fmt(duration - displayPos)}` : fmt(0)}
                  </Text>
                </View>
              </View>

              <View style={[style.controls, isCompact && { marginTop: 24, marginBottom: 16 }]}>
                <PressableScale 
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    toggleRepeatMode();
                  }} 
                  style={[style.secondaryBtn, repeatMode !== 'off' && style.activePill]} 
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons 
                    name={repeatMode === 'track' ? "repeat" : "repeat"} 
                    size={28} 
                    color={repeatMode !== 'off' ? theme.colors.text.primary : theme.colors.text.secondary} 
                    style={repeatMode !== 'off' ? {
                      textShadowColor: theme.colors.accent.secondary,
                      textShadowRadius: 1,
                      textShadowOffset: { width: 0.5, height: 0.5 }
                    } : undefined}
                  />
                  {repeatMode === 'track' && <Text style={[style.repeatOneBadge, { color: theme.colors.text.primary }]}>1</Text>}
                </PressableScale>
                
                <PressableScale 
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    skipToPrevious();
                  }} 
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons name="play-skip-back" size={isCompact ? 36 : 42} color={theme.colors.text.primary} />
                </PressableScale>
                
                <PressableScale 
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    togglePlayPause();
                  }} 
                  style={[style.playBtn, isCompact && { width: 64, height: 64, borderRadius: 32 }, { overflow: 'hidden', backgroundColor: theme.colors.accent.primary }]} 
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons
                    name={isPlaying ? "pause" : "play"}
                    size={isCompact ? 36 : 42}
                    color={theme.colors.text.onPrimary}
                    style={{ marginLeft: isPlaying ? 0 : 4, zIndex: 1 }}
                  />
                </PressableScale>
                
                <PressableScale 
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    skipToNext();
                  }} 
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons name="play-skip-forward" size={isCompact ? 36 : 42} color={theme.colors.text.primary} />
                </PressableScale>
                
                <PressableScale 
                  onPress={() => {
                    if (track) {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      openLikeModal(track);
                    }
                  }} 
                  style={style.secondaryBtn} 
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons 
                    name={liked ? "heart" : "heart-outline"} 
                    size={28} 
                    color={liked ? theme.colors.accent.likeBold : theme.colors.text.secondary} 
                    style={liked ? { textShadowColor: theme.colors.accent.likeBold, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 6 } : {}}
                  />
                </PressableScale>
              </View>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const style = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg.page,
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
    color: theme.colors.text.primary,
    fontSize: 15,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  headerCenter: {
    alignItems: "center",
    flex: 1,
  },
  headerCollectionTitle: {
    color: theme.colors.text.secondary,
    fontSize: 13,
    marginTop: 6,
    maxWidth: 220,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
  },
  playerLayout: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  artworkShadowContainer: {
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    backgroundColor: theme.colors.bg.surface,
    borderRadius: 16,
  },
  artworkWrapper: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  artwork: {
    width: "100%",
    height: "100%",
  },
  bottomSection: {
    width: "100%",
    paddingBottom: 24,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 8,
  },
  textWrapper: {
    flex: 1,
    alignItems: "flex-start",
    justifyContent: "center",
    paddingRight: 16,
  },
  downloadBtn: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 44,
    minHeight: 44,
  },
  title: {
    color: theme.colors.text.primary,
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 6,
  },
  artist: {
    fontSize: 16,
    color: theme.colors.text.metadata,
  },
  seekContainer: {
    alignSelf: "stretch",
    marginTop: 12,
  },
  seekTrack: {
    height: 6,
    backgroundColor: theme.colors.border.strong,
    borderRadius: 2,
    position: "relative",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  seekFill: {
    height: "100%",
    backgroundColor: theme.colors.accent.primary,
    borderRadius: 2,
    position: "absolute",
    left: 0,
    top: 0,
  },
  seekThumb: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.accent.primary,
    position: "absolute",
    marginLeft: -5,
    shadowColor: "#000",
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
    fontSize: 12,
    color: theme.colors.text.metadata,
    fontVariant: ['tabular-nums'],
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 32,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.accent.primary,
  },
  secondaryBtn: {
    padding: 8,
    borderRadius: 24,
    position: "relative",
  },
  activePill: {
    backgroundColor: hexToRgba(theme.colors.accent.secondary, 0.2),
  },
  repeatOneBadge: {
    position: "absolute",
    top: 10,
    right: 5,
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.accent.primary,
  },
  repeatDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.accent.secondary,
    position: "absolute",
    bottom: 2,
    alignSelf: "center",
  },
  errorContainer: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  errorTitle: {
    color: theme.colors.text.primary,
    fontSize: 17,
    fontWeight: "700",
    marginTop: 16,
  },
  errorMessage: {
    color: theme.colors.text.muted,
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
    marginHorizontal: 32,
  },
  retryBtn: {
    backgroundColor: theme.colors.accent.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 24,
  },
  retryBtnText: {
    color: theme.colors.text.onPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
});
