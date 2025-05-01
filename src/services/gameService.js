// src/services/gameService.js
import { doc, getDoc, updateDoc } from "firebase/firestore";
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
import { setupInitialGame } from "../utils/InitialsWordList"; // veya doğru dosya adı
import { updateGameStatistics, saveGameRecord } from "./userStatsService";
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

// Eşleşme sistemine katıl
export const joinMatchmaking = async (gameType) => {
  try {
    if (!auth.currentUser) {
      throw new Error("Giriş yapılmamış");
    }

    const userId = auth.currentUser.uid;
    const username = auth.currentUser.displayName;

    console.log("Joining matchmaking:", gameType, userId, username);

    // Matchmaking referansı
    const matchmakingRef = ref(database, `matchmaking/${gameType}`);

    // Bekleyen oyuncuları kontrol et
    const snapshot = await get(matchmakingRef);
    const waitingPlayers = snapshot.val() || {};

    // Kendisi hariç bekleyen oyuncuları bul
    const otherPlayerIds = Object.keys(waitingPlayers).filter(
      (id) => id !== userId
    );

    if (otherPlayerIds.length > 0) {
      // Eşleşme bulundu - ilk bekleyen oyuncu ile eşleş
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
    console.log("Creating new game:", player1Id, player2Id, gameType);

    // Oyun tahtasını oluştur (sabit hücreler + rastgele mayınlar ve ödüller)
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
      board: gameBoard,
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

    console.log("Game created with ID:", newGameRef.key);

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

    // Oyun verilerini al
    const game = await getGameData(gameId);

    // Sıra kontrolü
    if (game.turnPlayer !== userId) {
      throw new Error("Sıra sizde değil");
    }

    // İlk hamle kontrolü - merkez hücreyi içermeli
    if (game.firstMove || game.centerRequired) {
      // Merkez yıldıza temas kontrolü
      const touchesCenterStar = isTouchingCenterStar(
        game.board,
        selectedBoardCells
      );

      if (!touchesCenterStar) {
        showTemporaryMessage("İlk kelime merkez yıldıza temas etmelidir!");
        return;
      }
    }

    // Kullanıcı bilgisi
    const isPlayer1 = game.player1.id === userId;
    const userRack = isPlayer1 ? game.player1Rack : game.player2Rack;

    // Tahta kopyası oluştur
    const boardCopy = JSON.parse(JSON.stringify(game.board));

    // Harfleri yerleştir
    placedCells.forEach((cell) => {
      const { row, col, rackIndex } = cell;
      // Harfi kullanıcının rafından al
      const letterObj = userRack[rackIndex];
      const letter =
        typeof letterObj === "object" ? letterObj.letter : letterObj;

      // Tahtaya harfi yerleştir
      boardCopy[row][col].letter = letter;
    });

    // Kelimeyi oluştur (gösterim amaçlı)
    let word = "";
    placedCells.forEach((cell) => {
      const { rackIndex } = cell;
      const letterObj = userRack[rackIndex];
      const letter =
        typeof letterObj === "object" ? letterObj.letter : letterObj;
      word += letter === "JOKER" ? "*" : letter;
    });

    // Kelime kontrolü
    if (!validateWord(word.toLowerCase())) {
      throw new Error("Geçersiz kelime");
    }

    // Puanları hesapla
    let points = calculateWordPoints(placedCells, boardCopy, userRack);

    // Mayın/ödül kontrolü - burada basit bir kontrol yapıyoruz
    const effects = {};
    const rewards = [];

    // Her hücre için mayın/ödül kontrolü
    placedCells.forEach((cell) => {
      const { row, col } = cell;
      const special = boardCopy[row][col].special;

      if (special) {
        // Mayın etkileri
        if (special === "PuanBolunmesi") {
          effects.pointDivision = true;
          points = Math.round(points * 0.3); // %30'unu al
        } else if (special === "PuanTransferi") {
          effects.pointTransfer = true;
          const opponentPoints = points;
          points = -points; // Oyuncudan puan düş

          // Rakibe puan ekle
          if (isPlayer1) {
            game.player2.score = (game.player2.score || 0) + opponentPoints;
          } else {
            game.player1.score = (game.player1.score || 0) + opponentPoints;
          }
        } else if (special === "HarfKaybi") {
          effects.letterLoss = true;
          // Tüm harfler değiştirilecek
        } else if (special === "EkstraHamleEngeli") {
          effects.moveBlockade = true;
          // Özel hücre etkilerini iptal et
          points = calculateRawPoints(placedCells, userRack);
        } else if (special === "KelimeIptali") {
          effects.wordCancellation = true;
          points = 0; // Puan yok
        }

        // Ödül etkileri
        if (
          special === "BolgeYasagi" ||
          special === "HarfYasagi" ||
          special === "EkstraHamleJokeri"
        ) {
          rewards.push(special);
        }

        // Özel hücreyi kullanıldı olarak işaretle
        boardCopy[row][col].special = null;
      }
    });

    // ÖNEMLİ: Kullanılan harflerin yerine yeni harf verilmesi
    // 1. Kullanıcının mevcut rafını kopyala
    let userRackCopy = [...userRack];

    // 2. Kullanılan harflerin indekslerini büyükten küçüğe sırala (doğru silme için)
    const usedIndices = placedCells
      .map((cell) => cell.rackIndex)
      .sort((a, b) => b - a);

    // 3. Kullanılan harfleri raftan çıkar
    usedIndices.forEach((index) => {
      userRackCopy.splice(index, 1);
    });

    // Harf Kaybı mayını etkisini uygula
    if (effects.letterLoss) {
      // Tüm harfleri havuza geri koy
      game.letterPool = [...game.letterPool, ...userRackCopy];
      // Rafı temizle
      userRackCopy = [];
    }

    // 4. Kaç yeni harf gerektiğini belirle
    const neededLetterCount = Math.min(
      7 - userRackCopy.length,
      game.letterPool.length
    );

    // 5. Harf havuzundan yeni harfleri al
    const newLetters = game.letterPool.slice(0, neededLetterCount);

    // 6. Kalan harf havuzunu güncelle
    const updatedLetterPool = game.letterPool.slice(neededLetterCount);

    // 7. Kullanıcının rafına yeni harfleri ekle
    userRackCopy = [...userRackCopy, ...newLetters];

    // Ödülleri Firebase uyumlu bir formatta saklama
    // ÖNEMLİ: İç içe dizi hatası burada olabilir
    let player1Rewards = Array.isArray(game.player1Rewards)
      ? [...game.player1Rewards]
      : [];
    let player2Rewards = Array.isArray(game.player2Rewards)
      ? [...game.player2Rewards]
      : [];

    // Firebase'in iç içe dizi sorunu için, ödülleri map olarak saklayalım
    if (rewards.length > 0) {
      if (isPlayer1) {
        for (const reward of rewards) {
          player1Rewards.push(reward);
        }
      } else {
        for (const reward of rewards) {
          player2Rewards.push(reward);
        }
      }
    }

    // Oyun verilerini güncelle
    const updates = {
      board: boardCopy,
      letterPool: updatedLetterPool,
      lastMoveTime: Date.now(),
      turnPlayer:
        game.player1.id === userId ? game.player2.id : game.player1.id,
      firstMove: false,
      centerRequired: false,
      consecutivePasses: 0, // Pas geçme sayacını sıfırla
    };

    // Puanları ve oyuncunun yeni rafını güncelle
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

    // Puan transferi varsa rakibin puanını güncelle
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

    // Oyun bitişini kontrol et - Eğer bir oyuncunun rafındaki tüm harfler biterse
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

const isTouchingCenterStar = (board, selectedCells) => {
  // Merkez yıldızın koordinatları
  const centerRow = 7;
  const centerCol = 7;

  // Olası komşu hücre yönleri (yukarı, aşağı, sol, sağ)
  const directions = [
    { dr: -1, dc: 0 }, // yukarı
    { dr: 1, dc: 0 }, // aşağı
    { dr: 0, dc: -1 }, // sol
    { dr: 0, dc: 1 }, // sağ
  ];

  // Her seçili hücre için komşuluk kontrolü
  return selectedCells.some((cell) => {
    // Her yönü kontrol et
    return directions.some(({ dr, dc }) => {
      const newRow = cell.row + dr;
      const newCol = cell.col + dc;

      // Tahta sınırları içinde mi
      const isWithinBoard =
        newRow >= 0 && newRow < 15 && newCol >= 0 && newCol < 15;

      // Merkez yıldıza komşu mu
      return isWithinBoard && newRow === centerRow && newCol === centerCol;
    });
  });
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

export const endGame = async (gameId, reason) => {
  try {
    const game = await getGameData(gameId);

    if (game.status === "completed") {
      return { success: true, alreadyCompleted: true };
    }

    const userId = auth.currentUser ? auth.currentUser.uid : null;
    const isPlayer1 = userId === game.player1.id;

    // Son puanları hesapla
    let player1Score = game.player1.score;
    let player2Score = game.player2.score;

    // Teslim olma durumu
    if (reason === "surrender") {
      if (isPlayer1) {
        // Oyuncu 1 teslim oldu - Oyuncu 2 kazandı
        player2Score += 50; // Bonus puan
      } else {
        // Oyuncu 2 teslim oldu - Oyuncu 1 kazandı
        player1Score += 50; // Bonus puan
      }
    }

    // İç içe dizi sorununu önlemek için oyun verisini temizle
    const cleanedGame = JSON.parse(JSON.stringify(game));

    // Firebase'in kabul etmediği veri yapılarını düzelt
    cleanGameDataForFirebase(cleanedGame);

    // Oyunu tamamlandı olarak işaretle
    const gameData = {
      ...cleanedGame,
      status: "completed",
      completedAt: Date.now(),
      reason,
      player1: {
        ...cleanedGame.player1,
        score: player1Score,
      },
      player2: {
        ...cleanedGame.player2,
        score: player2Score,
      },
    };

    // Kazanan belirle
    const player1Win = player1Score > player2Score;
    const player2Win = player2Score > player1Score;
    const isDraw = player1Score === player2Score;

    // Kazanan oyuncuyu belirle
    let winnerId = null;
    if (player1Win) {
      winnerId = game.player1.id;
    } else if (player2Win) {
      winnerId = game.player2.id;
    }

    // Kazanan bilgisini oyuna ekle
    gameData.winner = winnerId;
    gameData.isDraw = isDraw;

    // Completed games koleksiyonuna ekle
    await set(ref(database, `completedGames/${gameId}`), gameData);

    // Aktif oyunlardan kaldır
    await update(ref(database, `games/${gameId}`), { status: "completed" });

    // Firestore'a oyun kaydını ve istatistikleri ekle
    try {
      // Oyun kaydını sakla
      await saveGameRecord(gameId, gameData);

      // Her oyuncu için istatistikleri güncelle
      const player1Result = player1Win ? "win" : isDraw ? "tie" : "loss";
      const player2Result = player2Win ? "win" : isDraw ? "tie" : "loss";

      await updateGameStatistics(
        game.player1.id,
        gameId,
        player1Result,
        player1Score
      );
      await updateGameStatistics(
        game.player2.id,
        gameId,
        player2Result,
        player2Score
      );
    } catch (error) {
      console.error("Error updating game statistics:", error);
    }

    return {
      success: true,
      player1Score,
      player2Score,
      winner: winnerId,
    };
  } catch (error) {
    console.error("End game error:", error);
    throw error;
  }
};

// gameService.js içine yeni yardımcı fonksiyon ekleyin
// Bu fonksiyon iç içe dizileri ve diğer Firebase ile uyumlu olmayan veri yapılarını temizler
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
