import React, { ReactNode } from 'react';
import { ViewStyle } from 'react-native';
import { SafeAreaView, SafeAreaViewProps } from 'react-native-safe-area-context';

interface SafeAreaWrapperProps extends SafeAreaViewProps {
  children: ReactNode;
  className?: string;
}

const SafeAreaWrapper: React.FC<SafeAreaWrapperProps> = ({ children, className = '', style, edges = ['top', 'bottom', 'left', 'right'], ...props }) => {
  return (
    <SafeAreaView
      className={`flex-1 bg-light-background dark:bg-dark-background ${className}`}
      edges={edges} // Control which edges have safe area padding
      style={style}
      {...props}
    >
      {children}
    </SafeAreaView>
  );
};

export default SafeAreaWrapper;
