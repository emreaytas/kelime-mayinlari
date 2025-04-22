// app/index.js
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { auth } from "../src/firebase/config";
import LoginScreen from "../src/screens/LoginScreen";

export default function Index() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Listen for auth state to change
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
      setInitializing(false);
    });

    // Cleanup subscription
    return unsubscribe;
  }, []);

  if (initializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2e6da4" />
      </View>
    );
  }

  if (user) {
    // User is signed in, redirect to home
    return <Redirect href="/home" />;
  }

  // User is not signed in, show login screen
  return <LoginScreen />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
