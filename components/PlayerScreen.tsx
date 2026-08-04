import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { theme } from "@/constants/theme";
import { useActiveTrack, usePlaybackProgress, usePlaybackControls, usePlaybackSession } from "@/hooks/usePlaybackState";
import { seekTo } from "@/lib/track-player";
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
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { track, error } = useActiveTrack();
  const session = usePlaybackSession();
  const { position, duration } = usePlaybackProgress();
  const { isPlaying, togglePlayPause, skipToNext, skipToPrevious, repeatMode, toggleRepeatMode } = usePlaybackControls();
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);

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
    <View style={style.container}>
      <View style={[style.header, isCompact && { paddingTop: 24, paddingBottom: 8 }]}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace("/")} style={style.iconButton}>
          <Ionicons name="chevron-down" size={32} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={style.headerCenter}>
          <Text style={style.headerTitle}>Now Playing</Text>
          {session?.source === "album" && session.collectionId && session.collectionTitle && (
            <TouchableOpacity onPress={() => router.push(`/album/${session.collectionId}`)}>
              <Text numberOfLines={1} style={style.headerCollectionTitle}>
                {session.collectionTitle}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={{ width: 32 }} />
      </View>
      <View style={[style.content, isCompact ? { paddingTop: 24 } : { paddingTop: 20 }]}>
        {error ? (
          <View style={style.errorContainer}>
            <Ionicons name="alert-circle" size={48} color={theme.colors.notificationError} />
            <Text style={style.errorTitle}>Could not load track</Text>
            <Text style={style.errorMessage}>{error}</Text>
            <TouchableOpacity
              style={style.retryBtn}
              onPress={() => router.canGoBack() ? router.back() : router.replace("/")}
            >
              <Text style={style.retryBtnText}>Go back</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={style.playerLayout}>
            <View style={[style.artworkContainer, { width: artworkSize, height: artworkSize, marginBottom: isCompact ? 48 : 96 }]}>
              {track?.thumbnailUrl && (
                <Image
                  source={{ uri: track.thumbnailUrl }}
                  style={style.artwork}
                  cachePolicy="disk" contentFit="cover" transition={150}
                />
              )}
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
                <TouchableOpacity
                  style={style.downloadBtn}
                  onPress={() => {
                    if (downloadState === 'none') {
                      setDownloadState('downloading');
                      // Simulate download for now
                      setTimeout(() => setDownloadState('downloaded'), 1500);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  {downloadState === 'downloading' ? (
                    <ActivityIndicator size="small" color={theme.colors.text} />
                  ) : (
                    <Ionicons 
                      name={downloadState === 'downloaded' ? 'checkmark-circle' : 'download-outline'} 
                      size={26} 
                      color={downloadState === 'downloaded' ? theme.colors.button : theme.colors.text} 
                    />
                  )}
                </TouchableOpacity>
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

              <View style={[style.controls, isCompact && { marginTop: 24, marginBottom: 16 }]}>
                <TouchableOpacity onPress={toggleRepeatMode} style={style.secondaryBtn}>
                  <Ionicons 
                    name={repeatMode === 'track' ? "repeat-outline" : "repeat"} 
                    size={26} 
                    color={repeatMode === 'off' ? theme.colors.subtext : theme.colors.button} 
                  />
                  {repeatMode === 'track' && <Text style={style.repeatOneBadge}>1</Text>}
                </TouchableOpacity>
                
                <TouchableOpacity onPress={skipToPrevious}>
                  <Ionicons name="play-skip-back" size={isCompact ? 36 : 42} color={theme.colors.text} />
                </TouchableOpacity>
                
                <TouchableOpacity onPress={togglePlayPause} style={[style.playBtn, isCompact && { width: 64, height: 64, borderRadius: 32 }]}>
                  <Ionicons
                    name={isPlaying ? "pause" : "play"}
                    size={isCompact ? 36 : 42}
                    color={theme.colors.main}
                    style={{ marginLeft: isPlaying ? 0 : 4 }}
                  />
                </TouchableOpacity>
                
                <TouchableOpacity onPress={skipToNext}>
                  <Ionicons name="play-skip-forward" size={isCompact ? 36 : 42} color={theme.colors.text} />
                </TouchableOpacity>
                
                <TouchableOpacity onPress={() => setShowPlaylistModal(true)} style={style.secondaryBtn}>
                  <Ionicons name="add-circle-outline" size={28} color={theme.colors.text} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
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
  headerCenter: {
    alignItems: "center",
    flex: 1,
  },
  headerCollectionTitle: {
    color: theme.colors.button,
    fontSize: 14,
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
  artworkContainer: {
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  artwork: {
    width: "100%",
    height: "100%",
    borderRadius: 16,
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
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 6,
  },
  artist: {
    color: theme.colors.buttonDisabled,
    fontSize: 18,
    fontWeight: "500",
  },
  seekContainer: {
    alignSelf: "stretch",
    marginTop: 12,
  },
  seekTrack: {
    height: 4,
    backgroundColor: theme.colors.buttonDisabled,
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
