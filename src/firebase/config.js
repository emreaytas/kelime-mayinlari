// src/firebase/config.js - Birleştirilmiş ve düzeltilmiş Firebase yapılandırması
import { initializeApp } from "firebase/app";
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDQz6zZAK4krUK_hOrEsMKmj3L2QvVlfvs",
  authDomain: "kelimemayinlari-e6d88.firebaseapp.com",
  projectId: "kelimemayinlari-e6d88",
  storageBucket: "kelimemayinlari-e6d88.appspot.com",
  messagingSenderId: "987162249430",
  appId: "1:987162249430:web:ed6e2c28d1fc8589196177",
  measurementId: "G-S67XBLXEJ0",
  databaseURL:
    "https://kelimemayinlari-e6d88-default-rtdb.europe-west1.firebasedatabase.app",
};

console.log("Firebase yapılandırması yükleniyor");

// Initialize Firebase app once
let app;
try {
  app = initializeApp(firebaseConfig);
  console.log("Firebase başarıyla başlatıldı");
} catch (error) {
  console.error("Firebase başlatma hatası:", error);
}

// Initialize services conditionally
let auth;
let firestore;
let database;

try {
  // Try to get existing auth instance first
  auth = getAuth(app);
  console.log("Mevcut Auth bulundu");
} catch (error) {
  console.log("Yeni Auth oluşturuluyor");
  // If not initialized, create new auth instance with persistence
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
    console.log("Auth başarıyla oluşturuldu");
  } catch (authError) {
    console.error("Auth oluşturma hatası:", authError);
  }
}

try {
  // Initialize Firestore
  firestore = getFirestore(app);
  console.log("Firestore başarıyla başlatıldı");

  // Initialize Realtime Database
  database = getDatabase(app);
  console.log("Realtime Database başarıyla başlatıldı");
} catch (dbError) {
  console.error("Database başlatma hatası:", dbError);
}

// Export modules
export { auth, firestore, database };
export default app;
