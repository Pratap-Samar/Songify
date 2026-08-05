import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, TouchableOpacity } from "react-native";
import { theme } from "@/constants/theme";

interface SnackbarProps {
  visible: boolean;
  message: string;
  actionText?: string;
  onAction?: () => void;
  onDismiss: () => void;
  duration?: number;
}

export default function Snackbar({ visible, message, actionText, onAction, onDismiss, duration = 3000 }: SnackbarProps) {
  const translateY = useRef(new Animated.Value(100)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (visible) {
      setMounted(true);
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();

      timeout = setTimeout(() => {
        onDismiss();
      }, duration);
    } else {
      Animated.timing(translateY, {
        toValue: 100,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setMounted(false);
      });
    }
    return () => clearTimeout(timeout);
  }, [visible, duration, onDismiss, translateY]);

  if (!mounted) return null;

  return (
    <Animated.View style={[style.container, { transform: [{ translateY }] }]}>
      <Text style={style.message}>{message}</Text>
      {actionText && onAction && (
        <TouchableOpacity onPress={onAction}>
          <Text style={style.actionText}>{actionText}</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const style = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 90,
    left: 20,
    right: 20,
    backgroundColor: theme.colors.bg.row,
    padding: 16,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
    zIndex: 1000,
  },
  message: {
    color: theme.colors.text.primary,
    fontSize: 14,
  },
  actionText: {
    color: theme.colors.accent.link,
    fontSize: 14,
    fontWeight: "bold",
  },
});
