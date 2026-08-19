import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { StyleSheet, View, Text, FlatList, ActivityIndicator, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { PressableScale } from "@/components/PressableScale";
import MarqueeText from "@/components/MarqueeText";
import { getAlbum } from "@/lib/api";
import { playCollection } from "@/lib/playback";
import type { Album, Track } from "@/lib/music";
import { theme } from "@/constants/theme";
import { useResponsive } from "@/lib/useResponsive";
import { useActiveTrack, useShuffleMode, usePlaybackSession, usePlaybackControls } from "@/hooks/usePlaybackState";
import { useTabBarHeight } from "@/lib/TabBarHeightContext";
import { addAlbum, removeAlbum, isAlbumSaved, initDb } from "@/lib/database";
import { useLikeModal } from "@/lib/LikeModalContext";
import { darkenHex, hexToRgba } from "@/lib/colorUtils";
import { SkeletonLoader } from "@/components/SkeletonLoader";

const TrackRowItem = React.memo(({ item, index, isCurrentlyPlaying, isPlaying, isResolving, handlePlayTrack, liked, openLikeModal }: any) => {
  const isPlayingThis = isCurrentlyPlaying && isPlaying;

  return (
    <PressableScale style={style.trackRow} onPress={() => handlePlayTrack(index)}>
      <View style={style.trackNumberContainer}>
        {isResolving ? (
          <ActivityIndicator size="small" color={theme.colors.accent.blue} />
        ) : isPlayingThis ? (
          <Ionicons name="stats-chart" size={16} color={theme.colors.accent.status} />
        ) : (
          <Text style={[style.trackNumber, isCurrentlyPlaying && style.trackNumberPlaying]}>
            {index + 1}
          </Text>
        )}
      </View>
      
      <View style={style.trackDetails}>
        <MarqueeText 
          style={[style.trackTitle, isCurrentlyPlaying && style.trackTitlePlaying]} 
          text={item.title}
          animate={isCurrentlyPlaying}
        />
        <Text style={style.trackArtist} numberOfLines={1}>
          {item.artists.join(", ")}
        </Text>
      </View>
      
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text style={style.trackDuration}>{item.duration}</Text>
        <PressableScale style={style.downloadBtn} onPress={() => openLikeModal(item)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons 
            name={liked ? "heart" : "heart-outline"} 
            size={24} 
            color={liked ? theme.colors.accent.likeBold : theme.colors.text.secondary} 
            style={liked ? { textShadowColor: "#ffffff", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 2 } : {}}
          />
        </PressableScale>
      </View>
    </PressableScale>
  );
});

export default function AlbumScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [album, setAlbum] = useState<Album | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { contentMaxWidth, titleSize, baseSize } = useResponsive();
  const shuffleEnabled = useShuffleMode();
  const { track: activeTrack, isPlaying, resolvingTrackId } = useActiveTrack();
  const session = usePlaybackSession();
  const { togglePlayPause } = usePlaybackControls();
  const [isSaved, setSaved] = useState(false);
  const [toggling, setToggling] = useState(false);
  const { openLikeModal, isLiked } = useLikeModal();
  const { tabBarHeight } = useTabBarHeight();
  
  const scrollY = useRef(new Animated.Value(0)).current;

  const isThisCollectionActive = session?.source === "album" && session?.collectionId === album?.id;
  const showPause = isThisCollectionActive && isPlaying;
  const albumArtworkSource = useMemo(() => {
    return album?.artwork ? { uri: album.artwork } : undefined;
  }, [album?.artwork]);

  const handleMainPlay = useCallback(() => {
    if (isThisCollectionActive) {
      togglePlayPause();
    } else {
      if (album) {
        playCollection({
          type: "album",
          id: album.id,
          title: album.title,
          artwork: album.artwork,
          tracks: album.tracks,
          startIndex: 0,
        }, router);
      }
    }
  }, [isThisCollectionActive, album, togglePlayPause, router]);
  
  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, [router]);

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    
    getAlbum(id)
      .then((data) => {
        if (mounted) {
          setAlbum(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load album");
          setLoading(false);
        }
      });
      
    return () => { mounted = false; };
  }, [id]);

  useEffect(() => {
    if (!album) return;
    let mounted = true;
    (async () => {
      try {
        await initDb();
        const alreadySaved = await isAlbumSaved(album.id);
        if (mounted) setSaved(alreadySaved);
      } catch {
        if (mounted) setSaved(false);
      }
    })();
    return () => { mounted = false; };
  }, [album]);

  const handleToggleSave = useCallback(async () => {
    if (toggling || !album) return;
    setToggling(true);
    try {
      await initDb();
      if (isSaved) {
        await removeAlbum(album.id);
        setSaved(false);
      } else {
        await addAlbum(album.id, album.title, album.artists, album.artwork ?? null, album.year ?? null);
        setSaved(true);
      }
    } catch (e) {
      console.error("[AlbumScreen] toggle saved album failed:", e);
    } finally {
      setToggling(false);
    }
  }, [album, isSaved, toggling]);

  const handlePlayTrack = useCallback((index: number) => {
    if (!album) return;
    playCollection({
      type: "album",
      id: album.id,
      title: album.title,
      artwork: album.artwork,
      tracks: album.tracks,
      startIndex: index,
    }, router);
  }, [album, router]);

  const renderTrack = useCallback(({ item, index }: { item: Track; index: number }) => {
    const isCurrentlyPlaying = isThisCollectionActive && activeTrack?.videoId === item.videoId;
    return (
      <TrackRowItem 
        item={item} 
        index={index} 
        isCurrentlyPlaying={isCurrentlyPlaying} 
        isPlaying={isPlaying} 
        handlePlayTrack={handlePlayTrack} 
        liked={isLiked(item.videoId)}
        openLikeModal={openLikeModal}
      />
    );
  }, [isThisCollectionActive, activeTrack, isPlaying, handlePlayTrack, isLiked, openLikeModal]);

  const renderSeparator = useCallback(() => (
    <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.1)", marginLeft: 56 }} />
  ), []);

  if (loading) {
    return (
      <SafeAreaView style={style.container}>
        <View style={{ alignItems: "center", paddingTop: 60, paddingHorizontal: 20 }}>
          <SkeletonLoader width={300} height={300} borderRadius={12} style={{ marginBottom: 24 }} />
          <SkeletonLoader width="50%" height={22} style={{ marginBottom: 12 }} />
          <SkeletonLoader width="30%" height={16} style={{ marginBottom: 32 }} />
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 32 }}>
            <SkeletonLoader width={120} height={44} borderRadius={22} />
            <SkeletonLoader width={44} height={44} borderRadius={22} />
            <SkeletonLoader width={44} height={44} borderRadius={22} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !album) {
    return (
      <View style={style.errorContainer}>
        <Ionicons name="alert-circle" size={64} color={theme.colors.text.secondary} />
        <Text style={style.errorTitle}>Album Not Found</Text>
        <Text style={style.errorText}>{error || "Could not load the album details."}</Text>
        <PressableScale style={style.backBtn} onPress={goBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={style.backBtnText}>Go Back</Text>
        </PressableScale>
      </View>
    );
  }

  const renderHeader = () => (
    <View style={style.headerContainer}>
      <View style={style.artworkWrapper}>
        {album.artwork ? (
          <Image source={albumArtworkSource} style={style.artwork} cachePolicy="disk" contentFit="cover" transition={150} />
        ) : (
          <View style={style.artworkPlaceholder}>
            <Ionicons name="musical-notes" size={64} color={theme.colors.text.secondary} />
          </View>
        )}
      </View>

      <Text style={[style.title, { fontSize: titleSize }]} numberOfLines={2}>
        {album.title}
      </Text>
      
      <Text style={[style.artist, { fontSize: baseSize, color: theme.colors.accent.link }]}>
        {album.artists.join(", ")}
      </Text>
      
      <Text style={[style.metadata, { fontSize: baseSize * 0.85 }]}>
        {album.year ? `${album.year} • ` : ""}
        {album.trackCount || album.tracks.length} Songs
        {album.duration ? ` • ${album.duration}` : ""}
      </Text>

      <View style={style.controlsRow}>
        <PressableScale onPress={handleMainPlay}>
          <View
            style={[style.playButton, { backgroundColor: theme.colors.accent.primary }]}
          >
            <Ionicons name={showPause ? "pause" : "play"} size={28} color={theme.colors.text.onPrimary} style={{ marginLeft: showPause ? 0 : 4 }} />
          </View>
        </PressableScale>
        <PressableScale 
          style={[style.actionButton, shuffleEnabled && { backgroundColor: hexToRgba(theme.colors.accent.secondary, 0.2), borderColor: "transparent" }]}
          onPress={async () => {
            import("expo-haptics").then(Haptics => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
            const { toggleShuffleMode } = await import("@/lib/track-player");
            await toggleShuffleMode();
          }}
        >
          <Ionicons name="shuffle" size={24} color={shuffleEnabled ? theme.colors.text.primary : theme.colors.text.secondary} />
        </PressableScale>
        <PressableScale
          style={style.actionButton}
          onPress={handleToggleSave}
          disabled={toggling}
        >
          {toggling ? (
            <ActivityIndicator size="small" color={theme.colors.text.primary} />
          ) : (
            <Ionicons 
              name={isSaved ? "heart" : "heart-outline"} 
              size={24} 
              color={isSaved ? theme.colors.accent.likeBold : theme.colors.text.secondary} 
              style={isSaved ? { textShadowColor: "#ffffff", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 2 } : {}}
            />
          )}
        </PressableScale>
      </View>
    </View>
  );

  const headerOpacity = scrollY.interpolate({
    inputRange: [200, 280],
    outputRange: [0, 1],
    extrapolate: "clamp"
  });

  return (
    <SafeAreaView edges={["top"]} style={style.container}>
      {album.artwork && (
        <View style={StyleSheet.absoluteFillObject}>
          <Image
            source={albumArtworkSource}
            style={StyleSheet.absoluteFillObject}
            blurRadius={80}
            contentFit="cover"
          />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: theme.colors.bg.page, opacity: 0.85 }]} />
        </View>
      )}
      
      <Animated.View style={[style.stickyHeader, { opacity: headerOpacity }]} pointerEvents="box-none">
        <Text style={style.stickyTitle} numberOfLines={1}>{album.title}</Text>
        <PressableScale onPress={handleMainPlay} style={style.stickyPlayButton}>
          <Ionicons name={showPause ? "pause" : "play"} size={20} color={theme.colors.text.onPrimary} style={{ marginLeft: showPause ? 0 : 2 }} />
        </PressableScale>
      </Animated.View>

      <PressableScale style={style.absoluteBack} onPress={goBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
        <Ionicons name="chevron-back" size={32} color={theme.colors.text.primary} />
      </PressableScale>

      <Animated.FlatList
        data={album.tracks}
        keyExtractor={(item, index) => `${item.videoId}-${index}`}
        ListHeaderComponent={renderHeader}
        renderItem={renderTrack}
        ItemSeparatorComponent={renderSeparator}
        style={style.trackList}
        contentContainerStyle={[style.listContent, { maxWidth: contentMaxWidth, alignSelf: "center", width: "100%", paddingBottom: tabBarHeight + 20 }]}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      />
    </SafeAreaView>
  );
}

const style = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg.page,
  },
  center: {
    flex: 1,
    backgroundColor: theme.colors.bg.page,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    backgroundColor: theme.colors.bg.page,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorTitle: {
    color: theme.colors.text.primary,
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    color: theme.colors.text.primary,
    fontSize: 15,
    marginBottom: 16,
  },
  backBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: theme.colors.bg.surface,
    borderRadius: 8,
  },
  backBtnText: {
    color: theme.colors.text.primary,
    fontWeight: "bold",
  },
  listContent: {
    paddingBottom: 16,
    paddingHorizontal: 4,
    paddingTop: 60,
  },
  trackList: {
    flex: 1,
  },
  headerContainer: {
    alignItems: "center",
    padding: 24,
    paddingTop: 12,
  },
  absoluteBack: {
    position: "absolute",
    top: 48,
    left: 16,
    zIndex: 20,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 20,
  },
  stickyHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 96,
    paddingTop: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.bg.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.1)",
    zIndex: 15,
  },
  stickyTitle: {
    color: theme.colors.text.primary,
    fontSize: 16,
    fontWeight: "bold",
    maxWidth: "60%",
    textAlign: "center",
  },
  stickyPlayButton: {
    position: "absolute",
    right: 16,
    bottom: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.accent.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  artworkWrapper: {
    width: 240,
    height: 240,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    marginBottom: 24,
    backgroundColor: theme.colors.bg.surface,
  },
  artwork: {
    width: "100%",
    height: "100%",
    borderRadius: 16,
  },
  artworkPlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    color: theme.colors.text.primary,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  artist: {
    color: theme.colors.text.metadata,
    fontWeight: "600",
    marginBottom: 8,
  },
  metadata: {
    color: theme.colors.text.muted,
    marginBottom: 24,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  playButton: {
    backgroundColor: theme.colors.accent.primary,
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: theme.colors.accent.primary,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  playButtonText: {
    color: theme.colors.text.onPrimary,
    fontWeight: "bold",
    fontSize: 15,
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.bg.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  actionButtonDisabled: {
    backgroundColor: theme.colors.disabled.bg,
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 0,
  },
  trackNumberContainer: {
    width: 32,
    alignItems: "center",
  },
  trackNumber: {
    color: theme.colors.text.muted,
    fontSize: 13,
  },
  trackNumberPlaying: {
    color: theme.colors.accent.primary,
    fontWeight: "bold",
  },
  trackDetails: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "center",
  },
  trackTitle: {
    color: theme.colors.text.primary,
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 4,
  },
  trackTitlePlaying: {
    color: theme.colors.accent.primary,
  },
  trackArtist: {
    color: theme.colors.text.metadata,
    fontSize: 13,
  },
  trackDuration: {
    color: theme.colors.text.muted,
    fontSize: 13,
    marginRight: 12,
  },
  downloadBtn: {
    padding: 4,
  },
});
