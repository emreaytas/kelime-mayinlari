// src/services/gameService.js
import { doc, getDoc, updateDoc, setDoc, Timestamp } from "firebase/firestore";
import { auth, firestore, database } from "../firebase/config";
import {
  ref,
  set,
  update,
  push,
  get,
  onValue,
  remove,
} from "firebase/database";
import {
  createGameBoard,
  generateLetterPool,
  distributeLetters,
  validateWord,
  letterValues,
} from "../utils/GameBoardUtils";
import { setupInitialGame } from "../utils/InitialsWordList";
import { updateGameStatistics, saveGameRecord } from "./userStatsService";
import { cleanFirebaseData } from "../utils/firebaseUtils"; // Adjust the path as needed
import wordList from "../assets/wordList";
// Hamle süresini kontrol et ve süresi dolanları işaretle
export const checkGameTimers = async () => {
  try {
    // Aktif oyunları getir
    const gamesRef = ref(database, "games");
    const snapshot = await get(gamesRef);
    if (!snapshot.exists()) {
      return { processed: 0 };
    }
    const now = Date.now();
    let processedCount = 0;

    // Her oyun için kontrol et
    const promises = [];
    snapshot.forEach((childSnapshot) => {
      const gameId = childSnapshot.key;
      const gameData = childSnapshot.val();

      // Sadece aktif oyunları kontrol et
      if (gameData.status !== "active") {
        return;
      }

      // Son hamleden bu yana geçen süre
      const timeSinceLastMove = now - gameData.lastMoveTime;

      // Oyun tipi bazında süre sınırlarını belirle (milisaniye cinsinden)
      let timeLimit;
      switch (gameData.gameType) {
        case "2min":
          timeLimit = 2 * 60 * 1000; // 2 dakika
          break;
        case "5min":
          timeLimit = 5 * 60 * 1000; // 5 dakika
          break;
        case "12hour":
          timeLimit = 12 * 60 * 60 * 1000; // 12 saat
          break;
        case "24hour":
          timeLimit = 24 * 60 * 60 * 1000; // 24 saat
          break;
        default:
          // Varsayılan olarak 24 saat
          timeLimit = 24 * 60 * 60 * 1000;
      }

      // Süre aşıldı mı?
      if (timeSinceLastMove > timeLimit) {
        // İşlemi promises dizisine ekle
        const processGame = async () => {
          try {
            // Oyunu tamamlandı olarak işaretle
            const currentTurnPlayer = gameData.turnPlayer;
            const player1Id = gameData.player1.id;
            const player2Id = gameData.player2.id;

            // Süresi geçen oyuncunun karşı tarafını kazanan olarak işaretle
            const winnerId =
              currentTurnPlayer === player1Id ? player2Id : player1Id;

            // Oyuncuların mevcut puanlarını al
            let player1Score = gameData.player1.score || 0;
            let player2Score = gameData.player2.score || 0;

            // Kazanan oyuncuya bonus puan ver
            if (winnerId === player1Id) {
              player1Score += 25; // Süre aşımı bonusu
            } else {
              player2Score += 25; // Süre aşımı bonusu
            }

            // Kazananları belirle
            const player1Win = winnerId === player1Id;
            const player2Win = winnerId === player2Id;
            const isDraw = false; // Süre aşımında beraberlik olmaz

            // Oyunu güncelle
            // Nokta içeren yollar yerine iç içe objeler kullan
            const updates = {
              status: "completed",
              completedAt: now,
              reason: "timeout",
              timedOutPlayer: currentTurnPlayer,
              winner: winnerId,
              player1: {
                ...gameData.player1,
                score: player1Score,
              },
              player2: {
                ...gameData.player2,
                score: player2Score,
              },
            };

            const updatedGameData = {
              ...gameData,
              ...updates,
            };

            // Firebase'de güncelle
            await update(ref(database, `games/${gameId}`), updates);

            // Tamamlanan oyun olarak kopyala
            await set(
              ref(database, `completedGames/${gameId}`),
              updatedGameData
            );

            // Firestore'a oyun kaydını ve istatistikleri ekle
            try {
              // Oyun kaydını sakla
              await saveGameRecord(gameId, updatedGameData);

              // Her oyuncu için istatistikleri güncelle
              const player1Result = player1Win ? "win" : "loss";
              const player2Result = player2Win ? "win" : "loss";

              await updateGameStatistics(
                player1Id,
                gameId,
                player1Result,
                player1Score
              );
              await updateGameStatistics(
                player2Id,
                gameId,
                player2Result,
                player2Score
              );
            } catch (error) {
              console.error("Error updating game statistics:", error);
            }

            processedCount++;
          } catch (error) {
            console.error(`Error processing game ${gameId}:`, error);
          }
        };

        promises.push(processGame());
      }
    });

    // Tüm işlemlerin tamamlanmasını bekle
    await Promise.all(promises);

    return { processed: processedCount };
  } catch (error) {
    console.error("Timer check error:", error);
    return { error: error.message };
  }
};

export const saveGameToFirestore = async (gameId, gameData) => {
  try {
    // Create a deep copy of the game data
    const cleanGameData = JSON.parse(JSON.stringify(gameData));

    // Clean the data (convert nested arrays to objects)
    cleanFirebaseData(cleanGameData);

    // Now you can safely save to Firestore
    await setDoc(doc(firestore, "games", gameId), cleanGameData);

    return { success: true };
  } catch (error) {
    console.error(`Error saving game ${gameId} to Firestore:`, error);
    throw error;
  }
};

// Eşleşme sistemine katıl
export const joinMatchmaking = async (gameType) => {
  try {
    if (!auth.currentUser) {
      throw new Error("Giriş yapılmamış");
    }

    const userId = auth.currentUser.uid;
    const username =
      auth.currentUser.displayName || auth.currentUser.email || "Kullanıcı";

    console.log("Joining matchmaking:", { gameType, userId, username });

    // Matchmaking referansı
    const matchmakingRef = ref(database, `matchmaking/${gameType}`);

    // Bekleyen oyuncuları kontrol et
    const snapshot = await get(matchmakingRef);
    const waitingPlayers = snapshot.val() || {};

    console.log("Waiting players:", waitingPlayers);

    // Kendisi hariç bekleyen oyuncuları bul
    const otherPlayerIds = Object.keys(waitingPlayers).filter(
      (id) => id !== userId
    );

    if (otherPlayerIds.length > 0) {
      // Eşleşme bulundu
      const opponentId = otherPlayerIds[0];
      const opponentData = waitingPlayers[opponentId];

      console.log("Match found with opponent:", opponentId);

      // Rakibi bekleme listesinden çıkar
      await remove(ref(database, `matchmaking/${gameType}/${opponentId}`));

      // Yeni oyun oluştur
      const game = await createNewGame(
        userId,
        username,
        opponentId,
        opponentData.username,
        gameType
      );

      console.log("Game created:", game.gameId);

      return {
        status: "matched",
        gameId: game.gameId,
      };
    } else {
      // Eşleşme bulunamadı - bekleme listesine ekle
      await set(ref(database, `matchmaking/${gameType}/${userId}`), {
        username,
        timestamp: Date.now(),
      });

      console.log("Added to matchmaking queue");

      return { status: "waiting" };
    }
  } catch (error) {
    console.error("Matchmaking error:", error);
    throw error;
  }
};

// Eşleşmeyi iptal et
export const cancelMatchmaking = async (gameType) => {
  try {
    if (!auth.currentUser) {
      throw new Error("Giriş yapılmamış");
    }

    const userId = auth.currentUser.uid;

    // Bekleme listesinden çıkar
    await remove(ref(database, `matchmaking/${gameType}/${userId}`));

    return { status: "cancelled" };
  } catch (error) {
    console.error("Matchmaking cancellation error:", error);
    throw error;
  }
};

// Yeni oyun oluştur
export const createNewGame = async (
  player1Id,
  player1Username,
  player2Id,
  player2Username,
  gameType
) => {
  try {
    // Oyun tahtasını oluştur
    const gameBoard = createGameBoard();

    // Harf havuzu oluştur
    const letterPool = generateLetterPool();

    // Harfleri dağıt
    const { player1Rack, player2Rack, remainingPool } =
      distributeLetters(letterPool);

    // Rastgele ilk oyuncu seç
    const firstPlayer = Math.random() < 0.5 ? player1Id : player2Id;

    // Oyun referansı oluştur
    const newGameRef = push(ref(database, "games"));

    // Tahta verisini Firebase formatına çevir
    const formattedBoard = boardToFirebaseFormat(gameBoard);

    // Oyun verisi
    const initialGameData = {
      player1: {
        id: player1Id,
        username: player1Username,
        score: 0,
      },
      player2: {
        id: player2Id,
        username: player2Username,
        score: 0,
      },
      board: formattedBoard, // Firebase formatına dönüştürülmüş tahta
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
      firstMove: true,
      centerRequired: true,
    };

    // Rastgele başlangıç kelimesini oluştur ve yerleştir
    const gameWithInitialWord = setupInitialGame(initialGameData);

    // Firebase'e oyun verisini kaydet
    await set(newGameRef, gameWithInitialWord);

    return { gameId: newGameRef.key, ...gameWithInitialWord };
  } catch (error) {
    console.error("Game creation error:", error);
    throw error;
  }
};

// Oyun verilerini al
export const getGameData = async (gameId) => {
  try {
    const gameRef = ref(database, `games/${gameId}`);
    const snapshot = await get(gameRef);

    if (!snapshot.exists()) {
      throw new Error("Oyun bulunamadı");
    }

    return {
      id: gameId,
      ...snapshot.val(),
    };
  } catch (error) {
    console.error("Get game data error:", error);
    throw error;
  }
};

// Oyun verilerini dinle
export const listenToGameChanges = (gameId, callback) => {
  try {
    const gameRef = ref(database, `games/${gameId}`);

    const unsubscribe = onValue(
      gameRef,
      (snapshot) => {
        if (snapshot.exists()) {
          callback({
            id: gameId,
            ...snapshot.val(),
          });
        } else {
          callback(null);
        }
      },
      (error) => {
        console.error("Game listening error:", error);
        callback(null, error);
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error("Listen to game changes error:", error);
    throw error;
  }
};

export const placeWord = async (gameId, placedCells) => {
  try {
    if (!auth.currentUser) {
      throw new Error("Giriş yapılmamış");
    }

    const userId = auth.currentUser.uid;
    const game = await getGameData(gameId);

    if (game.turnPlayer !== userId) {
      throw new Error("Sıra sizde değil");
    }

    const isPlayer1 = game.player1.id === userId;
    const userRack = isPlayer1 ? game.player1Rack : game.player2Rack; // Bu zaten var!

    // Tahta normalizasyonu
    let normalizedBoard = [];
    for (let i = 0; i < 15; i++) {
      normalizedBoard[i] = [];
      for (let j = 0; j < 15; j++) {
        if (Array.isArray(game.board) && game.board[i] && game.board[i][j]) {
          normalizedBoard[i][j] = game.board[i][j];
        } else if (
          typeof game.board === "object" &&
          game.board[i] &&
          (game.board[i][j] || game.board[i][j.toString()])
        ) {
          normalizedBoard[i][j] =
            game.board[i][j] || game.board[i][j.toString()];
        } else {
          normalizedBoard[i][j] = {
            letter: null,
            type: getCellType(i, j),
            special: null,
            points: null,
          };
        }
      }
    }

    // Ana kelimeyi oluştur - getUserRack() yerine userRack kullan
    const mainWord = getMainWordFormed(placedCells, normalizedBoard, userRack);
    const mainWordToValidate = mainWord.replace(/\*/g, "A").toLowerCase();

    if (mainWord.length >= 2 && !wordList.includes(mainWordToValidate)) {
      throw new Error("Geçersiz kelime: " + mainWord);
    }

    // Çapraz kelimeleri kontrol et - getUserRack() yerine userRack kullan
    const crossWords = getCrossWordsFormed(
      placedCells,
      normalizedBoard,
      userRack
    );

    for (const crossWord of crossWords) {
      const crossWordToValidate = crossWord.replace(/\*/g, "A").toLowerCase();
      if (crossWord.length >= 2 && !wordList.includes(crossWordToValidate)) {
        throw new Error("Geçersiz çapraz kelime: " + crossWord);
      }
    }

    // Kelimeler onaylandı, harfleri yerleştir
    const boardCopy = JSON.parse(JSON.stringify(normalizedBoard));
    placedCells.forEach((cell) => {
      const { row, col, rackIndex } = cell;
      const letterObj = userRack[rackIndex];
      const letter =
        typeof letterObj === "object" ? letterObj.letter : letterObj;
      const points = typeof letterObj === "object" ? letterObj.points : 0;

      boardCopy[row][col] = {
        letter: letter,
        type: boardCopy[row][col].type || null,
        special: null,
        points: points,
      };
    });

    // Puanları hesapla - getUserRack() yerine userRack kullan
    let points = calculateWordPoints(placedCells, boardCopy, userRack);

    // Mayın/ödül kontrolü
    const effects = {};
    const rewards = [];

    // Her hücre için mayın/ödül kontrolü
    placedCells.forEach((cell) => {
      const { row, col } = cell;
      const special = normalizedBoard[row][col].special;

      if (special) {
        // Mayın etkileri
        if (special === "PuanBolunmesi") {
          effects.pointDivision = true;
          points = Math.round(points * 0.3);
        } else if (special === "PuanTransferi") {
          effects.pointTransfer = true;
          const opponentPoints = points;
          points = -points;
          if (isPlayer1) {
            game.player2.score = (game.player2.score || 0) + opponentPoints;
          } else {
            game.player1.score = (game.player1.score || 0) + opponentPoints;
          }
        } else if (special === "HarfKaybi") {
          effects.letterLoss = true;
        } else if (special === "EkstraHamleEngeli") {
          effects.moveBlockade = true;
          points = calculateRawPoints(placedCells, userRack);
        } else if (special === "KelimeIptali") {
          effects.wordCancellation = true;
          points = 0;
        }

        // Ödül etkileri
        if (
          special === "BolgeYasagi" ||
          special === "HarfYasagi" ||
          special === "EkstraHamleJokeri"
        ) {
          rewards.push(special);
        }
      }
    });

    // Kullanılan harflerin yerine yenilerini al
    let userRackCopy = [...userRack];
    const usedIndices = placedCells
      .map((cell) => cell.rackIndex)
      .sort((a, b) => b - a);
    usedIndices.forEach((index) => {
      userRackCopy.splice(index, 1);
    });

    // Harf Kaybı mayını
    if (effects.letterLoss) {
      game.letterPool = [...game.letterPool, ...userRackCopy];
      userRackCopy = [];
    }

    // Yeni harfleri çek
    const neededLetterCount = Math.min(
      7 - userRackCopy.length,
      game.letterPool.length
    );
    const newLetters = game.letterPool.slice(0, neededLetterCount);
    const updatedLetterPool = game.letterPool.slice(neededLetterCount);
    userRackCopy = [...userRackCopy, ...newLetters];

    // Ödülleri güncelle
    let player1Rewards = Array.isArray(game.player1Rewards)
      ? [...game.player1Rewards]
      : [];
    let player2Rewards = Array.isArray(game.player2Rewards)
      ? [...game.player2Rewards]
      : [];

    if (rewards.length > 0) {
      if (isPlayer1) {
        player1Rewards = [...player1Rewards, ...rewards];
      } else {
        player2Rewards = [...player2Rewards, ...rewards];
      }
    }

    // Tahtayı Firebase formatına dönüştür
    const firebaseBoard = boardToFirebaseFormat(boardCopy);

    // Sıradaki oyuncu
    const nextPlayer =
      game.player1.id === userId ? game.player2.id : game.player1.id;

    // Oyun verilerini güncelle
    const updates = {
      board: firebaseBoard,
      letterPool: updatedLetterPool,
      lastMoveTime: Date.now(),
      turnPlayer: nextPlayer,
      firstMove: false,
      centerRequired: false,
      consecutivePasses: 0,
    };

    // Puanları güncelle
    if (isPlayer1) {
      updates.player1 = {
        ...game.player1,
        score: (game.player1.score || 0) + points,
      };
      updates.player1Rack = userRackCopy;
      updates.player1Rewards = player1Rewards;
    } else {
      updates.player2 = {
        ...game.player2,
        score: (game.player2.score || 0) + points,
      };
      updates.player2Rack = userRackCopy;
      updates.player2Rewards = player2Rewards;
    }

    // Puan transferi
    if (effects.pointTransfer) {
      if (isPlayer1) {
        updates.player2 = {
          ...game.player2,
          score: (game.player2.score || 0) + Math.abs(points),
        };
      } else {
        updates.player1 = {
          ...game.player1,
          score: (game.player1.score || 0) + Math.abs(points),
        };
      }
    }

    // Oyun bitişi kontrolü
    if (userRackCopy.length === 0 && updatedLetterPool.length === 0) {
      updates.status = "completed";
      updates.completedAt = Date.now();
      updates.reason = "allLettersUsed";
      updates.winner = userId;
    }

    // Firebase güncelle
    await update(ref(database, `games/${gameId}`), updates);

    // Sonucu döndür
    return {
      success: true,
      points: points,
      effects: effects,
      rewards: rewards,
      nextPlayer: nextPlayer,
      gameEnded: updates.status === "completed",
    };
  } catch (error) {
    console.error("Place word error:", error);
    throw error;
  }
};

// Helper functions to add to gameService.js

const createCompleteWord = (placedCells, board, rack) => {
  if (!board || placedCells.length === 0) return "";

  let direction = "horizontal";
  if (placedCells.length > 1) {
    direction =
      placedCells[0].row === placedCells[1].row ? "horizontal" : "vertical";
  }

  const firstCell = placedCells[0];
  let startRow = firstCell.row;
  let startCol = firstCell.col;
  let endRow = firstCell.row;
  let endCol = firstCell.col;

  placedCells.forEach((cell) => {
    startRow = Math.min(startRow, cell.row);
    startCol = Math.min(startCol, cell.col);
    endRow = Math.max(endRow, cell.row);
    endCol = Math.max(endCol, cell.col);
  });

  if (direction === "horizontal") {
    while (startCol > 0 && board[startRow][startCol - 1]?.letter) {
      startCol--;
    }
    while (endCol < 14 && board[startRow][endCol + 1]?.letter) {
      endCol++;
    }
  } else {
    while (startRow > 0 && board[startRow - 1][startCol]?.letter) {
      startRow--;
    }
    while (endRow < 14 && board[endRow + 1][startCol]?.letter) {
      endRow++;
    }
  }

  let word = "";

  if (direction === "horizontal") {
    for (let col = startCol; col <= endCol; col++) {
      const cell = board[startRow][col];

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
  } else {
    for (let row = startRow; row <= endRow; row++) {
      const cell = board[row][startCol];

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
  }

  return word;
};

export const calculateRawPoints = (placedCells, rack) => {
  let totalPoints = 0;

  placedCells.forEach((cell) => {
    const { rackIndex } = cell;

    // Harfi oyuncunun rafından al
    const letterObj = rack[rackIndex];
    const letter = typeof letterObj === "object" ? letterObj.letter : letterObj;

    // Harfin puan değerini al (çarpanlar yok)
    const letterPoint = letter === "JOKER" ? 0 : letterValues[letter] || 0;
    totalPoints += letterPoint;
  });

  return totalPoints;
};

export const passTurn = async (gameId) => {
  try {
    if (!auth.currentUser) {
      throw new Error("Giriş yapılmamış");
    }

    const userId = auth.currentUser.uid;

    // Oyun verilerini al
    const game = await getGameData(gameId);

    // Sıra kontrolü
    if (game.turnPlayer !== userId) {
      throw new Error("Sıra sizde değil");
    }

    // Ardışık pas geçme sayacını artır
    const consecutivePasses = (game.consecutivePasses || 0) + 1;

    // Ardışık 2 pas geçme oyunu bitirir
    if (consecutivePasses >= 2) {
      // Oyunu bitir
      return await endGame(gameId, "pass");
    }

    // Oyun verilerini güncelle
    const updates = {
      turnPlayer:
        game.player1.id === userId ? game.player2.id : game.player1.id,
      lastMoveTime: Date.now(),
      consecutivePasses,
    };

    // Firebase güncelle
    await update(ref(database, `games/${gameId}`), updates);

    return {
      success: true,
      nextPlayer: updates.turnPlayer,
      consecutivePasses,
    };
  } catch (error) {
    console.error("Pass turn error:", error);
    throw error;
  }
};

export const surrender = async (gameId) => {
  try {
    if (!auth.currentUser) {
      throw new Error("Giriş yapılmamış");
    }

    // Oyunu bitir (teslim olma nedeniyle)
    return await endGame(gameId, "surrender");
  } catch (error) {
    console.error("Surrender error:", error);
    throw error;
  }
};

// Firebase için veri temizleme
function cleanGameDataForFirebase(gameData) {
  if (!gameData || typeof gameData !== "object") return;

  // İç içe dizi içeren önemli alanlar
  const arrayFields = ["player1Rewards", "player2Rewards"];

  // Bu alanların her biri için kontrol yap
  arrayFields.forEach((field) => {
    if (Array.isArray(gameData[field])) {
      // Dizinin her bir elemanını kontrol et - iç içe dizi varsa nesneye dönüştür
      if (gameData[field].some((item) => Array.isArray(item))) {
        // İç içe dizi olan alanları nesne haritasına dönüştür
        const convertedData = {};
        gameData[field].forEach((item, index) => {
          convertedData[`item_${index}`] = item;
        });
        gameData[field] = convertedData;
      }
    }
  });

  // Tüm alt nesneleri ve dizileri de kontrol et
  Object.entries(gameData).forEach(([key, value]) => {
    // Null değil ve nesne veya dizi ise içeriğini temizle
    if (value && typeof value === "object") {
      cleanGameDataForFirebase(value);
    }
  });
}

const boardToFirebaseFormat = (board) => {
  const firebaseBoard = [];

  for (let i = 0; i < 15; i++) {
    const rowObject = {};

    for (let j = 0; j < 15; j++) {
      const cell = board[i][j];

      // Hücre varsa ve içeriği varsa kaydet
      if (cell) {
        rowObject[j] = {
          letter: cell.letter || null,
          type: cell.type || null,
          special: cell.special || null,
          points: cell.points || null,
        };
      }
    }

    firebaseBoard.push(rowObject);
  }

  return firebaseBoard;
};
// Oyunu bitir, kalıcı depolamaya aktar
export const finishAndStoreGame = async (gameId, gameData) => {
  try {
    console.log(
      `Oyun ${gameId} tamamlanıyor ve kalıcı depolamaya aktarılıyor...`
    );

    // Veri güvenliği için temizleme
    const cleanGameData = JSON.parse(JSON.stringify(gameData));

    // Clean the data for Firebase
    cleanFirebaseData(cleanGameData);

    // 1. Firestore'a kaydedelim - saveGameRecord fonksiyonunu kullanıyoruz
    await saveGameRecord(gameId, cleanGameData);
    console.log(`Oyun ${gameId} Firestore'a başarıyla kaydedildi.`);

    // 2. completedGames koleksiyonuna taşıyalım
    await set(ref(database, `completedGames/${gameId}`), cleanGameData);
    console.log(`Oyun ${gameId} completedGames koleksiyonuna eklendi.`);

    // 3. İstatistikleri güncelleyelim
    const player1Id = cleanGameData.player1.id;
    const player2Id = cleanGameData.player2.id;
    const player1Score = cleanGameData.player1.score || 0;
    const player2Score = cleanGameData.player2.score || 0;

    // Kazananı belirle
    const player1Win = player1Score > player2Score;
    const player2Win = player2Score > player1Score;
    const isDraw = player1Score === player2Score;

    // İstatistikleri güncelle
    const player1Result = player1Win ? "win" : isDraw ? "tie" : "loss";
    const player2Result = player2Win ? "win" : isDraw ? "tie" : "loss";

    await updateGameStatistics(player1Id, gameId, player1Result, player1Score);
    await updateGameStatistics(player2Id, gameId, player2Result, player2Score);
    console.log(`Oyun ${gameId} için istatistikler güncellendi.`);

    return {
      success: true,
      gameId,
      status: "completed",
    };
  } catch (error) {
    console.error("Oyun tamamlama hatası:", error);
    throw error;
  }
};

export const endGame = async (gameId, reason) => {
  try {
    const game = await getGameData(gameId);

    if (game.status === "completed") {
      return { success: true, alreadyCompleted: true };
    }

    const userId = auth.currentUser ? auth.currentUser.uid : null;
    const isPlayer1 = userId === game.player1.id;

    // Son puanları hesapla
    let player1Score = game.player1.score || 0;
    let player2Score = game.player2.score || 0;

    // Kazananı belirle
    let winnerId = null;
    let isDraw = false;

    // Teslim olma durumu
    if (reason === "surrender") {
      if (userId === game.player1.id) {
        // Oyuncu 1 teslim oldu
        player1Score = 0; // Teslim olanın puanı sıfırlanır
        player2Score += 50; // Rakibine bonus puan
        winnerId = game.player2.id; // Oyuncu 2 kazandı
      } else if (userId === game.player2.id) {
        // Oyuncu 2 teslim oldu
        player2Score = 0; // Teslim olanın puanı sıfırlanır
        player1Score += 50; // Rakibine bonus puan
        winnerId = game.player1.id; // Oyuncu 1 kazandı
      }
      // Teslim olma durumunda beraberlik olamaz
      isDraw = false;
    } else {
      // Normal oyun sonu veya pas durumu
      if (player1Score > player2Score) {
        winnerId = game.player1.id;
      } else if (player2Score > player1Score) {
        winnerId = game.player2.id;
      } else {
        isDraw = true;
      }
    }

    // Oyunu güncelle
    const updatedGameData = {
      ...game,
      status: "completed",
      completedAt: Date.now(),
      reason,
      player1: {
        ...game.player1,
        score: player1Score,
      },
      player2: {
        ...game.player2,
        score: player2Score,
      },
      winner: winnerId,
      isDraw: isDraw,
      surrenderedBy: reason === "surrender" ? userId : null,
    };

    // Aktif oyunu tamamlandı olarak güncelle
    await update(ref(database, `games/${gameId}`), {
      status: "completed",
      completedAt: updatedGameData.completedAt,
      reason: updatedGameData.reason,
      winner: updatedGameData.winner,
      isDraw: updatedGameData.isDraw,
      surrenderedBy: updatedGameData.surrenderedBy,
      player1: updatedGameData.player1,
      player2: updatedGameData.player2,
    });

    // Tamamlanmış oyunu kaydet
    await finishAndStoreGame(gameId, updatedGameData);

    return {
      success: true,
      player1Score,
      player2Score,
      winner: winnerId,
      isDraw: isDraw,
    };
  } catch (error) {
    console.error("End game error:", error);
    throw error;
  }
};
// Ödül kullan
export const useReward = async (gameId, rewardType) => {
  try {
    if (!auth.currentUser) {
      throw new Error("Giriş yapılmamış");
    }

    const userId = auth.currentUser.uid;

    // Oyun verilerini al
    const game = await getGameData(gameId);

    // Sıra kontrolü
    if (game.turnPlayer !== userId) {
      throw new Error("Sıra sizde değil");
    }

    // Kullanıcı bilgisi
    const isPlayer1 = game.player1.id === userId;
    const userRewards = isPlayer1
      ? game.player1Rewards || []
      : game.player2Rewards || [];

    // Ödül var mı kontrolü
    const rewardIndex = userRewards.indexOf(rewardType);
    if (rewardIndex === -1) {
      throw new Error("Bu ödüle sahip değilsiniz");
    }

    // Ödülü çıkar
    const updatedRewards = [...userRewards];
    updatedRewards.splice(rewardIndex, 1);

    const updates = {};

    // Güncellenmiş ödül listesi
    if (isPlayer1) {
      updates.player1Rewards = updatedRewards;
    } else {
      updates.player2Rewards = updatedRewards;
    }

    // Ödül türüne göre etki
    switch (rewardType) {
      case "BolgeYasagi": {
        // Rastgele taraf (sol/sağ)
        const side = Math.random() < 0.5 ? "left" : "right";
        updates.restrictedArea = {
          player: isPlayer1 ? game.player2.id : game.player1.id,
          side,
          until: Date.now() + 2 * 60 * 60 * 1000, // 2 saat
        };
        break;
      }
      case "HarfYasagi": {
        // Rakibin 2 harfini dondur
        const opponentRack = isPlayer1 ? game.player2Rack : game.player1Rack;

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
            player: isPlayer1 ? game.player2.id : game.player1.id,
            indices: freezeIndices,
            until: Date.now() + 60 * 60 * 1000, // 1 saat
          };
        }
        break;
      }
      case "EkstraHamleJokeri": {
        updates.extraMove = {
          player: userId,
          until: Date.now() + 15 * 60 * 1000, // 15 dakika
        };
        break;
      }
    }

    // Firebase güncelle
    await update(ref(database, `games/${gameId}`), updates);

    return { success: true, rewardType };
  } catch (error) {
    console.error("Use reward error:", error);
    throw error;
  }
};

// Kullanıcının aktif oyunlarını getir
export const getUserActiveGames = async () => {
  try {
    if (!auth.currentUser) {
      throw new Error("Giriş yapılmamış");
    }

    const userId = auth.currentUser.uid;

    // Tüm aktif oyunları al
    const gamesRef = ref(database, "games");
    const snapshot = await get(gamesRef);

    if (!snapshot.exists()) {
      return [];
    }

    // Kullanıcının oyunlarını filtrele
    const games = [];

    snapshot.forEach((childSnapshot) => {
      const gameData = childSnapshot.val();

      if (
        gameData.status === "active" &&
        (gameData.player1.id === userId || gameData.player2.id === userId)
      ) {
        games.push({
          id: childSnapshot.key,
          ...gameData,
        });
      }
    });

    return games;
  } catch (error) {
    console.error("Active games error:", error);
    throw error;
  }
};

// Kullanıcının tamamlanmış oyunlarını getir
export const getUserCompletedGames = async () => {
  try {
    if (!auth.currentUser) {
      throw new Error("Giriş yapılmamış");
    }

    const userId = auth.currentUser.uid;

    // Tüm tamamlanmış oyunları al
    const gamesRef = ref(database, "completedGames");
    const snapshot = await get(gamesRef);

    if (!snapshot.exists()) {
      return [];
    }

    // Kullanıcının oyunlarını filtrele
    const games = [];

    snapshot.forEach((childSnapshot) => {
      const gameData = childSnapshot.val();

      if (gameData.player1.id === userId || gameData.player2.id === userId) {
        games.push({
          id: childSnapshot.key,
          ...gameData,
        });
      }
    });

    // Tamamlanma tarihine göre sırala (son tamamlanan en üstte)
    games.sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

    return games;
  } catch (error) {
    console.error("Completed games error:", error);
    throw error;
  }
};

// Kelime puanlarını hesapla
export const calculateWordPoints = (placedCells, board, rack) => {
  if (!board || !placedCells.length) return 0;

  let totalPoints = 0;
  let wordMultiplier = 1;

  // Yerleştirme yönünü belirle
  const direction = getPlacementDirection(placedCells);

  // Ana kelimeyi oluşturan tüm hücreleri al
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

      // Özel hücre çarpanları (sadece yeni yerleştirilen harfler için)
      const cellType = board[cell.row][cell.col].type;

      switch (cellType) {
        case "H2":
          letterMultiplier = 2;
          break;
        case "H3":
          letterMultiplier = 3;
          break;
        case "K2":
          wordMultiplier *= 2;
          break;
        case "K3":
          wordMultiplier *= 3;
          break;
      }
    } else {
      // Tahtada zaten var olan harf
      const boardCell = board[cell.row][cell.col];
      letterPoint = boardCell.points || letterValues[boardCell.letter] || 0;
    }

    totalPoints += letterPoint * letterMultiplier;
  });

  // Kelime çarpanını uygula
  totalPoints *= wordMultiplier;

  // Çapraz kelimelerin puanlarını ekle
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

// Yardımcı fonksiyonlar
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
  }

  return wordCells;
};
const calculateCrossWordPoints = (crossWordCells, placedCell, board, rack) => {
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
// Yardımcı fonksiyonlar
const getPlacementDirection = (placedCells) => {
  if (placedCells.length < 2) return "horizontal";

  const [cell1, cell2] = placedCells;
  if (cell1.row === cell2.row) return "horizontal";
  if (cell1.col === cell2.col) return "vertical";
  if (Math.abs(cell1.row - cell2.row) === Math.abs(cell1.col - cell2.col))
    return "diagonal";
  return "horizontal";
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
      for (let col = startCol; col <= endCol; col++) {
        crossCells.push({ row: placedCell.row, col });
      }
    }
  }

  return crossCells;
};

// Hücre tipini belirleyen yardımcı fonksiyon
const getCellType = (row, col) => {
  // H2 hücreleri (harf puanı 2 katı)
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

  // H3 hücreleri (harf puanı 3 katı)
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

  // K2 hücreleri (kelime puanı 2 katı)
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

  // K3 hücreleri (kelime puanı 3 katı)
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

  // Merkez yıldız
  if (row === 7 && col === 7) {
    return "star";
  }

  // Hücre tipini kontrol et
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

  return null; // Normal hücre
};

const normalizeCompleteBoard = (boardData) => {
  console.log("Normalizing board data:", boardData);

  const normalizedBoard = [];

  for (let i = 0; i < 15; i++) {
    normalizedBoard[i] = [];
    for (let j = 0; j < 15; j++) {
      // Varsayılan boş hücre
      let cell = {
        letter: null,
        type: getCellType(i, j),
        special: null,
      };

      // Firebase verisini kontrol et
      if (boardData) {
        if (Array.isArray(boardData)) {
          // Dizi formatı
          if (boardData[i] && boardData[i][j]) {
            cell = { ...cell, ...boardData[i][j] };
          }
        } else if (typeof boardData === "object") {
          // Nesne formatı
          if (boardData[i]) {
            if (Array.isArray(boardData[i])) {
              if (boardData[i][j]) {
                cell = { ...cell, ...boardData[i][j] };
              }
            } else if (typeof boardData[i] === "object") {
              const colData = boardData[i][j] || boardData[i][j.toString()];
              if (colData) {
                cell = { ...cell, ...colData };
              }
            }
          }
        }
      }

      normalizedBoard[i][j] = cell;
    }
  }

  console.log("Normalized board:", normalizedBoard);
  return normalizedBoard;
};

const getMainWordFormed = (placedCells, board) => {
  if (placedCells.length === 0) return "";

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

  // Yerleştirilen hücreleri sırala
  const sortedCells = [...placedCells].sort((a, b) => {
    if (direction === "horizontal") {
      return a.col - b.col;
    } else if (direction === "vertical") {
      return a.row - b.row;
    } else {
      // diagonal
      return a.row + a.col - (b.row + b.col);
    }
  });

  if (direction === "horizontal") {
    const row = sortedCells[0].row;
    let startCol = sortedCells[0].col;
    let endCol = sortedCells[sortedCells.length - 1].col;

    // Sol tarafı kontrol et
    while (startCol > 0 && board[row][startCol - 1].letter) {
      startCol--;
    }

    // Sağ tarafı kontrol et
    while (endCol < 14 && board[row][endCol + 1].letter) {
      endCol++;
    }

    // Kelimeyi oluştur
    let word = "";
    for (let col = startCol; col <= endCol; col++) {
      const placedCell = placedCells.find(
        (cell) => cell.row === row && cell.col === col
      );

      if (placedCell) {
        // Yeni yerleştirilen harf
        const letterObj = rack[placedCell.rackIndex];
        const letter =
          typeof letterObj === "object" ? letterObj.letter : letterObj;
        word += letter === "JOKER" ? "*" : letter;
      } else if (board[row][col].letter) {
        // Tahtada mevcut harf
        word += board[row][col].letter;
      }
    }

    return word;
  } else if (direction === "vertical") {
    const col = sortedCells[0].col;
    let startRow = sortedCells[0].row;
    let endRow = sortedCells[sortedCells.length - 1].row;

    // Üst tarafı kontrol et
    while (startRow > 0 && board[startRow - 1][col].letter) {
      startRow--;
    }

    // Alt tarafı kontrol et
    while (endRow < 14 && board[endRow + 1][col].letter) {
      endRow++;
    }

    // Kelimeyi oluştur
    let word = "";
    for (let row = startRow; row <= endRow; row++) {
      const placedCell = placedCells.find(
        (cell) => cell.row === row && cell.col === col
      );

      if (placedCell) {
        // Yeni yerleştirilen harf
        const letterObj = rack[placedCell.rackIndex];
        const letter =
          typeof letterObj === "object" ? letterObj.letter : letterObj;
        word += letter === "JOKER" ? "*" : letter;
      } else if (board[row][col].letter) {
        // Tahtada mevcut harf
        word += board[row][col].letter;
      }
    }

    return word;
  } else {
    // diagonal
    // Çapraz kelime mantığı
    const dx = Math.sign(sortedCells[1]?.col - sortedCells[0].col || 1);
    const dy = Math.sign(sortedCells[1]?.row - sortedCells[0].row || 1);

    let startRow = sortedCells[0].row;
    let startCol = sortedCells[0].col;

    // Başlangıç noktasını bul
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
        (cell) => cell.row === currentRow && cell.col === currentCol
      );

      if (placedCell) {
        // Yeni yerleştirilen harf
        const letterObj = rack[placedCell.rackIndex];
        const letter =
          typeof letterObj === "object" ? letterObj.letter : letterObj;
        word += letter === "JOKER" ? "*" : letter;
      } else if (board[currentRow][currentCol].letter) {
        // Tahtada mevcut harf
        word += board[currentRow][currentCol].letter;
      } else {
        break; // Boş hücre, kelime sonu
      }

      currentRow += dy;
      currentCol += dx;
    }

    return word;
  }
};

// getCrossWordsFormed fonksiyonunu güncelle - çapraz kelimeler için kontrol ekle
const getCrossWordsFormed = (placedCells, board, rack) => {
  const crossWords = [];
  let mainDirection = "horizontal";

  if (placedCells.length > 1) {
    const [cell1, cell2] = placedCells;
    if (cell1.row === cell2.row) {
      mainDirection = "horizontal";
    } else if (cell1.col === cell2.col) {
      mainDirection = "vertical";
    } else if (
      Math.abs(cell1.row - cell2.row) === Math.abs(cell1.col - cell2.col)
    ) {
      mainDirection = "diagonal";
    }
  }

  // Çapraz yerleştirme durumunda farklı kontrol mekanizması
  if (mainDirection === "diagonal") {
    placedCells.forEach((cell) => {
      // Her hücre için yatay ve dikey kelimeleri kontrol et
      const directions = ["horizontal", "vertical"];

      directions.forEach((dir) => {
        let word = "";
        let start, end;

        if (dir === "horizontal") {
          start = cell.col;
          end = cell.col;

          // Sol ve sağ komşuları kontrol et
          while (start > 0 && board[cell.row][start - 1].letter) start--;
          while (end < 14 && board[cell.row][end + 1].letter) end++;

          if (end - start > 0) {
            for (let col = start; col <= end; col++) {
              const placedCell = placedCells.find(
                (pc) => pc.row === cell.row && pc.col === col
              );
              if (placedCell) {
                const letterObj = rack[placedCell.rackIndex];
                const letter =
                  typeof letterObj === "object" ? letterObj.letter : letterObj;
                word += letter === "JOKER" ? "*" : letter;
              } else if (board[cell.row][col].letter) {
                word += board[cell.row][col].letter;
              }
            }
          }
        } else {
          start = cell.row;
          end = cell.row;

          // Üst ve alt komşuları kontrol et
          while (start > 0 && board[start - 1][cell.col].letter) start--;
          while (end < 14 && board[end + 1][cell.col].letter) end++;

          if (end - start > 0) {
            for (let row = start; row <= end; row++) {
              const placedCell = placedCells.find(
                (pc) => pc.row === row && pc.col === cell.col
              );
              if (placedCell) {
                const letterObj = rack[placedCell.rackIndex];
                const letter =
                  typeof letterObj === "object" ? letterObj.letter : letterObj;
                word += letter === "JOKER" ? "*" : letter;
              } else if (board[row][cell.col].letter) {
                word += board[row][cell.col].letter;
              }
            }
          }
        }

        if (word.length >= 2) {
          crossWords.push(word);
        }
      });
    });
  } else {
    // Mevcut yatay/dikey çapraz kelime kontrolü
    placedCells.forEach((cell) => {
      let crossWord = "";
      let startPos, endPos;

      if (mainDirection === "horizontal") {
        // Dikey çapraz kelime ara
        startPos = cell.row;
        endPos = cell.row;

        while (startPos > 0 && board[startPos - 1][cell.col].letter) {
          startPos--;
        }
        while (endPos < 14 && board[endPos + 1][cell.col].letter) {
          endPos++;
        }

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
      } else {
        // Yatay çapraz kelime ara
        startPos = cell.col;
        endPos = cell.col;

        while (startPos > 0 && board[cell.row][startPos - 1].letter) {
          startPos--;
        }
        while (endPos < 14 && board[cell.row][endPos + 1].letter) {
          endPos++;
        }

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

      if (crossWord.length >= 2) {
        crossWords.push(crossWord);
      }
    });
  }

  return crossWords;
};
