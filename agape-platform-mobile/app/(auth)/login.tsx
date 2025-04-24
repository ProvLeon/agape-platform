import React, { useState } from 'react';
import { View, Alert, ActivityIndicator, TouchableOpacity, Text } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import Input from '@/components/Input'; // Assuming creation
import Button from '@/components/Button'; // Assuming creation
import { SafeAreaView } from 'react-native-safe-area-context'; // Use safe area

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  console.log('Loading login screen...');

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }
    setLoading(true);
    try {
      await login({ email, password });
      // Navigation will be handled by the RootLayout/Index based on auth state change
      // router.replace('/(tabs)/home'); // Usually not needed here if root layout handles it
    } catch (error: any) {
      Alert.alert('Login Failed', error.message || 'An unknown error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-light-background dark:bg-dark-background justify-center p-6">
      <View className="mb-10 items-center">
        {/* Replace with your Logo Component */}
        <Text className="text-4xl font-bold text-light-primary dark:text-dark-primary mb-2">Agape</Text>
        <Text className="text-lg text-light-text dark:text-dark-text">Welcome Back</Text>
      </View>

      <Input
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        className="mb-4" // Add styling via className
      />
      <Input
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        className="mb-6" // Add styling via className
      />

      {loading ? (
        <ActivityIndicator size="large" color="#A0522D" /> // Use theme color
      ) : (
        <Button onPress={handleLogin} title="Login" />
      )}

      <View className="flex-row justify-center mt-6">
        <Text className="text-light-text dark:text-dark-text">Don't have an account? </Text>
        <Link href="/(auth)/register" asChild>
          <TouchableOpacity>
            <Text className="text-light-primary dark:text-dark-primary font-semibold">Sign Up</Text>
          </TouchableOpacity>
        </Link>
      </View>
      {/* Add Forgot Password Link */}
      <View className="items-center mt-4">
        <TouchableOpacity onPress={() => {/* Implement forgot password */ }}>
          <Text className="text-sm text-gray-500 dark:text-gray-400">Forgot Password?</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
