// src/components/GameInterface.jsx
import React, { useState, useEffect } from "react";
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
import { database, auth } from "../firebase/config";
import { ref, onValue, update } from "firebase/database";
import Board from "./Board";
import LetterRack from "./LetterRack";
import {
  validateWord,
  calculateWordPoints,
  drawNewLetters,
  letterValues,
  checkSpecialItems,
  applyMineEffect,
} from "../utils/GameUtils";

export default function GameInterface({ gameId }) {
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedRackIndices, setSelectedRackIndices] = useState([]);
  const [selectedBoardCells, setSelectedBoardCells] = useState([]);
  const [placementDirection, setPlacementDirection] = useState(null);
  const [currentWord, setCurrentWord] = useState("");
  const [wordValid, setWordValid] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [activeReward, setActiveReward] = useState(null);
  const [specialPopup, setSpecialPopup] = useState(null);
  const [debugMode, setDebugMode] = useState(false);

  // Firebase'den oyun verilerini çekme
  useEffect(() => {
    if (!gameId) {
      Alert.alert("Hata", "Oyun ID'si belirtilmedi");
      return;
    }

    const gameRef = ref(database, `games/${gameId}`);
    const unsubscribe = onValue(gameRef, (snapshot) => {
      const gameData = snapshot.val();

      if (!gameData) {
        Alert.alert("Hata", "Oyun bulunamadı");
        return;
      }

      setGame(gameData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [gameId]);

  // Kullanıcının harflerini ve sırasını belirle
  const getUserRack = () => {
    if (!game) return [];

    if (game.player1?.id === auth.currentUser?.uid) {
      return game.player1Rack || [];
    } else {
      return game.player2Rack || [];
    }
  };

  const isUserTurn = () => {
    return game && game.turnPlayer === auth.currentUser?.uid;
  };

  // Raftaki harf seçimi
  const handleRackTileSelect = (index) => {
    if (!isUserTurn()) {
      Alert.alert("Uyarı", "Şu anda sıra sizde değil!");
      return;
    }

    // Seçili indeksleri güncelle
    const updatedIndices = [...selectedRackIndices];
    const indexPosition = updatedIndices.indexOf(index);

    if (indexPosition === -1) {
      // Ekle
      updatedIndices.push(index);
    } else {
      // Çıkar
      updatedIndices.splice(indexPosition, 1);
    }

    setSelectedRackIndices(updatedIndices);
  };

  // Hücrenin mevcut bir harfe bitişik olup olmadığını kontrol etme
  const checkAdjacentToExistingLetter = (row, col) => {
    if (!game?.board) return false;

    const directions = [
      { dr: -1, dc: 0 }, // yukarı
      { dr: 1, dc: 0 }, // aşağı
      { dr: 0, dc: -1 }, // sol
      { dr: 0, dc: 1 }, // sağ
    ];

    for (const { dr, dc } of directions) {
      const newRow = row + dr;
      const newCol = col + dc;

      // Tahta sınırlarını kontrol et
      if (newRow >= 0 && newRow < 15 && newCol >= 0 && newCol < 15) {
        // Bu hücrede harf var mı kontrol et
        if (game.board[newRow][newCol]?.letter) {
          return true;
        }
      }
    }

    return false;
  };

  // Tahta hücresi seçimi
  const handleBoardCellSelect = (row, col) => {
    if (!isUserTurn()) {
      Alert.alert("Uyarı", "Şu anda sıra sizde değil!");
      return;
    }

    // Harf seçili değilse, bir şey yapma
    if (selectedRackIndices.length === 0) {
      Alert.alert("Uyarı", "Önce harflerinizden seçim yapın!");
      return;
    }

    if (!game?.board || !game.board[row] || !game.board[row][col]) {
      Alert.alert("Hata", "Oyun tahtası yüklenemedi!");
      return;
    }

    // Hücre zaten doluysa
    if (game.board[row][col].letter) {
      Alert.alert("Uyarı", "Bu hücre zaten dolu!");
      return;
    }

    // Oyundaki ilk yerleştirmeyi kontrol et
    const hasAnyLetter = game.board.some((boardRow) =>
      boardRow.some((cell) => cell?.letter)
    );

    if (!hasAnyLetter && (row !== 7 || col !== 7)) {
      Alert.alert("Uyarı", "İlk harf ortadaki yıldıza yerleştirilmelidir!");
      return;
    }

    // İlk harf değilse, yerleştirme kurallarını kontrol et
    if (hasAnyLetter && selectedBoardCells.length === 0) {
      // Mevcut bir harfe bitişik olmalı
      const isAdjacentToExisting = checkAdjacentToExistingLetter(row, col);
      if (!isAdjacentToExisting) {
        Alert.alert("Uyarı", "Harf mevcut bir kelimeye bitişik olmalıdır!");
        return;
      }
    }

    // İlk seçili raf indeksini kullan
    const rackIndex = selectedRackIndices[0];

    // Yeni bir seçili hücre ekle
    const updatedCells = [...selectedBoardCells, { row, col, rackIndex }];
    setSelectedBoardCells(updatedCells);

    // Harfi kullanıldı olarak işaretle
    const remainingIndices = [...selectedRackIndices];
    remainingIndices.shift();
    setSelectedRackIndices(remainingIndices);

    // Kelime yönünü belirle (2 veya daha fazla harf yerleştirildiğinde)
    if (updatedCells.length >= 2 && !placementDirection) {
      const firstCell = updatedCells[0];
      const lastCell = updatedCells[updatedCells.length - 1];

      if (firstCell.row === lastCell.row) {
        setPlacementDirection("horizontal");
      } else if (firstCell.col === lastCell.col) {
        setPlacementDirection("vertical");
      } else {
        // Çapraz yerleştirmeye izin verilmiyorsa, son yerleştirmeyi iptal et
        Alert.alert(
          "Uyarı",
          "Harfler sadece yatay veya dikey olarak yerleştirilebilir!"
        );
        setSelectedBoardCells(updatedCells.slice(0, -1));
        setSelectedRackIndices([...remainingIndices, rackIndex]);
        return;
      }
    } else if (updatedCells.length >= 2 && placementDirection) {
      // Yerleştirmenin aynı yönde devam ettiğinden emin ol
      const firstCell = updatedCells[0];
      const lastCell = updatedCells[updatedCells.length - 1];

      if (
        placementDirection === "horizontal" &&
        firstCell.row !== lastCell.row
      ) {
        Alert.alert("Uyarı", "Kelime yatay olarak yerleştirilmelidir!");
        setSelectedBoardCells(updatedCells.slice(0, -1));
        setSelectedRackIndices([...remainingIndices, rackIndex]);
        return;
      } else if (
        placementDirection === "vertical" &&
        firstCell.col !== lastCell.col
      ) {
        Alert.alert("Uyarı", "Kelime dikey olarak yerleştirilmelidir!");
        setSelectedBoardCells(updatedCells.slice(0, -1));
        setSelectedRackIndices([...remainingIndices, rackIndex]);
        return;
      }
    }

    // Yerleştirilen kelimeyi kontrol et
    checkPlacedWord(updatedCells);
  };

  // Yerleştirilen kelimeyi kontrol et
  const checkPlacedWord = (cells) => {
    if (cells.length < 2) {
      setWordValid(false);
      setCurrentWord("");
      setEarnedPoints(0);
      return;
    }

    // Harf yerleştirmelerinden kelimeyi oluştur
    const sortedCells = [...cells].sort((a, b) => {
      if (placementDirection === "horizontal") {
        return a.col - b.col;
      } else {
        return a.row - b.row;
      }
    });

    let word = "";
    const rack = getUserRack();

    sortedCells.forEach((cell) => {
      const rackIndex = cell.rackIndex;
      if (rackIndex >= 0 && rackIndex < rack.length) {
        const letterObj = rack[rackIndex];
        const letter =
          typeof letterObj === "object" ? letterObj.letter : letterObj;
        word += letter === "JOKER" ? "*" : letter;
      }
    });

    setCurrentWord(word);

    // Kelimenin geçerliliğini kontrol et
    const isValid = validateWord(word);
    setWordValid(isValid);

    if (isValid) {
      // Puanları hesapla
      const points = calculatePoints(sortedCells);
      setEarnedPoints(points);
    } else {
      setEarnedPoints(0);
    }
  };

  // Bir kelime için puanları hesapla
  const calculatePoints = (cells) => {
    if (!game?.board) return 0;

    let totalPoints = 0;
    let wordMultiplier = 1;
    const rack = getUserRack();

    cells.forEach((cell) => {
      const { row, col, rackIndex } = cell;
      if (rackIndex < 0 || rackIndex >= rack.length) return;

      const letterObj = rack[rackIndex];
      const letter =
        typeof letterObj === "object" ? letterObj.letter : letterObj;

      // Harfin puan değerini al
      let letterPoint = letter === "JOKER" ? 0 : letterValues[letter] || 0;

      // Hücre tipini kontrol et (H2, H3, K2, K3)
      const cellType = game.board[row][col]?.type;

      if (cellType === "H2") {
        letterPoint *= 2;
      } else if (cellType === "H3") {
        letterPoint *= 3;
      } else if (cellType === "K2") {
        wordMultiplier *= 2;
      } else if (cellType === "K3") {
        wordMultiplier *= 3;
      }

      totalPoints += letterPoint;
    });

    // Kelime çarpanını uygula
    totalPoints *= wordMultiplier;

    return totalPoints;
  };

  // Çarpanlar olmadan ham puanları hesapla
  const calculateRawPoints = (cells) => {
    let totalPoints = 0;
    const rack = getUserRack();

    cells.forEach((cell) => {
      const { rackIndex } = cell;
      if (rackIndex < 0 || rackIndex >= rack.length) return;

      const letterObj = rack[rackIndex];
      const letter =
        typeof letterObj === "object" ? letterObj.letter : letterObj;

      // Harfin puan değeri
      const letterPoint = letter === "JOKER" ? 0 : letterValues[letter] || 0;
      totalPoints += letterPoint;
    });

    return totalPoints;
  };

  // Mayınları kontrol et
  const checkForMines = (cells) => {
    if (!game?.board) return null;

    for (const cell of cells) {
      const { row, col } = cell;
      const special = game.board[row][col]?.special;

      if (
        special &&
        (special.startsWith("Puan") ||
          special.startsWith("Harf") ||
          special.startsWith("Ekstra") ||
          special.startsWith("Kelime"))
      ) {
        return {
          type: special,
          row,
          col,
        };
      }
    }

    return null;
  };

  // Ödülleri kontrol et
  const checkForRewards = (cells) => {
    if (!game?.board) return null;

    for (const cell of cells) {
      const { row, col } = cell;
      const special = game.board[row][col]?.special;

      if (
        special &&
        (special === "BolgeYasagi" ||
          special === "HarfYasagi" ||
          special === "EkstraHamleJokeri")
      ) {
        return {
          type: special,
          row,
          col,
        };
      }
    }

    return null;
  };

  // Mayın etkisini uygula
  const applyMineEffect = (mine, points) => {
    switch (mine.type) {
      case "PuanBolunmesi":
        return Math.round(points * 0.3); // %30 al
      case "PuanTransferi":
        // Tüm puanları rakibe aktar
        return -points;
      case "HarfKaybi":
        // Harfleri havuza geri ver ve yeniden çek - confirmMove'da işlenecek
        return points;
      case "EkstraHamleEngeli":
        // Harf ve kelime çarpanlarını iptal et
        return calculateRawPoints(selectedBoardCells);
      case "KelimeIptali":
        return 0; // Puan yok
      default:
        return points;
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

    try {
      setLoading(true);

      // Tahtanın bir kopyasını oluştur
      const boardCopy = JSON.parse(JSON.stringify(game.board));

      // Rafın bir kopyasını oluştur
      let currentRack = [...getUserRack()];
      let updatedPool = [...game.letterPool];

      // Harfleri tahtaya yerleştir
      selectedBoardCells.forEach((cell) => {
        const { row, col, rackIndex } = cell;
        if (rackIndex < 0 || rackIndex >= currentRack.length) return;

        const letterObj = currentRack[rackIndex];
        const letter =
          typeof letterObj === "object" ? letterObj.letter : letterObj;
        boardCopy[row][col].letter = letter;
      });

      // Puanları hesapla
      let finalPoints = earnedPoints;

      // Mayınları kontrol et
      const mine = checkForMines(selectedBoardCells);

      if (mine) {
        // Mayın etkisini uygula
        const adjustedPoints = applyMineEffect(mine, finalPoints);

        // Puanları güncelle
        finalPoints = adjustedPoints;

        // Kullanıcıyı bilgilendir
        setSpecialPopup({
          title: "Mayın!",
          message: `${mine.type} mayınına denk geldiniz!`,
          type: "mine",
        });

        // Özel mayın işlemleri
        if (mine.type === "HarfKaybi") {
          // Harfleri havuza geri ver
          const usedRackIndices = selectedBoardCells.map(
            (cell) => cell.rackIndex
          );
          const uniqueIndices = [...new Set(usedRackIndices)].sort(
            (a, b) => b - a
          );

          uniqueIndices.forEach((index) => {
            if (index >= 0 && index < currentRack.length) {
              currentRack.splice(index, 1);
            }
          });

          // Kalan tüm harfleri havuza ekle
          updatedPool = [...updatedPool, ...currentRack];

          // Havuzu karıştır ve yeni harfler çek
          updatedPool.sort(() => Math.random() - 0.5);
          currentRack = updatedPool.slice(0, 7);
          updatedPool = updatedPool.slice(7);
        }
      }

      // Ödülleri kontrol et
      const reward = checkForRewards(selectedBoardCells);

      if (reward) {
        // Ödülü kullanıcıya ekle
        const userRewards =
          game.player1.id === auth.currentUser?.uid
            ? game.player1Rewards || []
            : game.player2Rewards || [];

        userRewards.push(reward.type);

        // Kullanıcıyı bilgilendir
        setSpecialPopup({
          title: "Ödül!",
          message: `${reward.type} ödülünü kazandınız! Sıra size geldiğinde kullanabilirsiniz.`,
          type: "reward",
        });
      }

      // Kullanılan harfleri raftan çıkar ve yenilerini çek
      const usedRackIndices = selectedBoardCells.map((cell) => cell.rackIndex);
      const uniqueIndices = [...new Set(usedRackIndices)].sort((a, b) => b - a);

      // HarfKaybi mayını değilse, normal şekilde yeni harfler çek
      if (!mine || mine.type !== "HarfKaybi") {
        const { updatedRack, updatedPool: newPool } = drawNewLetters(
          currentRack,
          updatedPool,
          uniqueIndices
        );
        currentRack = updatedRack;
        updatedPool = newPool;
      }

      // Sonraki oyuncu
      const nextPlayer =
        game.player1.id === auth.currentUser?.uid
          ? game.player2.id
          : game.player1.id;

      // Puanları güncelle
      let player1Score = game.player1.score;
      let player2Score = game.player2.score;

      if (game.player1.id === auth.currentUser?.uid) {
        player1Score += finalPoints > 0 ? finalPoints : 0;

        // PuanTransferi işle
        if (mine && mine.type === "PuanTransferi") {
          player2Score += earnedPoints;
        }
      } else {
        player2Score += finalPoints > 0 ? finalPoints : 0;

        // PuanTransferi işle
        if (mine && mine.type === "PuanTransferi") {
          player1Score += earnedPoints;
        }
      }

      // Oyun verilerini güncelle
      const updates = {
        board: boardCopy,
        letterPool: updatedPool,
        turnPlayer: nextPlayer,
        lastMoveTime: Date.now(),
        "player1.score": player1Score,
        "player2.score": player2Score,
      };

      // Rafı güncelle
      if (game.player1.id === auth.currentUser?.uid) {
        updates.player1Rack = currentRack;
      } else {
        updates.player2Rack = currentRack;
      }

      // Ödülleri güncelle
      if (reward) {
        if (game.player1.id === auth.currentUser?.uid) {
          updates.player1Rewards = game.player1Rewards
            ? [...game.player1Rewards, reward.type]
            : [reward.type];
        } else {
          updates.player2Rewards = game.player2Rewards
            ? [...game.player2Rewards, reward.type]
            : [reward.type];
        }
      }

      // Firebase'i güncelle
      await update(ref(database, `games/${gameId}`), updates);

      // UI durumunu sıfırla
      setSelectedRackIndices([]);
      setSelectedBoardCells([]);
      setPlacementDirection(null);
      setCurrentWord("");
      setEarnedPoints(0);
      setActiveReward(null);

      setLoading(false);
    } catch (error) {
      console.error("Confirm move error:", error);
      setLoading(false);
      Alert.alert(
        "Hata",
        "Hamle yapılırken bir sorun oluştu: " + error.message
      );
    }
  };

  // Hamleyi iptal et
  const cancelMove = () => {
    setSelectedRackIndices([]);
    setSelectedBoardCells([]);
    setPlacementDirection(null);
    setCurrentWord("");
    setWordValid(false);
    setEarnedPoints(0);
    setActiveReward(null);
  };

  // Pas geç
  const passTurn = async () => {
    if (!isUserTurn()) {
      Alert.alert("Uyarı", "Şu anda sıra sizde değil!");
      return;
    }

    try {
      setLoading(true);

      // Sonraki oyuncuya geç
      const nextPlayer =
        game.player1.id === auth.currentUser?.uid
          ? game.player2.id
          : game.player1.id;

      // Firebase'i güncelle
      await update(ref(database, `games/${gameId}`), {
        turnPlayer: nextPlayer,
        lastMoveTime: Date.now(),
        lastPassTurn: auth.currentUser?.uid,
      });

      // Her iki oyuncu arka arkaya pas geçtiyse
      if (game.lastPassTurn === nextPlayer) {
        endGame("pass");
      }

      setLoading(false);
    } catch (error) {
      console.error("Pass turn error:", error);
      setLoading(false);
      Alert.alert("Hata", "Pas geçilirken bir sorun oluştu: " + error.message);
    }
  };

  // Teslim ol
  const surrender = () => {
    if (!isUserTurn()) {
      Alert.alert("Uyarı", "Şu anda sıra sizde değil!");
      return;
    }

    Alert.alert("Emin misiniz?", "Teslim olursanız, oyunu kaybedeceksiniz.", [
      {
        text: "İptal",
        style: "cancel",
      },
      {
        text: "Teslim Ol",
        onPress: () => endGame("surrender"),
      },
    ]);
  };

  // Oyunu bitir
  const endGame = async (reason) => {
    try {
      setLoading(true);

      const isPlayer1 = game.player1.id === auth.currentUser?.uid;

      // Son puanları hesapla
      let player1FinalScore = game.player1.score;
      let player2FinalScore = game.player2.score;

      // Teslim olma durumu
      if (reason === "surrender") {
        // Teslim olan oyuncu kaybeder
        if (isPlayer1) {
          player2FinalScore += 50; // Bonus puanlar
        } else {
          player1FinalScore += 50; // Bonus puanlar
        }
      }
      // Normal bitiş - kalan harflerden puanları hesapla
      else if (reason === "finished") {
        const player1Rack = game.player1Rack || [];
        const player2Rack = game.player2Rack || [];

        // Kalan harflerden puanları topla
        const player1RemainingPoints = player1Rack.reduce(
          (total, letterObj) => {
            const points =
              typeof letterObj === "object"
                ? letterObj.points
                : letterValues[letterObj] || 0;
            return total + points;
          },
          0
        );

        const player2RemainingPoints = player2Rack.reduce(
          (total, letterObj) => {
            const points =
              typeof letterObj === "object"
                ? letterObj.points
                : letterValues[letterObj] || 0;
            return total + points;
          },
          0
        );

        // Harfleri önce bitiren oyuncuya, rakibinin kalan harflerinin puanını ekle
        if (isPlayer1) {
          player1FinalScore += player2RemainingPoints;
          player2FinalScore -= player2RemainingPoints;
        } else {
          player2FinalScore += player1RemainingPoints;
          player1FinalScore -= player1RemainingPoints;
        }
      }

      // Oyunu tamamlandı olarak işaretle
      const gameData = {
        ...game,
        status: "completed",
        completedAt: Date.now(),
        reason,
        "player1.score": player1FinalScore,
        "player2.score": player2FinalScore,
      };

      // Tamamlanan oyunlar listesine ekle
      await update(ref(database, `completedGames/${gameId}`), gameData);

      // Aktif oyunlardan kaldır
      await update(ref(database, `games/${gameId}`), { status: "completed" });

      // Oyuncu istatistiklerini güncelle
      const player1Win = player1FinalScore > player2FinalScore;
      const player2Win = player2FinalScore > player1FinalScore;

      // Oyuncu 1 istatistikleri
      const player1Ref = ref(database, `users/${game.player1.id}`);
      const player1Snapshot = await get(player1Ref);
      const player1Data = player1Snapshot.val() || {};

      const player1GamesPlayed = (player1Data.gamesPlayed || 0) + 1;
      const player1GamesWon = player1Win
        ? (player1Data.gamesWon || 0) + 1
        : player1Data.gamesWon || 0;
      const player1SuccessRate = Math.round(
        (player1GamesWon / player1GamesPlayed) * 100
      );

      await update(player1Ref, {
        gamesPlayed: player1GamesPlayed,
        gamesWon: player1GamesWon,
        successRate: player1SuccessRate,
      });

      // Oyuncu 2 istatistikleri
      const player2Ref = ref(database, `users/${game.player2.id}`);
      const player2Snapshot = await get(player2Ref);
      const player2Data = player2Snapshot.val() || {};

      const player2GamesPlayed = (player2Data.gamesPlayed || 0) + 1;
      const player2GamesWon = player2Win
        ? (player2Data.gamesWon || 0) + 1
        : player2Data.gamesWon || 0;
      const player2SuccessRate = Math.round(
        (player2GamesWon / player2GamesPlayed) * 100
      );

      await update(player2Ref, {
        gamesPlayed: player2GamesPlayed,
        gamesWon: player2GamesWon,
        successRate: player2SuccessRate,
      });

      setLoading(false);

      // Sonucu kullanıcıya göster
      Alert.alert(
        "Oyun Bitti",
        `${
          player1FinalScore > player2FinalScore
            ? `${game.player1.username} kazandı!`
            : player2FinalScore > player1FinalScore
            ? `${game.player2.username} kazandı!`
            : "Berabere!"
        }`,
        [
          {
            text: "Ana Sayfaya Dön",
            onPress: () => router.replace("/home"),
          },
        ]
      );
    } catch (error) {
      console.error("End game error:", error);
      setLoading(false);
      Alert.alert(
        "Hata",
        "Oyun sonlandırılırken bir sorun oluştu: " + error.message
      );
    }
  };

  // Ödül kullanma
  const useReward = async (rewardIndex) => {
    if (!isUserTurn()) {
      Alert.alert("Uyarı", "Şu anda sıra sizde değil!");
      return;
    }

    try {
      setLoading(true);

      const isPlayer1 = game.player1.id === auth.currentUser?.uid;
      const userRewards = isPlayer1
        ? game.player1Rewards || []
        : game.player2Rewards || [];

      if (rewardIndex < 0 || rewardIndex >= userRewards.length) {
        Alert.alert("Hata", "Seçilen ödül bulunamadı!");
        setLoading(false);
        return;
      }

      const reward = userRewards[rewardIndex];
      const updates = {};

      // Kullanılan ödülü kaldır
      const newRewards = [...userRewards];
      newRewards.splice(rewardIndex, 1);

      if (isPlayer1) {
        updates.player1Rewards = newRewards;
      } else {
        updates.player2Rewards = newRewards;
      }

      // Ödül etkisini uygula
      switch (reward) {
        case "BolgeYasagi": {
          // Rastgele taraf (sol/sağ)
          const side = Math.random() < 0.5 ? "left" : "right";
          updates.restrictedArea = {
            player:
              game.player1.id === auth.currentUser?.uid
                ? game.player2.id
                : game.player1.id,
            side,
            until: Date.now() + 2 * 60 * 60 * 1000, // 2 saat
          };

          setSpecialPopup({
            title: "Bölge Yasağı Etkinleştirildi",
            message: `Rakibiniz artık sadece tahtanın ${
              side === "left" ? "sağ" : "sol"
            } tarafına harf koyabilir!`,
            type: "reward",
          });
          break;
        }
        case "HarfYasagi": {
          // Rakibin 2 rastgele harfini dondur
          const opponentRack = isPlayer1
            ? game.player2Rack || []
            : game.player1Rack || [];
          if (opponentRack.length >= 2) {
            const freezeIndices = [];
            while (
              freezeIndices.length < 2 &&
              freezeIndices.length < opponentRack.length
            ) {
              const randIndex = Math.floor(Math.random() * opponentRack.length);
              if (!freezeIndices.includes(randIndex)) {
                freezeIndices.push(randIndex);
              }
            }

            updates.frozenLetters = {
              player:
                game.player1.id === auth.currentUser?.uid
                  ? game.player2.id
                  : game.player1.id,
              indices: freezeIndices,
              until: Date.now() + 60 * 60 * 1000, // 1 saat
            };

            setSpecialPopup({
              title: "Harf Yasağı Etkinleştirildi",
              message: `Rakibinizin ${freezeIndices.length} harfi bir tur boyunca donduruldu!`,
              type: "reward",
            });
          } else {
            Alert.alert("Uyarı", "Rakibinizin yeterli harfi yok!");
          }
          break;
        }
        case "EkstraHamleJokeri": {
          updates.extraMove = {
            player: auth.currentUser?.uid,
            until: Date.now() + 15 * 60 * 1000, // 15 dakika
          };

          setSpecialPopup({
            title: "Ekstra Hamle Jokeri Etkinleştirildi",
            message:
              "Mevcut hamlenizi tamamladıktan sonra ekstra bir hamle daha yapabileceksiniz!",
            type: "reward",
          });
          break;
        }
      }

      // Firebase'i güncelle
      await update(ref(database, `games/${gameId}`), updates);
      setActiveReward(null);
      setLoading(false);
    } catch (error) {
      console.error("Use reward error:", error);
      setLoading(false);
      Alert.alert(
        "Hata",
        "Ödül kullanılırken bir sorun oluştu: " + error.message
      );
    }
  };

  // Debug modu aktifleştir
  const toggleDebugMode = () => {
    setDebugMode(!debugMode);
  };

  // Özel öğe popup'ını kapat
  const closeSpecialPopup = () => {
    setSpecialPopup(null);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2e6da4" />
        <Text>Yükleniyor...</Text>
      </View>
    );
  }

  if (!game) {
    return (
      <View style={styles.errorContainer}>
        <Text>Oyun bulunamadı</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Ana Menüye Dön</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const userIsPlayer1 = game.player1?.id === auth.currentUser?.uid;
  const opponent = userIsPlayer1 ? game.player2 : game.player1;
  const userRack = getUserRack();
  const userRewards = userIsPlayer1
    ? game.player1Rewards || []
    : game.player2Rewards || [];

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Info Area */}
      <View style={styles.topInfoContainer}>
        <View style={styles.playerInfo}>
          <Text style={styles.playerName}>
            {userIsPlayer1 ? game.player1.username : game.player2.username}
          </Text>
          <Text style={styles.score}>
            {userIsPlayer1 ? game.player1.score : game.player2.score}
          </Text>
        </View>

        <View style={styles.poolInfo}>
          <Text>Kalan: {game.letterPool?.length || 0}</Text>
        </View>

        <View style={styles.playerInfo}>
          <Text style={styles.playerName}>{opponent?.username}</Text>
          <Text style={styles.score}>{opponent?.score}</Text>
        </View>
      </View>

      {/* Game Board */}
      <ScrollView contentContainerStyle={styles.boardContainer}>
        <Board
          board={game.board}
          selectedCells={selectedBoardCells}
          onCellPress={handleBoardCellSelect}
          showSpecials={debugMode}
        />
      </ScrollView>

      {/* User Rewards */}
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
                  disabled={!isUserTurn()}
                >
                  <Text style={styles.rewardText}>{reward}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          {activeReward !== null && (
            <TouchableOpacity
              style={styles.useRewardButton}
              onPress={() => useReward(activeReward)}
            >
              <Text style={styles.useRewardText}>Ödülü Kullan</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* User Letter Rack */}
      <View style={styles.rackContainer}>
        <LetterRack
          letters={userRack}
          selectedIndices={selectedRackIndices}
          onTilePress={handleRackTileSelect}
        />
      </View>

      {/* Word Info and Control Buttons */}
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
            onPress={surrender}
            disabled={!isUserTurn() || loading}
          >
            <Text style={styles.buttonText}>Teslim Ol</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={cancelMove}
            disabled={selectedBoardCells.length === 0 || loading}
          >
            <Text style={styles.buttonText}>İptal</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.passButton]}
            onPress={passTurn}
            disabled={!isUserTurn() || loading}
          >
            <Text style={styles.buttonText}>Pas</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              styles.confirmButton,
              (!wordValid || !isUserTurn() || loading) && styles.disabledButton,
            ]}
            onPress={confirmMove}
            disabled={!wordValid || !isUserTurn() || loading}
          >
            <Text style={styles.buttonText}>Onayla</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Status Indicator */}
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>
          {isUserTurn()
            ? "Sıra sizde!"
            : `${opponent?.username || "Rakip"} oynuyor...`}
        </Text>
      </View>

      {/* Debug Mode Toggle (Development only) */}
      {__DEV__ && (
        <TouchableOpacity style={styles.debugButton} onPress={toggleDebugMode}>
          <Text style={styles.debugButtonText}>
            {debugMode ? "Debug Kapat" : "Debug Aç"}
          </Text>
        </TouchableOpacity>
      )}

      {/* Special Item Popup */}
      <Modal
        visible={specialPopup !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={closeSpecialPopup}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              specialPopup?.type === "mine"
                ? styles.mineModal
                : styles.rewardModal,
            ]}
          >
            <Text style={styles.modalTitle}>{specialPopup?.title}</Text>
            <Text style={styles.modalMessage}>{specialPopup?.message}</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={closeSpecialPopup}
            >
              <Text style={styles.modalButtonText}>Tamam</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  debugButton: {
    position: "absolute",
    right: 10,
    bottom: 10,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    padding: 8,
    borderRadius: 20,
  },
  debugButtonText: {
    color: "white",
    fontSize: 12,
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
  mineModal: {
    borderWidth: 3,
    borderColor: "#ff4d4d",
  },
  rewardModal: {
    borderWidth: 3,
    borderColor: "#4CAF50",
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
});
