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

  // Firebase dinleyicisi referansı
  const unsubscribeRef = useRef(null);

  // Tamamlanmış oyunu göstermek için flag
  const gameCompletedShown = useRef(false);

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
      showGameResultPopup(game);
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

      // Oyun verilerini güncelle
      setGame(gameData);
      console.log("Oyun verileri güncellendi:", gameData);

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

  // Oyun sonucunu göster
  const showGameResultPopup = (gameData) => {
    const isPlayer1 = auth.currentUser?.uid === gameData.player1.id;
    const player1Won = gameData.player1.score > gameData.player2.score;
    const player2Won = gameData.player2.score > gameData.player1.score;
    const isDraw = gameData.player1.score === gameData.player2.score;

    let title = "Oyun Bitti";
    let message = "";

    // Oyunun bitme nedenine göre mesaj oluştur
    if (gameData.reason === "timeout") {
      // Süre aşımı durumunda, kimin süresinin dolduğunu göster
      const timedOutPlayerName =
        gameData.timedOutPlayer === auth.currentUser?.uid
          ? "Sizin"
          : isPlayer1
          ? gameData.player2.username
          : gameData.player1.username;

      message = `${timedOutPlayerName} süreniz doldu! `;
    } else if (gameData.reason === "surrender") {
      // Teslim olma durumunda, kimin teslim olduğunu göster
      const surrenderedPlayer =
        gameData.reason === auth.currentUser?.uid
          ? "Siz teslim oldunuz"
          : `${
              isPlayer1 ? gameData.player2.username : gameData.player1.username
            } teslim oldu`;

      message = surrenderedPlayer + "! ";
    } else if (gameData.reason === "pass") {
      message = "Üst üste pas geçildiği için oyun sona erdi! ";
    } else {
      message = "Oyun normal şekilde tamamlandı";
    }

    // Kazanan durumu ekle
    if (isDraw) {
      message += "Oyun berabere bitti!";
    } else if ((isPlayer1 && player1Won) || (!isPlayer1 && player2Won)) {
      message += "Tebrikler, oyunu kazandınız!";
    } else {
      message += "Üzgünüm, oyunu kaybettiniz.";
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
  const handleRackTileSelect = (index) => {
    if (!isUserTurn()) {
      showTemporaryMessage("Şu anda sıra sizde değil!");
      return;
    }

    // Seçili rafları güncelle
    const newSelectedIndices = [...selectedRackIndices];
    const indexPos = newSelectedIndices.indexOf(index);

    if (indexPos !== -1) {
      // Eğer bu raf zaten seçiliyse, seçimi kaldır
      newSelectedIndices.splice(indexPos, 1);
      setSelectedRackIndices(newSelectedIndices);
      showTemporaryMessage("Harf seçimi kaldırıldı");
    } else {
      // Yeni bir raf seçimi yap
      // Tek seferde sadece 1 harf seçilebilir
      setSelectedRackIndices([index]);
      showTemporaryMessage("Şimdi tahtada bir hücre seçin");

      // Debug için log
      const userRack = getUserRack();
      if (userRack && index >= 0 && index < userRack.length) {
        const letter = userRack[index];
        console.log(
          `Seçilen harf: ${
            typeof letter === "object" ? letter.letter : letter
          }, indeks: ${index}`
        );
      }
    }
  };

  // Hamleyi onayla ve sunucuya gönder
  const confirmMove = async () => {
    if (!isUserTurn()) {
      showTemporaryMessage("Şu anda sıra sizde değil!");
      return;
    }

    if (!wordValid) {
      Alert.alert("Uyarı", "Geçerli bir kelime oluşturun!");
      return;
    }

    try {
      setConfirmingAction(true);

      // Kelimeyi yerleştir
      const result = await placeWord(gameId, selectedBoardCells);

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

  // Hücre seçimi
  const handleCellPress = (row, col) => {
    console.log(`handleCellPress çağrıldı - Satır: ${row}, Sütun: ${col}`);

    // Oyun kontrolü
    if (!game || !game.board) {
      console.error("Oyun veya tahta tanımlı değil!");
      return;
    }

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

    // Seçilen raf indeksini al
    const rackIndex = selectedRackIndices[0];

    // Hücre var mı kontrol et (kritik güvenlik kontrolü)
    if (!game.board[row] || game.board[row][col] === undefined) {
      console.error(`Geçersiz hücre koordinatları: (${row}, ${col})`);
      return;
    }

    // Hücre dolu mu kontrol et
    if (game.board[row][col] && game.board[row][col].letter) {
      showTemporaryMessage("Bu hücre zaten dolu!");
      return;
    }

    // İlk yerleştirme mi (merkez yıldız kontrolü)
    // İlk hamle mutlaka merkez (7,7) hücresini içermelidir
    if (
      (game.firstMove || game.centerRequired) &&
      selectedBoardCells.length === 0
    ) {
      if (row !== 7 || col !== 7) {
        showTemporaryMessage("İlk harf ortadaki yıldıza yerleştirilmelidir!");
        return;
      }
    } else if (
      selectedBoardCells.length === 0 &&
      !(game.firstMove || game.centerRequired)
    ) {
      // İlk hamle değilse ve bu ilk seçilen hücreyse, mevcut bir harfe bitişik mi kontrol et
      const isAdjacent = checkIfAdjacentToExistingLetter(row, col, game.board);
      if (!isAdjacent) {
        showTemporaryMessage("Harf mevcut bir kelimeye bitişik olmalıdır!");
        return;
      }
    } else if (selectedBoardCells.length >= 1) {
      // Bir sonraki harf, mevcut seçili harflerle aynı doğrultuda olmalı
      const isValidPlacement = checkValidPlacement(row, col);
      if (!isValidPlacement) {
        showTemporaryMessage("Harfler aynı doğrultuda yerleştirilmelidir!");
        return;
      }
    }

    // Yeni seçili hücre oluştur
    const newCell = { row, col, rackIndex };

    // Hücreyi seçili hücrelere ekle
    const newSelectedCells = [...selectedBoardCells, newCell];
    setSelectedBoardCells(newSelectedCells);

    // Seçilen harfi raf seçiminden kaldır
    setSelectedRackIndices([]);

    // Yerleştirme yönünü belirle
    if (newSelectedCells.length === 2) {
      determineDirection(newSelectedCells);
    }

    // Oluşan kelimeyi kontrol et
    checkWord(newSelectedCells);

    console.log("Harf yerleştirildi:", { row, col, rackIndex });
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
        // Komşu hücre var mı ve içinde harf var mı?
        if (
          board[newRow] &&
          board[newRow][newCol] &&
          board[newRow][newCol].letter
        ) {
          return true;
        }
      }
    }

    return false;
  };

  const determineDirection = (cells) => {
    if (cells.length < 2) return;

    const [cell1, cell2] = cells;

    if (cell1.row === cell2.row) {
      setPlacementDirection("horizontal");
    } else if (cell1.col === cell2.col) {
      setPlacementDirection("vertical");
    }
  };

  // Geçerli yerleştirme kontrolü
  const checkValidPlacement = (row, col) => {
    if (selectedBoardCells.length === 0) {
      return true; // İlk harf için geçerli
    }

    // Son yerleştirilen hücre ile yeni hücre arasındaki yön kontrolü
    const firstCell = selectedBoardCells[0];

    // Yatay yerleştirme
    if (firstCell.row === row) {
      // Eğer yön belirlenmişse ve dikey ise, geçersiz
      if (placementDirection === "vertical") {
        return false;
      }

      // Sütunlar sıralı olmalı (arada boşluk olmamalı)
      const cols = selectedBoardCells.map((cell) => cell.col);
      cols.push(col); // Yeni sütunu ekle
      cols.sort((a, b) => a - b); // Sırala

      // Ardışık olup olmadığını kontrol et
      for (let i = 1; i < cols.length; i++) {
        if (cols[i] - cols[i - 1] !== 1) {
          return false;
        }
      }

      return true;
    }
    // Dikey yerleştirme
    else if (firstCell.col === col) {
      // Eğer yön belirlenmişse ve yatay ise, geçersiz
      if (placementDirection === "horizontal") {
        return false;
      }

      // Satırlar sıralı olmalı (arada boşluk olmamalı)
      const rows = selectedBoardCells.map((cell) => cell.row);
      rows.push(row); // Yeni satırı ekle
      rows.sort((a, b) => a - b); // Sırala

      // Ardışık olup olmadığını kontrol et
      for (let i = 1; i < rows.length; i++) {
        if (rows[i] - rows[i - 1] !== 1) {
          return false;
        }
      }

      return true;
    }

    // Ne yatay ne dikey değil
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

  // Puanları hesapla (örnek bir fonksiyon - gerçek puanlama mantığı farklı olabilir)
  const calculateWordPoints = (cells) => {
    // Bu sadece basit bir örnek
    return cells.length * 10;
  };

  // Hamleyi iptal et
  const cancelMove = () => {
    resetSelections();
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
  };

  // Pas geç
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
          getUserRack={() => getUserRack()} // Fonksiyon referansını doğru şekilde geçir
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
});
