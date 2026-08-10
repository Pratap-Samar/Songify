import React, { useState, useEffect } from 'react';
import { View, Text, TextStyle, StyleSheet, StyleProp } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withDelay, 
  cancelAnimation, 
  Easing, 
  withRepeat, 
  withSequence 
} from 'react-native-reanimated';

interface MarqueeTextProps {
  text: string;
  style?: StyleProp<TextStyle>;
  animate?: boolean;
}

export default function MarqueeText({ text, style, animate = false }: MarqueeTextProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);

  const offset = useSharedValue(0);

  const shouldAnimate = animate && textWidth > containerWidth && containerWidth > 0;

  useEffect(() => {
    if (shouldAnimate) {
      const gap = 40;
      const distance = Math.ceil(textWidth) + gap;
      const duration = (distance / 30) * 1000; // 30 pixels per second

      offset.value = 0;
      offset.value = withDelay(
        1500, // Pause before scrolling the first time
        withRepeat(
          withSequence(
            withTiming(-distance, { duration, easing: Easing.linear }),
            withTiming(0, { duration: 0 }) // Snap back instantly
          ),
          -1 // Infinite repeat
        )
      );
    } else {
      cancelAnimation(offset);
      offset.value = 0;
    }
  }, [shouldAnimate, textWidth, containerWidth, offset]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  return (
    <View 
      style={styles.container} 
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {/* Hidden Text for measuring natural width */}
      <View style={styles.hiddenMeasureContainer}>
        <Text
          style={[style, styles.measureText]}
          numberOfLines={1}
          onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
        >
          {text}
        </Text>
      </View>

      {/* Visible Text */}
      {shouldAnimate ? (
        <Animated.View style={[{ flexDirection: 'row' }, animatedStyle]}>
          <Text style={[style, { width: Math.ceil(textWidth) }]} numberOfLines={1}>
            {text}
          </Text>
          <View style={{ width: 40 }} />
          <Text style={[style, { width: Math.ceil(textWidth) }]} numberOfLines={1}>
            {text}
          </Text>
        </Animated.View>
      ) : (
        <Text style={style} numberOfLines={1} ellipsizeMode="tail">
          {text}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    width: '100%',
  },
  hiddenMeasureContainer: {
    position: 'absolute',
    opacity: 0,
    width: 10000, // Very wide to prevent wrapping/truncating
    pointerEvents: 'none',
  },
  measureText: {
    alignSelf: 'flex-start',
  },
});
