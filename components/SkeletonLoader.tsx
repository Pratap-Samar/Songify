import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, DimensionValue } from 'react-native';
import { theme } from '@/constants/theme';
import { hexToRgba } from '@/lib/colorUtils';

interface SkeletonProps {
  width: DimensionValue;
  height: DimensionValue;
  borderRadius?: number;
  style?: any;
}

export function SkeletonLoader({ width, height, borderRadius = 8, style }: SkeletonProps) {
  const anim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [anim]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width, height, borderRadius, opacity: anim },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: hexToRgba(theme.colors.text.muted, 0.2),
  },
});
