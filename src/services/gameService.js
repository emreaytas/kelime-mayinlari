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
    const userRack = isPlayer1 ? game.player1Rack : game.player2Rack;

    // Tahta kontrolü ve normalizasyonu
    if (!game.board) {
      throw new Error("Oyun tahtası bulunamadı");
    }

    // Tahta verisini normalize et
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
            type: getCellType(i, j), // Hücre tipini belirle
            special: null,
            points: null,
          };
        }
      }
    }

    // Tahta kopyası oluştur
    const boardCopy = JSON.parse(JSON.stringify(normalizedBoard));

    // Kelimeyi oluştur ve doğrula
    let word = "";
    placedCells.forEach((cell) => {
      const { row, col, rackIndex } = cell;

      // Tahta sınırlarını kontrol et
      if (row < 0 || row >= 15 || col < 0 || col >= 15) {
        throw new Error(`Geçersiz hücre konumu: [${row}][${col}]`);
      }

      const letterObj = userRack[rackIndex];
      const letter =
        typeof letterObj === "object" ? letterObj.letter : letterObj;
      word += letter === "JOKER" ? "*" : letter;
    });

    // Kelime kontrolü
    if (!validateWord(word.toLowerCase())) {
      throw new Error("Geçersiz kelime");
    }

    // Kelime onaylandı, şimdi harfleri kalıcı olarak yerleştir
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

    // Puanları hesapla
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

    // Oyun verilerini güncelle
    const updates = {
      board: firebaseBoard,
      letterPool: updatedLetterPool,
      lastMoveTime: Date.now(),
      turnPlayer:
        game.player1.id === userId ? game.player2.id : game.player1.id,
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

    return {
      success: true,
      points,
      effects,
      rewards,
      nextPlayer: updates.turnPlayer,
      gameEnded: updates.status === "completed",
    };
  } catch (error) {
    console.error("Place word error:", error);
    throw error;
  }
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
        // Oyuncu 1 teslim oldu - Oyuncu 2 kazandı
        winnerId = game.player2.id;
        player2Score += 50; // Bonus puan
      } else if (userId === game.player2.id) {
        // Oyuncu 2 teslim oldu - Oyuncu 1 kazandı
        winnerId = game.player1.id;
        player1Score += 50; // Bonus puan
      }
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
  console.log("Calculating points for cells:", placedCells);
  console.log("Board:", board);

  let totalPoints = 0;
  let wordMultiplier = 1;

  placedCells.forEach((cell) => {
    const { row, col, rackIndex } = cell;

    // Debug
    console.log(
      `Processing cell: row=${row}, col=${col}, rackIndex=${rackIndex}`
    );

    // Board ve hücre kontrolü
    if (!board) {
      console.error("Board is undefined");
      return;
    }

    if (!board[row]) {
      console.error(`Board row ${row} is undefined`);
      return;
    }

    if (!board[row][col]) {
      console.error(`Board cell at [${row}][${col}] is undefined`);
      return;
    }

    // Harfi oyuncunun rafından al
    const letterObj = rack[rackIndex];
    const letter = typeof letterObj === "object" ? letterObj.letter : letterObj;

    // Harfin puan değerini al
    let letterPoint = letter === "JOKER" ? 0 : letterValues[letter] || 0;

    // Hücre tipini kontrol et (çarpanlar)
    const cellData = board[row][col];
    const cellType = cellData.type;

    console.log(`Cell type: ${cellType}, Letter point: ${letterPoint}`);

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

  console.log(`Total points: ${totalPoints}`);
  return totalPoints;
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
