import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { theme } from "@/constants/theme";
import { PressableScale } from "./PressableScale";

export type TrackRowProps = {
  title: string;
  subtitle: string;
  thumbnailUrl?: string | null;
  isSelected?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  rightElement?: React.ReactNode;
};

export function TrackRow({
  title,
  subtitle,
  thumbnailUrl,
  isSelected,
  onPress,
  onLongPress,
  rightElement,
}: TrackRowProps) {
  return (
    <PressableScale
      style={[style.container, isSelected && style.containerSelected]}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <View style={style.imgContainer}>
        {thumbnailUrl && (
          <Image
            source={{ uri: thumbnailUrl }}
            style={style.img}
            cachePolicy="disk"
            contentFit="cover"
            transition={150}
          />
        )}
      </View>
      <View style={style.dataContainer}>
        <Text numberOfLines={1} style={[style.title, isSelected && style.titleSelected]}>
          {title}
        </Text>
        <Text numberOfLines={1} style={[style.subtitle, isSelected && style.subtitleSelected]}>
          {subtitle}
        </Text>
      </View>
      {rightElement && <View style={style.rightContainer}>{rightElement}</View>}
    </PressableScale>
  );
}

const style = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    // Removed margins, borders, and bg.row to make it flat and breathable
  },
  containerSelected: {
    backgroundColor: theme.colors.bg.surface,
  },
  imgContainer: {
    marginRight: 14,
    height: 48,
    width: 48,
    borderRadius: 4,
    backgroundColor: theme.colors.bg.surface,
    overflow: "hidden",
  },
  img: {
    width: "100%",
    height: "100%",
  },
  dataContainer: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    color: theme.colors.text.primary,
    fontSize: 16,
    fontWeight: "500",
  },
  titleSelected: {
    color: theme.colors.accent.primary,
  },
  artist: {
    color: theme.colors.text.metadata,
    fontSize: 13,
  },
  subtitle: {
    color: theme.colors.text.metadata,
    fontSize: 14,
    marginTop: 2,
  },
  subtitleSelected: {
    color: theme.colors.text.primary,
  },
  rightContainer: {
    marginLeft: 12,
  },
});
