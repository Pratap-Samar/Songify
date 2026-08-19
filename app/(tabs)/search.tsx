import React, { useEffect, useState, useCallback } from "react";
import { StyleSheet, Text, View, FlatList, TouchableOpacity } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { PressableScale } from "@/components/PressableScale";
import { searchTracks } from "@/lib/api";
import type { Track, AlbumSearchItem } from "@/lib/music";
import Library from "@/components/Library";
import SearchBar from "@/components/SearchBar";
import { theme } from "@/constants/theme";
import { useResponsive } from "@/lib/useResponsive";
import { playAndOpenPlayer } from "@/lib/playback";
import { getRecentSearches, saveRecentSearch, removeRecentSearch } from "@/lib/database";
import { useActiveTrack } from "@/hooks/usePlaybackState";

export default function SearchTab() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<"songs" | "albums" | "videos">("songs");
  const [form, setForm] = useState<string>("");
  const [songs, setSongs] = useState<Track[]>([]);
  const [albums, setAlbums] = useState<AlbumSearchItem[]>([]);
  const [videos, setVideos] = useState<Track[]>([]);
  const [songsLoading, setSongsLoading] = useState(false);
  const [albumsLoading, setAlbumsLoading] = useState(false);
  const [videosLoading, setVideosLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const { contentMaxWidth } = useResponsive();
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const { resolvingTrackId } = useActiveTrack();

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      getRecentSearches().then(searches => {
        if (isActive) setRecentSearches(searches);
      });
      return () => { isActive = false; };
    }, [])
  );

  const reloadRecentSearches = async () => {
    const searches = await getRecentSearches();
    setRecentSearches(searches);
  };

  const handleSaveRecent = async (query: string) => {
    const q = query.trim();
    if (q.length >= 3) {
      await saveRecentSearch(q);
      reloadRecentSearches();
    }
  };

  const handleDeleteRecent = async (query: string) => {
    await removeRecentSearch(query);
    reloadRecentSearches();
  };

  useEffect(() => {
    const query = form.trim();
    if (query.length < 3) {
      setSongs([]);
      setAlbums([]);
      setVideos([]);
      setError(null);
      setSongsLoading(false);
      setAlbumsLoading(false);
      setVideosLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setSongsLoading(true);
      setAlbumsLoading(true);
      setVideosLoading(true);
      setError(null);
      try {
        const songPromise = searchTracks(query, controller.signal, "songs");
        const albumPromise = searchTracks(query, controller.signal, "albums");
        const videoPromise = searchTracks(query, controller.signal, "videos");

        songPromise.then(res => {
          if (!controller.signal.aborted) {
            setSongs(res.songs);
            setSongsLoading(false);
          }
        }).catch(err => {
          if (!controller.signal.aborted) {
            setSongs([]);
            setError(err instanceof Error ? err.message : "Search failed.");
            setSongsLoading(false);
          }
        });

        albumPromise.then(res => {
          if (!controller.signal.aborted) {
            setAlbums(res.albums);
            setAlbumsLoading(false);
          }
        }).catch(err => {
          if (!controller.signal.aborted) {
            setAlbums([]);
            setAlbumsLoading(false);
          }
        });

        videoPromise.then(res => {
          if (!controller.signal.aborted) {
            setVideos(res.videos);
            setVideosLoading(false);
          }
        }).catch(err => {
          if (!controller.signal.aborted) {
            setVideos([]);
            setVideosLoading(false);
          }
        });

      } catch (searchError) {
        if (!controller.signal.aborted) {
          setSongs([]);
          setAlbums([]);
          setVideos([]);
          setError(searchError instanceof Error ? searchError.message : "Search failed.");
          setSongsLoading(false);
          setAlbumsLoading(false);
          setVideosLoading(false);
        }
      }
    }, 350);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [form]);

  const handlePressSong = (track: Track) => {
    handleSaveRecent(form);
    setCurrentTrackId(track.videoId);
    playAndOpenPlayer(track.videoId, router, track);
  };
  
  const handlePressAlbum = (album: AlbumSearchItem) => {
    handleSaveRecent(form);
    router.push(`/album/${album.id}`);
  };

  const handleSubmitEditing = () => {
    handleSaveRecent(form);
  };

  const handleClearSearch = () => {
    setForm("");
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  const showingSongs = activeFilter === "songs";
  const showingVideos = activeFilter === "videos";

  return (
    <View style={style.global}>
      <View style={[style.content, { maxWidth: contentMaxWidth }]}>
        <SearchBar
          form={form}
          handleChange={setForm}
          handleClearSearch={handleClearSearch}
          autoFocus={true}
          onBack={goBack}
          onSubmitEditing={handleSubmitEditing}
        />
        
        {form.trim().length < 3 ? (
          <View style={style.recentContainer}>
            {recentSearches.length > 0 ? (
              <>
                <Text style={style.recentTitle}>Recent Searches</Text>
                <FlatList
                  data={recentSearches}
                  keyExtractor={(item) => item}
                  contentContainerStyle={{ paddingHorizontal: 16 }}
                  renderItem={({ item }) => (
                    <View style={style.recentItem}>
                      <PressableScale style={style.recentItemLeft} onPress={() => setForm(item)}>
                        <Ionicons name="time-outline" size={20} color={theme.colors.text.muted} style={{ marginRight: 12 }} />
                        <Text style={style.recentItemText} numberOfLines={1}>{item}</Text>
                      </PressableScale>
                      <TouchableOpacity style={style.recentItemRight} onPress={() => handleDeleteRecent(item)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                        <Ionicons name="close" size={20} color={theme.colors.text.muted} />
                      </TouchableOpacity>
                    </View>
                  )}
                />
              </>
            ) : null}
          </View>
        ) : (
          <>
            <View style={style.filterContainer}>
              {(["songs", "albums", "videos"] as const).map((filter) => {
                const isActive = activeFilter === filter;
                return (
                  <PressableScale
                    key={filter}
                    style={[style.filterChip, isActive && style.filterChipActive]}
                    onPress={() => setActiveFilter(filter)}
                  >
                    <Text style={[style.filterText, isActive && style.filterTextActive]}>
                      {filter.charAt(0).toUpperCase() + filter.slice(1)}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>
            <Library
              songs={showingSongs ? songs : showingVideos ? videos : []}
              albums={showingSongs || showingVideos ? [] : albums}
              isSearching={showingSongs ? songsLoading : showingVideos ? videosLoading : albumsLoading}
              error={error}
              query={form.trim()}
              onPressSong={handlePressSong}
              onPressAlbum={handlePressAlbum}
              currentTrackId={currentTrackId ?? undefined}
              resolvingTrackId={resolvingTrackId}
            />
          </>
        )}
      </View>
    </View>
  );
}

const style = StyleSheet.create({
  global: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    backgroundColor: theme.colors.bg.page,
    alignItems: "center",
  },
  content: {
    flex: 1,
    width: "100%",
  },
  recentContainer: {
    flex: 1,
    paddingTop: 8,
  },
  recentTitle: {
    color: theme.colors.text.primary,
    fontSize: 18,
    fontWeight: "bold",
    marginHorizontal: 16,
    marginBottom: 16,
  },
  recentItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  recentItemLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  recentItemText: {
    color: theme.colors.text.primary,
    fontSize: 16,
  },
  recentItemRight: {
    paddingLeft: 12,
  },
  filterContainer: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: theme.colors.bg.surface,
  },
  filterChipActive: {
    backgroundColor: theme.colors.accent.blue,
  },
  filterText: {
    color: theme.colors.text.primary,
    fontSize: 13,
  },
  filterTextActive: {
    color: theme.colors.text.onPrimary,
    fontWeight: "600",
  },
});
