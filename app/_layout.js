// app/_layout.js
import React, { useState, useEffect } from "react";
import { Stack } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../src/firebase/config";
import { ActivityIndicator, View, StyleSheet } from "react-native";

export default function AppLayout() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Listen for authentication state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (initializing) setInitializing(false);
    });

    // Cleanup subscription
    return unsubscribe;
  }, [initializing]);

  if (initializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2e6da4" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: "#2e6da4",
        },
        headerTintColor: "#fff",
        headerTitleStyle: {
          fontWeight: "bold",
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Kelime Mayınları",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="home"
        options={{
          title: "Kelime Mayınları",
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="register"
        options={{
          title: "Kayıt Ol",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="game"
        options={{
          title: "Oyun",
          headerShown: false,
          gestureEnabled: false,
        }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
