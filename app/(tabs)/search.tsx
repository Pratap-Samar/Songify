import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { PressableScale } from "@/components/PressableScale";
import { searchTracks } from "@/lib/api";
import type { Track, AlbumSearchItem } from "@/lib/music";
import Library from "@/components/Library";
import SearchBar from "@/components/SearchBar";
import { theme } from "@/constants/theme";
import { useResponsive } from "@/lib/useResponsive";

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

        // Fire and forget or handle concurrently but without making songs wait for albums.
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
    setCurrentTrackId(track.videoId);
    import("@/lib/playback").then(({ playAndOpenPlayer }) => {
      playAndOpenPlayer(track.videoId, router);
    });
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
        {/* We need to pass autoFocus down if SearchBar supports it, otherwise we'll modify SearchBar too */}
        <SearchBar
          form={form}
          handleChange={setForm}
          handleClearSearch={handleClearSearch}
          autoFocus={true}
          onBack={goBack}
        />
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
          onPressAlbum={(album) => router.push(`/album/${album.id}`)}
          currentTrackId={currentTrackId ?? undefined}
        />
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
