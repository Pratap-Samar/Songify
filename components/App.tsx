import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { initDb } from "@/lib/database";
import { searchTracks } from "@/lib/api";
import type { Track } from "@/lib/music";
import Library from "./Library";
import SearchBar from "./SearchBar";
import NowPlayingBar from "./NowPlayingBar";

export default function App() {
  const router = useRouter();
  const [form, setForm] = useState<string>("");
  const [songs, setSongs] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);

  useEffect(() => {
    initDb();
  }, []);

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
    router.push({ pathname: "/player", params: { videoId: track.videoId } });
    setCurrentTrack(track);
  };

  const handleClearSearch = () => {
    setForm("");
  };

  return (
    <View style={style.global}>
      <SearchBar
        form={form}
        handleChange={setForm}
        handleClearSearch={handleClearSearch}
      ></SearchBar>
      <Library
        songs={songs}
        isSearching={isSearching}
        error={error}
        query={form.trim()}
        onPressSong={handlePressSong}
      ></Library>
      <NowPlayingBar
        currentTrack={currentTrack}
        onPress={() => {
          if (currentTrack) {
            router.push({ pathname: "/player", params: { videoId: currentTrack.videoId } });
          }
        }}
      ></NowPlayingBar>
    </View>
  );
}

const style = StyleSheet.create({
  global: {
    backgroundColor: "#F2F0EF",
    flex: 1,
  },
});