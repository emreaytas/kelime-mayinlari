// src/components/GameInterface.jsx
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
  getGameData,
  listenToGameChanges,
  placeWord,
  passTurn,
  surrender,
  useReward,
} from "../services/gameService";
import { validateWord } from "../utils/GameBoardUtils";
import { checkCurrentPlayerTimer } from "../services/gameTimerService"; // Adjust path as needed
export default function GameInterface({ gameId }) {
  const [statusMessage, setStatusMessage] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [timerColor, setTimerColor] = useState("#333"); // Normal renk için varsayılan değer
  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState(null);
  const [currentWord, setCurrentWord] = useState("");
  const [wordValid, setWordValid] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [placementDirection, setPlacementDirection] = useState(null); // horizontal veya vertical
  const [activeReward, setActiveReward] = useState(null); // Seçilen ödül indeksi
  const [specialPopup, setSpecialPopup] = useState(null);
  const [confirmingAction, setConfirmingAction] = useState(false);
  const [remainingTime, setRemainingTime] = useState(null);
  const [selectedRackIndices, setSelectedRackIndices] = useState([]);
  const [selectedBoardCells, setSelectedBoardCells] = useState([]);
  const [gameResult, setGameResult] = useState(null);
  const [visibleRack, setVisibleRack] = useState([]);
  const [originalRack, setOriginalRack] = useState([]);
  // Firebase dinleyicisi referansı
  const unsubscribeRef = useRef(null);

  // Tamamlanmış oyunu göstermek için flag
  const gameCompletedShown = useRef(false);
  const letterValues = {
    A: 1,
    B: 3,
    C: 4,
    Ç: 4,
    D: 3,
    E: 1,
    F: 7,
    G: 5,
    Ğ: 8,
    H: 5,
    I: 2,
    İ: 1,
    J: 10,
    K: 1,
    L: 1,
    M: 2,
    N: 1,
    O: 2,
    Ö: 7,
    P: 5,
    R: 1,
    S: 2,
    Ş: 4,
    T: 1,
    U: 2,
    Ü: 3,
    V: 7,
    Y: 3,
    Z: 4,
    JOKER: 0,
  };

  const getPlacementDirection = (placedCells) => {
    if (placedCells.length < 2) return "horizontal";

    const [cell1, cell2] = placedCells;
    if (cell1.row === cell2.row) return "horizontal";
    if (cell1.col === cell2.col) return "vertical";
    if (Math.abs(cell1.row - cell2.row) === Math.abs(cell1.col - cell2.col))
      return "diagonal";
    return "horizontal"; // varsayılan
  };

  const showTemporaryMessage = (message) => {
    // Önceki mesaj varsa ve timer çalışıyorsa temizle
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }

    // Havuz bilgisini gizle, uyarı mesajını göster
    setStatusMessage(message);
    setShowToast(true);

    // 1 saniye sonra uyarı mesajını kaldır ve havuz bilgisini geri getir
    toastTimer.current = setTimeout(() => {
      setShowToast(false);
      toastTimer.current = null;
    }, 1000);
  };

  // useRef ile timer referansını tutma
  const toastTimer = useRef(null);

  useEffect(() => {
    if (game) {
      const rack = getUserRack();
      setOriginalRack(rack);

      // Görünür rafı güncelle
      if (selectedBoardCells.length === 0) {
        setVisibleRack(rack);
      } else {
        const usedIndices = selectedBoardCells.map((cell) => cell.rackIndex);
        const filteredRack = rack.filter(
          (_, index) => !usedIndices.includes(index)
        );
        setVisibleRack(filteredRack);
      }
    }
  }, [game, selectedBoardCells]);

  useEffect(() => {
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
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [gameId]);

  useEffect(() => {
    if (!game || !isUserTurn() || !gameId) return;

    // Check time remaining every second
    const timerInterval = setInterval(async () => {
      try {
        const result = await checkCurrentPlayerTimer(gameId);
        // Rest of the code...
      } catch (error) {
        console.error("Timer check error:", error);
      }
    }, 1000);

    return () => {
      clearInterval(timerInterval);
    };
  }, [game, isUserTurn, gameId]);

  useEffect(() => {
    console.log("========================");
    console.log("OYUN TAHTASI DEBUG BİLGİLERİ:");
    console.log("Oyun ID:", gameId);
    console.log("Oyun Yükleniyor mu:", loading);
    console.log("Oyun Verisi Var mı:", !!game);
    if (game && game.board) {
      console.log(
        "Tahta Boyutu:",
        game.board.length,
        "x",
        game.board[0].length
      );
      console.log("Kullanıcı Harfleri:", getUserRack());
      console.log("Seçili Raf İndeksleri:", selectedRackIndices);
      console.log("Seçili Hücreler:", selectedBoardCells);
      console.log("Kullanıcının Sırası mı:", isUserTurn());
      console.log("İlk Hamle mi:", game.firstMove);
      console.log("Merkez Gerekli mi:", game.centerRequired);
    }
    console.log("========================");
  }, [game, selectedRackIndices, selectedBoardCells]);

  // Temizlik işlemi için
  useEffect(() => {
    return () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    // Oyun tamamlandıysa ve daha önce popup gösterilmediyse
    if (game && game.status === "completed" && !gameCompletedShown.current) {
      // Oyun sonuç bilgilerini al
      const result = showGameResultPopup(game);
      setGameResult(result);

      // Tekrar göstermeyi önle
      gameCompletedShown.current = true;
    }
  }, [game]);

  useEffect(() => {
    console.log("selectedBoardCells değişti:", selectedBoardCells);
  }, [selectedBoardCells]);

  useEffect(() => {
    console.log("selectedRackIndices değişti:", selectedRackIndices);
  }, [selectedRackIndices]);

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
    setupGameListener();

    // Cleanup
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [gameId]);

  // Süre göstergesi için useEffect fonksiyonunda
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

  const showBoardSpecialsOnly = (gameData) => {
    console.log("\n=== OYUN TAHTASI - MAYINLAR VE ÖDÜLLER ===");
    console.log("\n=========================================\n");
    // Tahta matrisi oluştur
    let matrixString = "    ";
    for (let i = 0; i < 15; i++) {
      matrixString += String(i).padStart(3, " ");
    }
    matrixString += "\n";
    matrixString += "   +" + "-".repeat(45) + "+\n";

    for (let row = 0; row < 15; row++) {
      matrixString += String(row).padStart(2, " ") + " |";

      for (let col = 0; col < 15; col++) {
        const cell = gameData.board[row][col];
        let symbol = "   "; // Boş hücre

        if (cell.special) {
          // Sadece mayın veya ödül göster
          switch (cell.special) {
            // Mayınlar
            case "PuanBolunmesi":
              symbol = " %÷";
              break;
            case "PuanTransferi":
              symbol = " $→";
              break;
            case "HarfKaybi":
              symbol = " H-";
              break;
            case "EkstraHamleEngeli":
              symbol = " X!";
              break;
            case "KelimeIptali":
              symbol = " K×";
              break;
            // Ödüller
            case "BolgeYasagi":
              symbol = " B+";
              break;
            case "HarfYasagi":
              symbol = " H+";
              break;
            case "EkstraHamleJokeri":
              symbol = " E+";
              break;
          }
        }

        matrixString += symbol;
      }
      matrixString += "|\n";
    }
    matrixString += "   +" + "-".repeat(45) + "+\n";

    console.log(matrixString);

    // Mayın ve ödül bilgileri
    console.log("\nMAYINLAR VE ÖDÜLLER:");
    console.log("------------------------");
    console.log("Öğe Türü                | Adet");
    console.log("------------------------");
    console.log("Puan Bölünmesi         |   5");
    console.log("Puan Transferi         |   4");
    console.log("Harf Kaybı             |   3");
    console.log("Ekstra Hamle Engeli    |   2");
    console.log("Kelime İptali          |   2");
    console.log("Bölge Yasağı           |   2");
    console.log("Harf Yasağı            |   3");
    console.log("Ekstra Hamle Jokeri    |   2");
    console.log("------------------------");

    console.log("\nLEJANT:");
    console.log("Mayınlar:");
    console.log("  %÷ = Puan Bölünmesi");
    console.log("  $→ = Puan Transferi");
    console.log("  H- = Harf Kaybı");
    console.log("  X! = Ekstra Hamle Engeli");
    console.log("  K× = Kelime İptali");
    console.log("\nÖdüller:");
    console.log("  B+ = Bölge Yasağı");
    console.log("  H+ = Harf Yasağı");
    console.log("  E+ = Ekstra Hamle Jokeri");
    console.log("\n=========================================\n");
  };

  const setupGameListener = () => {
    let isFirstLoad = true;

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

      // Tahta verisini kontrol et
      if (!gameData.board) {
        console.error("Oyun tahtası bulunamadı. Boş tahta oluşturuluyor.");
        gameData.board = createEmptyBoard();
      } else {
        // Tahtayı normalize et
        const normalizedBoard = normalizeCompleteBoard(gameData.board);
        gameData.board = normalizedBoard;
      }

      // Update game state
      setGame(gameData);

      // Sadece ilk yüklemede mayın ve ödülleri göster
      if (isFirstLoad) {
        showBoardSpecialsOnly(gameData);
        isFirstLoad = false;
      }

      // Seçimleri temizle - bu özellikle diğer kullanıcının hamlelerinden sonra önemli
      if (
        gameData.turnPlayer === auth.currentUser?.uid &&
        selectedBoardCells.length > 0
      ) {
        // Yeni sıra bizde ise ve hala seçilmiş hücreler varsa temizle
        resetSelections();
      }

      // Oyun tamamlandıysa ve daha önce popup gösterilmediyse
      if (gameData.status === "completed" && !gameCompletedShown.current) {
        showGameResultPopup(gameData);
        // Tekrar göstermeyi önle
        gameCompletedShown.current = true;
      }
    });
  };

  const createEmptyBoard = () => {
    const board = [];
    for (let i = 0; i < 15; i++) {
      board[i] = [];
      for (let j = 0; j < 15; j++) {
        board[i][j] = {
          letter: null,
          type: getCellType(i, j),
          special: null,
          points: null,
        };
      }
    }
    return board;
  };

  const normalizeCompleteBoard = (boardData) => {
    const normalizedBoard = [];

    // 15x15 boş tahta oluştur
    for (let i = 0; i < 15; i++) {
      normalizedBoard[i] = [];
      for (let j = 0; j < 15; j++) {
        // Varsayılan boş hücre
        normalizedBoard[i][j] = {
          letter: null,
          type: getCellType(i, j),
          special: null,
          points: null,
        };
      }
    }

    // Eğer boardData varsa, üzerine yazalım
    if (boardData) {
      // Firebase'den gelen veri formatını kontrol et
      if (Array.isArray(boardData)) {
        // Dizi formatı
        boardData.forEach((row, rowIndex) => {
          if (row && rowIndex < 15) {
            if (Array.isArray(row)) {
              row.forEach((cell, colIndex) => {
                if (cell && colIndex < 15) {
                  normalizedBoard[rowIndex][colIndex] = {
                    ...normalizedBoard[rowIndex][colIndex],
                    ...cell,
                  };
                }
              });
            } else if (typeof row === "object") {
              // Firebase nesne formatı
              Object.keys(row).forEach((colKey) => {
                const colIndex = parseInt(colKey);
                if (!isNaN(colIndex) && colIndex < 15) {
                  normalizedBoard[rowIndex][colIndex] = {
                    ...normalizedBoard[rowIndex][colIndex],
                    ...row[colKey],
                  };
                }
              });
            }
          }
        });
      } else if (typeof boardData === "object") {
        // Nesne formatı
        Object.keys(boardData).forEach((rowKey) => {
          const rowIndex = parseInt(rowKey);
          if (!isNaN(rowIndex) && rowIndex < 15) {
            const row = boardData[rowKey];
            if (row && typeof row === "object") {
              Object.keys(row).forEach((colKey) => {
                const colIndex = parseInt(colKey);
                if (!isNaN(colIndex) && colIndex < 15) {
                  normalizedBoard[rowIndex][colIndex] = {
                    ...normalizedBoard[rowIndex][colIndex],
                    ...row[colKey],
                  };
                }
              });
            }
          }
        });
      }
    }

    return normalizedBoard;
  };

  // Oyun sonucunu göster
  // showGameResultPopup fonksiyonunu güncelleyelim
  const showGameResultPopup = (gameData) => {
    const isPlayer1 = auth.currentUser?.uid === gameData.player1.id;

    let resultMessage = "";
    let resultType = ""; // "win", "loss", "draw"

    // Oyunun bitme nedenine göre mesaj
    if (gameData.reason === "surrender") {
      if (gameData.surrenderedBy === auth.currentUser?.uid) {
        resultMessage = "Teslim oldunuz";
        resultType = "loss";
      } else {
        resultMessage = "Rakibiniz teslim oldu";
        resultType = "win";
      }
    } else if (gameData.reason === "timeout") {
      if (gameData.timedOutPlayer === auth.currentUser?.uid) {
        resultMessage = "Süreniz doldu";
        resultType = "loss";
      } else {
        resultMessage = "Rakibinizin süresi doldu";
        resultType = "win";
      }
    } else if (gameData.reason === "pass") {
      resultMessage = "Üst üste pas geçildi";

      // Puan durumuna göre sonucu belirle
      const myScore = isPlayer1
        ? gameData.player1.score
        : gameData.player2.score;
      const opponentScore = isPlayer1
        ? gameData.player2.score
        : gameData.player1.score;

      if (myScore > opponentScore) {
        resultType = "win";
      } else if (myScore < opponentScore) {
        resultType = "loss";
      } else {
        resultType = "draw";
      }
    } else {
      // Normal oyun sonu
      resultMessage = "Oyun tamamlandı";

      if (gameData.winner === auth.currentUser?.uid) {
        resultType = "win";
      } else if (gameData.isDraw) {
        resultType = "draw";
      } else {
        resultType = "loss";
      }
    }

    // Sonuç mesajını tamamla
    if (resultType === "win") {
      resultMessage += " - Tebrikler, kazandınız!";
    } else if (resultType === "loss") {
      resultMessage += " - Üzgünüm, kaybettiniz.";
    } else if (resultType === "draw") {
      resultMessage += " - Oyun berabere bitti!";
    }

    // Özel mesajlar
    if (
      gameData.reason === "surrender" &&
      gameData.surrenderedBy !== auth.currentUser?.uid
    ) {
      resultMessage += " (50 bonus puan kazandınız)";
    }

    return {
      resultMessage,
      resultType,
      player1: {
        username: gameData.player1.username,
        score: gameData.player1.score,
      },
      player2: {
        username: gameData.player2.username,
        score: gameData.player2.score,
      },
    };
  };

  const normalizeBoard = (boardData) => {
    if (!boardData) return null;

    const normalizedBoard = [];

    // 15x15 tahta oluştur
    for (let i = 0; i < 15; i++) {
      const row = [];
      for (let j = 0; j < 15; j++) {
        // Varsayılan boş hücre
        let cell = {
          letter: null,
          type: getCellType(i, j),
          special: null,
          points: null,
        };

        // Firebase'den gelen veriyi kontrol et
        if (boardData[i] && typeof boardData[i] === "object") {
          // j indeksini string olarak da kontrol et (Firebase bazen string key kullanır)
          const cellData = boardData[i][j] || boardData[i][j.toString()];

          if (cellData) {
            cell = {
              ...cell,
              letter: cellData.letter || null,
              type: cellData.type || cell.type, // Özel hücre tipini koru
              special: cellData.special || null,
              points: cellData.points || null,
            };
          }
        }

        row.push(cell);
      }
      normalizedBoard.push(row);
    }

    return normalizedBoard;
  };

  // Helper function to determine cell type
  const getCellType = (row, col) => {
    // H2 cells (letter score x2)
    const h2Cells = [
      [0, 5],
      [0, 9],
      [1, 6],
      [1, 8],
      [5, 0],
      [5, 5],
      [5, 9],
      [5, 14],
      [6, 1],
      [6, 6],
      [6, 8],
      [6, 13],
      [8, 1],
      [8, 6],
      [8, 8],
      [8, 13],
      [9, 0],
      [9, 5],
      [9, 9],
      [9, 14],
      [13, 6],
      [13, 8],
      [14, 5],
      [14, 9],
    ];

    // H3 cells (letter score x3)
    const h3Cells = [
      [1, 1],
      [1, 13],
      [4, 4],
      [4, 10],
      [10, 4],
      [10, 10],
      [13, 1],
      [13, 13],
    ];

    // K2 cells (word score x2)
    const k2Cells = [
      [2, 7],
      [3, 3],
      [3, 11],
      [7, 2],
      [7, 12],
      [11, 3],
      [11, 11],
      [12, 7],
    ];

    // K3 cells (word score x3)
    const k3Cells = [
      [0, 2],
      [0, 12],
      [2, 0],
      [2, 14],
      [12, 0],
      [12, 14],
      [14, 2],
      [14, 12],
    ];

    // Center star (starting point)
    if (row === 7 && col === 7) {
      return "star";
    }

    // Check special cell types
    for (const [r, c] of h2Cells) {
      if (r === row && c === col) return "H2";
    }

    for (const [r, c] of h3Cells) {
      if (r === row && c === col) return "H3";
    }

    for (const [r, c] of k2Cells) {
      if (r === row && c === col) return "K2";
    }

    for (const [r, c] of k3Cells) {
      if (r === row && c === col) return "K3";
    }

    return null; // Regular cell
  };
  // Kullanıcının harflerini al
  const getUserRack = () => {
    if (!game || !auth.currentUser) return [];

    const isPlayer1 = auth.currentUser.uid === game.player1?.id;
    const rack = isPlayer1 ? game.player1Rack : game.player2Rack;

    // Raf verilerinin güvenlik kontrolü
    if (!rack || !Array.isArray(rack)) {
      console.warn("Kullanıcı rafı bulunamadı veya geçersiz:", rack);
      return [];
    }

    return rack;
  };

  const isUserTurn = () => {
    return game && auth.currentUser && game.turnPlayer === auth.currentUser.uid;
  };
  // Kullanıcının ödüllerini al
  const getUserRewards = () => {
    if (!game || !auth.currentUser) return [];

    const isPlayer1 = auth.currentUser.uid === game.player1.id;
    return isPlayer1 ? game.player1Rewards || [] : game.player2Rewards || [];
  };

  // Raftaki harf seçimi
  const handleRackTileSelect = (visibleIndex) => {
    if (!isUserTurn()) {
      showTemporaryMessage("Şu anda sıra sizde değil!");
      return;
    }

    // Görünür indeksi orijinal indekse çevir
    const usedIndices = selectedBoardCells
      .map((cell) => cell.rackIndex)
      .sort((a, b) => a - b);
    let originalIndex = visibleIndex;

    // Her kullanılan indeks için, görünür indeksi kaydır
    for (const usedIndex of usedIndices) {
      if (originalIndex >= usedIndex) {
        originalIndex++;
      }
    }

    // Orijinal raftaki harfi kontrol et
    if (originalIndex >= originalRack.length) {
      showTemporaryMessage("Geçersiz harf seçimi!");
      return;
    }

    // Zaten seçili mi kontrol et
    if (selectedRackIndices.includes(originalIndex)) {
      // Seçimi kaldır
      setSelectedRackIndices(
        selectedRackIndices.filter((idx) => idx !== originalIndex)
      );
      showTemporaryMessage("Harf seçimi kaldırıldı");
    } else {
      // Yeni seçim yap (sadece bir harf seçilebilir)
      setSelectedRackIndices([originalIndex]);
      showTemporaryMessage("Şimdi tahtada bir hücre seçin");
    }
  };

  // onaylama olayı.

  const confirmMove = async () => {
    console.log("=== confirmMove Debug ===");
    console.log("Selected cells:", selectedBoardCells);
    console.log("Game board:", game?.board);
    console.log("User rack:", getUserRack());

    if (!isUserTurn()) {
      showTemporaryMessage("Sıra sizde değil!");
      return;
    }

    if (!game || !game.board) {
      console.error("Game or game board not available");
      showTemporaryMessage("Oyun verisi yüklenemedi!");
      return;
    }

    if (selectedBoardCells.length === 0) {
      Alert.alert("Uyarı", "Lütfen önce bir kelime oluşturun!");
      return;
    }

    // Yerleştirme yönünü belirle
    let placementDir = "horizontal";
    if (selectedBoardCells.length > 1) {
      const [cell1, cell2] = selectedBoardCells;
      if (cell1.row === cell2.row) {
        placementDir = "horizontal";
      } else if (cell1.col === cell2.col) {
        placementDir = "vertical";
      } else if (
        Math.abs(cell1.row - cell2.row) === Math.abs(cell1.col - cell2.col)
      ) {
        placementDir = "diagonal";
      }
    }

    try {
      // Tüm oluşan kelimeleri kontrol et
      const allWordsValid = await validateAllFormedWords(
        selectedBoardCells,
        game.board,
        placementDir
      );

      if (!allWordsValid) {
        Alert.alert(
          "Geçersiz Kelime",
          "Yerleştirdiğiniz harflerle oluşan kelimelerden biri veya daha fazlası geçersiz. Lütfen kontrol edin."
        );
        return;
      }

      // Puan hesaplama
      const rack = getUserRack();
      const previewPoints = calculateWordPoints(
        selectedBoardCells,
        game.board,
        rack
      );
      console.log(`Önizleme puanı: ${previewPoints}`);

      setConfirmingAction(true);

      // Kelime yerleştirme işlemini gerçekleştir
      const result = await placeWord(gameId, selectedBoardCells);

      if (result.success) {
        resetSelections();
        if (result.points !== undefined) {
          showTemporaryMessage(`+${result.points} puan kazandınız!`);
        }

        // Mayın ve ödül bildirimleri için mevcut kod...
        if (result.effects) {
          const mineMessage = getMineEffectMessage(result.effects);
          if (mineMessage) {
            setSpecialPopup({
              title: "Mayına Denk Geldiniz!",
              message: mineMessage,
            });
          }
        }

        // Ödül bildirimleri
        if (result.rewards && result.rewards.length > 0) {
          const rewardNames = result.rewards
            .map((reward) => getRewardDisplayName(reward))
            .join(", ");
          setSpecialPopup({
            title: "Ödül Kazandınız!",
            message: `${rewardNames} kazandınız!`,
          });
        }
      }
    } catch (error) {
      Alert.alert("Hata", error.message || "Hamle yapılırken bir sorun oluştu");
    } finally {
      setConfirmingAction(false);
    }
  };
  const cancelMove = () => {
    resetSelections();
    showTemporaryMessage("Hamle iptal edildi");
  };

  const validateAllFormedWords = async (placedCells, board, direction) => {
    console.log("=== validateAllFormedWords ===");
    console.log("Direction:", direction);

    const rack = getUserRack();

    // Ana kelimeyi kontrol et
    const mainWord = getMainWordFormed(placedCells, board);
    console.log("Ana kelime:", mainWord);

    if (mainWord.length >= 2) {
      const mainWordToValidate = mainWord.replace(/\*/g, "A").toLowerCase();
      if (!validateWord(mainWordToValidate)) {
        console.log("Ana kelime geçersiz:", mainWord);
        return false;
      }
    }

    // Çapraz yerleştirmede çapraz kelimeleri de kontrol et
    if (direction === "diagonal") {
      // Her yerleştirilen harf için yatay ve dikey kelimeleri kontrol et
      for (const cell of placedCells) {
        // Yatay kelime kontrolü
        let hWord = "";
        let hStartCol = cell.col;
        let hEndCol = cell.col;

        while (hStartCol > 0 && board[cell.row][hStartCol - 1]?.letter) {
          hStartCol--;
        }
        while (hEndCol < 14 && board[cell.row][hEndCol + 1]?.letter) {
          hEndCol++;
        }

        if (hEndCol > hStartCol) {
          for (let col = hStartCol; col <= hEndCol; col++) {
            if (board[cell.row][col]?.letter) {
              hWord += board[cell.row][col].letter;
            } else {
              const placedCell = placedCells.find(
                (pc) => pc.row === cell.row && pc.col === col
              );
              if (placedCell) {
                const letterObj = rack[placedCell.rackIndex];
                const letter =
                  typeof letterObj === "object" ? letterObj.letter : letterObj;
                hWord += letter === "JOKER" ? "*" : letter;
              }
            }
          }

          if (hWord.length >= 2) {
            const wordToValidate = hWord.replace(/\*/g, "A").toLowerCase();
            if (!validateWord(wordToValidate)) {
              console.log("Çapraz yatay kelime geçersiz:", hWord);
              return false;
            }
          }
        }

        // Dikey kelime kontrolü
        let vWord = "";
        let vStartRow = cell.row;
        let vEndRow = cell.row;

        while (vStartRow > 0 && board[vStartRow - 1][cell.col]?.letter) {
          vStartRow--;
        }
        while (vEndRow < 14 && board[vEndRow + 1][cell.col]?.letter) {
          vEndRow++;
        }

        if (vEndRow > vStartRow) {
          for (let row = vStartRow; row <= vEndRow; row++) {
            if (board[row][cell.col]?.letter) {
              vWord += board[row][cell.col].letter;
            } else {
              const placedCell = placedCells.find(
                (pc) => pc.row === row && pc.col === cell.col
              );
              if (placedCell) {
                const letterObj = rack[placedCell.rackIndex];
                const letter =
                  typeof letterObj === "object" ? letterObj.letter : letterObj;
                vWord += letter === "JOKER" ? "*" : letter;
              }
            }
          }

          if (vWord.length >= 2) {
            const wordToValidate = vWord.replace(/\*/g, "A").toLowerCase();
            if (!validateWord(wordToValidate)) {
              console.log("Çapraz dikey kelime geçersiz:", vWord);
              return false;
            }
          }
        }
      }
    } else {
      // Normal çapraz kelimeleri kontrol et
      const crossWords = getCrossWordsFormed(placedCells, board);
      console.log("Çapraz kelimeler:", crossWords);

      for (const word of crossWords) {
        if (word.length >= 2) {
          const wordToValidate = word.replace(/\*/g, "A").toLowerCase();
          if (!validateWord(wordToValidate)) {
            console.log("Çapraz kelime geçersiz:", word);
            return false;
          }
        }
      }
    }

    return true;
  };

  const getCrossWordsFormed = (placedCells, board) => {
    const crossWords = [];
    const rack = getUserRack();

    // Yerleştirme yönünü belirle
    let direction = "horizontal";
    if (placedCells.length > 1) {
      const [cell1, cell2] = placedCells;
      if (cell1.row === cell2.row) {
        direction = "horizontal";
      } else if (cell1.col === cell2.col) {
        direction = "vertical";
      } else if (
        Math.abs(cell1.row - cell2.row) === Math.abs(cell1.col - cell2.col)
      ) {
        direction = "diagonal";
      }
    }

    placedCells.forEach((cell) => {
      if (direction === "diagonal") {
        // Çapraz yerleştirmede, hem yatay hem dikey kelimeleri kontrol et

        // Yatay kelime kontrolü
        let hWord = "";
        let hStartCol = cell.col;
        let hEndCol = cell.col;

        // Sol tarafı kontrol et
        while (hStartCol > 0 && board[cell.row][hStartCol - 1].letter) {
          hStartCol--;
        }

        // Sağ tarafı kontrol et
        while (hEndCol < 14 && board[cell.row][hEndCol + 1].letter) {
          hEndCol++;
        }

        // Yatay kelime oluştur (en az 2 harf olmalı)
        if (hEndCol - hStartCol > 0) {
          for (let col = hStartCol; col <= hEndCol; col++) {
            const placedCell = placedCells.find(
              (pc) => pc.row === cell.row && pc.col === col
            );
            if (placedCell) {
              const letterObj = rack[placedCell.rackIndex];
              const letter =
                typeof letterObj === "object" ? letterObj.letter : letterObj;
              hWord += letter === "JOKER" ? "*" : letter;
            } else if (board[cell.row][col].letter) {
              hWord += board[cell.row][col].letter;
            }
          }
          if (hWord.length >= 2) {
            crossWords.push(hWord);
          }
        }

        // Dikey kelime kontrolü
        let vWord = "";
        let vStartRow = cell.row;
        let vEndRow = cell.row;

        // Yukarı tarafı kontrol et
        while (vStartRow > 0 && board[vStartRow - 1][cell.col].letter) {
          vStartRow--;
        }

        // Aşağı tarafı kontrol et
        while (vEndRow < 14 && board[vEndRow + 1][cell.col].letter) {
          vEndRow++;
        }

        // Dikey kelime oluştur (en az 2 harf olmalı)
        if (vEndRow - vStartRow > 0) {
          for (let row = vStartRow; row <= vEndRow; row++) {
            const placedCell = placedCells.find(
              (pc) => pc.row === row && pc.col === cell.col
            );
            if (placedCell) {
              const letterObj = rack[placedCell.rackIndex];
              const letter =
                typeof letterObj === "object" ? letterObj.letter : letterObj;
              vWord += letter === "JOKER" ? "*" : letter;
            } else if (board[row][cell.col].letter) {
              vWord += board[row][cell.col].letter;
            }
          }
          if (vWord.length >= 2) {
            crossWords.push(vWord);
          }
        }
      } else {
        // Normal yatay/dikey yerleştirme için çapraz kontrol
        let crossWord = "";
        let startPos, endPos;

        if (direction === "horizontal") {
          // Dikey çapraz kelime ara
          startPos = cell.row;
          endPos = cell.row;

          // Yukarı doğru genişlet
          while (startPos > 0 && board[startPos - 1][cell.col].letter) {
            startPos--;
          }

          // Aşağı doğru genişlet
          while (endPos < 14 && board[endPos + 1][cell.col].letter) {
            endPos++;
          }

          // Çapraz kelime oluştur
          if (endPos - startPos > 0) {
            for (let row = startPos; row <= endPos; row++) {
              const placedCell = placedCells.find(
                (pc) => pc.row === row && pc.col === cell.col
              );
              if (placedCell) {
                const letterObj = rack[placedCell.rackIndex];
                const letter =
                  typeof letterObj === "object" ? letterObj.letter : letterObj;
                crossWord += letter === "JOKER" ? "*" : letter;
              } else if (board[row][cell.col].letter) {
                crossWord += board[row][cell.col].letter;
              }
            }
          }
        } else if (direction === "vertical") {
          // Yatay çapraz kelime ara
          startPos = cell.col;
          endPos = cell.col;

          // Sola doğru genişlet
          while (startPos > 0 && board[cell.row][startPos - 1].letter) {
            startPos--;
          }

          // Sağa doğru genişlet
          while (endPos < 14 && board[cell.row][endPos + 1].letter) {
            endPos++;
          }

          // Çapraz kelime oluştur
          if (endPos - startPos > 0) {
            for (let col = startPos; col <= endPos; col++) {
              const placedCell = placedCells.find(
                (pc) => pc.row === cell.row && pc.col === col
              );
              if (placedCell) {
                const letterObj = rack[placedCell.rackIndex];
                const letter =
                  typeof letterObj === "object" ? letterObj.letter : letterObj;
                crossWord += letter === "JOKER" ? "*" : letter;
              } else if (board[cell.row][col].letter) {
                crossWord += board[cell.row][col].letter;
              }
            }
          }
        }

        // Çapraz kelime en az 2 harf içeriyorsa listeye ekle
        if (crossWord.length >= 2) {
          crossWords.push(crossWord);
        }
      }
    });

    return crossWords;
  };

  const getMineEffectMessage = (effects) => {
    const messages = [];

    if (effects.pointDivision) {
      messages.push("Puan Bölünmesi: Puanınızın sadece %30'unu aldınız!");
    }
    if (effects.pointTransfer) {
      messages.push("Puan Transferi: Puanlarınız rakibinize transfer edildi!");
    }
    if (effects.letterLoss) {
      messages.push("Harf Kaybı: Elinizdeki tüm harfler değiştirildi!");
    }
    if (effects.moveBlockade) {
      messages.push(
        "Ekstra Hamle Engeli: Harf ve kelime çarpanları iptal edildi!"
      );
    }
    if (effects.wordCancellation) {
      messages.push("Kelime İptali: Bu hamlede puan alamadınız!");
    }

    return messages.join("\n");
  };

  const getRewardDisplayName = (rewardType) => {
    const rewardNames = {
      BolgeYasagi: "Bölge Yasağı",
      HarfYasagi: "Harf Yasağı",
      EkstraHamleJokeri: "Ekstra Hamle Jokeri",
    };

    return rewardNames[rewardType] || rewardType;
  };
  // Çapraz kelimeleri kontrol eden yeni fonksiyon
  const checkCrossWords = (placedCells, board) => {
    const crossWords = [];

    // Her yerleştirilen hücre için çapraz kelime kontrolü yap
    placedCells.forEach((cell) => {
      const { row, col } = cell;

      // Yatay ve dikey olarak kontrol et
      const directions = [
        { isVertical: true }, // Dikey kontrol
        { isVertical: false }, // Yatay kontrol
      ];

      directions.forEach(({ isVertical }) => {
        // Yerleştirme yönüne dik ise kontrol et
        const shouldCheck =
          (isVertical && placementDirection !== "vertical") ||
          (!isVertical && placementDirection !== "horizontal");

        if (shouldCheck) {
          // Kelimenin başlangıç noktasını bul
          let startPos = isVertical ? row : col;
          while (
            startPos > 0 &&
            board[isVertical ? startPos - 1 : row][
              isVertical ? col : startPos - 1
            ]?.letter
          ) {
            startPos--;
          }

          // Kelimenin sonunu bul
          let endPos = isVertical ? row : col;
          while (
            endPos < 14 &&
            board[isVertical ? endPos + 1 : row][isVertical ? col : endPos + 1]
              ?.letter
          ) {
            endPos++;
          }

          // Kelime en az 2 harfli olmalı
          if (endPos - startPos >= 1) {
            // Kelimeyi oluştur
            let crossWord = "";
            for (let i = startPos; i <= endPos; i++) {
              const currRow = isVertical ? i : row;
              const currCol = isVertical ? col : i;

              // Tahta üzerinde harf varsa al
              if (board[currRow][currCol]?.letter) {
                crossWord += board[currRow][currCol].letter;
              } else {
                // Tahtada harf yoksa yerleştirilen harflerden kontrol et
                const placedCell = placedCells.find(
                  (pc) => pc.row === currRow && pc.col === currCol
                );

                if (placedCell) {
                  const rack = getUserRack();
                  const letterObj = rack[placedCell.rackIndex];
                  const letter =
                    typeof letterObj === "object"
                      ? letterObj.letter
                      : letterObj;
                  crossWord += letter === "JOKER" ? "*" : letter;
                } else {
                  // Ne tahtada ne de yerleştirilen harflerde yoksa (olmamalı)
                  crossWord += "?";
                }
              }
            }

            // Kelime en az 2 harfli ve yeni oluşturulmuş bir kelime ise ekle
            if (crossWord.length >= 2 && !crossWord.includes("?")) {
              crossWords.push(crossWord);
            }
          }
        }
      });
    });

    return crossWords;
  }; // Özel etki mesajını oluşturan yardımcı fonksiyon
  const getEffectMessage = (effects) => {
    if (effects.pointDivision) {
      return "Puan Bölünmesi: Puanınızın yalnızca %30'unu aldınız!";
    } else if (effects.pointTransfer) {
      return "Puan Transferi: Puanlarınız rakibinize transfer edildi!";
    } else if (effects.letterLoss) {
      return "Harf Kaybı: Elinizdeki tüm harfler değiştirildi!";
    } else if (effects.moveBlockade) {
      return "Ekstra Hamle Engeli: Harf ve kelime çarpanları iptal edildi!";
    } else if (effects.wordCancellation) {
      return "Kelime İptali: Bu hamlede puan alamadınız!";
    }
    return "Özel bir etki tetiklendi!";
  };
  // Hücre seçimi
  const handleCellPress = (row, col) => {
    console.log(`handleCellPress çağrıldı - Satır: ${row}, Sütun: ${col}`);

    // Oyun kontrolü
    if (!game) {
      console.error("Oyun tanımlı değil!");
      return;
    }

    if (!game.board) {
      console.error("Oyun tahtası tanımlı değil!");
      return;
    }

    // Hücre kontrolü - güvenli erişim
    if (!game.board[row] || !game.board[row][col]) {
      console.error(`Hücre (${row},${col}) tanımlı değil!`);
      return;
    }

    // Hücre verisi kontrolü
    const cell = game.board[row][col];
    if (!cell || typeof cell !== "object") {
      console.error(`Hücre (${row},${col}) geçersiz veri:`, cell);
      return;
    }

    console.log(`Hücre (${row},${col}) geçerli:`, cell);

    // Kullanıcının sırası değilse işlem yapma
    if (!isUserTurn()) {
      showTemporaryMessage("Şu anda sıra sizde değil!");
      return;
    }

    // Eğer raf seçili değilse hücre seçilemez
    if (selectedRackIndices.length === 0) {
      showTemporaryMessage("Önce rafınızdan bir harf seçin!");
      return;
    }

    // Seçilen raf indeksini al (gerçek indeks)
    const rackIndex = selectedRackIndices[0];
    const letterObj = getUserRack()[rackIndex];
    const letter = typeof letterObj === "object" ? letterObj.letter : letterObj;

    // Hücre dolu mu kontrol et (sadece kalıcı harfler için)
    if (game.board[row][col].letter) {
      showTemporaryMessage("Bu hücre zaten dolu!");
      return;
    }

    // Bu hücre zaten seçilmiş mi kontrol et
    const alreadySelected = selectedBoardCells.some(
      (cell) => cell.row === row && cell.col === col
    );

    if (alreadySelected) {
      showTemporaryMessage("Bu hücre zaten seçili!");
      return;
    }

    // Harfler bitişik ve aynı doğrultuda yerleştirilmeli
    if (selectedBoardCells.length >= 1) {
      const isValidPlacement = checkValidPlacement(row, col);
      if (!isValidPlacement) {
        showTemporaryMessage(
          "Harfler bitişik ve aynı doğrultuda yerleştirilmelidir!"
        );
        return;
      }
    }

    // Yeni seçili hücre oluştur
    const newCell = {
      row,
      col,
      rackIndex: rackIndex,
      letter: letter,
    };
    const newSelectedCells = [...selectedBoardCells, newCell];
    setSelectedBoardCells(newSelectedCells);

    // Seçilen harfi raf seçiminden kaldır
    setSelectedRackIndices([]);

    // Yerleştirme yönünü belirle
    if (newSelectedCells.length === 2) {
      determineDirection(newSelectedCells);
    }

    // Kelimeyi güncelle
    updateCurrentWord(newSelectedCells);

    console.log("Harf yerleştirildi:", {
      row,
      col,
      rackIndex: newCell.rackIndex,
      letter: letter,
    });
  };
  // Kelimeyi göstermek için yeni fonksiyon
  const updateCurrentWord = (cells) => {
    if (cells.length === 0) {
      setCurrentWord("");
      setWordValid(false);
      setEarnedPoints(0);
      return;
    }

    try {
      // Tam kelimeyi oluştur (tahtadaki harflerle birlikte)
      const completeWord = createCompleteWord(cells);

      console.log("Oluşturulan tam kelime:", completeWord);
      setCurrentWord(completeWord);

      // Kelime geçerliliğini kontrol et
      if (completeWord.length >= 2) {
        // Joker'leri 'A' ile değiştirerek ve Türkçe karakterleri normalize ederek doğrula
        const wordToValidate = completeWord
          .replace(/\*/g, "A")
          .toLowerCase()
          .replace(/i̇/g, "i")
          .replace(/ı/g, "i");

        console.log("Doğrulanacak kelime:", wordToValidate);

        const isValid = validateWord(wordToValidate);
        console.log("Kelime geçerli mi?", isValid);

        setWordValid(isValid);

        if (isValid) {
          const points = calculateWordPoints(cells, game.board, getUserRack());
          setEarnedPoints(points);
          console.log("Hesaplanan puan:", points);
        } else {
          setEarnedPoints(0);
        }
      } else {
        setWordValid(false);
        setEarnedPoints(0);
      }
    } catch (error) {
      console.error("Error in updateCurrentWord:", error);
      setCurrentWord("");
      setWordValid(false);
      setEarnedPoints(0);
    }
  };
  const createCompleteWord = (placedCells) => {
    if (!game || !game.board || placedCells.length === 0) return "";

    // Yönü belirle
    let direction = "horizontal";
    if (placedCells.length > 1) {
      const [cell1, cell2] = placedCells;
      if (cell1.row === cell2.row) {
        direction = "horizontal";
      } else if (cell1.col === cell2.col) {
        direction = "vertical";
      } else if (
        Math.abs(cell1.row - cell2.row) === Math.abs(cell1.col - cell2.col)
      ) {
        direction = "diagonal";
      }
    } else {
      // Tek harf için en uygun yönü belirle
      const cell = placedCells[0];

      // Yatay komşuları kontrol et
      const hasHorizontalNeighbor =
        (cell.col > 0 && game.board[cell.row][cell.col - 1]?.letter) ||
        (cell.col < 14 && game.board[cell.row][cell.col + 1]?.letter);

      // Dikey komşuları kontrol et
      const hasVerticalNeighbor =
        (cell.row > 0 && game.board[cell.row - 1][cell.col]?.letter) ||
        (cell.row < 14 && game.board[cell.row + 1][cell.col]?.letter);

      // Çapraz komşuları kontrol et
      const hasDiagonalNeighbor =
        (cell.row > 0 &&
          cell.col > 0 &&
          game.board[cell.row - 1][cell.col - 1]?.letter) ||
        (cell.row > 0 &&
          cell.col < 14 &&
          game.board[cell.row - 1][cell.col + 1]?.letter) ||
        (cell.row < 14 &&
          cell.col > 0 &&
          game.board[cell.row + 1][cell.col - 1]?.letter) ||
        (cell.row < 14 &&
          cell.col < 14 &&
          game.board[cell.row + 1][cell.col + 1]?.letter);

      if (
        hasHorizontalNeighbor &&
        !hasVerticalNeighbor &&
        !hasDiagonalNeighbor
      ) {
        direction = "horizontal";
      } else if (
        hasVerticalNeighbor &&
        !hasHorizontalNeighbor &&
        !hasDiagonalNeighbor
      ) {
        direction = "vertical";
      } else if (
        hasDiagonalNeighbor &&
        !hasHorizontalNeighbor &&
        !hasVerticalNeighbor
      ) {
        direction = "diagonal";
      }
    }

    // Kelime sınırlarını bul
    const { startRow, startCol, endRow, endCol } = findWordBoundaries(
      placedCells,
      game.board,
      direction
    );

    // Kelimeyi oluştur
    let word = "";
    const rack = getUserRack();

    if (direction === "horizontal") {
      for (let col = startCol; col <= endCol; col++) {
        const cell = game.board[startRow][col];
        if (cell?.letter) {
          word += cell.letter;
        } else {
          const placedCell = placedCells.find(
            (pc) => pc.row === startRow && pc.col === col
          );
          if (placedCell) {
            const letterObj = rack[placedCell.rackIndex];
            const letter =
              typeof letterObj === "object" ? letterObj.letter : letterObj;
            word += letter === "JOKER" ? "*" : letter;
          }
        }
      }
    } else if (direction === "vertical") {
      for (let row = startRow; row <= endRow; row++) {
        const cell = game.board[row][startCol];
        if (cell?.letter) {
          word += cell.letter;
        } else {
          const placedCell = placedCells.find(
            (pc) => pc.row === row && pc.col === startCol
          );
          if (placedCell) {
            const letterObj = rack[placedCell.rackIndex];
            const letter =
              typeof letterObj === "object" ? letterObj.letter : letterObj;
            word += letter === "JOKER" ? "*" : letter;
          }
        }
      }
    } else if (direction === "diagonal") {
      // Çapraz kelime oluşturma
      const dx = Math.sign(endCol - startCol);
      const dy = Math.sign(endRow - startRow);

      let currentRow = startRow;
      let currentCol = startCol;

      while (
        currentRow >= 0 &&
        currentRow < 15 &&
        currentCol >= 0 &&
        currentCol < 15 &&
        (currentRow !== endRow + dy || currentCol !== endCol + dx)
      ) {
        const cell = game.board[currentRow][currentCol];
        if (cell?.letter) {
          word += cell.letter;
        } else {
          const placedCell = placedCells.find(
            (pc) => pc.row === currentRow && pc.col === currentCol
          );
          if (placedCell) {
            const letterObj = rack[placedCell.rackIndex];
            const letter =
              typeof letterObj === "object" ? letterObj.letter : letterObj;
            word += letter === "JOKER" ? "*" : letter;
          }
        }
        currentRow += dy;
        currentCol += dx;
      }
    }

    return word;
  };

  const findAllFormedWords = (placedCells) => {
    if (!game || !game.board || placedCells.length === 0) return [];

    const words = [];
    const mainDirection =
      placedCells.length > 1
        ? placedCells[0].row === placedCells[1].row
          ? "horizontal"
          : "vertical"
        : "horizontal";

    // Ana kelimeyi bul
    const mainWord = createCompleteWord(placedCells);
    if (mainWord.length >= 2) {
      words.push({
        word: mainWord,
        direction: mainDirection,
        cells: placedCells,
      });
    }

    // Her yerleştirilen harf için çapraz kelimeleri kontrol et
    placedCells.forEach((placedCell) => {
      const { row, col } = placedCell;

      // Çapraz yönde kelime oluşturur mu kontrol et
      if (mainDirection === "horizontal") {
        // Dikey kelime ara
        let verticalWord = "";
        let startRow = row;
        let endRow = row;

        // Yukarı doğru harfleri bul
        while (startRow > 0 && game.board[startRow - 1][col]?.letter) {
          startRow--;
        }

        // Aşağı doğru harfleri bul
        while (endRow < 14 && game.board[endRow + 1][col]?.letter) {
          endRow++;
        }

        // Kelimeyi oluştur
        if (endRow - startRow + 1 >= 2) {
          // En az 2 harf
          for (let r = startRow; r <= endRow; r++) {
            if (r === row) {
              // Yerleştirilen harf
              const rack = getUserRack();
              const letterObj = rack[placedCell.rackIndex];
              const letter =
                typeof letterObj === "object" ? letterObj.letter : letterObj;
              verticalWord += letter === "JOKER" ? "*" : letter;
            } else {
              // Tahtadaki harf
              verticalWord += game.board[r][col].letter;
            }
          }

          if (verticalWord.length >= 2) {
            words.push({
              word: verticalWord,
              direction: "vertical",
              cells: [placedCell],
            });
          }
        }
      } else {
        // Yatay kelime ara
        let horizontalWord = "";
        let startCol = col;
        let endCol = col;

        // Sola doğru harfleri bul
        while (startCol > 0 && game.board[row][startCol - 1]?.letter) {
          startCol--;
        }

        // Sağa doğru harfleri bul
        while (endCol < 14 && game.board[row][endCol + 1]?.letter) {
          endCol++;
        }

        // Kelimeyi oluştur
        if (endCol - startCol + 1 >= 2) {
          // En az 2 harf
          for (let c = startCol; c <= endCol; c++) {
            if (c === col) {
              // Yerleştirilen harf
              const rack = getUserRack();
              const letterObj = rack[placedCell.rackIndex];
              const letter =
                typeof letterObj === "object" ? letterObj.letter : letterObj;
              horizontalWord += letter === "JOKER" ? "*" : letter;
            } else {
              // Tahtadaki harf
              horizontalWord += game.board[row][c].letter;
            }
          }

          if (horizontalWord.length >= 2) {
            words.push({
              word: horizontalWord,
              direction: "horizontal",
              cells: [placedCell],
            });
          }
        }
      }
    });

    return words;
  };

  const checkIfAdjacentToExistingLetter = (row, col, board) => {
    // Tahta kontrolü
    if (!board || !Array.isArray(board)) {
      console.error("Geçersiz tahta verisi:", board);
      return false;
    }

    // Bitişik hücre yönleri (yukarı, aşağı, sol, sağ)
    const directions = [
      { dr: -1, dc: 0 }, // yukarı
      { dr: 1, dc: 0 }, // aşağı
      { dr: 0, dc: -1 }, // sol
      { dr: 0, dc: 1 }, // sağ
    ];

    // Her yönü kontrol et
    for (const { dr, dc } of directions) {
      const newRow = row + dr;
      const newCol = col + dc;

      // Tahta sınırlarını kontrol et
      if (newRow >= 0 && newRow < 15 && newCol >= 0 && newCol < 15) {
        // Komşu hücrede kalıcı bir harf var mı?
        if (
          board[newRow] &&
          board[newRow][newCol] &&
          board[newRow][newCol].letter
        ) {
          // Bu komşu hücre, şu anda yerleştirilen geçici harf değil mi?
          const isTemporary = selectedBoardCells.some(
            (cell) => cell.row === newRow && cell.col === newCol
          );

          if (!isTemporary) {
            return true;
          }
        }
      }
    }

    return false;
  };

  // Oluşturulan kelimeyi kontrol et
  const checkWord = (cells) => {
    if (cells.length < 2) {
      setCurrentWord("");
      setWordValid(false);
      setEarnedPoints(0);
      return;
    }

    // Hücreleri sırala (yön belirlendiyse ona göre)
    const sortedCells = [...cells].sort((a, b) => {
      if (placementDirection === "horizontal") {
        return a.col - b.col;
      } else if (placementDirection === "vertical") {
        return a.row - b.row;
      }
      // Varsayılan sıralama (yön belirlenemediyse)
      return 0;
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
    const isValid = validateWord(word.toLowerCase());
    setWordValid(isValid);

    // Puanları hesapla
    if (isValid) {
      // Basit bir hesaplama - gerçek uygulamada daha karmaşık bir mantık kullanabilirsiniz
      const points = calculateWordPoints(sortedCells);
      setEarnedPoints(points);
    } else {
      setEarnedPoints(0);
    }
  };

  const calculateCompleteWordPoints = (cells, board) => {
    if (!board || cells.length === 0) return 0;

    // Tam kelimeyi ve yönü belirle
    const direction =
      cells.length > 1
        ? cells[0].row === cells[1].row
          ? "horizontal"
          : "vertical"
        : "horizontal"; // Default yön

    // Kelime sınırlarını bul (tahtadaki harflerle birlikte)
    const { startRow, startCol, endRow, endCol } = findWordBoundaries(
      cells,
      board,
      direction
    );

    let totalPoints = 0;
    let wordMultiplier = 1;
    const rack = getUserRack();

    // Her harf için puan hesapla
    if (direction === "horizontal") {
      for (let col = startCol; col <= endCol; col++) {
        const cell = board[startRow][col];
        let letterPoint = 0;
        let letterMultiplier = 1;

        // Tahtada varolan harf
        if (cell && cell.letter) {
          const letter = cell.letter;
          letterPoint = getLetterValue(letter);
        } else {
          // Yeni yerleştirilen harf
          const placedCell = cells.find(
            (pc) => pc.row === startRow && pc.col === col
          );
          if (placedCell) {
            const letterObj = rack[placedCell.rackIndex];
            const letter =
              typeof letterObj === "object" ? letterObj.letter : letterObj;
            letterPoint = getLetterValue(letter);

            // Sadece yeni yerleştirilen harfler için çarpanları uygula
            const cellType = board[startRow][col]?.type;
            if (cellType === "H2") letterMultiplier = 2;
            else if (cellType === "H3") letterMultiplier = 3;
            else if (cellType === "K2") wordMultiplier *= 2;
            else if (cellType === "K3") wordMultiplier *= 3;
          }
        }

        totalPoints += letterPoint * letterMultiplier;
      }
    } else {
      for (let row = startRow; row <= endRow; row++) {
        const cell = board[row][startCol];
        let letterPoint = 0;
        let letterMultiplier = 1;

        // Tahtada varolan harf
        if (cell && cell.letter) {
          const letter = cell.letter;
          letterPoint = getLetterValue(letter);
        } else {
          // Yeni yerleştirilen harf
          const placedCell = cells.find(
            (pc) => pc.row === row && pc.col === startCol
          );
          if (placedCell) {
            const letterObj = rack[placedCell.rackIndex];
            const letter =
              typeof letterObj === "object" ? letterObj.letter : letterObj;
            letterPoint = getLetterValue(letter);

            // Sadece yeni yerleştirilen harfler için çarpanları uygula
            const cellType = board[row][startCol]?.type;
            if (cellType === "H2") letterMultiplier = 2;
            else if (cellType === "H3") letterMultiplier = 3;
            else if (cellType === "K2") wordMultiplier *= 2;
            else if (cellType === "K3") wordMultiplier *= 3;
          }
        }

        totalPoints += letterPoint * letterMultiplier;
      }
    }

    return totalPoints * wordMultiplier;
  };

  const findWordBoundaries = (cells, board, direction) => {
    if (cells.length === 0)
      return { startRow: 0, startCol: 0, endRow: 0, endCol: 0 };

    let startRow = cells[0].row;
    let startCol = cells[0].col;
    let endRow = cells[0].row;
    let endCol = cells[0].col;

    // Tüm yerleştirilen hücreleri kapsayacak şekilde başlangıç sınırlarını bul
    cells.forEach((cell) => {
      startRow = Math.min(startRow, cell.row);
      startCol = Math.min(startCol, cell.col);
      endRow = Math.max(endRow, cell.row);
      endCol = Math.max(endCol, cell.col);
    });

    // Kelimenin sınırlarını tahtadaki harflerle genişlet
    if (direction === "horizontal") {
      // Sola doğru genişlet
      while (startCol > 0 && board[startRow][startCol - 1]?.letter) {
        startCol--;
      }
      // Sağa doğru genişlet
      while (endCol < 14 && board[startRow][endCol + 1]?.letter) {
        endCol++;
      }
    } else if (direction === "vertical") {
      // Yukarı doğru genişlet
      while (startRow > 0 && board[startRow - 1][startCol]?.letter) {
        startRow--;
      }
      // Aşağı doğru genişlet
      while (endRow < 14 && board[endRow + 1][startCol]?.letter) {
        endRow++;
      }
    } else if (direction === "diagonal") {
      // Çapraz yönü belirle
      const dx = Math.sign(endCol - startCol) || 1;
      const dy = Math.sign(endRow - startRow) || 1;

      // Başlangıç noktasını geriye doğru genişlet
      while (
        startRow - dy >= 0 &&
        startRow - dy < 15 &&
        startCol - dx >= 0 &&
        startCol - dx < 15 &&
        board[startRow - dy][startCol - dx]?.letter
      ) {
        startRow -= dy;
        startCol -= dx;
      }

      // Bitiş noktasını ileriye doğru genişlet
      while (
        endRow + dy >= 0 &&
        endRow + dy < 15 &&
        endCol + dx >= 0 &&
        endCol + dx < 15 &&
        board[endRow + dy][endCol + dx]?.letter
      ) {
        endRow += dy;
        endCol += dx;
      }
    }

    return { startRow, startCol, endRow, endCol };
  };
  const getLetterValue = (letter) => {
    const letterValues = {
      A: 1,
      B: 3,
      C: 4,
      Ç: 4,
      D: 3,
      E: 1,
      F: 7,
      G: 5,
      Ğ: 8,
      H: 5,
      I: 2,
      İ: 1,
      J: 10,
      K: 1,
      L: 1,
      M: 2,
      N: 1,
      O: 2,
      Ö: 7,
      P: 5,
      R: 1,
      S: 2,
      Ş: 4,
      T: 1,
      U: 2,
      Ü: 3,
      V: 7,
      Y: 3,
      Z: 4,
      JOKER: 0,
      "*": 0,
    };
    return letterValues[letter] || 0;
  };

  const checkValidPlacement = (row, col) => {
    if (selectedBoardCells.length === 0) {
      return true; // İlk harf için her zaman geçerli
    }

    if (selectedBoardCells.length === 1) {
      const firstCell = selectedBoardCells[0];

      // Bitişik olmalı (8 yönde komşu kontrolü - çapraz dahil)
      const rowDiff = Math.abs(firstCell.row - row);
      const colDiff = Math.abs(firstCell.col - col);

      // Yatay, dikey veya çapraz bitişik mi?
      if (rowDiff <= 1 && colDiff <= 1 && rowDiff + colDiff > 0) {
        return true;
      }

      return false;
    }

    // Üçüncü ve sonraki harfler için
    if (placementDirection === "horizontal") {
      const firstRow = selectedBoardCells[0].row;
      if (row !== firstRow) return false;

      // Sağa veya sola bitişik mi?
      const cols = selectedBoardCells.map((cell) => cell.col);
      const minCol = Math.min(...cols);
      const maxCol = Math.max(...cols);

      return col === minCol - 1 || col === maxCol + 1;
    } else if (placementDirection === "vertical") {
      const firstCol = selectedBoardCells[0].col;
      if (col !== firstCol) return false;

      // Yukarı veya aşağı bitişik mi?
      const rows = selectedBoardCells.map((cell) => cell.row);
      const minRow = Math.min(...rows);
      const maxRow = Math.max(...rows);

      return row === minRow - 1 || row === maxRow + 1;
    } else if (placementDirection === "diagonal") {
      const firstCell = selectedBoardCells[0];
      const lastCell = selectedBoardCells[selectedBoardCells.length - 1];

      // Çapraz yönü belirle
      const dx = Math.sign(lastCell.col - firstCell.col);
      const dy = Math.sign(lastCell.row - firstCell.row);

      // Beklenen pozisyonlar
      const expectedRow1 = firstCell.row - dy;
      const expectedCol1 = firstCell.col - dx;
      const expectedRow2 = lastCell.row + dy;
      const expectedCol2 = lastCell.col + dx;

      // Başa veya sona ekleniyor mu?
      return (
        (row === expectedRow1 && col === expectedCol1) ||
        (row === expectedRow2 && col === expectedCol2)
      );
    }

    return false;
  };
  // determineDirection fonksiyonunu güncelle
  const determineDirection = (cells) => {
    if (cells.length < 2) return;

    const cell1 = cells[0];
    const cell2 = cells[1];

    if (cell1.row === cell2.row) {
      setPlacementDirection("horizontal");
    } else if (cell1.col === cell2.col) {
      setPlacementDirection("vertical");
    } else if (
      Math.abs(cell1.row - cell2.row) === Math.abs(cell1.col - cell2.col)
    ) {
      // Çapraz yerleştirme
      setPlacementDirection("diagonal");
    } else {
      setPlacementDirection(null);
    }
  };

  const getMainWordFormed = (placedCells, board) => {
    if (!placedCells || placedCells.length === 0) return "";
    if (!board || !Array.isArray(board)) return "";

    // Yerleştirme yönünü belirle
    let direction = "horizontal";
    if (placedCells.length > 1) {
      const [cell1, cell2] = placedCells;
      if (cell1.row === cell2.row) {
        direction = "horizontal";
      } else if (cell1.col === cell2.col) {
        direction = "vertical";
      } else if (
        Math.abs(cell1.row - cell2.row) === Math.abs(cell1.col - cell2.col)
      ) {
        direction = "diagonal";
      }
    }

    // Tek harf için en uygun kelimeyi bul
    if (placedCells.length === 1) {
      const cell = placedCells[0];

      // Yatay kelime kontrolü
      let hWord = "";
      let hStartCol = cell.col;
      let hEndCol = cell.col;

      while (hStartCol > 0 && board[cell.row][hStartCol - 1]?.letter) {
        hStartCol--;
      }
      while (hEndCol < 14 && board[cell.row][hEndCol + 1]?.letter) {
        hEndCol++;
      }

      if (hEndCol > hStartCol) {
        for (let col = hStartCol; col <= hEndCol; col++) {
          if (board[cell.row][col]?.letter) {
            hWord += board[cell.row][col].letter;
          } else if (col === cell.col) {
            hWord += cell.letter;
          }
        }
      }

      // Dikey kelime kontrolü
      let vWord = "";
      let vStartRow = cell.row;
      let vEndRow = cell.row;

      while (vStartRow > 0 && board[vStartRow - 1][cell.col]?.letter) {
        vStartRow--;
      }
      while (vEndRow < 14 && board[vEndRow + 1][cell.col]?.letter) {
        vEndRow++;
      }

      if (vEndRow > vStartRow) {
        for (let row = vStartRow; row <= vEndRow; row++) {
          if (board[row][cell.col]?.letter) {
            vWord += board[row][cell.col].letter;
          } else if (row === cell.row) {
            vWord += cell.letter;
          }
        }
      }

      // En uzun kelimeyi seç
      if (hWord.length >= vWord.length && hWord.length > 1) {
        return hWord;
      } else if (vWord.length > 1) {
        return vWord;
      }
    }

    // Normal yerleştirme işlemleri
    if (direction === "diagonal") {
      const sortedCells = [...placedCells].sort((a, b) => {
        return a.row + a.col - (b.row + b.col);
      });

      const firstCell = sortedCells[0];
      const lastCell = sortedCells[sortedCells.length - 1];

      const dx = Math.sign(lastCell.col - firstCell.col);
      const dy = Math.sign(lastCell.row - firstCell.row);

      let startRow = firstCell.row;
      let startCol = firstCell.col;

      // Başlangıç noktasını geriye doğru genişlet
      while (
        startRow - dy >= 0 &&
        startRow - dy < 15 &&
        startCol - dx >= 0 &&
        startCol - dx < 15 &&
        board[startRow - dy][startCol - dx]?.letter
      ) {
        startRow -= dy;
        startCol -= dx;
      }

      // Kelimeyi oluştur
      let word = "";
      let currentRow = startRow;
      let currentCol = startCol;

      while (
        currentRow >= 0 &&
        currentRow < 15 &&
        currentCol >= 0 &&
        currentCol < 15
      ) {
        const placedCell = placedCells.find(
          (pc) => pc.row === currentRow && pc.col === currentCol
        );

        if (placedCell) {
          word += placedCell.letter === "JOKER" ? "*" : placedCell.letter;
        } else if (board[currentRow][currentCol]?.letter) {
          word += board[currentRow][currentCol].letter;
        } else {
          break; // Boş hücre, kelime sonu
        }

        currentRow += dy;
        currentCol += dx;
      }

      return word;
    } else {
      // Yatay veya dikey kelimeler için mevcut kod...
      return createCompleteWord(placedCells);
    }
  };
  // Puanları hesapla (örnek bir fonksiyon - gerçek puanlama mantığı farklı olabilir)
  const calculateWordPoints = (placedCells, board, rack) => {
    if (!board || !placedCells.length) return 0;

    let totalPoints = 0;
    let wordMultiplier = 1;

    // Ana kelimeyi hesapla
    const direction = getPlacementDirection(placedCells);
    const wordCells = getFullWordCells(placedCells, board, direction);

    // Ana kelime puanını hesapla
    wordCells.forEach((cell) => {
      let letterPoint = 0;
      let letterMultiplier = 1;

      if (cell.isPlaced) {
        // Yeni yerleştirilen harf
        const letterObj = rack[cell.rackIndex];
        const letter =
          typeof letterObj === "object" ? letterObj.letter : letterObj;
        letterPoint = letter === "JOKER" ? 0 : letterValues[letter] || 0;

        // Özel hücre kontrolü
        const cellType = board[cell.row][cell.col].type;

        if (cellType === "H2") {
          letterMultiplier = 2;
        } else if (cellType === "H3") {
          letterMultiplier = 3;
        } else if (cellType === "K2") {
          wordMultiplier *= 2;
        } else if (cellType === "K3") {
          wordMultiplier *= 3;
        }
      } else {
        // Tahtada mevcut harf
        const boardCell = board[cell.row][cell.col];
        letterPoint = boardCell.points || letterValues[boardCell.letter] || 0;
      }

      totalPoints += letterPoint * letterMultiplier;
    });

    totalPoints *= wordMultiplier;

    // Çapraz kelimeleri hesapla
    placedCells.forEach((placedCell) => {
      const crossWordCells = getCrossWordForCell(placedCell, board, direction);
      if (crossWordCells.length >= 2) {
        totalPoints += calculateCrossWordPoints(
          crossWordCells,
          placedCell,
          board,
          rack
        );
      }
    });

    return totalPoints;
  };

  const getFullWordCells = (placedCells, board, direction) => {
    const wordCells = [];
    const sortedCells = [...placedCells].sort((a, b) => {
      if (direction === "horizontal") return a.col - b.col;
      if (direction === "vertical") return a.row - b.row;
      return a.row + a.col - (b.row + b.col);
    });

    if (direction === "horizontal") {
      const row = sortedCells[0].row;
      let startCol = sortedCells[0].col;
      let endCol = sortedCells[sortedCells.length - 1].col;

      // Sol ve sağ genişletme
      while (startCol > 0 && board[row][startCol - 1].letter) {
        startCol--;
      }
      while (endCol < 14 && board[row][endCol + 1].letter) {
        endCol++;
      }

      for (let col = startCol; col <= endCol; col++) {
        const placedCell = placedCells.find(
          (cell) => cell.row === row && cell.col === col
        );
        if (placedCell) {
          wordCells.push({ ...placedCell, isPlaced: true });
        } else {
          wordCells.push({ row, col, isPlaced: false });
        }
      }
    } else if (direction === "vertical") {
      const col = sortedCells[0].col;
      let startRow = sortedCells[0].row;
      let endRow = sortedCells[sortedCells.length - 1].row;

      // Yukarı ve aşağı genişletme
      while (startRow > 0 && board[startRow - 1][col].letter) {
        startRow--;
      }
      while (endRow < 14 && board[endRow + 1][col].letter) {
        endRow++;
      }

      for (let row = startRow; row <= endRow; row++) {
        const placedCell = placedCells.find(
          (cell) => cell.row === row && cell.col === col
        );
        if (placedCell) {
          wordCells.push({ ...placedCell, isPlaced: true });
        } else {
          wordCells.push({ row, col, isPlaced: false });
        }
      }
    } else {
      // diagonal
      const dx = Math.sign(sortedCells[1]?.col - sortedCells[0].col || 1);
      const dy = Math.sign(sortedCells[1]?.row - sortedCells[0].row || 1);

      let startRow = sortedCells[0].row;
      let startCol = sortedCells[0].col;
      let endRow = sortedCells[sortedCells.length - 1].row;
      let endCol = sortedCells[sortedCells.length - 1].col;

      // Çapraz genişletme
      while (
        startRow - dy >= 0 &&
        startRow - dy < 15 &&
        startCol - dx >= 0 &&
        startCol - dx < 15 &&
        board[startRow - dy][startCol - dx].letter
      ) {
        startRow -= dy;
        startCol -= dx;
      }

      while (
        endRow + dy < 15 &&
        endRow + dy >= 0 &&
        endCol + dx < 15 &&
        endCol + dx >= 0 &&
        board[endRow + dy][endCol + dx].letter
      ) {
        endRow += dy;
        endCol += dx;
      }

      let currentRow = startRow;
      let currentCol = startCol;

      while (
        currentRow >= 0 &&
        currentRow < 15 &&
        currentCol >= 0 &&
        currentCol < 15 &&
        (currentRow <= endRow || currentCol <= endCol)
      ) {
        const placedCell = placedCells.find(
          (cell) => cell.row === currentRow && cell.col === currentCol
        );

        if (placedCell) {
          wordCells.push({ ...placedCell, isPlaced: true });
        } else if (board[currentRow][currentCol].letter) {
          wordCells.push({ row: currentRow, col: currentCol, isPlaced: false });
        }

        currentRow += dy;
        currentCol += dx;
      }
    }

    return wordCells;
  };

  const getCrossWordForCell = (placedCell, board, mainDirection) => {
    const crossCells = [];

    if (mainDirection === "horizontal") {
      // Dikey çapraz kelime
      let startRow = placedCell.row;
      let endRow = placedCell.row;

      while (startRow > 0 && board[startRow - 1][placedCell.col].letter) {
        startRow--;
      }
      while (endRow < 14 && board[endRow + 1][placedCell.col].letter) {
        endRow++;
      }

      if (endRow > startRow) {
        // En az 2 harf olmalı
        for (let row = startRow; row <= endRow; row++) {
          crossCells.push({ row, col: placedCell.col });
        }
      }
    } else if (mainDirection === "vertical") {
      // Yatay çapraz kelime
      let startCol = placedCell.col;
      let endCol = placedCell.col;

      while (startCol > 0 && board[placedCell.row][startCol - 1].letter) {
        startCol--;
      }
      while (endCol < 14 && board[placedCell.row][endCol + 1].letter) {
        endCol++;
      }

      if (endCol > startCol) {
        // En az 2 harf olmalı
        for (let col = startCol; col <= endCol; col++) {
          crossCells.push({ row: placedCell.row, col });
        }
      }
    } else if (mainDirection === "diagonal") {
      // Hem yatay hem dikey çapraz kelimeleri kontrol et

      // Yatay çapraz
      let hStartCol = placedCell.col;
      let hEndCol = placedCell.col;

      while (hStartCol > 0 && board[placedCell.row][hStartCol - 1].letter) {
        hStartCol--;
      }
      while (hEndCol < 14 && board[placedCell.row][hEndCol + 1].letter) {
        hEndCol++;
      }

      if (hEndCol > hStartCol) {
        for (let col = hStartCol; col <= hEndCol; col++) {
          crossCells.push({ row: placedCell.row, col, isHorizontal: true });
        }
      }

      // Dikey çapraz
      let vStartRow = placedCell.row;
      let vEndRow = placedCell.row;

      while (vStartRow > 0 && board[vStartRow - 1][placedCell.col].letter) {
        vStartRow--;
      }
      while (vEndRow < 14 && board[vEndRow + 1][placedCell.col].letter) {
        vEndRow++;
      }

      if (vEndRow > vStartRow) {
        for (let row = vStartRow; row <= vEndRow; row++) {
          crossCells.push({ row, col: placedCell.col, isVertical: true });
        }
      }
    }

    return crossCells;
  };

  const calculateCrossWordPoints = (
    crossWordCells,
    placedCell,
    board,
    rack
  ) => {
    let points = 0;
    let wordMultiplier = 1;

    crossWordCells.forEach((cell) => {
      let letterPoint = 0;
      let letterMultiplier = 1;

      if (cell.row === placedCell.row && cell.col === placedCell.col) {
        // Yeni yerleştirilen harf
        const letterObj = rack[placedCell.rackIndex];
        const letter =
          typeof letterObj === "object" ? letterObj.letter : letterObj;
        letterPoint = letter === "JOKER" ? 0 : letterValues[letter] || 0;

        // Özel hücre kontrolü
        const cellType = board[cell.row][cell.col].type;

        if (cellType === "H2") {
          letterMultiplier = 2;
        } else if (cellType === "H3") {
          letterMultiplier = 3;
        } else if (cellType === "K2") {
          wordMultiplier *= 2;
        } else if (cellType === "K3") {
          wordMultiplier *= 3;
        }
      } else {
        // Tahtada mevcut harf
        const boardCell = board[cell.row][cell.col];
        letterPoint = boardCell.points || letterValues[boardCell.letter] || 0;
      }

      points += letterPoint * letterMultiplier;
    });

    return points * wordMultiplier;
  };

  const getSelectedCellLetter = (row, col) => {
    const selectedCell = selectedBoardCells.find(
      (cell) => cell.row === row && cell.col === col
    );

    if (!selectedCell || selectedCell.rackIndex === undefined) {
      return null;
    }

    const userRack = getUserRack();

    if (!userRack || !Array.isArray(userRack) || userRack.length === 0) {
      return null;
    }

    const rackIndex = selectedCell.rackIndex;

    if (rackIndex < 0 || rackIndex >= userRack.length) {
      console.warn(
        `Geçersiz raf indeksi: ${rackIndex}, raf uzunluğu: ${userRack.length}`
      );
      return null;
    }

    const letterObj = userRack[rackIndex];

    if (!letterObj) {
      return null;
    }

    // Harf nesne veya string olabilir
    return typeof letterObj === "object" ? letterObj.letter : letterObj;
  };

  // Tüm seçimleri sıfırla
  const resetSelections = () => {
    setSelectedBoardCells([]);
    setSelectedRackIndices([]);
    setPlacementDirection(null);
    setCurrentWord("");
    setWordValid(false);
    setEarnedPoints(0);
    setActiveReward(null);

    // Görünür rafı orijinal rafa döndür
    if (originalRack.length > 0) {
      setVisibleRack(originalRack);
    }

    console.log("Tüm seçimler sıfırlandı");
  };
  // Pas geç
  // Updated handlePass function for GameInterface.jsx

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
            // First, reset all selections and changes before sending to server
            resetSelections();

            // Then show loading indicator
            setConfirmingAction(true);

            // Send pass action to server
            await passTurn(gameId);

            // Log pass action
            console.log("Pas geçildi, tüm seçimler temizlendi.");
          } catch (error) {
            // Show error if pass failed
            Alert.alert(
              "Hata",
              error.message || "Pas geçilirken bir sorun oluştu"
            );

            // Reset selections again in case of error
            resetSelections();
          } finally {
            // Hide loading indicator
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

  const calculateSimplePoints = (cells, rack) => {
    let totalPoints = 0;

    cells.forEach((cell) => {
      const letterObj = rack[cell.rackIndex];
      const letter =
        typeof letterObj === "object" ? letterObj.letter : letterObj;
      const points = letter === "JOKER" ? 0 : letterValues[letter] || 0;
      totalPoints += points;
    });

    return totalPoints;
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
            "Harf Yasağı etkinleştirildi. Rakibinizin 2 harfi donduruldu!",
          EkstraHamleJokeri:
            "Ekstra Hamle Jokeri etkinleştirildi. Bir hamle daha yapabilirsiniz!",
        };

        setSpecialPopup({
          title: "Ödül Kullanıldı",
          message:
            rewardMessages[rewardType] || `${rewardType} etkinleştirildi!`,
        });

        // Ekstra hamle jokeri kullanıldıysa, sıranın tekrar bu oyuncuda olması için bir flag set et
        if (rewardType === "EkstraHamleJokeri") {
          // Bu state'i GameInterface'in üst kısmında tanımlamanız gerekecek
          setHasExtraMove(true);
        }

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

  // Oyun süresini formatlı göster (örnek)
  const formatGameDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return "Bilinmiyor";

    // Milisaniye cinsinden süre farkı
    const durationMs = endTime - startTime;
    const seconds = Math.floor((durationMs / 1000) % 60);
    const minutes = Math.floor((durationMs / (1000 * 60)) % 60);
    const hours = Math.floor((durationMs / (1000 * 60 * 60)) % 24);
    const days = Math.floor(durationMs / (1000 * 60 * 60 * 24));

    if (days > 0) {
      return `${days} gün ${hours} saat`;
    } else if (hours > 0) {
      return `${hours} saat ${minutes} dakika`;
    } else {
      return `${minutes} dakika ${seconds} saniye`;
    }
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
    const player1Won = game.winner === game.player1?.id;
    const player2Won = game.winner === game.player2?.id;
    const isDraw = game.isDraw === true;

    // Kullanıcının oyuncu 1 mi yoksa 2 mi olduğunu belirle
    const isPlayer1 = auth.currentUser?.uid === game.player1?.id;

    // Oyunun bitme sebebini açıklayan mesajı belirle
    let reasonMessage = "";
    if (game.reason === "timeout") {
      const timedOutPlayerName =
        game.timedOutPlayer === game.player1?.id
          ? game.player1?.username
          : game.player2?.username;
      reasonMessage = `Süre aşımı: ${timedOutPlayerName} süresi doldu`;
    } else if (game.reason === "surrender") {
      const surrenderedPlayerName =
        game.surrenderedBy === game.player1?.id
          ? game.player1?.username
          : game.player2?.username;
      reasonMessage = `${surrenderedPlayerName} teslim oldu`;
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
            {game.reason === "surrender" && (
              <Text style={styles.statsText}>
                Teslim olma nedeniyle{" "}
                {game.surrenderedBy === game.player1?.id
                  ? game.player2?.username
                  : game.player1?.username}{" "}
                +50 bonus puan kazandı
              </Text>
            )}
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
          {showToast ? (
            <Text style={styles.toastMessage}>{statusMessage}</Text>
          ) : (
            <Text>Kalan: {game.letterPool?.length || 0}</Text>
          )}
        </View>

        <View style={styles.playerInfo}>
          <Text style={styles.playerName}>{opponent?.username || "Rakip"}</Text>
          <Text style={styles.score}>{opponent?.score || 0}</Text>
        </View>
      </View>
      {/* Oyun Tahtası */}
      <View style={styles.boardContainer}>
        <GameBoard
          board={game.board}
          selectedCells={selectedBoardCells}
          onCellPress={handleCellPress}
          showSpecials={false}
          getUserRack={() => getUserRack()}
          restrictedSide={game?.restrictedArea?.side}
          currentPlayer={auth.currentUser?.uid}
        />
      </View>
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
                  <Text style={styles.rewardText}>
                    {getRewardDisplayName(reward)}
                  </Text>
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

      {/* Aktif Kısıtlamalar */}
      {(game?.restrictedArea || game?.frozenLetters) && (
        <View style={styles.restrictionsContainer}>
          {game.restrictedArea &&
            game.restrictedArea.player === auth.currentUser?.uid && (
              <View style={styles.restrictionItem}>
                <Text style={styles.restrictionText}>
                  Bölge Kısıtlaması: Sadece tahtanın{" "}
                  {game.restrictedArea.side === "left" ? "sağ" : "sol"} tarafına
                  oynayabilirsiniz
                </Text>
              </View>
            )}

          {game.frozenLetters &&
            game.frozenLetters.player === auth.currentUser?.uid && (
              <View style={styles.restrictionItem}>
                <Text style={styles.restrictionText}>
                  Dondurulmuş harfleriniz var! {game.frozenLetters.turns} tur
                  kaldı
                </Text>
              </View>
            )}
        </View>
      )}

      {/* Harf Rafı */}
      <View style={styles.rackContainer}>
        <LetterRack
          letters={visibleRack}
          selectedIndices={selectedRackIndices.map((originalIndex) => {
            // Orijinal indeksi görünür indekse çevir
            const usedIndices = selectedBoardCells
              .map((cell) => cell.rackIndex)
              .sort((a, b) => a - b);
            let visibleIndex = originalIndex;

            for (const usedIndex of usedIndices) {
              if (usedIndex < originalIndex) {
                visibleIndex--;
              }
            }

            return visibleIndex;
          })}
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
            onPress={() => {
              console.log("Onayla butonuna tıklandı");
              console.log("wordValid:", wordValid);
              console.log("isUserTurn():", isUserTurn());
              console.log("confirmingAction:", confirmingAction);
              confirmMove();
            }}
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

      {gameResult && (
        <View style={styles.gameResultBanner}>
          <Text
            style={[
              styles.gameResultText,
              gameResult.resultType === "win" && styles.winText,
              gameResult.resultType === "loss" && styles.lossText,
              gameResult.resultType === "draw" && styles.drawText,
            ]}
          >
            {gameResult.resultMessage}
          </Text>
          <View style={styles.gameResultScores}>
            <Text style={styles.gameResultScoreText}>
              {gameResult.player1.username}: {gameResult.player1.score} puan
            </Text>
            <Text style={styles.gameResultScoreText}>
              {gameResult.player2.username}: {gameResult.player2.score} puan
            </Text>
          </View>
          <TouchableOpacity
            style={styles.homeButton}
            onPress={() => router.replace("/home")}
          >
            <Text style={styles.homeButtonText}>Ana Sayfaya Dön</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Yükleme İndikatörü */}
      {confirmingAction && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
    </SafeAreaView>
  );
}

// stilleri buraya koydum çek çek kullan mantığı hocam.
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
    flex: 1,
    padding: 12,
    borderRadius: 5,
    alignItems: "center",
    marginHorizontal: 2,
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
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
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    padding: 5,
    margin: 0,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
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
  toastMessage: {
    color: "#FF6B6B", // Kırmızımsı uyarı rengi
    fontWeight: "bold",
    fontSize: 14,
    textAlign: "center",
    // Animation yoksa basit bir görünüm için
    backgroundColor: "rgba(255, 107, 107, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
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
  statusContainer: {
    padding: 10,
    alignItems: "center",
    backgroundColor: "#f0f0f0",
  },
  statusText: {
    fontStyle: "italic",
  },
  timerText: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 5,
    color: "#e74c3c",
  },
  gameTypeText: {
    fontSize: 12,
    color: "#666",
    marginTop: 5,
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
    padding: 15,
    minWidth: 120,
    backgroundColor: "#f9f9f9",
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
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
  statsContainer: {
    width: "100%",
    backgroundColor: "#f0f0f0",
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  statsText: {
    fontSize: 14,
    marginBottom: 5,
  },
  homeButton: {
    backgroundColor: "#2e6da4",
    padding: 15,
    borderRadius: 5,
    alignItems: "center",
    width: "100%",
  },
  gameResultBanner: {
    backgroundColor: "#f0f0f0",
    padding: 15,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  gameResultText: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  winText: {
    color: "#4CAF50",
  },
  lossText: {
    color: "#F44336",
  },
  gameResultScores: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 15,
  },
  gameResultScoreText: {
    fontSize: 14,
  },
  homeButtonText: {
    color: "white",
    fontWeight: "bold",
  },
});
