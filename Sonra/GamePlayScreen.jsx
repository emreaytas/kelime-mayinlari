// src/screens/GamePlayScreen.jsx
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Modal,
  SafeAreaView,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { auth } from "../src/firebase/config";
import GameBoard from "../src/components/GameBoard";
import LetterRack from "../src/components/LetterRack";
import {
  getGameData,
  listenToGameChanges,
  placeWord,
  passTurn,
  surrender,
  useReward,
} from "../src/services/gameService";
import { letterValues, validateWord } from "../src/utils/GameBoardUtils";

export default function GamePlayScreen() {
  const { gameId } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState(null);
  const [user, setUser] = useState(null);
  const [selectedCells, setSelectedCells] = useState([]);
  const [selectedRackIndices, setSelectedRackIndices] = useState([]);
  const [currentWord, setCurrentWord] = useState("");
  const [wordValid, setWordValid] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [placementDirection, setPlacementDirection] = useState(null); // horizontal veya vertical
  const [selectedReward, setSelectedReward] = useState(null);
  const [specialPopup, setSpecialPopup] = useState(null);
  const [confirmingAction, setConfirmingAction] = useState(false);

  // Firebase dinleyicisi referansı
  const unsubscribeRef = useRef(null);

  // Kullanıcı ve oyun verilerini yükle
  useEffect(() => {
    // Giriş durumunu kontrol et
    const authUnsubscribe = auth.onAuthStateChanged((currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        // Giriş yapılmamış, login sayfasına yönlendir
        router.replace("/");
      }
    });

    // Oyun ID'si var mı kontrol et
    if (!gameId) {
      Alert.alert("Hata", "Oyun ID'si bulunamadı", [
        { text: "Ana Sayfaya Dön", onPress: () => router.replace("/home") },
      ]);
      return;
    }

    // Oyun verilerini dinle
    setupGameListener();

    // Cleanup
    return () => {
      authUnsubscribe();
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [gameId]);

  // Oyun değişikliklerini dinleme
  const setupGameListener = () => {
    unsubscribeRef.current = listenToGameChanges(gameId, (gameData, error) => {
      setLoading(false);

      if (error) {
        Alert.alert("Hata", "Oyun verileri yüklenirken bir sorun oluştu");
        return;
      }

      if (!gameData) {
        Alert.alert("Bilgi", "Oyun bulunamadı", [
          { text: "Ana Sayfaya Dön", onPress: () => router.replace("/home") },
        ]);
        return;
      }

      setGame(gameData);

      // Oyun tamamlandıysa ve daha önce popup gösterilmediyse
      if (gameData.status === "completed" && !gameData._completedShown) {
        showGameResultPopup(gameData);
        // Tekrar göstermeyi önle
        setGame({ ...gameData, _completedShown: true });
      }
    });
  };

  // Oyun sonucunu göster
  const showGameResultPopup = (gameData) => {
    const isPlayer1 = user?.uid === gameData.player1.id;
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

  // Kullanıcının harflerini ve sırasını al
  const getUserRack = () => {
    if (!game || !user) return [];

    const isPlayer1 = user.uid === game.player1.id;
    return isPlayer1 ? game.player1Rack : game.player2Rack;
  };

  // Kullanıcının sırası mı?
  const isUserTurn = () => {
    return game && user && game.turnPlayer === user.uid;
  };

  // Kullanıcının ödüllerini al
  const getUserRewards = () => {
    if (!game || !user) return [];

    const isPlayer1 = user.uid === game.player1.id;
    return isPlayer1 ? game.player1Rewards || [] : game.player2Rewards || [];
  };

  // Hücre seçimi
  const handleCellPress = (row, col) => {
    if (!isUserTurn()) {
      Alert.alert("Uyarı", "Şu anda sıra sizde değil!");
      return;
    }

    // Önce bir harf seçilmiş olmalı
    if (selectedRackIndices.length === 0) {
      Alert.alert("Uyarı", "Önce rafınızdan bir harf seçin!");
      return;
    }

    // Hücre boş mu kontrol et
    if (game.board[row][col].letter) {
      Alert.alert("Uyarı", "Bu hücre zaten dolu!");
      return;
    }

    // İlk yerleştirme mi kontrol et
    const isFirstMove = !game.board.some((boardRow) =>
      boardRow.some((cell) => cell.letter)
    );

    if (isFirstMove && (row !== 7 || col !== 7)) {
      Alert.alert("Uyarı", "İlk harf ortadaki yıldıza yerleştirilmelidir!");
      return;
    }

    // İlk hamle değilse, mevcut bir harfe bitişik mi kontrol et
    if (!isFirstMove && selectedCells.length === 0) {
      // Mevcut harflere bitişik mi?
      const isAdjacent = checkIfAdjacentToExistingLetter(row, col);
      if (!isAdjacent) {
        Alert.alert("Uyarı", "Harf mevcut bir kelimeye bitişik olmalıdır!");
        return;
      }
    }

    // Seçilen raf indeksi
    const rackIndex = selectedRackIndices[0];

    // Yeni seçili hücreleri güncelle
    const newSelectedCells = [...selectedCells, { row, col, rackIndex }];
    setSelectedCells(newSelectedCells);

    // Seçilen harfi kaldır
    setSelectedRackIndices(selectedRackIndices.slice(1));

    // Yerleştirme yönünü belirle (2 veya daha fazla harf olduğunda)
    if (newSelectedCells.length >= 2 && !placementDirection) {
      const firstCell = newSelectedCells[0];
      const lastCell = newSelectedCells[newSelectedCells.length - 1];

      if (firstCell.row === lastCell.row) {
        setPlacementDirection("horizontal");
      } else if (firstCell.col === lastCell.col) {
        setPlacementDirection("vertical");
      } else {
        // Çapraz yerleştirme geçersiz
        Alert.alert(
          "Uyarı",
          "Harfler yatay veya dikey olarak yerleştirilmelidir!"
        );

        // Son eklenen hücreyi kaldır
        setSelectedCells(newSelectedCells.slice(0, -1));
        setSelectedRackIndices([...selectedRackIndices]); // Harfi geri ekle
        return;
      }
    } else if (newSelectedCells.length >= 2 && placementDirection) {
      // Yerleştirme yönünü kontrol et
      const firstCell = newSelectedCells[0];
      const lastCell = newSelectedCells[newSelectedCells.length - 1];

      if (
        placementDirection === "horizontal" &&
        firstCell.row !== lastCell.row
      ) {
        Alert.alert("Uyarı", "Kelime yatay olarak yerleştirilmelidir!");
        setSelectedCells(newSelectedCells.slice(0, -1));
        setSelectedRackIndices([...selectedRackIndices]); // Harfi geri ekle
        return;
      }

      if (placementDirection === "vertical" && firstCell.col !== lastCell.col) {
        Alert.alert("Uyarı", "Kelime dikey olarak yerleştirilmelidir!");
        setSelectedCells(newSelectedCells.slice(0, -1));
        setSelectedRackIndices([...selectedRackIndices]); // Harfi geri ekle
        return;
      }
    }

    // Oluşan kelimeyi kontrol et
    checkWord(newSelectedCells);
  };

  // Mevcut bir harfe bitişik mi kontrol et
  const checkIfAdjacentToExistingLetter = (row, col) => {
    const directions = [
      { dr: -1, dc: 0 }, // yukarı
      { dr: 1, dc: 0 }, // aşağı
      { dr: 0, dc: -1 }, // sol
      { dr: 0, dc: 1 }, // sağ
    ];

    for (const { dr, dc } of directions) {
      const newRow = row + dr;
      const newCol = col + dc;

      // Tahta sınırları içinde mi?
      if (newRow >= 0 && newRow < 15 && newCol >= 0 && newCol < 15) {
        // Bu hücrede harf var mı?
        if (game.board[newRow][newCol].letter) {
          return true;
        }
      }
    }

    return false;
  };

  // Raftaki harf seçimi
  const handleRackTilePress = (index) => {
    if (!isUserTurn()) {
      Alert.alert("Uyarı", "Şu anda sıra sizde değil!");
      return;
    }

    const newSelectedIndices = [...selectedRackIndices];

    // Harf zaten seçili mi?
    const indexPos = newSelectedIndices.indexOf(index);
    if (indexPos !== -1) {
      // Seçimi kaldır
      newSelectedIndices.splice(indexPos, 1);
    } else {
      // Yeni seçim ekle
      newSelectedIndices.push(index);
    }

    setSelectedRackIndices(newSelectedIndices);
  };

  // Oluşturulan kelimeyi kontrol et
  const checkWord = (cells) => {
    if (cells.length < 2) {
      setCurrentWord("");
      setWordValid(false);
      setEarnedPoints(0);
      return;
    }

    // Hücreleri sırala
    const sortedCells = [...cells].sort((a, b) => {
      if (placementDirection === "horizontal") {
        return a.col - b.col;
      }
      return a.row - b.row;
    });

    // Kelimeyi oluştur
    const rack = getUserRack();
    let word = "";

    sortedCells.forEach((cell) => {
      const { rackIndex } = cell;
      const letterObj = rack[rackIndex];
      const letter =
        typeof letterObj === "object" ? letterObj.letter : letterObj;

      word += letter === "JOKER" ? "*" : letter;
    });

    setCurrentWord(word);

    // Kelimenin geçerliliğini kontrol et
    const isValid = validateWord(word);
    setWordValid(isValid);

    // Puanları hesapla
    if (isValid) {
      const points = calculateWordPoints(sortedCells);
      setEarnedPoints(points);
    } else {
      setEarnedPoints(0);
    }
  };

  // Kelime puanlarını hesapla
  const calculateWordPoints = (cells) => {
    let totalPoints = 0;
    let wordMultiplier = 1;
    const rack = getUserRack();

    cells.forEach((cell) => {
      const { row, col, rackIndex } = cell;

      // Harfi ve puanını al
      const letterObj = rack[rackIndex];
      const letter =
        typeof letterObj === "object" ? letterObj.letter : letterObj;

      // Joker harfler 0 puan
      let letterPoint = letter === "JOKER" ? 0 : letterValues[letter] || 0;

      // Hücre tipine göre çarpanları uygula
      const cellType = game.board[row][col].type;

      if (cellType === "H2") {
        letterPoint *= 2; // Harf puanı 2 katı
      } else if (cellType === "H3") {
        letterPoint *= 3; // Harf puanı 3 katı
      } else if (cellType === "K2") {
        wordMultiplier *= 2; // Kelime puanı 2 katı
      } else if (cellType === "K3") {
        wordMultiplier *= 3; // Kelime puanı 3 katı
      }

      totalPoints += letterPoint;
    });

    // Kelime çarpanını uygula
    totalPoints *= wordMultiplier;

    return totalPoints;
  };

  // Kelimeyi onayla
  const confirmWord = async () => {
    if (!isUserTurn()) {
      Alert.alert("Uyarı", "Şu anda sıra sizde değil!");
      return;
    }

    if (!wordValid) {
      Alert.alert("Uyarı", "Geçerli bir kelime oluşturun!");
      return;
    }

    try {
      setConfirmingAction(true);

      // Kelimeyi yerleştir
      const result = await placeWord(gameId, selectedCells);

      // Özel etkileri göster
      if (result.effects) {
        if (result.effects.pointDivision) {
          setSpecialPopup({
            title: "Mayın Etkisi",
            message: "Puan Bölünmesi: Puanınızın sadece %30'unu aldınız!",
          });
        } else if (result.effects.pointTransfer) {
          setSpecialPopup({
            title: "Mayın Etkisi",
            message: "Puan Transferi: Puanlarınız rakibinize gitti!",
          });
        } else if (result.effects.letterLoss) {
          setSpecialPopup({
            title: "Mayın Etkisi",
            message: "Harf Kaybı: Tüm harfleriniz yenileriyle değiştirildi!",
          });
        } else if (result.effects.moveBlockade) {
          setSpecialPopup({
            title: "Mayın Etkisi",
            message:
              "Ekstra Hamle Engeli: Harf ve kelime çarpanları iptal edildi!",
          });
        } else if (result.effects.wordCancellation) {
          setSpecialPopup({
            title: "Mayın Etkisi",
            message: "Kelime İptali: Bu kelimeden hiç puan alamadınız!",
          });
        }
      }

      // Ödülleri göster
      if (result.rewards && result.rewards.length > 0) {
        const rewardMessages = {
          BolgeYasagi:
            "Bölge Yasağı: Rakibiniz sınırlı bir alanda oynayabilecek!",
          HarfYasagi: "Harf Yasağı: Rakibinizin bazı harfleri dondurulacak!",
          EkstraHamleJokeri:
            "Ekstra Hamle Jokeri: Bir sonraki turda ekstra hamle yapabilirsiniz!",
        };

        const rewardMessage = result.rewards
          .map((r) => rewardMessages[r] || r)
          .join("\n");

        setSpecialPopup({
          title: "Ödül Kazandınız!",
          message: rewardMessage,
        });
      }

      // Seçimleri sıfırla
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
    setSelectedCells([]);
    setSelectedRackIndices([]);
    setPlacementDirection(null);
    setCurrentWord("");
    setWordValid(false);
    setEarnedPoints(0);
    setSelectedReward(null);
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

        setSelectedReward(null);
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
  if (game.status === "completed") {
    const player1Won = game.player1.score > game.player2.score;
    const player2Won = game.player2.score > game.player1.score;
    const isDraw = game.player1.score === game.player2.score;

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.gameOverContainer}>
          <Text style={styles.gameOverTitle}>Oyun Tamamlandı</Text>

          <View style={styles.scoreContainer}>
            <View style={styles.playerScore}>
              <Text style={styles.playerName}>{game.player1.username}</Text>
              <Text style={styles.score}>{game.player1.score}</Text>
              {player1Won && <Text style={styles.winner}>Kazanan!</Text>}
            </View>

            <View style={styles.playerScore}>
              <Text style={styles.playerName}>{game.player2.username}</Text>
              <Text style={styles.score}>{game.player2.score}</Text>
              {player2Won && <Text style={styles.winner}>Kazanan!</Text>}
            </View>
          </View>

          {isDraw && <Text style={styles.drawText}>Berabere!</Text>}

          <Text style={styles.reasonText}>
            {game.reason === "surrender"
              ? "Oyuncu teslim oldu"
              : game.reason === "pass"
              ? "Her iki oyuncu da pas geçti"
              : "Oyun normal şekilde tamamlandı"}
          </Text>

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
  const isPlayer1 = user?.uid === game.player1.id;
  const currentPlayer = isPlayer1 ? game.player1 : game.player2;
  const opponent = isPlayer1 ? game.player2 : game.player1;
  const userRack = getUserRack();
  const userRewards = getUserRewards();

  return (
    <SafeAreaView style={styles.container}>
      {/* Üst Bilgi Alanı */}
      <View style={styles.topInfoContainer}>
        <View style={styles.playerInfo}>
          <Text style={styles.playerName}>{currentPlayer.username}</Text>
          <Text style={styles.score}>{currentPlayer.score}</Text>
        </View>

        <View style={styles.poolInfo}>
          <Text>Kalan: {game.letterPool?.length || 0}</Text>
        </View>

        <View style={styles.playerInfo}>
          <Text style={styles.playerName}>{opponent.username}</Text>
          <Text style={styles.score}>{opponent.score}</Text>
        </View>
      </View>

      {/* Oyun Tahtası */}
      <ScrollView contentContainerStyle={styles.boardContainer}>
        <GameBoard
          board={game.board}
          selectedCells={selectedCells}
          onCellPress={handleCellPress}
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
                    selectedReward === index && styles.selectedReward,
                  ]}
                  onPress={() =>
                    setSelectedReward(selectedReward === index ? null : index)
                  }
                  disabled={!isUserTurn() || confirmingAction}
                >
                  <Text style={styles.rewardText}>{reward}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {selectedReward !== null && (
            <TouchableOpacity
              style={styles.useRewardButton}
              onPress={() => handleUseReward(userRewards[selectedReward])}
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
          onTilePress={handleRackTilePress}
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
            disabled={selectedCells.length === 0 || confirmingAction}
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
            onPress={confirmWord}
            disabled={!wordValid || !isUserTurn() || confirmingAction}
          >
            <Text style={styles.buttonText}>Onayla</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Durum Göstergesi */}
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>
          {isUserTurn() ? "Sıra sizde!" : `${opponent.username} oynuyor...`}
        </Text>
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
  playerScore: {
    alignItems: "center",
    padding: 10,
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
});
