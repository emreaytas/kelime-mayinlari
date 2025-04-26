// app/home.js
import { Redirect } from "expo-router";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useEffect, useState } from "react";
import { auth } from "../src/firebase/config"; // Yolun doğru olduğundan emin olun
import HomeScreen from "../src/screens/HomeScreen";

export default function Home() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    console.log("home.js useEffect çalıştı.");
    // Listen for auth state to change
    const unsubscribe = auth.onAuthStateChanged((user) => {
      console.log(
        "Auth state changed:",
        user ? "Kullanıcı oturum açtı" : "Kullanıcı oturum açmadı"
      );
      setUser(user);
      setInitializing(false);
    });

    // Cleanup subscription
    return () => {
      console.log("home.js useEffect cleanup çalıştı");
      unsubscribe();
    };
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
    console.log("home.js: Kullanıcı bulunamadı, ana sayfaya yönlendiriliyor");
    return <Redirect href="/" />;
  }

  console.log("home.js: HomeScreen gösteriliyor");
  // User is signed in, show home screen
  return <HomeScreen />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
