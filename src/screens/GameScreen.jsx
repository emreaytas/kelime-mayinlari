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
import { checkGameTimer } from "../services/gameTimerService"; // Timer kontrolü eklendi

export default function GameScreen() {
  const { gameId } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [gameStatus, setGameStatus] = useState(null);

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
    } else if (gameId && !loading) {
      // Oyun süresini kontrol et
      checkGameTimer(gameId).then((result) => {
        if (result.error) {
          Alert.alert("Hata", "Oyun bilgileri alınamadı", [
            {
              text: "Ana Sayfaya Dön",
              onPress: () => router.replace("/home"),
            },
          ]);
        } else if (!result.exists) {
          Alert.alert("Hata", "Oyun bulunamadı", [
            {
              text: "Ana Sayfaya Dön",
              onPress: () => router.replace("/home"),
            },
          ]);
        } else if (result.expired) {
          Alert.alert(
            "Bilgi",
            "Bu oyunun süresi doldu. Ana sayfadan 'Biten Oyunlar' sekmesinde görebilirsiniz.",
            [
              {
                text: "Ana Sayfaya Dön",
                onPress: () => router.replace("/home"),
              },
            ]
          );
        } else {
          setGameStatus(result.status);
        }
      });
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

  if (gameStatus === "completed") {
    return (
      <View style={styles.errorContainer}>
        <Text>
          Bu oyun tamamlanmış. Biten oyunlar listesinden sonucu görebilirsiniz.
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.replace("/home")}
        >
          <Text style={styles.buttonText}>Ana Sayfaya Dön</Text>
        </TouchableOpacity>
      </View>
    );
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
