// src/services/userStatsService.js
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  arrayUnion,
  increment,
  Timestamp,
} from "firebase/firestore";
import { auth, firestore, database } from "../firebase/config";
import { ref, update, get } from "firebase/database";

/**
 * Kullanıcı profili oluşturur veya günceller
 * @param {string} userId - Kullanıcı ID'si
 * @param {object} userData - Kullanıcı bilgileri
 */
export const createOrUpdateUserProfile = async (userId, userData) => {
  try {
    const userRef = doc(firestore, "users", userId);

    // Kullanıcı zaten var mı kontrol et
    const docSnap = await getDoc(userRef);

    if (docSnap.exists()) {
      // Mevcut kullanıcıyı güncelle
      await updateDoc(userRef, {
        ...userData,
        lastUpdated: Timestamp.now(),
      });
    } else {
      // Yeni kullanıcı oluştur
      await setDoc(userRef, {
        ...userData,
        gamesPlayed: 0,
        gamesWon: 0,
        gamesLost: 0,
        gamesTied: 0,
        successRate: 0,
        playedGameIds: [],
        totalPoints: 0,
        highestScore: 0,
        lastGame: null,
        createdAt: Timestamp.now(),
        lastUpdated: Timestamp.now(),
      });
    }

    // Realtime Database'de de eşzamanlı olarak güncelle
    const rtdbUserRef = ref(database, `users/${userId}`);
    await update(rtdbUserRef, {
      ...userData,
      lastUpdated: Date.now(),
    });

    return true;
  } catch (error) {
    console.error("Error creating/updating user profile:", error);
    throw error;
  }
};

/**
 * Kullanıcı profilini getirir
 * @param {string} userId - Kullanıcı ID'si
 * @returns {object} - Kullanıcı profil bilgileri
 */
export const getUserProfile = async (userId) => {
  try {
    const userRef = doc(firestore, "users", userId);
    const docSnap = await getDoc(userRef);

    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      throw new Error("User not found");
    }
  } catch (error) {
    console.error("Error getting user profile:", error);
    throw error;
  }
};

/**
 * Mevcut giriş yapmış kullanıcının profilini getirir
 * @returns {object} - Kullanıcı profil bilgileri
 */
export const getCurrentUserProfile = async () => {
  try {
    if (!auth.currentUser) {
      throw new Error("No authenticated user");
    }

    return await getUserProfile(auth.currentUser.uid);
  } catch (error) {
    console.error("Error getting current user profile:", error);
    throw error;
  }
};

/**
 * Oyun bittiğinde kullanıcı istatistiklerini günceller
 * @param {string} userId - Kullanıcı ID'si
 * @param {string} gameId - Tamamlanan oyun ID'si
 * @param {string} result - Oyun sonucu: 'win', 'loss', 'tie'
 * @param {number} points - Kullanıcının bu oyunda aldığı puan
 */
export const updateGameStatistics = async (userId, gameId, result, points) => {
  try {
    const userRef = doc(firestore, "users", userId);
    const docSnap = await getDoc(userRef);

    if (!docSnap.exists()) {
      throw new Error("User not found");
    }

    const userData = docSnap.data();

    // Firestore güncellemeleri için batch hazırla
    const updates = {
      playedGameIds: arrayUnion(gameId),
      gamesPlayed: increment(1),
      totalPoints: increment(points),
      lastGame: {
        gameId,
        result,
        points,
        timestamp: Timestamp.now(),
      },
      lastUpdated: Timestamp.now(),
    };

    // Sonuca göre ilgili alanları güncelle
    if (result === "win") {
      updates.gamesWon = increment(1);
    } else if (result === "loss") {
      updates.gamesLost = increment(1);
    } else if (result === "tie") {
      updates.gamesTied = increment(1);
    }

    // En yüksek skoru güncelle
    if (points > (userData.highestScore || 0)) {
      updates.highestScore = points;
    }

    // Firestore'u güncelle
    await updateDoc(userRef, updates);

    // Realtime Database'i de güncelle
    const rtdbUserRef = ref(database, `users/${userId}`);
    const rtdbUserSnapshot = await get(rtdbUserRef);

    if (rtdbUserSnapshot.exists()) {
      const rtdbUserData = rtdbUserSnapshot.val();

      const rtdbUpdates = {
        gamesPlayed: (rtdbUserData.gamesPlayed || 0) + 1,
        totalPoints: (rtdbUserData.totalPoints || 0) + points,
        lastUpdated: Date.now(),
      };

      if (result === "win") {
        rtdbUpdates.gamesWon = (rtdbUserData.gamesWon || 0) + 1;
      } else if (result === "loss") {
        rtdbUpdates.gamesLost = (rtdbUserData.gamesLost || 0) + 1;
      } else if (result === "tie") {
        rtdbUpdates.gamesTied = (rtdbUserData.gamesTied || 0) + 1;
      }

      // Başarı oranını hesapla
      const totalGames = rtdbUpdates.gamesPlayed;
      const wins =
        result === "win"
          ? (rtdbUserData.gamesWon || 0) + 1
          : rtdbUserData.gamesWon || 0;

      rtdbUpdates.successRate =
        totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

      await update(rtdbUserRef, rtdbUpdates);
    }

    // Başarı oranını asenkron olarak güncelle
    await updateSuccessRate(userId);

    console.log(
      `Updated stats for user ${userId}: Result=${result}, Points=${points}`
    );

    return {
      success: true,
      result,
      points,
    };
  } catch (error) {
    console.error(`Stats update error for user ${userId}:`, error);
    throw error;
  }
};

/**
 * Kullanıcının başarı oranını yeniden hesaplar ve günceller
 * @param {string} userId - Kullanıcı ID'si
 */
export const updateSuccessRate = async (userId) => {
  try {
    const userRef = doc(firestore, "users", userId);
    const docSnap = await getDoc(userRef);

    if (!docSnap.exists()) {
      throw new Error("User not found");
    }

    const userData = docSnap.data();
    const gamesPlayed = userData.gamesPlayed || 0;
    const gamesWon = userData.gamesWon || 0;

    // Başarı oranını hesapla
    const successRate =
      gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;

    // Firestore'u güncelle
    await updateDoc(userRef, {
      successRate,
      lastUpdated: Timestamp.now(),
    });

    // Realtime Database'i de güncelle
    const rtdbUserRef = ref(database, `users/${userId}`);
    await update(rtdbUserRef, {
      successRate,
      lastUpdated: Date.now(),
    });

    return {
      success: true,
      successRate,
    };
  } catch (error) {
    console.error(`Success rate update error for user ${userId}:`, error);
    throw error;
  }
};

/**
 * Oyun kaydını Firestore'a saklar
 * @param {string} gameId - Oyun ID'si
 * @param {object} gameData - Oyun verileri
 */
export const saveGameRecord = async (gameId, gameData) => {
  try {
    // Derin kopya oluştur
    const cleanGameData = JSON.parse(JSON.stringify(gameData));

    // Firebase'in kabul etmediği veri yapılarını temizle
    cleanFirebaseData(cleanGameData);

    const gameRef = doc(firestore, "games", gameId);

    await setDoc(gameRef, {
      ...cleanGameData,
      completedAt: Timestamp.fromMillis(
        cleanGameData.completedAt || Date.now()
      ),
      startTime: Timestamp.fromMillis(cleanGameData.startTime || Date.now()),
      lastSaved: Timestamp.now(),
    });

    return true;
  } catch (error) {
    console.error("Error saving game record:", error);
    throw error;
  }
};

function cleanFirebaseData(obj) {
  if (!obj || typeof obj !== "object") return;

  Object.entries(obj).forEach(([key, value]) => {
    // Null değerleri kontrol et
    if (value === null) {
      return;
    }

    // Dizilerin iç içe dizi içermediğinden emin ol
    if (Array.isArray(value)) {
      // İç içe dizi içeren dizileri nesne haritalarına dönüştür
      if (value.some((item) => Array.isArray(item))) {
        obj[key] = convertArrayToMap(value);
      } else {
        // Dizinin her öğesini temizle
        value.forEach((item) => {
          if (item && typeof item === "object") {
            cleanFirebaseData(item);
          }
        });
      }
    }
    // Nesnelerin içindeki verileri temizle
    else if (typeof value === "object") {
      cleanFirebaseData(value);
    }
  });
}

function convertArrayToMap(array) {
  const result = {};
  array.forEach((item, index) => {
    if (Array.isArray(item)) {
      result[`item_${index}`] = convertArrayToMap(item);
    } else if (item && typeof item === "object") {
      cleanFirebaseData(item);
      result[`item_${index}`] = item;
    } else {
      result[`item_${index}`] = item;
    }
  });
  return result;
}
/**
 * Kullanıcının oyun geçmişini getirir
 * @param {string} userId - Kullanıcı ID'si
 * @param {number} limit - Maksimum oyun sayısı
 * @returns {Array} - Oyun geçmişi
 */
export const getUserGameHistory = async (userId, limit = 10) => {
  try {
    const userRef = doc(firestore, "users", userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      throw new Error("User not found");
    }

    const userData = userDoc.data();
    const gameIds = userData.playedGameIds || [];

    // En son 'limit' kadar oyunu al
    const recentGameIds = gameIds.slice(-limit);

    // Her oyunun verilerini al
    const games = [];

    for (const gameId of recentGameIds) {
      try {
        const gameRef = doc(firestore, "games", gameId);
        const gameDoc = await getDoc(gameRef);

        if (gameDoc.exists()) {
          games.push({
            id: gameId,
            ...gameDoc.data(),
          });
        }
      } catch (err) {
        console.error(`Error getting game ${gameId}:`, err);
      }
    }

    // Tamamlanma tarihine göre sırala
    games.sort((a, b) => {
      const dateA = a.completedAt ? a.completedAt.toMillis() : 0;
      const dateB = b.completedAt ? b.completedAt.toMillis() : 0;
      return dateB - dateA;
    });

    return games;
  } catch (error) {
    console.error("Error getting user game history:", error);
    throw error;
  }
};

/**
 * Kullanıcının toplam istatistiklerini getirir
 * @param {string} userId - Kullanıcı ID'si (opsiyonel, verilmezse giriş yapmış kullanıcı)
 * @returns {object} - İstatistikler
 */
export const getUserStatsSummary = async (userId = null) => {
  try {
    const uid = userId || (auth.currentUser ? auth.currentUser.uid : null);

    if (!uid) {
      throw new Error("No user ID provided or signed in");
    }

    const userData = await getUserProfile(uid);

    return {
      username: userData.username,
      gamesPlayed: userData.gamesPlayed || 0,
      gamesWon: userData.gamesWon || 0,
      gamesLost: userData.gamesLost || 0,
      gamesTied: userData.gamesTied || 0,
      successRate: userData.successRate || 0,
      totalPoints: userData.totalPoints || 0,
      highestScore: userData.highestScore || 0,
      lastGame: userData.lastGame || null,
    };
  } catch (error) {
    console.error("Error getting user stats summary:", error);
    throw error;
  }
};
