import React from "react";
import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";
import { useResponsive } from "@/lib/useResponsive";

export default function AboutScreen() {
  const router = useRouter();
  const { contentMaxWidth, spacing, titleSize, baseSize } = useResponsive();
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  return (
    <View style={style.container}>
      <View style={[style.headerRow, { paddingHorizontal: spacing, paddingTop: 48, paddingBottom: spacing }]}>
        <TouchableOpacity onPress={goBack} style={style.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[style.headerTitle, { fontSize: titleSize }]}>About</Text>
      </View>

      <View style={[style.content, { padding: spacing, alignItems: "center" }]}>
        <View style={[style.maxWidthContainer, { maxWidth: contentMaxWidth }]}>
          <Text style={[style.appTitle, { fontSize: titleSize * 1.5 }]}>Songify</Text>
          <Text style={[style.appVersion, { fontSize: baseSize }]}>Version 1.0.0</Text>

          <View style={[style.infoCard, { marginTop: spacing * 2 }]}>
            <Text style={[style.infoText, { fontSize: baseSize }]}>
              A modern, fast, and beautiful music player built with Expo and React Native.
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const style = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.main,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: theme.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontWeight: "bold",
    color: theme.colors.text,
  },
  content: {
    flex: 1,
  },
  maxWidthContainer: {
    width: "100%",
    alignItems: "center",
  },
  appTitle: {
    fontWeight: "900",
    color: theme.colors.text,
    marginTop: 48,
  },
  appVersion: {
    color: theme.colors.subtext,
    marginTop: 8,
  },
  infoCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: 24,
    width: "100%",
  },
  infoText: {
    color: theme.colors.text,
    textAlign: "center",
    lineHeight: 24,
  },
});
