import React, { useEffect } from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Color';

interface SkeletonLoaderProps extends ViewProps {
  className?: string; // Allow passing Tailwind classes for sizing, shape, margin, etc.
  duration?: number; // Animation duration in ms
  highlightColorLight?: string; // Optional custom highlight color for light mode
  highlightColorDark?: string; // Optional custom highlight color for dark mode
  backgroundColorLight?: string; // Optional custom background color for light mode
  backgroundColorDark?: string; // Optional custom background color for dark mode
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  className = '',
  style,
  duration = 1200,
  highlightColorLight,
  highlightColorDark,
  backgroundColorLight,
  backgroundColorDark,
  ...props
}) => {
  const { colorScheme } = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Define base and highlight colors based on theme
  const baseBg = colorScheme === 'dark'
    ? (backgroundColorDark || colors.card) // Slightly lighter than card bg in dark mode maybe? Or use border? Let's try card first.
    : (backgroundColorLight || colors.muted); // Muted color in light mode
  const highlightColor = colorScheme === 'dark'
    ? (highlightColorDark || colors.border) // Use border color as highlight in dark mode
    : (highlightColorLight || '#E0E0E0'); // Slightly lighter gray for light mode highlight

  const translateX = useSharedValue(-1); // Start off-screen to the left

  useEffect(() => {
    // Start the animation loop when the component mounts
    translateX.value = withRepeat(
      withTiming(1, {
        duration: duration,
        easing: Easing.linear, // Use linear easing for a smooth, constant speed
      }),
      -1, // Repeat indefinitely
      false // Don't reverse the animation
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]); // Rerun effect only if duration changes

  // Animated style for the gradient shimmer
  const animatedStyle = useAnimatedStyle(() => {
    const interpolatedPosition = translateX.value * 200 - 100; // Adjust range as needed

    // We use a gradient that moves across the placeholder
    // The gradient stops are transparent -> highlight -> transparent
    const gradientColors = [
      'transparent', // Start transparent
      highlightColor, // Peak highlight color
      'transparent', // End transparent
    ];

    return {
      transform: [{ translateX: interpolatedPosition }],
      position: 'absolute',
      left: '-100%', // Start completely to the left
      width: '300%', // Make gradient wide enough to sweep across
      height: '100%',
    };
  });

  return (
    <View
      className={`overflow-hidden bg-muted dark:bg-border ${className}`} // Base background color + shape/size classes
      style={[style, { backgroundColor: baseBg }]}
      {...props}
    >
      <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
        <LinearGradient
          colors={['transparent', highlightColor, 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
};

export default SkeletonLoader;
