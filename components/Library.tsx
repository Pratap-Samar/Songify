import { Image, StyleSheet, Text, View } from "react-native";
import { song } from "./App";

type LibraryProps = {
  songs: song[] | undefined;
};

export default function Library({ songs }: LibraryProps) {
  return (
    <View style={style.container}>
      {songs == undefined ? (
        <></>
      ) : (
        songs.map((song) => {
          return (
            <View style={style.songContainer} key={String(song.key)}>
              <View style={style.songImgContainer}>
                <Image
                  source={{
                    uri: song.thumbnail,
                  }}
                  style={style.songImg}
                ></Image>
              </View>
              <View style={style.songDataContainer}>
                <Text style={style.songName}>{song.name}</Text>
                <Text style={style.songArtist}>{song.artist}</Text>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const style = StyleSheet.create({
  container: {
    flex: 9,
    alignItems: "center",
  },
  songContainer: {
    padding: 10,
    backgroundColor: "#f0f1f3",
    width: "80%",
    margin: 5,
    flexDirection: "row",
    height: 100,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  songDataContainer: {
    flex: 4,
  },
  songImgContainer: {
    flex: 2,
    margin: 5,
    height: "100%",
  },
  songImg: {
    width: "80%",
    height: "80%",
    objectFit: "cover",
  },
  songName: {
    fontWeight: 600,
    fontSize: 15,
  },
  songArtist: {
    fontSize: 13,
  },
});
