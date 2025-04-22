// src/screens/GameScreen.jsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { auth } from "../firebase/config";
import GameInterface from "../components/GameInterface";

export default function GameScreen() {
  const { gameId } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Auth durumunu dinle
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Oyun ID'sini kontrol et
  useEffect(() => {
    if (!gameId && !loading) {
      Alert.alert("Hata", "Oyun ID'si belirtilmedi", [
        {
          text: "Ana Sayfaya Dön",
          onPress: () => router.replace("/home"),
        },
      ]);
    }
  }, [gameId, loading]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2e6da4" />
        <Text>Yükleniyor...</Text>
      </View>
    );
  }

  if (!user) {
    // Kullanıcı giriş yapmamış, giriş sayfasına yönlendir
    return router.replace("/");
  }

  return (
    <SafeAreaView style={styles.container}>
      {gameId ? (
        <GameInterface gameId={gameId} />
      ) : (
        <View style={styles.errorContainer}>
          <Text>Oyun ID'si bulunamadı</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.replace("/home")}
          >
            <Text style={styles.buttonText}>Ana Sayfaya Dön</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  button: {
    marginTop: 20,
    backgroundColor: "#2e6da4",
    padding: 12,
    borderRadius: 5,
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
  },
});
