// src/firebase/config.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with AsyncStorage persistence
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

const firestore = getFirestore(app);
const database = getDatabase(app);

export { auth, firestore, database };
export default app;
