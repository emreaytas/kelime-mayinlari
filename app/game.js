// app/game.js
import { Redirect } from "expo-router";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useEffect, useState } from "react";
import { auth } from "../src/firebase/config";
import GameScreen from "../src/screens/GameScreen";

export default function Game() {
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

  if (!user) {
    // Not signed in, redirect to login
    return <Redirect href="/" />;
  }

  // User is signed in, show game screen
  return <GameScreen />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
