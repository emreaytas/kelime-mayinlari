// src/services/gameService.js
import { database, auth } from "../firebase/config";
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

// Yeni oyun oluştur
export const createNewGame = async (
  player1Id,
  player1Username,
  player2Id,
  player2Username,
  gameType
) => {
  try {
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
    const gameData = {
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
      turnPlayer: firstPlayer, // Rastgele seçilen ilk oyuncu
      startTime: Date.now(),
      lastMoveTime: Date.now(),
      gameType,
      status: "active",
      firstMove: true, // İlk hamle henüz yapılmadı
      centerRequired: true, // İlk hamlede merkez yıldız gerekli
      consecutivePasses: 0, // Arka arkaya pas geçme sayısı
    };

    // Firebase'e oyun verisini kaydet
    await set(newGameRef, gameData);

    return { gameId: newGameRef.key, ...gameData };
  } catch (error) {
    console.error("Oyun oluşturma hatası:", error);
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
    const username = auth.currentUser.displayName;

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

      return { status: "waiting" };
    }
  } catch (error) {
    console.error("Eşleşme hatası:", error);
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
    console.error("Eşleşme iptali hatası:", error);
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
    console.error("Oyun verileri alma hatası:", error);
    throw error;
  }
};

// Oyun verilerini dinle
export const listenToGameChanges = (gameId, callback) => {
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
      console.error("Oyun dinleme hatası:", error);
      callback(null, error);
    }
  );

  return unsubscribe;
};

// Kelime yerleştirme
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
      const centerCellIncluded = placedCells.some(
        (cell) => cell.row === 7 && cell.col === 7
      );

      if (!centerCellIncluded) {
        throw new Error("İlk hamle merkez yıldıza yerleştirilmelidir!");
      }
    }

    // Kullanıcı bilgisi
    const isPlayer1 = game.player1.id === userId;
    const userRack = isPlayer1 ? game.player1Rack : game.player2Rack;

    // Tahta kopyası oluştur
    const boardCopy = JSON.parse(JSON.stringify(game.board));

    // Harfleri yerleştir
    let word = "";
    const cellTypes = [];

    placedCells.forEach((cell) => {
      const { row, col, rackIndex } = cell;

      if (rackIndex < 0 || rackIndex >= userRack.length) {
        throw new Error("Geçersiz harf indeksi");
      }

      const letterObj = userRack[rackIndex];
      const letter =
        typeof letterObj === "object" ? letterObj.letter : letterObj;

      word += letter === "JOKER" ? "*" : letter;
      cellTypes.push(boardCopy[row][col].type);

      // Tahtaya harfi yerleştir
      boardCopy[row][col].letter = letter;
    });

    // Kelime kontrolü
    if (!validateWord(word)) {
      throw new Error("Geçersiz kelime");
    }

    // Puanları hesapla
    let points = calculateWordPoints(word, placedCells, boardCopy);

    // Mayın/ödül kontrolü
    const specialItems = [];
    placedCells.forEach((cell) => {
      const { row, col } = cell;
      if (boardCopy[row][col].special) {
        specialItems.push({
          type: boardCopy[row][col].special,
          row,
          col,
        });

        // Özel öğeyi kullanıldı olarak işaretle
        boardCopy[row][col].special = null;
      }
    });

    // Mayın etkilerini uygula
    const { finalPoints, effects } = applyMineEffects(
      points,
      specialItems,
      userId,
      game
    );
    points = finalPoints;

    // Raf kopyası oluştur
    let userRackCopy = [...userRack];

    // Kullanılan harfleri raftan çıkar
    const usedIndices = placedCells
      .map((cell) => cell.rackIndex)
      .sort((a, b) => b - a);
    usedIndices.forEach((index) => {
      userRackCopy.splice(index, 1);
    });

    // HarfKaybi mayını kontrolü
    if (effects.letterLoss) {
      // Tüm harfleri havuza geri ver
      game.letterPool = [...game.letterPool, ...userRackCopy];
      // Havuzu karıştır
      game.letterPool.sort(() => Math.random() - 0.5);
      // Yeni 7 harf çek
      userRackCopy = game.letterPool.slice(0, 7);
      game.letterPool = game.letterPool.slice(7);
    } else {
      // Normal harf çekme
      const neededLetters = Math.min(
        7 - userRackCopy.length,
        game.letterPool.length
      );
      const newLetters = game.letterPool.slice(0, neededLetters);
      game.letterPool = game.letterPool.slice(neededLetters);
      userRackCopy = [...userRackCopy, ...newLetters];
    }

    // Oyun verilerini güncelle
    const updates = {
      board: boardCopy,
      letterPool: game.letterPool,
      lastMoveTime: Date.now(),
      turnPlayer:
        game.player1.id === userId ? game.player2.id : game.player1.id,
      firstMove: false, // İlk hamle yapıldı
      centerRequired: false, // Artık merkez gerekli değil
      consecutivePasses: 0, // Pas geçme sayacını sıfırla
    };

    // Puanları güncelle
    if (isPlayer1) {
      updates["player1.score"] = game.player1.score + points;
      updates.player1Rack = userRackCopy;

      // PuanTransferi mayını
      if (effects.pointTransfer) {
        updates["player2.score"] = game.player2.score + Math.abs(points);
      }
    } else {
      updates["player2.score"] = game.player2.score + points;
      updates.player2Rack = userRackCopy;

      // PuanTransferi mayını
      if (effects.pointTransfer) {
        updates["player1.score"] = game.player1.score + Math.abs(points);
      }
    }

    // Ödülleri ekle
    const rewards = specialItems.filter(
      (item) =>
        item.type === "BolgeYasagi" ||
        item.type === "HarfYasagi" ||
        item.type === "EkstraHamleJokeri"
    );

    if (rewards.length > 0) {
      const userRewards = isPlayer1
        ? game.player1Rewards || []
        : game.player2Rewards || [];
      const updatedRewards = [...userRewards];

      rewards.forEach((reward) => {
        updatedRewards.push(reward.type);
      });

      if (isPlayer1) {
        updates.player1Rewards = updatedRewards;
      } else {
        updates.player2Rewards = updatedRewards;
      }
    }

    // Oyun bitme kontrolü - her iki oyuncunun da harfleri bitmiş mi?
    const allLettersUsed =
      userRackCopy.length === 0 ||
      (isPlayer1
        ? game.player2Rack.length === 0
        : game.player1Rack.length === 0);

    // Harf havuzu ve oyuncuların raklarında kalan harfler
    const noMoreLetters =
      game.letterPool.length === 0 &&
      (userRackCopy.length === 0 ||
        (isPlayer1
          ? game.player2Rack.length === 0
          : game.player1Rack.length === 0));

    if (allLettersUsed || noMoreLetters) {
      updates.status = "completed";
      updates.completedAt = Date.now();
      updates.reason = "finished";

      // Kalan harflerin puanını hesapla
      if (userRackCopy.length === 0) {
        // Bu oyuncu tüm harflerini kullandı, diğer oyuncunun kalan harflerinin puanı ona gider
        const opponentRack = isPlayer1 ? game.player2Rack : game.player1Rack;
        let remainingPoints = 0;

        opponentRack.forEach((letterObj) => {
          const letter =
            typeof letterObj === "object" ? letterObj.letter : letterObj;
          remainingPoints += letter === "JOKER" ? 0 : letterValues[letter] || 0;
        });

        if (isPlayer1) {
          updates["player1.score"] += remainingPoints;
          updates["player2.score"] -= remainingPoints;
        } else {
          updates["player2.score"] += remainingPoints;
          updates["player1.score"] -= remainingPoints;
        }
      }
    }

    // Firebase güncelle
    await update(ref(database, `games/${gameId}`), updates);

    return {
      points,
      effects,
      rewards: rewards.map((r) => r.type),
      nextPlayer: updates.turnPlayer,
      gameEnded: updates.status === "completed",
    };
  } catch (error) {
    console.error("Kelime yerleştirme hatası:", error);
    throw error;
  }
};

// Kelime puanlarını hesapla
const calculateWordPoints = (word, placedCells, board) => {
  let totalPoints = 0;
  let wordMultiplier = 1;

  placedCells.forEach((cell) => {
    const { row, col, rackIndex } = cell;

    // Harfin puan değeri
    let letterPoint = 0;
    const letter = board[row][col].letter;

    if (letter !== "JOKER") {
      letterPoint = letterValues[letter] || 0;
    }

    // Hücre tipine göre çarpanlar
    const cellType = board[row][col].type;

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

// Mayın etkilerini uygula
const applyMineEffects = (points, specialItems, userId, game) => {
  let finalPoints = points;
  const effects = {
    pointDivision: false,
    pointTransfer: false,
    letterLoss: false,
    moveBlockade: false,
    wordCancellation: false,
  };

  // Mayın kontrolü
  for (const item of specialItems) {
    if (item.type === "PuanBolunmesi") {
      finalPoints = Math.round(points * 0.3); // Puanın %30'u
      effects.pointDivision = true;
    } else if (item.type === "PuanTransferi") {
      finalPoints = -points; // Rakibe transfer
      effects.pointTransfer = true;
    } else if (item.type === "HarfKaybi") {
      effects.letterLoss = true;
    } else if (item.type === "EkstraHamleEngeli") {
      // Harf ve kelime çarpanları yok
      finalPoints = calculateRawPoints(points, specialItems);
      effects.moveBlockade = true;
    } else if (item.type === "KelimeIptali") {
      finalPoints = 0; // Puan yok
      effects.wordCancellation = true;
    }
  }

  return { finalPoints, effects };
};

// Ham puanları hesapla (çarpansız)
const calculateRawPoints = (placedCells, userRack) => {
  let points = 0;

  placedCells.forEach((cell) => {
    const { rackIndex } = cell;
    const letterObj = userRack[rackIndex];
    const letter = typeof letterObj === "object" ? letterObj.letter : letterObj;

    if (letter !== "JOKER") {
      points += letterValues[letter] || 0;
    }
  });

  return points;
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
    console.error("Ödül kullanma hatası:", error);
    throw error;
  }
};

// Pas geç
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

    // Sırayı rakibe devret
    const updates = {
      turnPlayer:
        game.player1.id === userId ? game.player2.id : game.player1.id,
      lastMoveTime: Date.now(),
      consecutivePasses: (game.consecutivePasses || 0) + 1,
    };

    // Her iki oyuncu da pas geçtiyse (ardışık 2 pas)
    if (updates.consecutivePasses >= 2) {
      updates.status = "completed";
      updates.completedAt = Date.now();
      updates.reason = "pass";
    }

    // Firebase güncelle
    await update(ref(database, `games/${gameId}`), updates);

    return {
      success: true,
      gameEnded: updates.status === "completed",
    };
  } catch (error) {
    console.error("Pas geçme hatası:", error);
    throw error;
  }
};

// Teslim ol
export const surrender = async (gameId) => {
  try {
    if (!auth.currentUser) {
      throw new Error("Giriş yapılmamış");
    }

    await endGame(gameId, "surrender");
    return { success: true };
  } catch (error) {
    console.error("Teslim olma hatası:", error);
    throw error;
  }
};

// Oyunu bitir
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
    // Normal bitiş (tüm harfler bitti)
    else if (reason === "finished") {
      // Kalan harflerin puanını hesapla
      const player1Rack = game.player1Rack || [];
      const player2Rack = game.player2Rack || [];

      const player1RemainingPoints = player1Rack.reduce((total, letterObj) => {
        const letter =
          typeof letterObj === "object" ? letterObj.letter : letterObj;
        const points = letter === "JOKER" ? 0 : letterValues[letter] || 0;
        return total + points;
      }, 0);

      const player2RemainingPoints = player2Rack.reduce((total, letterObj) => {
        const letter =
          typeof letterObj === "object" ? letterObj.letter : letterObj;
        const points = letter === "JOKER" ? 0 : letterValues[letter] || 0;
        return total + points;
      }, 0);

      // Bitiren oyuncuya rakibinin kalan harflerinin puanlarını ekle
      if (player1Rack.length === 0 && player2Rack.length > 0) {
        // Oyuncu 1 bitirdi
        player1Score += player2RemainingPoints;
        player2Score -= player2RemainingPoints;
      } else if (player2Rack.length === 0 && player1Rack.length > 0) {
        // Oyuncu 2 bitirdi
        player2Score += player1RemainingPoints;
        player1Score -= player1RemainingPoints;
      }
    }

    // Oyunu tamamlandı olarak işaretle
    const gameData = {
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
    };

    // Completed games koleksiyonuna ekle
    await set(ref(database, `completedGames/${gameId}`), gameData);

    // Aktif oyunlardan kaldır
    await update(ref(database, `games/${gameId}`), { status: "completed" });

    // Oyuncu istatistiklerini güncelle
    const player1Win = player1Score > player2Score;
    const player2Win = player2Score > player1Score;

    // Oyuncu 1 istatistikleri
    const player1StatsRef = ref(database, `users/${game.player1.id}`);
    const player1StatsSnapshot = await get(player1StatsRef);
    const player1Stats = player1StatsSnapshot.val() || {};

    const player1GamesPlayed = (player1Stats.gamesPlayed || 0) + 1;
    const player1GamesWon = player1Win
      ? (player1Stats.gamesWon || 0) + 1
      : player1Stats.gamesWon || 0;
    const player1SuccessRate = Math.round(
      (player1GamesWon / player1GamesPlayed) * 100
    );

    await update(player1StatsRef, {
      gamesPlayed: player1GamesPlayed,
      gamesWon: player1GamesWon,
      successRate: player1SuccessRate,
    });

    // Oyuncu 2 istatistikleri
    const player2StatsRef = ref(database, `users/${game.player2.id}`);
    const player2StatsSnapshot = await get(player2StatsRef);
    const player2Stats = player2StatsSnapshot.val() || {};

    const player2GamesPlayed = (player2Stats.gamesPlayed || 0) + 1;
    const player2GamesWon = player2Win
      ? (player2Stats.gamesWon || 0) + 1
      : player2Stats.gamesWon || 0;
    const player2SuccessRate = Math.round(
      (player2GamesWon / player2GamesPlayed) * 100
    );

    await update(player2StatsRef, {
      gamesPlayed: player2GamesPlayed,
      gamesWon: player2GamesWon,
      successRate: player2SuccessRate,
    });

    return {
      success: true,
      player1Score,
      player2Score,
      winner:
        player1Score > player2Score
          ? game.player1.id
          : player2Score > player1Score
          ? game.player2.id
          : null,
    };
  } catch (error) {
    console.error("Oyun bitirme hatası:", error);
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
    console.error("Aktif oyunları alma hatası:", error);
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
    console.error("Tamamlanmış oyunları alma hatası:", error);
    throw error;
  }
};
