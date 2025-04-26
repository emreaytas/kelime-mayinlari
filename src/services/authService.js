// src/services/authService.js
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore"; // firestore kullanabilmek için.
import { auth, firestore } from "../firebase/config"; // yapılandırma ayarlarını buradan görebiliriz.
import { use } from "react";

// Kullanıcı kaydı
export const registerUser = async (username, email, password) => {
  console.log("authService çalıştı ");
  try {
    // Kullanıcı adının benzersiz olup olmadığını kontrol et
    const usernameDoc = await getDoc(doc(firestore, "usernames", username));
    if (usernameDoc.exists()) {
      throw new Error("Bu kullanıcı adı zaten kullanılıyor.");
    }

    // Firebase Auth ile kayıt
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = userCredential.user;
    console.log("authService çalıştı " + userCredential);

    // Profili güncelle (displayName'e kullanıcı adını ekle)
    await updateProfile(user, {
      displayName: username,
    });

    // Firestore'a kullanıcı bilgilerini kaydet
    await setDoc(doc(firestore, "users", user.uid), {
      username,
      email,
      createdAt: new Date().toISOString(),
      gamesPlayed: 0,
      gamesWon: 0,
      successRate: 0,
    });

    // Kullanıcı adını Firestore'a kaydet (benzersizlik için)
    await setDoc(doc(firestore, "usernames", username), {
      uid: user.uid,
      email,
    });

    return user;
  } catch (error) {
    let errorMessage = "Kayıt sırasında bir hata oluştu.";
    if (error.code === "auth/email-already-in-use") {
      errorMessage = "Bu e-posta adresi zaten kullanılıyor.";
    } else if (error.message) {
      errorMessage = error.message;
    }
    throw new Error(errorMessage);
  }
};

// Kullanıcı girişi
export const loginUser = async (username, password) => {
  try {
    // Kullanıcı adından e-posta adresini bul
    const usernameDoc = await getDoc(doc(firestore, "usernames", username));
    if (!usernameDoc.exists()) {
      throw new Error("Kullanıcı adı bulunamadı.");
    }

    const { email } = usernameDoc.data();

    // Firebase Auth ile giriş
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );
    console.log(
      " giriş yaptı user: " +
        userCredential.user +
        " : " +
        userCredential.user.email +
        " : " +
        userCredential.user.username
    );
    console.log(
      userCredential.user + " userCredential bilgisi... authService."
    );

    return userCredential.user;
  } catch (error) {
    let errorMessage = "Giriş sırasında bir hata oluştu.";
    if (error.code === "auth/wrong-password") {
      errorMessage = "Hatalı şifre.";
    } else if (error.code === "auth/user-not-found") {
      errorMessage = "Kullanıcı bulunamadı.";
    } else if (error.message) {
      errorMessage = error.message;
    }
    throw new Error(errorMessage);
  }
};

// Çıkış yap
export const signOutUser = async () => {
  try {
    console.log(auth.userCredential.username + " çıkış yaptı...");
    await signOut(auth);
    return true;
  } catch (error) {
    throw new Error("Çıkış sırasında bir hata oluştu.");
  }
};

// Kullanıcı bilgilerini getir
export const getUserProfile = async (userId) => {
  try {
    const userDoc = await getDoc(doc(firestore, "users", userId));
    console.log("authService.js bilgiler: " + userDoc);
    if (!userDoc.exists()) {
      throw new Error("Kullanıcı bulunamadı.");
    }
    return userDoc.data();
  } catch (error) {
    throw new Error("Kullanıcı bilgileri alınamadı.");
  }
};

// Kullanıcı istatistiklerini güncelle
export const updateUserStats = async (userId, isWin) => {
  try {
    const userRef = doc(firestore, "users", userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      throw new Error("Kullanıcı bulunamadı.");
    }

    const userData = userDoc.data();

    // Oyun sayılarını ve istatistikleri güncelle
    const gamesPlayed = (userData.gamesPlayed || 0) + 1;
    const gamesWon = isWin
      ? (userData.gamesWon || 0) + 1
      : userData.gamesWon || 0;

    // Başarı yüzdesini kesin hesapla
    // Tam sayı olarak yüzde hesaplaması
    const successRate = Math.round((gamesWon / gamesPlayed) * 100);

    // Güncellemeleri yap
    await updateDoc(userRef, {
      gamesPlayed,
      gamesWon,
      successRate,
    });
    console.log(
      "updateUserStats metotu authService.js ",
      gamesPlayed + " : " + gamesWon + " : " + successRate
    );

    return {
      gamesPlayed,
      gamesWon,
      successRate,
    };
  } catch (error) {
    console.error("Kullanıcı istatistikleri güncellenemedi:", error);
    throw new Error("Kullanıcı istatistikleri güncellenemedi.");
  }
};
