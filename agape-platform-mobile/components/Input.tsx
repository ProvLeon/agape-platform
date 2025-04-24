import React, { useState } from 'react';
import { TextInput, View, TextInputProps, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Color';

interface InputProps extends TextInputProps {
  className?: string;
  label?: string;
  error?: string;
  iconLeft?: React.ComponentProps<typeof Ionicons>['name'];
  iconRight?: React.ComponentProps<typeof Ionicons>['name'];
  onIconRightPress?: () => void;
  containerClassName?: string;
}

const Input: React.FC<InputProps> = ({
  className,
  label,
  error,
  iconLeft,
  iconRight,
  onIconRightPress,
  containerClassName = '',
  secureTextEntry,
  ...props
}) => {
  const { colorScheme: nwColorScheme } = useColorScheme();
  const currentScheme = nwColorScheme ?? 'light';
  const colors = Colors[currentScheme];
  const [isFocused, setIsFocused] = useState(false);
  const [isSecure, setIsSecure] = useState(secureTextEntry);

  const borderColor = error ? colors.destructive : isFocused ? colors.primary : colors.border;
  const iconColor = isFocused ? colors.primary : colors.mutedForeground;

  const toggleSecureEntry = () => {
    setIsSecure(!isSecure);
    if (onIconRightPress) onIconRightPress(); // Allow custom logic too
  };

  return (
    <View className={`mb-4 ${containerClassName}`}>
      {label && <Text className="text-sm font-medium mb-1.5 text-foreground">{label}</Text>}
      <View
        className={`flex-row items-center h-12 bg-card border rounded-lg px-3 ${className}`}
        style={{ borderColor: borderColor, borderWidth: isFocused || error ? 1.5 : 1 }} // Thicker border on focus/error
      >
        {iconLeft && <Ionicons name={iconLeft} size={20} color={iconColor} style={{ marginRight: 8 }} />}
        <TextInput
          className="flex-1 text-base text-foreground py-2" // Adjusted padding and font size
          placeholderTextColor={colors.mutedForeground}
          secureTextEntry={isSecure}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        {secureTextEntry && ( // Always show toggle for secure fields
          <TouchableOpacity onPress={toggleSecureEntry} className="p-1">
            <Ionicons name={isSecure ? 'eye-off-outline' : 'eye-outline'} size={22} color={iconColor} />
          </TouchableOpacity>
        )}
        {!secureTextEntry && iconRight && ( // Show custom right icon if not secure
          <TouchableOpacity onPress={onIconRightPress} disabled={!onIconRightPress} className="p-1">
            <Ionicons name={iconRight} size={20} color={iconColor} />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text className="text-xs text-destructive mt-1 ml-1">{error}</Text>}
    </View>
  );
};

export default Input;
