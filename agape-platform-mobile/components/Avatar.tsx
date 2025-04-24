import React from 'react';
import { View, Text, Image, ImageSourcePropType, ViewStyle } from 'react-native';
import { Colors } from '@/constants/Color';
import { useColorScheme } from '@/hooks/useColorScheme';

interface AvatarProps {
  source?: ImageSourcePropType | string | null;
  name?: string;
  size?: number;
  style?: ViewStyle;
  className?: string;
  textClassName?: string; // Allow styling initials text
}

// Simple stable hashing function for color generation
const simpleHash = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

// Generate a pleasant color based on the hash
const getColorFromHash = (hash: number): string => {
  // Generate HSL values - keep saturation and lightness reasonable
  const hue = hash % 360;
  const saturation = 50 + (hash % 10); // 50-60% saturation
  const lightness = 65 + (hash % 10); // 65-75% lightness
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};


const Avatar: React.FC<AvatarProps> = ({ source, name, size = 48, style, className = '', textClassName = '' }) => {
  const { colorScheme: nwColorScheme } = useColorScheme();
  const currentScheme = nwColorScheme ?? 'light';
  const colors = Colors[currentScheme];

  const initials = name
    ? name
      .split(' ')
      .map((n) => n[0])
      .filter(Boolean) // Remove empty strings if name has multiple spaces
      .slice(0, 2)
      .join('')
      .toUpperCase()
    : '?';

  // Determine if source is a valid URI string or an ImageSourcePropType object
  const imageSource = typeof source === 'string' && source.trim() ? { uri: source } : source;
  const hasValidImageSource = imageSource && (typeof imageSource !== 'string'); // Check if it's an object or number (require())

  const [imageError, setImageError] = React.useState(false);
  const showInitials = !hasValidImageSource || imageError;

  const backgroundColor = showInitials ? getColorFromHash(simpleHash(name || '?')) : 'transparent'; // Use generated color only for initials

  React.useEffect(() => {
    setImageError(false); // Reset error state if source changes
  }, [source]);


  return (
    <View
      className={`rounded-full items-center justify-center overflow-hidden bg-muted ${className}`} // Use muted background as default
      style={[
        { width: size, height: size, backgroundColor },
        style,
      ]}
    >
      {showInitials ? (
        <Text
          className={`text-white font-semibold ${textClassName}`}
          style={{
            fontSize: size * 0.4, // Scale font size
          }}
          adjustsFontSizeToFit
          numberOfLines={1}
        >
          {initials}
        </Text>
      ) : (
        <Image
          source={imageSource as ImageSourcePropType} // Type assertion after check
          style={{ width: size, height: size }}
          resizeMode="cover"
          onError={() => setImageError(true)} // Fallback to initials on error
        />
      )}
    </View>
  );
};

export default Avatar;
