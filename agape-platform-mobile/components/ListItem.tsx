import React, { ReactNode } from 'react';
import { View, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Color';
import { useColorScheme } from '@/hooks/useColorScheme';

interface ListItemProps {
  title: string | ReactNode;
  subtitle?: string | ReactNode;
  leftElement?: ReactNode;
  rightElement?: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  showChevron?: boolean;
  isActive?: boolean; // For indicating selection or active state
  bottomBorder?: boolean; // Control border visibility
}

const ListItem: React.FC<ListItemProps> = ({
  title,
  subtitle,
  leftElement,
  rightElement,
  onPress,
  style,
  className = '',
  titleClassName = '',
  subtitleClassName = '',
  showChevron = false,
  isActive = false,
  bottomBorder = true,
}) => {
  const { colorScheme: nwColorScheme } = useColorScheme();
  const currentScheme = nwColorScheme ?? 'light';
  const colors = Colors[currentScheme];
  const Component = onPress ? TouchableOpacity : View;
  const showRightChevron = onPress && showChevron;

  const activeBg = isActive ? 'bg-primary/10 dark:bg-primary/20' : 'bg-card'; // Subtle background for active state
  const borderClass = bottomBorder ? 'border-b border-border' : '';

  return (
    <Component
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      className={`flex-row items-center px-4 py-3 ${activeBg} ${borderClass} ${className}`} // Adjusted padding
      style={style}
    >
      {leftElement && <View className="mr-3 items-center justify-center">{leftElement}</View>}

      <View className="flex-1 justify-center">
        {typeof title === 'string' ? (
          <Text className={`text-base font-medium text-foreground ${titleClassName}`} numberOfLines={1}>
            {title}
          </Text>
        ) : (
          title
        )}
        {subtitle && (typeof subtitle === 'string' ? (
          <Text className={`text-sm text-muted-foreground mt-0.5 ${subtitleClassName}`} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : (
          <View className="mt-0.5">{subtitle}</View> // Wrap custom node
        ))}
      </View>

      {rightElement && <View className="ml-3 items-center justify-center">{rightElement}</View>}

      {showRightChevron && (
        <View className="ml-2">
          <Ionicons name="chevron-forward-outline" size={20} color={colors.mutedForeground} />
        </View>
      )}
    </Component>
  );
};

export default ListItem;
