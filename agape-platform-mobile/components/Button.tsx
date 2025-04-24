import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, ViewStyle, TextStyle, Pressable, PressableProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; // Import icons

interface ButtonProps extends PressableProps {
  title?: string; // Make title optional if icon-only
  onPress: () => void;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
  textClassName?: string;
  style?: ViewStyle;
  iconLeft?: React.ComponentProps<typeof Ionicons>['name']; // Add icon props
  iconRight?: React.ComponentProps<typeof Ionicons>['name'];
  iconSize?: number;
}

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'default',
  size = 'default',
  isLoading = false,
  disabled = false,
  className = '',
  textClassName = '',
  style,
  iconLeft,
  iconRight,
  iconSize,
  ...props
}) => {
  const baseClasses = "flex-row items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background active:opacity-80"; // Added active state

  // Adjusted for new ministry colors (Red primary, Blue secondary)
  const variantClasses = {
    default: "bg-primary text-primary-foreground",
    destructive: "bg-destructive text-destructive-foreground",
    outline: "border border-border bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground", // Adjusted for better contrast
    secondary: "bg-secondary text-secondary-foreground",
    ghost: "hover:bg-accent hover:text-accent-foreground text-foreground", // Ensure text color
    link: "text-primary underline-offset-4 hover:underline",
  };

  // Ensure text colors contrast well with backgrounds
  const textVariantClasses = {
    default: "text-primary-foreground", // White on Red
    destructive: "text-destructive-foreground", // White on Destructive Red
    outline: "text-primary", // Primary Red text for outline
    secondary: "text-secondary-foreground", // White on Blue
    ghost: "text-primary", // Primary Red text for ghost
    link: "text-primary", // Primary Red text for link
  };

  const sizeClasses = {
    default: "h-10 px-4 py-2",
    sm: "h-9 px-3",
    lg: "h-11 px-8",
    icon: "h-10 w-10", // Square for icon buttons
  };

  const textSizeClasses = {
    default: "text-sm",
    sm: "text-xs",
    lg: "text-base",
    icon: "", // No text size for icon variant
  };

  const iconVariantColors = {
    default: "hsl(var(--primary-foreground))",
    destructive: "hsl(var(--destructive-foreground))",
    outline: "hsl(var(--primary))",
    secondary: "hsl(var(--secondary-foreground))",
    ghost: "hsl(var(--primary))",
    link: "hsl(var(--primary))",
  }

  const iconFinalSize = iconSize ? iconSize : size === 'lg' ? 20 : size === 'sm' ? 14 : 16;
  const iconColor = iconVariantColors[variant];

  const isDisabled = disabled || isLoading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className} ${isDisabled ? 'opacity-50' : ''}`}
      style={({ pressed }) => [
        style,
        pressed && variant !== 'link' && { opacity: 0.8 } // Add pressed effect
      ]}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={iconColor} /> // Use variant color
      ) : (
        <>
          {iconLeft && <Ionicons name={iconLeft} size={iconFinalSize} color={iconColor} style={title ? { marginRight: 8 } : {}} />}
          {title && (
            <Text className={`${textVariantClasses[variant]} ${textSizeClasses[size]} ${textClassName} font-semibold text-center`}>
              {title}
            </Text>
          )}
          {iconRight && !iconLeft && <Ionicons name={iconRight} size={iconFinalSize} color={iconColor} style={title ? { marginLeft: 8 } : {}} />}
        </>
      )}
    </Pressable>
  );
};

export default Button;
