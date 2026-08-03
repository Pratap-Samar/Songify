import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { searchTracks } from "@/lib/api";
import type { Track } from "@/lib/music";
import Library from "@/components/Library";
import SearchBar from "@/components/SearchBar";
import { theme } from "@/constants/theme";
import { useResponsive } from "@/lib/useResponsive";

export default function SearchTab() {
  const router = useRouter();
  const [form, setForm] = useState<string>("");
  const [songs, setSongs] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const { contentMaxWidth, spacing } = useResponsive();

  useEffect(() => {
    const query = form.trim();
    if (query.length < 3) {
      setSongs([]);
      setError(null);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setIsSearching(true);
      setError(null);
      try {
        setSongs(await searchTracks(query, controller.signal));
      } catch (searchError) {
        if (!controller.signal.aborted) {
          setSongs([]);
          setError(searchError instanceof Error ? searchError.message : "Search failed.");
        }
      } finally {
        if (!controller.signal.aborted) {
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
    setCurrentTrackId(track.videoId);
    import("@/lib/playback").then(({ playAndOpenPlayer }) => {
      playAndOpenPlayer(track.videoId, router);
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
          isSearching={isSearching}
          error={error}
          query={form.trim()}
          onPressSong={handlePressSong}
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
