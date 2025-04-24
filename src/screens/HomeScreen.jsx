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
import { ref, onValue, push, set, get } from "firebase/database";
import { auth, firestore, database } from "../firebase/config";
import {
  generateLetterPool,
  distributeLetters,
  initializeBoard,
  generateMines,
  generateRewards,
  placeSpecialsOnBoard,
} from "../utils/GameUtils";
import { checkGameTimers } from "../services/gameService";

export default function HomeScreen() {
  const [user, setUser] = useState(null);
  const [activeGames, setActiveGames] = useState([]);
  const [completedGames, setCompletedGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("newGame");

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

    // Belirli aralıklarla süreleri kontrol et (örn. her dakika)
    const timerInterval = setInterval(checkTimers, 60 * 1000); // 60 saniye

    // Cleanup
    return () => {
      clearInterval(timerInterval);
    };
  }, []);

  // Load user data and games
  useEffect(() => {
    const loadUserData = async () => {
      try {
        if (!auth.currentUser) {
          console.warn("No authenticated user found");
          router.replace("/");
          return;
        }

        // Get user profile from Firestore
        const userDoc = await getDoc(
          doc(firestore, "users", auth.currentUser.uid)
        );

        if (userDoc.exists()) {
          setUser(userDoc.data());
          console.log("User data loaded:", userDoc.data().username);
        } else {
          console.warn("User document not found in Firestore");
        }

        // Load active games
        const activeGamesRef = ref(database, "games");
        const unsubscribeActive = onValue(activeGamesRef, (snapshot) => {
          const gamesData = snapshot.val() || {};

          // Filter games for the current user that are active
          const userGames = Object.entries(gamesData)
            .filter(([_, game]) => {
              const isActive = game.status === "active";
              const isUserGame =
                game.player1?.id === auth.currentUser.uid ||
                game.player2?.id === auth.currentUser.uid;
              return isActive && isUserGame;
            })
            .map(([id, game]) => {
              const isPlayer1 = game.player1?.id === auth.currentUser.uid;
              return {
                id,
                opponent: isPlayer1
                  ? game.player2?.username
                  : game.player1?.username,
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

          setActiveGames(userGames);
          console.log(`Loaded ${userGames.length} active games`);
        });

        // Load completed games
        const completedGamesRef = ref(database, "completedGames");
        const unsubscribeCompleted = onValue(completedGamesRef, (snapshot) => {
          const gamesData = snapshot.val() || {};

          // Filter completed games for the current user
          const userCompletedGames = Object.entries(gamesData)
            .filter(([_, game]) => {
              return (
                game.player1?.id === auth.currentUser.uid ||
                game.player2?.id === auth.currentUser.uid
              );
            })
            .map(([id, game]) => {
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
                id,
                opponent: isPlayer1
                  ? game.player2?.username
                  : game.player1?.username,
                myScore,
                opponentScore,
                result,
                completedAt: game.completedAt || 0,
              };
            })
            // Sort by completion time (most recent first)
            .sort((a, b) => b.completedAt - a.completedAt);

          setCompletedGames(userCompletedGames);
          console.log(`Loaded ${userCompletedGames.length} completed games`);
        });

        setLoading(false);

        // Cleanup listeners on unmount
        return () => {
          unsubscribeActive();
          unsubscribeCompleted();
        };
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
  }, []);

  // Handle creating/joining a game with the selected time limit
  const handleJoinGame = async (gameType) => {
    try {
      if (!user) {
        Alert.alert("Hata", "Kullanıcı bilgileri yüklenemedi.");
        return;
      }

      setLoading(true);

      // Check matchmaking for waiting players
      const matchmakingRef = ref(database, `matchmaking/${gameType}`);
      const matchmakingSnapshot = await get(matchmakingRef);
      const waitingPlayers = matchmakingSnapshot.val() || {};

      // Find waiting players (exclude current user)
      const otherPlayerIds = Object.keys(waitingPlayers).filter(
        (id) => id !== auth.currentUser.uid
      );

      if (otherPlayerIds.length > 0) {
        // Match found - pair with the first waiting player
        const opponentId = otherPlayerIds[0];

        // Get opponent info
        const opponentSnapshot = await getDoc(
          doc(firestore, "users", opponentId)
        );

        if (!opponentSnapshot.exists()) {
          throw new Error("Opponent user data not found");
        }

        const opponentData = opponentSnapshot.data();

        // Remove opponent from matchmaking
        await set(ref(database, `matchmaking/${gameType}/${opponentId}`), null);

        // Create a new game
        await createGame(gameType, opponentId, opponentData.username);
      } else {
        // No match found - add to waiting list
        await set(
          ref(database, `matchmaking/${gameType}/${auth.currentUser.uid}`),
          {
            timestamp: Date.now(),
            username: user.username,
          }
        );

        setLoading(false);

        // Show waiting message
        Alert.alert(
          "Eşleşme Bekleniyor",
          "Diğer oyuncu bekleniyor. Eşleşme bulunduğunda otomatik olarak oyuna yönlendirileceksiniz.",
          [
            {
              text: "İptal Et",
              onPress: async () => {
                // Cancel matchmaking if user presses cancel
                await set(
                  ref(
                    database,
                    `matchmaking/${gameType}/${auth.currentUser.uid}`
                  ),
                  null
                );
              },
              style: "cancel",
            },
          ]
        );

        // Listen for matchmaking status changes
        const matchListener = onValue(
          ref(database, `matchmaking/${gameType}/${auth.currentUser.uid}`),
          async (snapshot) => {
            // If removed from waiting list, check for new games
            if (!snapshot.exists()) {
              // Look for recently created games
              const activeGamesSnapshot = await get(ref(database, "games"));
              const gamesData = activeGamesSnapshot.val() || {};

              // Find the latest game for this user
              const latestGame = Object.entries(gamesData)
                .filter(([_, game]) => {
                  return (
                    (game.player1?.id === auth.currentUser.uid ||
                      game.player2?.id === auth.currentUser.uid) &&
                    game.status === "active" &&
                    Date.now() - game.startTime < 60000 // Created in the last minute
                  );
                })
                .sort((a, b) => b[1].startTime - a[1].startTime)[0];

              if (latestGame) {
                const [gameId, _] = latestGame;
                router.push(`/game?gameId=${gameId}`);
              }

              // Remove this listener
              matchListener();
            }
          }
        );
      }
    } catch (error) {
      console.error("Join game error:", error);
      setLoading(false);
      Alert.alert("Hata", "Oyuna katılırken bir hata oluştu: " + error.message);
    }
  };

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

  // Create a new game
  const createGame = async (gameType, opponentId, opponentUsername) => {
    try {
      // Generate game components
      const letterPool = generateLetterPool();
      const { player1Rack, player2Rack, remainingPool } =
        distributeLetters(letterPool);

      // Create board with special cells
      const emptyBoard = initializeBoard();
      const mines = generateMines();
      const rewards = generateRewards();
      const boardWithSpecials = placeSpecialsOnBoard(
        emptyBoard,
        mines,
        rewards
      );

      // Randomly select first player
      const firstPlayer =
        Math.random() < 0.5 ? auth.currentUser.uid : opponentId;

      // Create new game in Firebase
      const newGameRef = push(ref(database, "games"));

      // Game data
      const gameData = {
        player1: {
          id: auth.currentUser.uid,
          username: user.username,
          score: 0,
        },
        player2: {
          id: opponentId,
          username: opponentUsername,
          score: 0,
        },
        board: boardWithSpecials,
        letterPool: remainingPool,
        player1Rack,
        player2Rack,
        player1Rewards: [],
        player2Rewards: [],
        turnPlayer: firstPlayer,
        startTime: Date.now(),
        lastMoveTime: Date.now(),
        gameType,
        status: "active",
      };

      // Save game to Firebase
      await set(newGameRef, gameData);

      setLoading(false);

      // Navigate to game screen
      router.push(`/game?gameId=${newGameRef.key}`);
    } catch (error) {
      console.error("Create game error:", error);
      setLoading(false);
      throw error;
    }
  };

  // Continue an existing game
  const continueGame = (gameId) => {
    router.push(`/game?gameId=${gameId}`);
  };

  // Log out
  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace("/");
    } catch (error) {
      console.error("Logout error:", error);
      Alert.alert("Hata", "Çıkış yapılırken bir hata oluştu: " + error.message);
    }
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
      {/* User Info */}

      <View style={styles.userInfo}>
        <View>
          <Text style={styles.username}>
            {user ? user.username : "Kullanıcı"}
          </Text>
          <View style={styles.statsContainer}>
            <Text style={styles.statsText}>
              Başarı: %{user && user.successRate ? user.successRate : 0}
            </Text>
            <Text style={styles.statsText}>
              Oyunlar: {user && user.gamesPlayed ? user.gamesPlayed : 0}
            </Text>
            <Text style={styles.statsText}>
              Kazanılan: {user && user.gamesWon ? user.gamesWon : 0}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Çıkış Yap</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "newGame" && styles.activeTab]}
          onPress={() => setActiveTab("newGame")}
        >
          <Text style={styles.tabText}>Yeni Oyun</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "activeGames" && styles.activeTab]}
          onPress={() => setActiveTab("activeGames")}
        >
          <Text style={styles.tabText}>
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
          <Text style={styles.tabText}>
            Biten Oyunlar ({completedGames.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === "newGame" && (
        <View style={styles.tabContent}>
          <Text style={styles.sectionTitle}>Hızlı Oyun</Text>
          <View style={styles.gameOptions}>
            <TouchableOpacity
              style={styles.gameTypeButton}
              onPress={() => handleJoinGame("2min")}
            >
              <Text style={styles.buttonText}>2 Dakika</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.gameTypeButton}
              onPress={() => handleJoinGame("5min")}
            >
              <Text style={styles.buttonText}>5 Dakika</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>Genişletilmiş Oyun</Text>
          <View style={styles.gameOptions}>
            <TouchableOpacity
              style={styles.gameTypeButton}
              onPress={() => handleJoinGame("12hour")}
            >
              <Text style={styles.buttonText}>12 Saat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.gameTypeButton}
              onPress={() => handleJoinGame("24hour")}
            >
              <Text style={styles.buttonText}>24 Saat</Text>
            </TouchableOpacity>
          </View>
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
});
