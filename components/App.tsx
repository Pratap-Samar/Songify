import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Library from "./Library";
import SearchBar from "./SearchBar";

export type song = {
  key: Number;
  name: string;
  artist: string;
  thumbnail: string;
};

export default function App() {
  const [form, setForm] = useState<string>("");
  const [songs, setSongs] = useState<song[] | undefined>(undefined);

  const handleChange = (e: string) => {
    setForm(e);
  };

  const findMusic = async (song: string) => {
    try {
      const res = await fetch(`http://localhost:8080/${song}`);
      const songData = await res.json();
      console.log(songData);
      const songs: song[] = [];
      let id = 0;
      for (const data of songData) {
        id++;
        const songNew = {
          key: id,
          name: data.name,
          artist: data.artist ? data.artist.name : "unknown",
          thumbnail: data.thumbnails[0].url,
        } satisfies song;
        songs.push(songNew);
      }
      setSongs(songs);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (form != "" && form.length > 2) {
      findMusic(form);
    }
  }, [form]);

  const handleClearSearch = () => {
    setForm("");
  };
  return (
    <View style={style.global}>
      <SearchBar
        form={form}
        handleChange={handleChange}
        handleClearSearch={handleClearSearch}
      ></SearchBar>
      <Library songs={songs}></Library>
    </View>
  );
}

const style = StyleSheet.create({
  global: {
    backgroundColor: "#F2F0EF",
    height: "100%",
  },
});
