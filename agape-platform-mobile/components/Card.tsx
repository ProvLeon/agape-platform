import React, { ReactNode } from 'react';
import { Text } from 'react-native';
import { View, ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  children: ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ children, className = '', style, ...props }) => {
  // Use Tailwind classes for background, border, shadow, padding, rounded corners
  return (
    <View
      className={`bg-card border border-border rounded-lg p-4 shadow-card ${className}`} // Added shadow
      style={style}
      {...props}
    >
      {children}
    </View>
  );
};

// Optional Header/Footer components for Card
export const CardHeader = ({ children, className = '', ...props }: CardProps) => (
  <View className={`mb-4 ${className}`} {...props}>{children}</View>
);

export const CardTitle = ({ children, className = '', ...props }: { children: ReactNode, className?: string }) => (
  <Text className={`text-lg font-semibold leading-none tracking-tight text-card-foreground ${className}`} {...props}>{children}</Text>
);

export const CardDescription = ({ children, className = '', ...props }: { children: ReactNode, className?: string }) => (
  <Text className={`text-sm text-muted-foreground ${className}`} {...props}>{children}</Text>
);

export const CardContent = ({ children, className = '', ...props }: CardProps) => (
  <View className={className} {...props}>{children}</View>
);

export const CardFooter = ({ children, className = '', ...props }: CardProps) => (
  <View className={`flex items-center pt-4 ${className}`} {...props}>{children}</View>
);


export default Card;
