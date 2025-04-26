// src/services/userService.js
import { auth, firestore, database } from "../firebase/config";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { ref, get, set, update, child, onValue } from "firebase/database";

// Kullanıcı verilerini iki veritabanı arasında senkronize et
export const syncUserData = async (userId) => {
  try {
    // Kullanıcı ID'si yoksa oturum açmış kullanıcıyı kullan
    const uid = userId || (auth.currentUser ? auth.currentUser.uid : null);

    if (!uid) {
      throw new Error("Kullanıcı ID'si belirtilmedi ve oturum açılmamış");
    }

    // Realtime Database'den verileri al
    const rtdbUserRef = ref(database, `users/${uid}`);
    const rtdbSnapshot = await get(rtdbUserRef);

    if (!rtdbSnapshot.exists()) {
      console.warn("Realtime Database'de kullanıcı bulunamadı");
      return false;
    }

    // Realtime Database'den verileri al
    const userData = rtdbSnapshot.val();

    // Verileri Firestore'a kaydet/güncelle
    const firestoreUserRef = doc(firestore, "users", uid);
    const firestoreSnapshot = await getDoc(firestoreUserRef);

    if (firestoreSnapshot.exists()) {
      // Mevcut dökümanı güncelle
      await updateDoc(firestoreUserRef, {
        username:
          userData.username || auth.currentUser?.displayName || "Kullanıcı",
        gamesPlayed: userData.gamesPlayed || 0,
        gamesWon: userData.gamesWon || 0,
        successRate: userData.successRate || 0,
        lastUpdated: new Date(),
      });
    } else {
      // Yeni döküman oluştur
      await setDoc(firestoreUserRef, {
        username:
          userData.username || auth.currentUser?.displayName || "Kullanıcı",
        email: userData.email || auth.currentUser?.email,
        gamesPlayed: userData.gamesPlayed || 0,
        gamesWon: userData.gamesWon || 0,
        successRate: userData.successRate || 0,
        createdAt: new Date(),
        lastUpdated: new Date(),
      });
    }

    return true;
  } catch (error) {
    console.error("Kullanıcı verisi senkronizasyon hatası:", error);
    return false;
  }
};

// Kullanıcı verilerini güncelle - her iki veritabanında da
export const updateUserStatistics = async (userId, gameResult) => {
  try {
    // Hem Realtime Database hem de Firestore'u güncelle

    // 1. Realtime Database'de güncelleme
    const rtdbUserRef = ref(database, `users/${userId}`);
    const rtdbSnapshot = await get(rtdbUserRef);

    if (rtdbSnapshot.exists()) {
      const userData = rtdbSnapshot.val();

      // Oyun sayılarını güncelle
      const gamesPlayed = (userData.gamesPlayed || 0) + 1;
      const gamesWon =
        gameResult === "win"
          ? (userData.gamesWon || 0) + 1
          : userData.gamesWon || 0;
      const successRate =
        gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;

      // RealTime Database'i güncelle
      await update(rtdbUserRef, {
        gamesPlayed,
        gamesWon,
        successRate,
        lastUpdated: Date.now(),
      });
    }

    // 2. Firestore'da güncelleme
    const firestoreUserRef = doc(firestore, "users", userId);
    const firestoreSnapshot = await getDoc(firestoreUserRef);

    if (firestoreSnapshot.exists()) {
      const userData = firestoreSnapshot.data();

      // Oyun sayılarını güncelle
      const gamesPlayed = (userData.gamesPlayed || 0) + 1;
      const gamesWon =
        gameResult === "win"
          ? (userData.gamesWon || 0) + 1
          : userData.gamesWon || 0;
      const successRate =
        gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;

      // Firestore'u güncelle
      await updateDoc(firestoreUserRef, {
        gamesPlayed,
        gamesWon,
        successRate,
        lastUpdated: new Date(),
      });
    } else {
      // Firestore'da kullanıcı yoksa, realtime DB'den alıp senkronize et
      await syncUserData(userId);

      // Sonra tekrar güncelleme yap
      await updateUserStatistics(userId, gameResult);
    }

    return true;
  } catch (error) {
    console.error("İstatistik güncelleme hatası:", error);
    return false;
  }
};

// Kullanıcı oluşturma/kaydetme
export const createUser = async (userId, userData) => {
  try {
    // Yeni modüler API kullanarak kullanıcıyı oluştur
    const userRef = ref(database, `users/${userId}`);
    await set(userRef, {
      username: userData.username,
      email: userData.email,
      gamesPlayed: 0,
      gamesWon: 0,
      successRate: 0,
      createdAt: Date.now(),
    });

    console.log(
      `userService.js: ${userData.username} (${userData.email}) oluşturuldu.`
    );

    // Aynı zamanda Firestore'a da kaydet
    const firestoreUserRef = doc(firestore, "users", userId);
    await setDoc(firestoreUserRef, {
      username: userData.username,
      email: userData.email,
      gamesPlayed: 0,
      gamesWon: 0,
      successRate: 0,
      createdAt: new Date(),
      lastUpdated: new Date(),
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
    // Önce Firestore'dan kontrol et
    const firestoreUserRef = doc(firestore, "users", userId);
    const firestoreSnapshot = await getDoc(firestoreUserRef);

    if (firestoreSnapshot.exists()) {
      return firestoreSnapshot.data();
    }

    // Firestore'da bulunamazsa Realtime Database'den kontrol et
    const rtdbUserRef = ref(database, `users/${userId}`);
    const rtdbSnapshot = await get(rtdbUserRef);

    if (rtdbSnapshot.exists()) {
      return rtdbSnapshot.val();
    }

    throw new Error("Kullanıcı bulunamadı");
  } catch (error) {
    console.error("Get user error: ", error);
    throw error;
  }
};

// Kullanıcı istatistiklerini güncelle (eski yöntem - uyumluluk için bırakıldı)
export const updateUserStats = async (userId, gameResult) => {
  try {
    // Bu fonksiyonu yeni updateUserStatistics fonksiyonuna yönlendir
    return await updateUserStatistics(
      userId,
      gameResult === "win" ? "win" : "loss"
    );
  } catch (error) {
    console.error("Update stats error: ", error);
    throw error;
  }
};
