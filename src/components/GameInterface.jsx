// src/components/GameInterface.jsx - Fixed version with extra data safety checks
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { auth } from "../firebase/config";
import GameBoard from "./GameBoard";
import LetterRack from "./LetterRack";
import {
  placeWord,
  passTurn,
  surrender,
  useReward,
  getGameData,
  listenToGameChanges,
} from "../services/gameService";

export default function GameInterface({ gameId }) {
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRackIndices, setSelectedRackIndices] = useState([]);
  const [selectedBoardCells, setSelectedBoardCells] = useState([]);
  const [currentWord, setCurrentWord] = useState("");
  const [wordValid, setWordValid] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [activeReward, setActiveReward] = useState(null);
  const [specialPopup, setSpecialPopup] = useState(null);
  const [confirmingAction, setConfirmingAction] = useState(false);
  const [remainingTime, setRemainingTime] = useState(null);
  const [timerColor, setTimerColor] = useState("#333"); // Normal renk

  // Firebase dinleyicisi referansı
  const unsubscribeRef = useRef(null);

  useEffect(() => {
    if (!game || !isUserTurn()) return;

    // Süreyi hesapla
    const calculateRemainingTime = () => {
      const now = Date.now();
      const lastMoveTime = game.lastMoveTime || game.startTime || now;
      const timePassed = now - lastMoveTime;

      // Oyun tipine göre toplam süre
      let totalTime;
      switch (game.gameType) {
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

      // Süreyi formatlama
      let formattedTime = "";
      if (timeLeft <= 0) {
        formattedTime = "Süre doldu!";
        setTimerColor("#e74c3c"); // Kırmızı
      } else {
        // Saat, dakika, saniye hesapla
        const hours = Math.floor(timeLeft / (60 * 60 * 1000));
        const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
        const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000);

        // Formatı belirle
        if (hours > 0) {
          formattedTime = `${hours}s ${minutes}d`;
        } else if (minutes > 0) {
          formattedTime = `${minutes}d ${seconds}s`;
        } else {
          formattedTime = `${seconds}s`;
        }

        // Son 30 saniye için renk değiştir
        if (timeLeft < 30 * 1000) {
          setTimerColor("#e74c3c"); // Kırmızı
        } else if (timeLeft < 2 * 60 * 1000) {
          // Son 2 dakika
          setTimerColor("#f39c12"); // Turuncu
        } else {
          setTimerColor("#333"); // Normal
        }
      }

      setRemainingTime(formattedTime);
    };

    // İlk hesaplama
    calculateRemainingTime();

    // Periyodik güncelleme
    const timer = setInterval(() => {
      calculateRemainingTime();
    }, 1000); // Her saniye

    return () => {
      clearInterval(timer);
    };
  }, [game, isUserTurn]);

  useEffect(() => {
    // Oyun verilerini dinle
    const setupGameListener = () => {
      try {
        unsubscribeRef.current = listenToGameChanges(
          gameId,
          (gameData, error) => {
            setLoading(false);

            if (error) {
              console.error("Game data error:", error);
              setError("Oyun verileri yüklenirken bir sorun oluştu");
              return;
            }

            if (!gameData) {
              console.error("No game data received");
              setError("Oyun verileri bulunamadı");
              return;
            }

            // Gelen verileri doğrula
            if (!validateGameData(gameData)) {
              console.error("Invalid game data structure:", gameData);
              setError("Oyun verileri geçersiz format");
              // Hatalı veriyi yine de depola (debug için)
              setGame(gameData);
              return;
            }

            // Geçerli oyun verileri
            setGame(gameData);
            setError(null);

            // Oyun yeni başladıysa ve başlangıç kelimesi varsa bildiri göster
            if (gameData.initialWord && !gameData._initialWordShown) {
              Alert.alert(
                "Oyun Başladı",
                `Başlangıç kelimesi tahtaya yerleştirildi: ${gameData.initialWord}`,
                [{ text: "Tamam" }]
              );
              // Tekrar göstermeyi önle
              setGame({ ...gameData, _initialWordShown: true });
            }

            // Oyun tamamlandıysa ve daha önce popup gösterilmediyse
            if (gameData.status === "completed" && !gameData._completedShown) {
              showGameResultPopup(gameData);
              // Tekrar göstermeyi önle
              setGame({ ...gameData, _completedShown: true });
            }
          }
        );
      } catch (err) {
        console.error("Error setting up game listener:", err);
        setError("Oyun bağlantısı kurulamadı");
        setLoading(false);
      }
    };

    setupGameListener();

    // Temizleme
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [gameId]);

  // Kullanıcı ve oyun verilerini yükle
  useEffect(() => {
    // Oyun ID'si var mı kontrol et
    if (!gameId) {
      Alert.alert("Hata", "Oyun ID'si bulunamadı", [
        { text: "Ana Sayfaya Dön", onPress: () => router.replace("/home") },
      ]);
      return;
    }

    // Oyun verilerini dinle
    const setupGameListener = () => {
      try {
        unsubscribeRef.current = listenToGameChanges(
          gameId,
          (gameData, error) => {
            setLoading(false);

            if (error) {
              console.error("Game data error:", error);
              setError("Oyun verileri yüklenirken bir sorun oluştu");
              return;
            }

            if (!gameData) {
              console.error("No game data received");
              setError("Oyun verileri bulunamadı");
              return;
            }

            // Gelen verileri doğrula
            if (!validateGameData(gameData)) {
              console.error("Invalid game data structure:", gameData);
              setError("Oyun verileri geçersiz format");
              // Hatalı veriyi yine de depola (debug için)
              setGame(gameData);
              return;
            }

            // Geçerli oyun verileri
            setGame(gameData);
            setError(null);

            // Oyun tamamlandıysa ve daha önce popup gösterilmediyse
            if (gameData.status === "completed" && !gameData._completedShown) {
              showGameResultPopup(gameData);
              // Tekrar göstermeyi önle
              setGame({ ...gameData, _completedShown: true });
            }
          }
        );
      } catch (err) {
        console.error("Error setting up game listener:", err);
        setError("Oyun bağlantısı kurulamadı");
        setLoading(false);
      }
    };

    setupGameListener();

    // Temizleme
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [gameId]);

  // Oyun verilerini doğrula
  const validateGameData = (data) => {
    if (!data) return false;

    // Minimum gerekli alanlar
    if (!data.board || !Array.isArray(data.board)) {
      console.warn("Game data missing valid board array");
      return false;
    }

    // Oyun durumu ve oyuncular
    if (!data.status || !data.player1 || !data.player2) {
      console.warn("Game data missing status or players");
      return false;
    }

    return true;
  };
  // Oyun süresini formatlama için yardımcı fonksiyon
  const formatGameDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return "Bilinmiyor";

    const durationMs = endTime - startTime;
    const seconds = Math.floor(durationMs / 1000);

    if (seconds < 60) {
      return `${seconds} saniye`;
    }

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes} dakika ${seconds % 60} saniye`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours} saat ${minutes % 60} dakika`;
    }

    const days = Math.floor(hours / 24);
    return `${days} gün ${hours % 24} saat`;
  };
  // Oyun sonucunu göster
  const showGameResultPopup = (gameData) => {
    if (!auth.currentUser) return;

    const isPlayer1 = auth.currentUser.uid === gameData.player1.id;
    const player1Won = gameData.player1.score > gameData.player2.score;
    const player2Won = gameData.player2.score > gameData.player1.score;
    const isDraw = gameData.player1.score === gameData.player2.score;

    let title = "Oyun Bitti";
    let message = "";

    if (isDraw) {
      message = "Oyun berabere bitti!";
    } else if ((isPlayer1 && player1Won) || (!isPlayer1 && player2Won)) {
      message = "Tebrikler, oyunu kazandınız!";
    } else {
      message = "Üzgünüm, oyunu kaybettiniz.";
    }

    message += `\n\n${gameData.player1.username}: ${gameData.player1.score} puan\n${gameData.player2.username}: ${gameData.player2.score} puan`;

    Alert.alert(title, message, [
      { text: "Ana Sayfaya Dön", onPress: () => router.replace("/home") },
    ]);
  };

  // Kullanıcının harflerini al
  const getUserRack = () => {
    if (!game || !auth.currentUser) return [];

    const isPlayer1 = auth.currentUser.uid === game.player1?.id;
    return isPlayer1 ? game.player1Rack || [] : game.player2Rack || [];
  };

  // Kullanıcının sırası mı?
  const isUserTurn = () => {
    if (!game || !auth.currentUser) return false;
    return game.turnPlayer === auth.currentUser.uid;
  };

  // Kullanıcının ödüllerini al
  const getUserRewards = () => {
    if (!game || !auth.currentUser) return [];

    const isPlayer1 = auth.currentUser.uid === game.player1?.id;
    return isPlayer1 ? game.player1Rewards || [] : game.player2Rewards || [];
  };

  // Hücre seçimi
  const handleBoardCellSelect = (row, col) => {
    if (!isUserTurn()) {
      Alert.alert("Uyarı", "Şu anda sıra sizde değil!");
      return;
    }

    // Harf seçili değilse
    if (selectedRackIndices.length === 0) {
      Alert.alert("Uyarı", "Önce rafınızdan bir harf seçin!");
      return;
    }

    // Tahta geçerli mi kontrol et
    if (
      !game?.board ||
      !Array.isArray(game.board) ||
      !game.board[row] ||
      !game.board[row][col]
    ) {
      Alert.alert("Uyarı", "Tahta verisi geçersiz! Lütfen sayfayı yenileyin.");
      return;
    }

    // Hücre boş mu kontrol et
    if (game.board[row][col]?.letter) {
      Alert.alert("Uyarı", "Bu hücre zaten dolu!");
      return;
    }

    // Raf indeksini al (ilk seçili harf)
    const rackIndex = selectedRackIndices[0];

    // Seçili hücreleri güncelle - tek bir hücre
    setSelectedBoardCells([{ row, col, rackIndex }]);

    // Seçilen harfi kaldır
    setSelectedRackIndices([]);

    // Kelimeyi ve puanı hesapla
    calculateWordAndPoints(row, col, rackIndex);
  };

  // Raftaki harf seçimi
  const handleRackTileSelect = (index) => {
    if (!isUserTurn()) {
      Alert.alert("Uyarı", "Şu anda sıra sizde değil!");
      return;
    }

    // Önceki seçimi temizle
    setSelectedBoardCells([]);

    // Yeni seçim - her zaman tek harf
    setSelectedRackIndices([index]);
  };

  // Kelimeyi ve puanı hesapla
  const calculateWordAndPoints = (row, col, rackIndex) => {
    // Güvenlik kontrolleri
    try {
      // Basit geçici hesaplama
      setCurrentWord("Test");
      setWordValid(true);
      setEarnedPoints(5);
    } catch (err) {
      console.error("Error calculating word and points:", err);
      setCurrentWord("");
      setWordValid(false);
      setEarnedPoints(0);
    }
  };

  // Hamleyi onayla
  const confirmMove = async () => {
    if (!isUserTurn()) {
      Alert.alert("Uyarı", "Şu anda sıra sizde değil!");
      return;
    }

    if (!wordValid) {
      Alert.alert("Uyarı", "Geçerli bir kelime oluşturun!");
      return;
    }

    if (selectedBoardCells.length === 0) {
      Alert.alert("Uyarı", "Tahtaya yerleştirilecek harf seçilmedi!");
      return;
    }

    try {
      setConfirmingAction(true);

      // Kelimeyi yerleştir - Tek harf yerleştiriyoruz
      const result = await placeWord(gameId, selectedBoardCells);

      // Başarılı hamle
      resetSelections();
    } catch (error) {
      Alert.alert("Hata", error.message || "Hamle yapılırken bir sorun oluştu");
    } finally {
      setConfirmingAction(false);
    }
  };

  // Hamleyi iptal et
  const cancelMove = () => {
    resetSelections();
  };

  // Tüm seçimleri sıfırla
  const resetSelections = () => {
    setSelectedBoardCells([]);
    setSelectedRackIndices([]);
    setCurrentWord("");
    setWordValid(false);
    setEarnedPoints(0);
    setActiveReward(null);
  };

  // Pas geç
  const handlePass = async () => {
    if (!isUserTurn()) {
      Alert.alert("Uyarı", "Şu anda sıra sizde değil!");
      return;
    }

    Alert.alert("Pas Geçmek İstiyor musunuz?", "Sıra rakibinize geçecektir.", [
      { text: "İptal", style: "cancel" },
      {
        text: "Pas Geç",
        onPress: async () => {
          try {
            setConfirmingAction(true);
            await passTurn(gameId);
            resetSelections();
          } catch (error) {
            Alert.alert(
              "Hata",
              error.message || "Pas geçilirken bir sorun oluştu"
            );
          } finally {
            setConfirmingAction(false);
          }
        },
      },
    ]);
  };

  // Teslim ol
  const handleSurrender = () => {
    if (!isUserTurn()) {
      Alert.alert("Uyarı", "Şu anda sıra sizde değil!");
      return;
    }

    Alert.alert(
      "Teslim Olmak İstiyor musunuz?",
      "Oyunu kaybedeceksiniz ve rakibiniz bonus puan alacak.",
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Teslim Ol",
          style: "destructive",
          onPress: async () => {
            try {
              setConfirmingAction(true);
              await surrender(gameId);
              resetSelections();
            } catch (error) {
              Alert.alert(
                "Hata",
                error.message || "Teslim olurken bir sorun oluştu"
              );
            } finally {
              setConfirmingAction(false);
            }
          },
        },
      ]
    );
  };

  // Ödül kullan
  const handleUseReward = async (rewardType) => {
    if (!isUserTurn()) {
      Alert.alert("Uyarı", "Şu anda sıra sizde değil!");
      return;
    }

    try {
      setConfirmingAction(true);

      const result = await useReward(gameId, rewardType);

      if (result.success) {
        const rewardMessages = {
          BolgeYasagi:
            "Bölge Yasağı etkinleştirildi. Rakibiniz sınırlı bir alanda oynayabilecek!",
          HarfYasagi:
            "Harf Yasağı etkinleştirildi. Rakibinizin bazı harfleri donduruldu!",
          EkstraHamleJokeri:
            "Ekstra Hamle Jokeri etkinleştirildi. Bir sonraki turda ekstra hamle yapabileceksiniz!",
        };

        setSpecialPopup({
          title: "Ödül Kullanıldı",
          message:
            rewardMessages[rewardType] || `${rewardType} etkinleştirildi!`,
        });

        setActiveReward(null);
      }
    } catch (error) {
      Alert.alert(
        "Hata",
        error.message || "Ödül kullanılırken bir sorun oluştu"
      );
    } finally {
      setConfirmingAction(false);
    }
  };

  // Popup kapat
  const closePopup = () => {
    setSpecialPopup(null);
  };

  // Hata durumunda
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.replace("/home")}
        >
          <Text style={styles.buttonText}>Ana Sayfaya Dön</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Yükleniyor
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2e6da4" />
        <Text>Oyun yükleniyor...</Text>
      </View>
    );
  }

  // Oyun yoksa veya silinmişse
  if (!game) {
    return (
      <View style={styles.errorContainer}>
        <Text>Oyun bulunamadı</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.replace("/home")}
        >
          <Text style={styles.buttonText}>Ana Sayfaya Dön</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Oyun tamamlanmışsa

  // Oyun tamamlanmışsa
  if (game.status === "completed") {
    const player1Won = (game.player1?.score || 0) > (game.player2?.score || 0);
    const player2Won = (game.player2?.score || 0) > (game.player1?.score || 0);
    const isDraw = (game.player1?.score || 0) === (game.player2?.score || 0);

    // Kullanıcının oyuncu 1 mi yoksa 2 mi olduğunu belirle
    const isPlayer1 = auth.currentUser?.uid === game.player1?.id;

    // Oyunun bitme sebebini açıklayan mesajı belirle
    let reasonMessage = "";
    if (game.reason === "timeout") {
      // Süre aşımı durumunda, kimin süresinin dolduğunu göster
      const timedOutPlayerName =
        game.timedOutPlayer === game.player1?.id
          ? game.player1?.username
          : game.player2?.username;
      reasonMessage = `Süre aşımı: ${timedOutPlayerName} süresi doldu`;
    } else if (game.reason === "surrender") {
      // Teslim olma durumunda, kimin teslim olduğunu göster
      const surrenderedPlayer = isPlayer1
        ? player1Won
          ? game.player2?.username
          : game.player1?.username
        : player2Won
        ? game.player1?.username
        : game.player2?.username;
      reasonMessage = `${surrenderedPlayer} teslim oldu`;
    } else if (game.reason === "pass") {
      reasonMessage = "Üst üste pas geçildi";
    } else {
      reasonMessage = "Oyun normal şekilde tamamlandı";
    }

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.gameOverContainer}>
          <Text style={styles.gameOverTitle}>Oyun Tamamlandı</Text>

          <View style={styles.scoreContainer}>
            <View style={styles.playerScore}>
              <Text style={styles.playerName}>
                {game.player1?.username || "Oyuncu 1"}
              </Text>
              <Text style={styles.score}>{game.player1?.score || 0}</Text>
              {player1Won && <Text style={styles.winner}>Kazanan!</Text>}
            </View>

            <View style={styles.playerScore}>
              <Text style={styles.playerName}>
                {game.player2?.username || "Oyuncu 2"}
              </Text>
              <Text style={styles.score}>{game.player2?.score || 0}</Text>
              {player2Won && <Text style={styles.winner}>Kazanan!</Text>}
            </View>
          </View>

          {isDraw && <Text style={styles.drawText}>Berabere!</Text>}

          <Text style={styles.reasonText}>{reasonMessage}</Text>

          {/* İstatistikler */}
          <View style={styles.statsContainer}>
            <Text style={styles.statsTitle}>Oyun İstatistikleri</Text>
            <Text style={styles.statsText}>
              Oyun Süresi:{" "}
              {formatGameDuration(game.startTime, game.completedAt)}
            </Text>
            <Text style={styles.statsText}>
              Oyun Tipi:{" "}
              {game.gameType === "2min"
                ? "2 Dakika"
                : game.gameType === "5min"
                ? "5 Dakika"
                : game.gameType === "12hour"
                ? "12 Saat"
                : "24 Saat"}
            </Text>
            <Text style={styles.statsText}>
              Başlangıç Kelimesi: {game.initialWord || "Bilinmiyor"}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.homeButton}
            onPress={() => router.replace("/home")}
          >
            <Text style={styles.buttonText}>Ana Sayfaya Dön</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Oyuncuları belirle
  const isPlayer1 = auth.currentUser?.uid === game.player1?.id;
  const currentPlayer = isPlayer1 ? game.player1 : game.player2;
  const opponent = isPlayer1 ? game.player2 : game.player1;
  const userRack = getUserRack();
  const userRewards = getUserRewards();

  return (
    <SafeAreaView style={styles.container}>
      {/* Üst Bilgi Alanı */}
      <View style={styles.topInfoContainer}>
        <View style={styles.playerInfo}>
          <Text style={styles.playerName}>
            {currentPlayer?.username || "Sen"}
          </Text>
          <Text style={styles.score}>{currentPlayer?.score || 0}</Text>
        </View>

        <View style={styles.poolInfo}>
          <Text>Kalan: {game.letterPool?.length || 0}</Text>
        </View>

        <View style={styles.playerInfo}>
          <Text style={styles.playerName}>{opponent?.username || "Rakip"}</Text>
          <Text style={styles.score}>{opponent?.score || 0}</Text>
        </View>
      </View>

      {/* Oyun Tahtası */}
      <ScrollView contentContainerStyle={styles.boardContainer}>
        <GameBoard
          board={game.board}
          selectedCells={selectedBoardCells}
          onCellPress={handleBoardCellSelect}
          showSpecials={false} // Debug modunda true yapılabilir
        />
      </ScrollView>

      {/* Kullanıcı Ödülleri */}
      {userRewards.length > 0 && (
        <View style={styles.rewardsContainer}>
          <Text style={styles.rewardsTitle}>Ödülleriniz:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.rewardsList}>
              {userRewards.map((reward, index) => (
                <TouchableOpacity
                  key={`reward-${index}`}
                  style={[
                    styles.rewardItem,
                    activeReward === index && styles.selectedReward,
                  ]}
                  onPress={() =>
                    setActiveReward(activeReward === index ? null : index)
                  }
                  disabled={!isUserTurn() || confirmingAction}
                >
                  <Text style={styles.rewardText}>{reward}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {activeReward !== null && (
            <TouchableOpacity
              style={styles.useRewardButton}
              onPress={() => handleUseReward(userRewards[activeReward])}
              disabled={confirmingAction}
            >
              <Text style={styles.useRewardText}>Ödülü Kullan</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Harf Rafı */}
      <View style={styles.rackContainer}>
        <LetterRack
          letters={userRack}
          selectedIndices={selectedRackIndices}
          onTilePress={handleRackTileSelect}
        />
      </View>

      {/* Kelime Bilgisi ve Kontrol Butonları */}
      <View style={styles.controlsContainer}>
        <View style={styles.wordInfoContainer}>
          <Text style={styles.wordLabel}>Kelime:</Text>
          <Text
            style={[
              styles.wordText,
              wordValid && currentWord ? styles.validWord : styles.invalidWord,
            ]}
          >
            {currentWord || "-"}
          </Text>
          {earnedPoints > 0 && (
            <Text style={styles.pointsText}>+{earnedPoints} puan</Text>
          )}
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.dangerButton]}
            onPress={handleSurrender}
            disabled={!isUserTurn() || confirmingAction}
          >
            <Text style={styles.buttonText}>Teslim Ol</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={cancelMove}
            disabled={selectedBoardCells.length === 0 || confirmingAction}
          >
            <Text style={styles.buttonText}>İptal</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.passButton]}
            onPress={handlePass}
            disabled={!isUserTurn() || confirmingAction}
          >
            <Text style={styles.buttonText}>Pas</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              styles.confirmButton,
              (!wordValid || !isUserTurn() || confirmingAction) &&
                styles.disabledButton,
            ]}
            onPress={confirmMove}
            disabled={!wordValid || !isUserTurn() || confirmingAction}
          >
            <Text style={styles.buttonText}>Onayla</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Durum Göstergesi */}
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>
          {isUserTurn()
            ? "Sıra sizde!"
            : `${opponent?.username || "Rakip"} oynuyor...`}
        </Text>

        {isUserTurn() && remainingTime && (
          <Text style={[styles.timerText, { color: timerColor }]}>
            Kalan süre: {remainingTime}
          </Text>
        )}

        {game && game.gameType && (
          <Text style={styles.gameTypeText}>
            {game.gameType === "2min"
              ? "2 Dakika Oyunu"
              : game.gameType === "5min"
              ? "5 Dakika Oyunu"
              : game.gameType === "12hour"
              ? "12 Saat Oyunu"
              : "24 Saat Oyunu"}
          </Text>
        )}
      </View>

      {/* Özel Öğe Popup'ı */}
      <Modal
        visible={specialPopup !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={closePopup}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{specialPopup?.title}</Text>
            <Text style={styles.modalMessage}>{specialPopup?.message}</Text>
            <TouchableOpacity style={styles.modalButton} onPress={closePopup}>
              <Text style={styles.modalButtonText}>Tamam</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Yükleme İndikatörü */}
      {confirmingAction && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
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
  errorText: {
    color: "red",
    textAlign: "center",
    marginBottom: 20,
    fontSize: 16,
  },
  topInfoContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 10,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  playerInfo: {
    alignItems: "center",
  },
  playerName: {
    fontWeight: "bold",
  },
  score: {
    fontSize: 18,
  },
  poolInfo: {
    alignItems: "center",
    justifyContent: "center",
  },
  boardContainer: {
    padding: 10,
    alignItems: "center",
  },
  rewardsContainer: {
    padding: 10,
    backgroundColor: "#f0f0f0",
  },
  rewardsTitle: {
    fontWeight: "bold",
    marginBottom: 5,
  },
  rewardsList: {
    flexDirection: "row",
    marginBottom: 5,
  },
  rewardItem: {
    padding: 8,
    backgroundColor: "#e0e0e0",
    borderRadius: 5,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  selectedReward: {
    backgroundColor: "#4CAF50",
    borderColor: "#2E7D32",
  },
  rewardText: {
    fontSize: 12,
  },
  useRewardButton: {
    backgroundColor: "#FF9800",
    padding: 8,
    borderRadius: 5,
    alignItems: "center",
    marginTop: 5,
  },
  useRewardText: {
    color: "white",
    fontWeight: "bold",
  },
  rackContainer: {
    padding: 10,
    backgroundColor: "#e0e0e0",
  },
  controlsContainer: {
    padding: 10,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#ccc",
  },
  wordInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  wordLabel: {
    marginRight: 5,
    fontWeight: "bold",
  },
  wordText: {
    fontSize: 16,
    marginRight: 10,
  },
  validWord: {
    color: "green",
  },
  invalidWord: {
    color: "red",
  },
  pointsText: {
    color: "blue",
    fontWeight: "bold",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 5,
    alignItems: "center",
    marginHorizontal: 2,
  },
  dangerButton: {
    backgroundColor: "#D32F2F",
  },
  cancelButton: {
    backgroundColor: "#f44336",
  },
  passButton: {
    backgroundColor: "#ff9800",
  },
  confirmButton: {
    backgroundColor: "#4CAF50",
  },
  disabledButton: {
    backgroundColor: "#cccccc",
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
  },
  statusContainer: {
    padding: 10,
    alignItems: "center",
    backgroundColor: "#f0f0f0",
  },
  statusText: {
    fontStyle: "italic",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "80%",
    backgroundColor: "white",
    borderRadius: 10,
    padding: 20,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
  },
  modalMessage: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: "#2e6da4",
    padding: 10,
    borderRadius: 5,
    width: "100%",
    alignItems: "center",
  },
  modalButtonText: {
    color: "white",
    fontWeight: "bold",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  gameOverContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  gameOverTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  scoreContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginBottom: 20,
  },
  winner: {
    color: "green",
    fontWeight: "bold",
    marginTop: 5,
  },
  drawText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "blue",
    marginVertical: 10,
  },
  reasonText: {
    fontStyle: "italic",
    marginBottom: 20,
  },
  homeButton: {
    backgroundColor: "#2e6da4",
    padding: 15,
    borderRadius: 5,
    alignItems: "center",
    width: "100%",
  },
  timerText: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 5,
  },
  gameTypeText: {
    fontSize: 12,
    color: "#666",
    marginTop: 3,
  },
  statsContainer: {
    backgroundColor: "#f9f9f9",
    padding: 15,
    borderRadius: 8,
    marginVertical: 15,
    width: "100%",
    alignItems: "flex-start",
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#2e6da4",
  },
  statsText: {
    fontSize: 14,
    marginBottom: 5,
    color: "#555",
  },
});
