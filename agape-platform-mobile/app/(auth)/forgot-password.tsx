import React, { useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import Input from '@/components/Input';
import Button from '@/components/Button';
import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { Ionicons } from '@expo/vector-icons';
import { forgotPassword } from '@/services/authService'; // Add this service function

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSendResetLink = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }
    setLoading(true);
    try {
      // Call your backend API for forgot password
      await forgotPassword({ email });
      Alert.alert(
        'Check Your Email',
        'If an account exists for this email, a password reset link has been sent.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      console.error("Forgot Password Error:", error);
      // Show a generic message regardless of whether the email exists for security
      Alert.alert(
        'Check Your Email',
        'If an account exists for this email, a password reset link has been sent.',
        [{ text: 'OK', onPress: () => router.back() }] // Go back even on error to prevent hinting
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaWrapper className="flex-1 bg-background">
      <Stack.Screen options={{ title: 'Forgot Password', headerShown: true }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center p-6"
          keyboardShouldPersistTaps="handled"
        >
          <View className="items-center mb-8">
            <Ionicons name="key-outline" size={64} className="text-primary mb-4" />
            <Text className="text-2xl font-bold text-foreground mb-2">Forgot Your Password?</Text>
            <Text className="text-base text-muted-foreground text-center">
              Enter your email address below and we'll send you a link to reset your password.
            </Text>
          </View>

          <View className="w-full">
            <Input
              placeholder="Email Address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              iconLeft="mail-outline"
              containerClassName="mb-6"
            />

            <Button
              title="Send Reset Link"
              onPress={handleSendResetLink}
              isLoading={loading}
              disabled={loading || !email}
              className="w-full"
            />
            <Button
              title="Back to Login"
              onPress={() => router.back()}
              variant='link'
              className="mt-4"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaWrapper>
  );
}
