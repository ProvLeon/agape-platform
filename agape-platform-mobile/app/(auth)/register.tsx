import React, { useState } from 'react';
import { View, Alert, ActivityIndicator, TouchableOpacity, Text } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import Input from '@/components/Input';
import Button from '@/components/Button';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RegisterData } from '@/types';

export default function RegisterScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // Add state for phone, camp_id if needed during registration
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  console.log('RegisterScreen')
  const handleRegister = async () => {
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all required fields.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    // Add password strength validation if needed

    setLoading(true);
    try {
      const registerData: RegisterData = {
        first_name: firstName,
        last_name: lastName,
        email: email,
        password: password,
        // Add optional fields like phone, camp_id here if collected
      };
      await register(registerData);
      Alert.alert('Registration Successful', 'Please log in with your new account.');
      router.replace('/(auth)/login'); // Go to login screen after successful registration
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message || 'An unknown error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-light-background dark:bg-dark-background justify-center p-6">
      <View className="mb-8 items-center">
        <Text className="text-4xl font-bold text-light-primary dark:text-dark-primary mb-2">Agape</Text>
        <Text className="text-lg text-light-text dark:text-dark-text">Create Your Account</Text>
      </View>

      <Input
        placeholder="First Name"
        value={firstName}
        onChangeText={setFirstName}
        className="mb-4"
      />
      <Input
        placeholder="Last Name"
        value={lastName}
        onChangeText={setLastName}
        className="mb-4"
      />
      <Input
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        className="mb-4"
      />
      <Input
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        className="mb-4"
      />
      <Input
        placeholder="Confirm Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        className="mb-6"
      />

      {/* Add optional fields like Phone, Camp Selection if needed */}

      {loading ? (
        <ActivityIndicator size="large" color="#A0522D" />
      ) : (
        <Button onPress={handleRegister} title="Register" />
      )}

      <View className="flex-row justify-center mt-6">
        <Text className="text-light-text dark:text-dark-text">Already have an account? </Text>
        <Link href="/(auth)/login" asChild>
          <TouchableOpacity>
            <Text className="text-light-primary dark:text-dark-primary font-semibold">Log In</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </SafeAreaView>
  );
}
