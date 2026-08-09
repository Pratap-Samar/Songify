import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  activeScale?: number;
}

export function PressableScale({
  style,
  activeScale = 0.95,
  disabled,
  onPressIn,
  onPressOut,
  children,
  ...props
}: PressableScaleProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const handlePressIn = (e: any) => {
    if (!disabled) {
      scale.value = withSpring(activeScale, { stiffness: 400, damping: 25 });
    }
    onPressIn?.(e);
  };

  const handlePressOut = (e: any) => {
    if (!disabled) {
      scale.value = withSpring(1, { stiffness: 400, damping: 25 });
    }
    onPressOut?.(e);
  };

  return (
    <AnimatedPressable
      style={[style, animatedStyle]}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      {...props}
    >
      {children}
    </AnimatedPressable>
  );
}
