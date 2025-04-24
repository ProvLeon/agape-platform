import React, { useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, Alert, Image, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import Input from '@/components/Input';
import Button from '@/components/Button';
import SafeAreaWrapper from '@/components/SafeAreaWrapper'; // Use SafeAreaWrapper

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }
    setLoading(true);
    try {
      await login({ email, password });
      // Root layout handles navigation
    } catch (error: any) {
      Alert.alert('Login Failed', error.message || 'An unknown error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaWrapper className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center p-6" // Use flex-grow for centering
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo Section */}
          <View className="items-center mb-10">
            {/* Replace with actual logo */}
            <Image
              source={require('@/assets/images/icon.png')} // Assuming icon exists
              className="w-24 h-24 mb-4"
              resizeMode="contain"
            />
            <Text className="text-3xl font-bold text-primary mb-1">Agape Platform</Text>
            <Text className="text-lg text-muted-foreground">Welcome Back</Text>
          </View>

          {/* Form Section */}
          <View className="w-full">
            <Input
              placeholder="Email Address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              iconLeft="mail-outline" // Example icon
              containerClassName="mb-4"
            />
            <Input
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              iconLeft="lock-closed-outline" // Example icon
              containerClassName="mb-6"
            />

            <Button
              title="Login"
              onPress={handleLogin}
              isLoading={loading}
              disabled={loading}
              className="w-full" // Make button full width
            />
          </View>

          {/* Links Section */}
          <View className="items-center mt-6">
            <View className="flex-row justify-center mb-3">
              <Text className="text-muted-foreground">Don't have an account? </Text>
              <Link href="/(auth)/register" asChild>
                <TouchableOpacity>
                  <Text className="text-primary font-semibold">Sign Up</Text>
                </TouchableOpacity>
              </Link>
            </View>
            <TouchableOpacity onPress={() => {/* TODO: Implement forgot password */ }}>
              <Text className="text-sm text-muted-foreground">Forgot Password?</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaWrapper>
  );
}
