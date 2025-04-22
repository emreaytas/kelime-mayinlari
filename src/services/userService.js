// src/services/userService.js
import { firebase } from "../firebase/config";

const usersRef = firebase.database().ref("users");

// Kullanıcı oluşturma/kaydetme
export const createUser = async (userId, userData) => {
  try {
    await usersRef.child(userId).set({
      username: userData.username,
      email: userData.email,
      winRate: 0,
      totalGames: 0,
      winsCount: 0,
    });
    return true;
  } catch (error) {
    console.error("User creation error: ", error);
    throw error;
  }
};

// Kullanıcı bilgilerini getir
export const getUserProfile = async (userId) => {
  try {
    const snapshot = await usersRef.child(userId).once("value");
    return snapshot.val();
  } catch (error) {
    console.error("Get user error: ", error);
    throw error;
  }
};

// Kullanıcı istatistiklerini güncelle
export const updateUserStats = async (userId, gameResult) => {
  try {
    const userRef = usersRef.child(userId);
    const snapshot = await userRef.once("value");
    const userData = snapshot.val();

    // Toplam oyun ve kazanma sayısını güncelle
    const totalGames = userData.totalGames + 1;
    const winsCount =
      gameResult === "win" ? userData.winsCount + 1 : userData.winsCount;
    const winRate = totalGames > 0 ? (winsCount / totalGames) * 100 : 0;

    await userRef.update({
      totalGames,
      winsCount,
      winRate,
    });

    return true;
  } catch (error) {
    console.error("Update stats error: ", error);
    throw error;
  }
};
