import React from "react";
import { StyleSheet, Text, View, Linking, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";
import { useResponsive } from "@/lib/useResponsive";
import { PressableScale } from "@/components/PressableScale";

export default function AboutScreen() {
  const router = useRouter();
  const { contentMaxWidth, spacing, titleSize, baseSize } = useResponsive();
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  const openGitHub = () => {
    Linking.openURL("https://github.com/Pratap-Samar/Songify");
  };

  return (
    <View style={style.container}>
      <View style={[style.headerRow, { paddingHorizontal: spacing, paddingTop: 48, paddingBottom: spacing }]}>
        <PressableScale onPress={goBack} style={style.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
        </PressableScale>
        <Text style={[style.headerTitle, { fontSize: titleSize }]}>About</Text>
      </View>

      <ScrollView style={style.content} contentContainerStyle={{ padding: spacing, alignItems: "center" }}>
        <View style={[style.maxWidthContainer, { maxWidth: contentMaxWidth }]}>
          
          <View style={style.heroSection}>
            <Text style={[style.appTitle, { fontSize: titleSize * 1.5 }]}>Songify</Text>
            <Text style={[style.appVersion, { fontSize: baseSize }]}>Version 1.0.0</Text>
            
            <View style={{ marginTop: spacing * 1.5, alignItems: 'center' }}>
              <Text style={[style.devLabel, { fontSize: baseSize * 0.9 }]}>Developed and maintained by</Text>
              <Text style={[style.devName, { fontSize: baseSize }]}>Samar Pratap</Text>
            </View>
          </View>

          <PressableScale style={[style.githubRow, { marginTop: spacing * 2 }]} onPress={openGitHub}>
            <View style={style.githubRowLeft}>
              <Ionicons name="logo-github" size={24} color={theme.colors.text.primary} />
              <View>
                <Text style={[style.githubTitle, { fontSize: baseSize }]}>GitHub Repository</Text>
                <Text style={[style.githubSubtitle, { fontSize: baseSize * 0.85 }]}>View the Songify source code</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.text.muted} />
          </PressableScale>

          <View style={[style.warningCard, { marginTop: spacing * 2 }]}>
            <View style={style.warningHeader}>
              <Ionicons name="warning" size={20} color={theme.colors.accent.premium} />
              <Text style={[style.warningTitle, { fontSize: baseSize }]}>Security Warning</Text>
            </View>
            <Text style={[style.warningText, { fontSize: baseSize * 0.9 }]}>
              Do not use this application if it was downloaded from an unofficial source. To protect your data and device, only use versions of this app distributed directly by the creator.
            </Text>
          </View>

        </View>
      </ScrollView>
    </View>
  );
}

const style = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.bg.page,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: theme.colors.bg.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.default,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontWeight: "bold",
    color: theme.colors.text.primary,
  },
  content: {
    flex: 1,
  },
  maxWidthContainer: {
    width: "100%",
  },
  heroSection: {
    alignItems: "center",
    marginTop: 32,
  },
  appTitle: {
    fontWeight: "900",
    color: theme.colors.text.primary,
  },
  appVersion: {
    color: theme.colors.text.secondary,
    marginTop: 4,
  },
  devLabel: {
    color: theme.colors.text.muted,
  },
  devName: {
    color: theme.colors.text.primary,
    fontWeight: "600",
    marginTop: 2,
  },
  githubRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.bg.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border.default,
  },
  githubRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  githubTitle: {
    color: theme.colors.text.primary,
    fontWeight: "600",
  },
  githubSubtitle: {
    color: theme.colors.text.secondary,
    marginTop: 2,
  },
  warningCard: {
    backgroundColor: 'rgba(255, 214, 10, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 214, 10, 0.3)',
  },
  warningHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  warningTitle: {
    fontWeight: "bold",
    color: theme.colors.accent.premium,
  },
  warningText: {
    color: theme.colors.text.secondary,
    lineHeight: 20,
  },
});
