// App.jsx
import "react-native-gesture-handler";
import React, { useState, useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AppNavigator from "./src/navigation/AppNavigator";
import { auth } from "./src/config/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ActivityIndicator, View } from "react-native";
import { setupTimerChecks } from "./src/services/gameTimerService"; // Timer servisi eklendi

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);

  // Kullanıcı oturum durumu değişikliklerini izle
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (initializing) setInitializing(false);
    });

    // Temizleme fonksiyonu
    return unsubscribe;
  }, [initializing]);

  // Oyun sürelerini kontrol etmek için timer kurulumu
  useEffect(() => {
    // Oyun zamanlayıcısını kur
    const cleanupTimerChecks = setupTimerChecks();

    // Temizleme fonksiyonu
    return () => {
      cleanupTimerChecks();
    };
  }, []);

  if (initializing) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#2e6da4" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AppNavigator user={user} />
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
