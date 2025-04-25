import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import Input from '@/components/Input';
import Button from '@/components/Button';
import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { Ionicons } from '@expo/vector-icons';
import { resetPassword } from '@/services/authService'; // Add this service function

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>(); // Get token from URL params

  useEffect(() => {
    if (!token) {
      Alert.alert("Error", "Invalid or missing password reset token.", [{ text: "OK", onPress: () => router.replace('/(auth)/login') }]);
    }
  }, [token, router]);

  const handleResetPassword = async () => {
    if (!password || !confirmPassword) {
      Alert.alert('Error', 'Please enter and confirm your new password.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters long.');
      return;
    }
    if (!token) {
      Alert.alert("Error", "Password reset token is missing.");
      return;
    }

    setLoading(true);
    try {
      await resetPassword({ token, new_password: password });
      Alert.alert(
        'Password Reset Successful',
        'You can now log in with your new password.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
      );
    } catch (error: any) {
      console.error("Reset Password Error:", error);
      Alert.alert('Password Reset Failed', error.message || 'Could not reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaWrapper className="flex-1 bg-background">
      <Stack.Screen options={{ title: 'Reset Password', headerShown: true }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center p-6"
          keyboardShouldPersistTaps="handled"
        >
          <View className="items-center mb-8">
            <Ionicons name="lock-open-outline" size={64} className="text-primary mb-4" />
            <Text className="text-2xl font-bold text-foreground mb-2">Set New Password</Text>
            <Text className="text-base text-muted-foreground text-center">
              Enter your new password below.
            </Text>
          </View>

          <View className="w-full">
            <Input
              placeholder="New Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              iconLeft="lock-closed-outline"
              containerClassName="mb-4"
            />
            <Input
              placeholder="Confirm New Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              iconLeft="lock-closed-outline"
              containerClassName="mb-6"
            />

            <Button
              title="Reset Password"
              onPress={handleResetPassword}
              isLoading={loading}
              disabled={loading || !password || !confirmPassword}
              className="w-full"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaWrapper>
  );
}
