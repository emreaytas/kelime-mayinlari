// src/screens/HomeScreen.jsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from "react-native";
import { router } from "expo-router";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { ref, onValue, push, set, get, remove } from "firebase/database";
import { auth, firestore, database } from "../firebase/config";
import {
  joinMatchmaking,
  cancelMatchmaking,
  getUserActiveGames,
  getUserCompletedGames,
  checkGameTimers,
} from "../services/gameService";

export default function HomeScreen() {
  const [user, setUser] = useState(null);
  const [activeGames, setActiveGames] = useState([]);
  const [completedGames, setCompletedGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [matchmakingLoading, setMatchmakingLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("newGame");
  const [waitingForMatch, setWaitingForMatch] = useState(false);
  const [matchmakingType, setMatchmakingType] = useState(null);

  // Periyodik süre kontrolü
  useEffect(() => {
    // Başlangıçta bir kez süreleri kontrol et
    const checkTimers = async () => {
      try {
        await checkGameTimers();
      } catch (err) {
        console.error("Timer check error:", err);
      }
    };

    checkTimers();

    // Belirli aralıklarla süreleri kontrol et (her dakika)
    const timerInterval = setInterval(checkTimers, 60 * 1000);

    // Cleanup
    return () => {
      clearInterval(timerInterval);
    };
  }, []);

  // Kullanıcı verileri ve oyunları yükle
  useEffect(() => {
    const loadUserData = async () => {
      try {
        if (!auth.currentUser) {
          console.warn("No authenticated user found");
          router.replace("/");
          return;
        }

        // Firestore'dan kullanıcı profili bilgilerini al
        const userDoc = await getDoc(
          doc(firestore, "users", auth.currentUser.uid)
        );

        if (userDoc.exists()) {
          setUser(userDoc.data());
        } else {
          console.warn("User document not found in Firestore");
        }

        // Aktif oyunları yükle
        loadActiveGames();

        // Tamamlanmış oyunları yükle
        loadCompletedGames();

        setLoading(false);
      } catch (error) {
        console.error("Error loading data:", error);
        setLoading(false);
        Alert.alert(
          "Hata",
          "Veriler yüklenirken bir hata oluştu: " + error.message
        );
      }
    };

    loadUserData();

    // Eşleşme kontrolü için listener
    const setupMatchmakingListener = () => {
      if (!auth.currentUser || !matchmakingType) return null;

      // Kullanıcının eşleşme durumunu dinle
      return onValue(
        ref(database, `matchmaking/${matchmakingType}/${auth.currentUser.uid}`),
        async (snapshot) => {
          // Eğer listeden kaldırıldıysa ve bekleme durumundaysa, yeni oyunları kontrol et
          if (!snapshot.exists() && waitingForMatch) {
            setWaitingForMatch(false);
            setMatchmakingType(null);

            // Son oluşturulan oyunları ara
            const games = await getUserActiveGames();

            if (games && games.length > 0) {
              // En son oluşturulan oyunu bul ve ona yönlendir
              const latestGame = games.sort(
                (a, b) => b.startTime - a.startTime
              )[0];
              if (latestGame) {
                router.push(`/game?gameId=${latestGame.id}`);
              }
            }
          }
        }
      );
    };

    const unsubscribeMatchmaking = setupMatchmakingListener();

    return () => {
      if (unsubscribeMatchmaking) {
        unsubscribeMatchmaking();
      }
    };
  }, [waitingForMatch, matchmakingType]);

  // Aktif oyunları yükle
  const loadActiveGames = async () => {
    try {
      // Gerçek servis fonksiyonunu kullan
      const games = await getUserActiveGames();

      // Oyun verilerini formatlayarak state'e kaydet
      const formattedGames = games.map((game) => {
        const isPlayer1 = game.player1?.id === auth.currentUser.uid;
        return {
          id: game.id,
          opponent: isPlayer1 ? game.player2?.username : game.player1?.username,
          myScore: isPlayer1
            ? game.player1?.score || 0
            : game.player2?.score || 0,
          opponentScore: isPlayer1
            ? game.player2?.score || 0
            : game.player1?.score || 0,
          isMyTurn: game.turnPlayer === auth.currentUser.uid,
          gameType: game.gameType,
          lastMoveTime: game.lastMoveTime || game.startTime,
        };
      });

      setActiveGames(formattedGames);
    } catch (error) {
      console.error("Error loading active games:", error);
    }
  };

  // Tamamlanmış oyunları yükle
  const loadCompletedGames = async () => {
    try {
      // Gerçek servis fonksiyonunu kullan
      const games = await getUserCompletedGames();

      // Oyun verilerini formatlayarak state'e kaydet
      const formattedGames = games.map((game) => {
        const isPlayer1 = game.player1?.id === auth.currentUser.uid;
        const myScore = isPlayer1
          ? game.player1?.score || 0
          : game.player2?.score || 0;
        const opponentScore = isPlayer1
          ? game.player2?.score || 0
          : game.player1?.score || 0;

        let result = "draw";
        if (myScore > opponentScore) {
          result = "win";
        } else if (myScore < opponentScore) {
          result = "loss";
        }

        return {
          id: game.id,
          opponent: isPlayer1 ? game.player2?.username : game.player1?.username,
          myScore,
          opponentScore,
          result,
          completedAt: game.completedAt || 0,
        };
      });

      setCompletedGames(formattedGames);
    } catch (error) {
      console.error("Error loading completed games:", error);
    }
  };

  // Eşleşme işlemi
  const handleJoinGame = async (gameType) => {
    try {
      if (!user) {
        Alert.alert("Hata", "Kullanıcı bilgileri yüklenemedi.");
        return;
      }

      setMatchmakingLoading(true);
      setMatchmakingType(gameType);

      // Eşleşme servisini kullan
      const result = await joinMatchmaking(gameType);

      if (result.status === "matched") {
        // Doğrudan eşleşme bulundu, oyun sayfasına yönlendir
        router.push(`/game?gameId=${result.gameId}`);
        setMatchmakingLoading(false);
      } else if (result.status === "waiting") {
        // Eşleşme bekleniyor, durum bilgisini güncelle
        setWaitingForMatch(true);
        setMatchmakingLoading(false);
      }
    } catch (error) {
      console.error("Join game error:", error);
      setMatchmakingLoading(false);
      setWaitingForMatch(false);
      setMatchmakingType(null);
      Alert.alert("Hata", "Oyuna katılırken bir hata oluştu: " + error.message);
    }
  };

  // Kalan süreyi formatlı şekilde göster
  const renderTimeLeft = (lastMoveTime, gameType) => {
    if (!lastMoveTime) return "";

    const now = Date.now();
    const timePassed = now - lastMoveTime;

    // Oyun tipine göre toplam süre
    let totalTime;
    switch (gameType) {
      case "2min":
        totalTime = 2 * 60 * 1000; // 2 dakika
        break;
      case "5min":
        totalTime = 5 * 60 * 1000; // 5 dakika
        break;
      case "12hour":
        totalTime = 12 * 60 * 60 * 1000; // 12 saat
        break;
      case "24hour":
        totalTime = 24 * 60 * 60 * 1000; // 24 saat
        break;
      default:
        totalTime = 24 * 60 * 60 * 1000; // Varsayılan 24 saat
    }

    // Kalan süre
    const timeLeft = totalTime - timePassed;

    if (timeLeft <= 0) {
      return "Süre doldu!";
    }

    // Süreyi formatlama
    if (timeLeft < 60 * 1000) {
      // 1 dakikadan az
      return `${Math.ceil(timeLeft / 1000)} saniye`;
    } else if (timeLeft < 60 * 60 * 1000) {
      // 1 saatten az
      return `${Math.ceil(timeLeft / (60 * 1000))} dakika`;
    } else {
      // 1 saatten fazla
      return `${Math.ceil(timeLeft / (60 * 60 * 1000))} saat`;
    }
  };

  // Mevcut bir oyuna devam et
  const continueGame = (gameId) => {
    router.push(`/game?gameId=${gameId}`);
  };

  // Çıkış yap
  const handleLogout = async () => {
    try {
      // Eşleşme bekliyorsa iptal et
      if (waitingForMatch && matchmakingType) {
        await cancelMatchmaking(matchmakingType);
      }

      await signOut(auth);
      router.replace("/");
    } catch (error) {
      console.error("Logout error:", error);
      Alert.alert("Hata", "Çıkış yapılırken bir hata oluştu: " + error.message);
    }
  };

  // Başarı oranını hesapla
  const calculateSuccessRate = () => {
    if (!user) return 0;

    const gamesPlayed = user.gamesPlayed || 0;
    const gamesWon = user.gamesWon || 0;

    if (gamesPlayed === 0) return 0;
    return Math.round((gamesWon / gamesPlayed) * 100);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2e6da4" />
        <Text>Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Kullanıcı Bilgileri */}
      <View style={styles.userInfo}>
        <View>
          <Text style={styles.username}>
            {user ? user.username : "Kullanıcı"}
          </Text>
          <View style={styles.statsContainer}>
            <Text style={styles.statsText}>
              Başarı: %{calculateSuccessRate()}
            </Text>
            <Text style={styles.statsText}>
              Oyunlar: {user?.gamesPlayed || 0}
            </Text>
            <Text style={styles.statsText}>
              Kazanılan: {user?.gamesWon || 0}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Çıkış Yap</Text>
        </TouchableOpacity>
      </View>

      {/* Sekmeler */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "newGame" && styles.activeTab]}
          onPress={() => setActiveTab("newGame")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "newGame" && styles.activeTabText,
            ]}
          >
            Yeni Oyun
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "activeGames" && styles.activeTab]}
          onPress={() => setActiveTab("activeGames")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "activeGames" && styles.activeTabText,
            ]}
          >
            Aktif Oyunlar ({activeGames.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === "completedGames" && styles.activeTab,
          ]}
          onPress={() => setActiveTab("completedGames")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "completedGames" && styles.activeTabText,
            ]}
          >
            Biten Oyunlar ({completedGames.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Sekme İçeriği */}
      {activeTab === "newGame" && (
        <View style={styles.tabContent}>
          <Text style={styles.sectionTitle}>Hızlı Oyun</Text>
          <View style={styles.gameOptions}>
            <TouchableOpacity
              style={styles.gameTypeButton}
              onPress={() => handleJoinGame("2min")}
              disabled={matchmakingLoading || waitingForMatch}
            >
              <Text style={styles.buttonText}>2 Dakika</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.gameTypeButton}
              onPress={() => handleJoinGame("5min")}
              disabled={matchmakingLoading || waitingForMatch}
            >
              <Text style={styles.buttonText}>5 Dakika</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>Genişletilmiş Oyun</Text>
          <View style={styles.gameOptions}>
            <TouchableOpacity
              style={styles.gameTypeButton}
              onPress={() => handleJoinGame("12hour")}
              disabled={matchmakingLoading || waitingForMatch}
            >
              <Text style={styles.buttonText}>12 Saat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.gameTypeButton}
              onPress={() => handleJoinGame("24hour")}
              disabled={matchmakingLoading || waitingForMatch}
            >
              <Text style={styles.buttonText}>24 Saat</Text>
            </TouchableOpacity>
          </View>

          {matchmakingLoading && (
            <View style={styles.matchmakingLoading}>
              <ActivityIndicator size="small" color="#2e6da4" />
              <Text style={styles.matchmakingText}>Eşleşme bekleniyor...</Text>
            </View>
          )}

          {waitingForMatch && (
            <View style={styles.matchmakingLoading}>
              <Text style={styles.matchmakingText}>
                {matchmakingType === "2min"
                  ? "2 Dakikalık oyun için eşleşme bekleniyor..."
                  : matchmakingType === "5min"
                  ? "5 Dakikalık oyun için eşleşme bekleniyor..."
                  : matchmakingType === "12hour"
                  ? "12 Saatlik oyun için eşleşme bekleniyor..."
                  : "24 Saatlik oyun için eşleşme bekleniyor..."}
              </Text>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  cancelMatchmaking(matchmakingType);
                  setWaitingForMatch(false);
                  setMatchmakingType(null);
                }}
              >
                <Text style={styles.cancelButtonText}>İptal Et</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {activeTab === "activeGames" && (
        <FlatList
          data={activeGames}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.gameItem}
              onPress={() => continueGame(item.id)}
            >
              <View style={styles.gameItemContent}>
                <View style={styles.gameItemHeader}>
                  <Text style={styles.opponentName}>
                    Rakip: {item.opponent || "Bilinmiyor"}
                  </Text>
                  {item.isMyTurn ? (
                    <Text style={styles.yourTurn}>Sıra sizde!</Text>
                  ) : (
                    <Text style={styles.opponentTurn}>Rakip oynuyor</Text>
                  )}
                </View>
                <View style={styles.gameItemDetails}>
                  <Text>Puanınız: {item.myScore}</Text>
                  <Text>Rakip Puanı: {item.opponentScore}</Text>
                </View>
                <View style={styles.gameItemFooter}>
                  <Text style={styles.gameType}>
                    {item.gameType === "2min"
                      ? "2 Dakika"
                      : item.gameType === "5min"
                      ? "5 Dakika"
                      : item.gameType === "12hour"
                      ? "12 Saat"
                      : "24 Saat"}
                  </Text>
                  {item.isMyTurn && (
                    <Text style={styles.timeLeft}>
                      {renderTimeLeft(item.lastMoveTime, item.gameType)}
                    </Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyList}>
              <Text>Aktif oyununuz bulunmamaktadır.</Text>
              <Text>
                Yeni bir oyun başlatmak için "Yeni Oyun" sekmesine gidin.
              </Text>
            </View>
          }
          onRefresh={loadActiveGames}
          refreshing={loading}
        />
      )}

      {activeTab === "completedGames" && (
        <FlatList
          data={completedGames}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.gameItem}>
              <View style={styles.gameItemContent}>
                <View style={styles.gameItemHeader}>
                  <Text style={styles.opponentName}>
                    Rakip: {item.opponent || "Bilinmiyor"}
                  </Text>
                  <Text
                    style={
                      item.result === "win"
                        ? styles.winText
                        : item.result === "loss"
                        ? styles.lossText
                        : styles.drawText
                    }
                  >
                    {item.result === "win"
                      ? "Kazandınız"
                      : item.result === "loss"
                      ? "Kaybettiniz"
                      : "Berabere"}
                  </Text>
                </View>
                <View style={styles.gameItemDetails}>
                  <Text>Puanınız: {item.myScore}</Text>
                  <Text>Rakip Puanı: {item.opponentScore}</Text>
                </View>
                <View style={styles.gameItemFooter}>
                  <Text style={styles.completionDate}>
                    {new Date(item.completedAt).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyList}>
              <Text>Henüz tamamlanmış oyununuz bulunmamaktadır.</Text>
            </View>
          }
          onRefresh={loadCompletedGames}
          refreshing={loading}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  userInfo: {
    padding: 15,
    backgroundColor: "white",
    borderRadius: 10,
    marginBottom: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
  username: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
  },
  logoutButton: {
    backgroundColor: "#f44336",
    padding: 10,
    borderRadius: 5,
  },
  logoutText: {
    color: "white",
    fontWeight: "bold",
  },
  tabs: {
    flexDirection: "row",
    marginBottom: 15,
    backgroundColor: "#e0e0e0",
    borderRadius: 8,
    overflow: "hidden",
  },
  tab: {
    flex: 1,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  activeTab: {
    backgroundColor: "#2e6da4",
  },
  tabText: {
    fontWeight: "500",
    color: "#333",
  },
  activeTabText: {
    color: "#fff",
  },
  tabContent: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 10,
    padding: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 10,
    marginBottom: 15,
    color: "#2e6da4",
  },
  gameOptions: {
    marginBottom: 20,
  },
  gameTypeButton: {
    backgroundColor: "#4CAF50",
    borderRadius: 8,
    padding: 16,
    marginBottom: 10,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 1,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  gameItem: {
    backgroundColor: "white",
    borderRadius: 8,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 1,
    overflow: "hidden",
  },
  gameItemContent: {
    padding: 15,
  },
  gameItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  opponentName: {
    fontWeight: "bold",
    fontSize: 16,
  },
  yourTurn: {
    color: "green",
    fontWeight: "bold",
  },
  opponentTurn: {
    color: "#666",
    fontStyle: "italic",
  },
  gameItemDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  gameItemFooter: {
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 8,
    marginTop: 4,
  },
  gameType: {
    fontSize: 12,
    color: "#666",
  },
  completionDate: {
    fontSize: 12,
    color: "#666",
  },
  emptyList: {
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  winText: {
    color: "green",
    fontWeight: "bold",
  },
  lossText: {
    color: "red",
    fontWeight: "bold",
  },
  drawText: {
    color: "blue",
    fontWeight: "bold",
  },
  statsContainer: {
    flexDirection: "row",
    marginTop: 4,
    flexWrap: "wrap",
  },
  statsText: {
    fontSize: 12,
    color: "#666",
    marginRight: 10,
  },
  timeLeft: {
    fontSize: 12,
    color: "#e74c3c", // Kırmızı
    fontWeight: "bold",
    marginLeft: 10,
  },
  matchmakingLoading: {
    alignItems: "center",
    marginTop: 20,
    padding: 15,
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  matchmakingText: {
    marginTop: 10,
    fontStyle: "italic",
    color: "#666",
  },
  cancelButton: {
    marginTop: 15,
    backgroundColor: "#f44336",
    padding: 10,
    borderRadius: 5,
    width: 150,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "white",
    fontWeight: "bold",
  },
});
