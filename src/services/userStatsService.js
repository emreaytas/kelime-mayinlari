// src/services/userStatsService.js
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  arrayUnion,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from "firebase/firestore";
import { auth, firestore } from "../firebase/config";

/**
 * Kullanıcı için Firestore'da bir belge oluşturur veya günceller
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
        lastUpdated: new Date().toISOString(),
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
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      });
    }

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

    // İstatistikleri hesapla
    const gamesPlayed = (userData.gamesPlayed || 0) + 1;
    const gamesWon =
      result === "win" ? (userData.gamesWon || 0) + 1 : userData.gamesWon || 0;
    const gamesLost =
      result === "loss"
        ? (userData.gamesLost || 0) + 1
        : userData.gamesLost || 0;
    const gamesTied =
      result === "tie"
        ? (userData.gamesTied || 0) + 1
        : userData.gamesTied || 0;
    const totalPoints = (userData.totalPoints || 0) + points;
    const successRate = Math.round((gamesWon / gamesPlayed) * 100);

    // Firestore'u güncelle
    await updateDoc(userRef, {
      gamesPlayed,
      gamesWon,
      gamesLost,
      gamesTied,
      totalPoints,
      successRate,
      playedGameIds: arrayUnion(gameId),
      lastUpdated: new Date().toISOString(),
    });

    console.log(
      `Updated stats for user ${userId}: Result=${result}, Games=${gamesPlayed}, Win/Loss/Tie=${gamesWon}/${gamesLost}/${gamesTied}, Success=${successRate}%`
    );

    return {
      gamesPlayed,
      gamesWon,
      gamesLost,
      gamesTied,
      totalPoints,
      successRate,
    };
  } catch (error) {
    console.error(`Stats update error for user ${userId}:`, error);
    throw error;
  }
};

/**
 * Oyun kaydını Firestore'da saklar
 * @param {string} gameId - Oyun ID'si
 * @param {object} gameData - Oyun verileri
 */
export const saveGameRecord = async (gameId, gameData) => {
  try {
    const gameRef = doc(firestore, "games", gameId);

    await setDoc(gameRef, {
      ...gameData,
      completedAt: new Date().toISOString(),
    });

    return true;
  } catch (error) {
    console.error("Error saving game record:", error);
    throw error;
  }
};

/**
 * Kullanıcının oyun geçmişini getirir
 * @param {string} userId - Kullanıcı ID'si
 * @param {number} limit - Getirilecek maksimum oyun sayısı
 * @returns {array} - Oyun geçmişi
 */
export const getUserGameHistory = async (userId, limitCount = 10) => {
  try {
    const gamesQuery = query(
      collection(firestore, "games"),
      where("players", "array-contains", userId),
      orderBy("completedAt", "desc"),
      limit(limitCount)
    );

    const querySnapshot = await getDocs(gamesQuery);
    const games = [];

    querySnapshot.forEach((doc) => {
      games.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return games;
  } catch (error) {
    console.error("Error getting user game history:", error);
    throw error;
  }
};

/**
 * En yüksek başarı oranına sahip kullanıcıları getirir (liderlik tablosu)
 * @param {number} limit - Getirilecek maksimum kullanıcı sayısı
 * @returns {array} - Kullanıcılar listesi
 */
export const getLeaderboard = async (limitCount = 10) => {
  try {
    // Minimum oyun sayısı şartı (örn. en az 5 oyun oynamış olmalı)
    const minGamesPlayed = 5;

    const usersQuery = query(
      collection(firestore, "users"),
      where("gamesPlayed", ">=", minGamesPlayed),
      orderBy("successRate", "desc"),
      limit(limitCount)
    );

    const querySnapshot = await getDocs(usersQuery);
    const users = [];

    querySnapshot.forEach((doc) => {
      const userData = doc.data();
      users.push({
        id: doc.id,
        username: userData.username,
        successRate: userData.successRate,
        gamesPlayed: userData.gamesPlayed,
        gamesWon: userData.gamesWon,
      });
    });

    return users;
  } catch (error) {
    console.error("Error getting leaderboard:", error);
    throw error;
  }
};

/**
 * Mevcut giriş yapmış kullanıcının istatistiklerini getirir
 * @returns {object} - Kullanıcı istatistikleri
 */
export const getCurrentUserStats = async () => {
  try {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      throw new Error("No user is signed in");
    }

    return await getUserProfile(currentUser.uid);
  } catch (error) {
    console.error("Error getting current user stats:", error);
    throw error;
  }
};
