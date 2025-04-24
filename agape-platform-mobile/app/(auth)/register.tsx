import React, { useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, Alert, Image, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import Input from '@/components/Input';
import Button from '@/components/Button';
import { RegisterData } from '@/types';
import SafeAreaWrapper from '@/components/SafeAreaWrapper';

export default function RegisterScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  const handleRegister = async () => {
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return;
    }
    // Basic password strength check (example)
    if (password.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    try {
      const registerData: RegisterData = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        password: password,
      };
      await register(registerData);
      Alert.alert(
        'Registration Successful',
        'Your account has been created. Please log in.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }] // Redirect on OK
      );
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message || 'An unknown error occurred.');
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
          contentContainerClassName="flex-grow justify-center p-6"
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Section */}
          <View className="items-center mb-8">
            <Image
              source={require('@/assets/images/icon.png')} // Assuming icon exists
              className="w-20 h-20 mb-3"
              resizeMode="contain"
            />
            <Text className="text-3xl font-bold text-primary mb-1">Create Account</Text>
            <Text className="text-base text-muted-foreground">Join the Agape Platform</Text>
          </View>

          {/* Form Section */}
          <View className="w-full">
            <View className="flex-row justify-between mb-4">
              <Input
                placeholder="First Name"
                value={firstName}
                onChangeText={setFirstName}
                iconLeft="person-outline"
                containerClassName="flex-1 mr-2" // Adjusted spacing
              />
              <Input
                placeholder="Last Name"
                value={lastName}
                onChangeText={setLastName}
                containerClassName="flex-1 ml-2" // Adjusted spacing
              />
            </View>
            <Input
              placeholder="Email Address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              iconLeft="mail-outline"
              containerClassName="mb-4"
            />
            <Input
              placeholder="Password (min 8 chars)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              iconLeft="lock-closed-outline"
              containerClassName="mb-4"
            />
            <Input
              placeholder="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              iconLeft="lock-closed-outline"
              containerClassName="mb-6"
            />

            <Button
              title="Register"
              onPress={handleRegister}
              isLoading={loading}
              disabled={loading}
              className="w-full"
            />
          </View>

          {/* Login Link */}
          <View className="flex-row justify-center mt-6">
            <Text className="text-muted-foreground">Already have an account? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text className="text-primary font-semibold">Log In</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaWrapper>
  );
}
