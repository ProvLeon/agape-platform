import React, { useEffect } from 'react';
import { View, Text, Button, StyleSheet, StatusBar, Alert } from 'react-native';

export default function TestScreen() {
  useEffect(() => {
    console.log("TestScreen rendered");
    // Show an alert to confirm the screen is mounted
    Alert.alert("Test Screen", "This screen is mounted!");
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <Text style={styles.title}>TEST SCREEN</Text>
      <Text style={styles.subtitle}>This is a basic test screen</Text>
      <View style={styles.buttonContainer}>
        <Button title="Press Me" onPress={() => Alert.alert("Button Pressed!")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#000',
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 40,
    color: '#333',
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 200,
  }
});
