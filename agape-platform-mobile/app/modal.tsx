import React from 'react';
import { View, Text, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function ModalScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-light-background dark:bg-dark-background">
      <Stack.Screen options={{ title: 'Modal Example', presentation: 'modal' }} />
      <Text className="text-xl font-bold text-light-text dark:text-dark-text">Modal Screen</Text>
      <Text className="text-base text-gray-600 dark:text-gray-400 mt-2">This is an example modal.</Text>

      {/* Use a light status bar on iOS to account for the black space above the modal */}
      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
    </View>
  );
}
