import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { searchTracks } from "@/lib/api";
import type { Track, AlbumSearchItem } from "@/lib/music";
import Library from "@/components/Library";
import SearchBar from "@/components/SearchBar";
import { theme } from "@/constants/theme";
import { useResponsive } from "@/lib/useResponsive";

export default function SearchTab() {
  const router = useRouter();
  const [form, setForm] = useState<string>("");
  const [songs, setSongs] = useState<Track[]>([]);
  const [albums, setAlbums] = useState<AlbumSearchItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const { contentMaxWidth, spacing } = useResponsive();

  useEffect(() => {
    const query = form.trim();
    if (query.length < 3) {
      setSongs([]);
      setAlbums([]);
      setError(null);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setIsSearching(true);
      setError(null);
      try {
        const songPromise = searchTracks(query, controller.signal, "songs");
        const albumPromise = searchTracks(query, controller.signal, "albums");

        // Fire and forget or handle concurrently but without making songs wait for albums.
        songPromise.then(res => {
          if (!controller.signal.aborted) {
            setSongs(res.songs);
            setIsSearching(false);
          }
        }).catch(err => {
          if (!controller.signal.aborted) {
            setSongs([]);
            setError(err instanceof Error ? err.message : "Search failed.");
            setIsSearching(false);
          }
        });

        albumPromise.then(res => {
          if (!controller.signal.aborted) {
            setAlbums(res.albums);
          }
        }).catch(err => {
          if (!controller.signal.aborted) {
            setAlbums([]);
          }
        });

      } catch (searchError) {
        if (!controller.signal.aborted) {
          setSongs([]);
          setAlbums([]);
          setError(searchError instanceof Error ? searchError.message : "Search failed.");
          setIsSearching(false);
        }
      }
    }, 350);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [form]);

  const handlePressSong = (track: Track) => {
    const startIndex = songs.findIndex((t) => t.videoId === track.videoId);
    setCurrentTrackId(track.videoId);
    import("@/lib/playback").then(({ playCollection }) => {
      playCollection({
        type: "search",
        id: "search-" + form,
        title: `Search: ${form}`,
        tracks: songs,
        startIndex: startIndex >= 0 ? startIndex : 0,
      }, router);
    });
  };

  const handleClearSearch = () => {
    setForm("");
  };

  return (
    <View style={style.global}>
      <View style={[style.content, { maxWidth: contentMaxWidth }]}>
        {/* We need to pass autoFocus down if SearchBar supports it, otherwise we'll modify SearchBar too */}
        <SearchBar
          form={form}
          handleChange={setForm}
          handleClearSearch={handleClearSearch}
          autoFocus={true}
          onBack={() => router.back()}
        />
        <Library
          songs={songs}
          albums={albums}
          isSearching={isSearching}
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
    backgroundColor: theme.colors.main,
    alignItems: "center",
  },
  content: {
    flex: 1,
    width: "100%",
  },
});
