// src/services/gameTimerService.js
import { ref, get, update, set } from "firebase/database";
import { database, firestore } from "../firebase/config";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { updateGameStatistics } from "./userStatsService";

/**
 * Aktif oyunları kontrol eder ve süresi bitenleri tamamlar
 * Bu fonksiyon belirli aralıklarla çağrılmalıdır
 */
export const checkActiveGameTimers = async () => {
  try {
    // Aktif oyunları al
    const gamesRef = ref(database, "games");
    const snapshot = await get(gamesRef);

    if (!snapshot.exists()) {
      return { checked: 0, expired: 0 };
    }

    const now = Date.now();
    let checkedGames = 0;
    let expiredGames = 0;

    // Her oyunu kontrol et
    snapshot.forEach(async (childSnapshot) => {
      const gameId = childSnapshot.key;
      const gameData = childSnapshot.val();

      // Sadece aktif oyunları kontrol et
      if (gameData.status !== "active") {
        return;
      }

      checkedGames++;

      // Son hamleden bu yana geçen süre
      const lastMoveTime = gameData.lastMoveTime || gameData.startTime || now;
      const timeSinceLastMove = now - lastMoveTime;

      // Oyun tipine göre süre sınırı
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
          timeLimit = 24 * 60 * 60 * 1000; // Varsayılan 24 saat
      }

      // Süre doldu mu kontrolü
      if (timeSinceLastMove > timeLimit) {
        expiredGames++;

        // Süresi biten oyunu işle
        await handleExpiredGame(gameId, gameData);
      }
    });

    return { checked: checkedGames, expired: expiredGames };
  } catch (error) {
    console.error("Game timer check error:", error);
    return { error: error.message };
  }
};

/**
 * Süresi dolan bir oyunu tamamlar
 * @param {string} gameId - Oyun ID'si
 * @param {object} gameData - Oyun verileri
 */
export const handleExpiredGame = async (gameId, gameData) => {
  try {
    const now = Date.now();

    // Şu anda sırası olan oyuncu süresini aştı
    const currentTurnPlayer = gameData.turnPlayer;
    const player1Id = gameData.player1.id;
    const player2Id = gameData.player2.id;

    // Süresi geçen oyuncunun rakibini kazanan yap
    const winnerId = currentTurnPlayer === player1Id ? player2Id : player1Id;

    // Puanları güncelle (süre aşımında kazanana bonus)
    let player1Score = gameData.player1.score || 0;
    let player2Score = gameData.player2.score || 0;

    if (winnerId === player1Id) {
      player1Score += 25; // Süre aşımı bonusu
    } else {
      player2Score += 25; // Süre aşımı bonusu
    }

    // Oyun verisini güncelle
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

    // Realtime Database'de güncelle
    await update(ref(database, `games/${gameId}`), updates);

    // Güncellenmiş oyun verisi
    const updatedGameData = {
      ...gameData,
      ...updates,
    };

    // Tamamlanan oyunlar koleksiyonuna kopyala
    await set(ref(database, `completedGames/${gameId}`), updatedGameData);

    // Firestore'a da kaydet (kalıcı depolama)
    await saveGameToFirestore(gameId, updatedGameData);

    // İstatistikleri güncelle
    const player1Result = winnerId === player1Id ? "win" : "loss";
    const player2Result = winnerId === player2Id ? "win" : "loss";

    await updateGameStatistics(player1Id, gameId, player1Result, player1Score);
    await updateGameStatistics(player2Id, gameId, player2Result, player2Score);

    console.log(`Game ${gameId} completed due to timeout`);

    return { success: true };
  } catch (error) {
    console.error(`Error handling expired game ${gameId}:`, error);
    return { error: error.message };
  }
};

/**
 * Oyun verilerini Firestore'a kaydeder (kalıcı depolama)
 * @param {string} gameId - Oyun ID'si
 * @param {object} gameData - Oyun verileri
 */
export const saveGameToFirestore = async (gameId, gameData) => {
  try {
    // Firestore'a kaydetmeden önce veriyi temizle
    const cleanGameData = JSON.parse(JSON.stringify(gameData));

    // Timestamp'leri düzgün formata çevir
    const firestoreData = {
      ...cleanGameData,
      completedAt: Timestamp.fromMillis(
        cleanGameData.completedAt || Date.now()
      ),
      startTime: Timestamp.fromMillis(cleanGameData.startTime || Date.now()),
      lastMoveTime: Timestamp.fromMillis(
        cleanGameData.lastMoveTime || Date.now()
      ),
      savedAt: Timestamp.now(),
    };

    // Firestore'a kaydet
    await setDoc(doc(firestore, "games", gameId), firestoreData);

    return { success: true };
  } catch (error) {
    console.error(`Error saving game ${gameId} to Firestore:`, error);
    throw error;
  }
};

/**
 * Ana uygulamada oyun sürelerini kontrol etmek için çağrılabilir
 * Örneğin uygulama ilk açıldığında ve belirli aralıklarla
 */
export const setupTimerChecks = () => {
  // İlk kontrol
  checkActiveGameTimers();

  // Düzenli kontroller (örn: her 5 dakikada bir)
  const interval = 5 * 60 * 1000; // 5 dakika
  const timerId = setInterval(checkActiveGameTimers, interval);

  // Temizleme fonksiyonu döndür
  return () => clearInterval(timerId);
};

/**
 * Tek bir oyunun süresini kontrol eder
 * Özellikle oyun açıldığında kullanışlı olabilir
 */
export const checkGameTimer = async (gameId) => {
  try {
    const gameRef = ref(database, `games/${gameId}`);
    const snapshot = await get(gameRef);

    if (!snapshot.exists()) {
      return { exists: false };
    }

    const gameData = snapshot.val();

    // Aktif oyun değilse kontrol etme
    if (gameData.status !== "active") {
      return { exists: true, status: gameData.status };
    }

    const now = Date.now();
    const lastMoveTime = gameData.lastMoveTime || gameData.startTime || now;
    const timeSinceLastMove = now - lastMoveTime;

    // Oyun tipine göre süre sınırı
    let timeLimit;
    switch (gameData.gameType) {
      case "2min":
        timeLimit = 2 * 60 * 1000;
        break;
      case "5min":
        timeLimit = 5 * 60 * 1000;
        break;
      case "12hour":
        timeLimit = 12 * 60 * 60 * 1000;
        break;
      case "24hour":
        timeLimit = 24 * 60 * 60 * 1000;
        break;
      default:
        timeLimit = 24 * 60 * 60 * 1000;
    }

    // Süre doldu mu?
    if (timeSinceLastMove > timeLimit) {
      // Oyunu tamamla
      await handleExpiredGame(gameId, gameData);
      return { exists: true, expired: true };
    }

    // Süre dolmadı
    return {
      exists: true,
      status: "active",
      timeRemaining: timeLimit - timeSinceLastMove,
    };
  } catch (error) {
    console.error(`Error checking game timer for ${gameId}:`, error);
    return { error: error.message };
  }
};
