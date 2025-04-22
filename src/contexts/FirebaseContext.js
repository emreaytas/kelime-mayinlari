// src/contexts/FirebaseContext.js
import React, { createContext, useState, useEffect, useContext } from "react";
import { firebase } from "../firebase/config";

const FirebaseContext = createContext();

export const FirebaseProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Firebase'in kullanıcı oturum durumunu dinleme
    const subscriber = firebase.auth().onAuthStateChanged((authUser) => {
      if (authUser) {
        // Kullanıcı verilerini veritabanından al
        firebase
          .database()
          .ref(`users/${authUser.uid}`)
          .once("value")
          .then((snapshot) => {
            const userData = snapshot.val();
            setUser({
              uid: authUser.uid,
              email: authUser.email,
              ...userData,
            });
            setLoading(false);
          })
          .catch((error) => {
            console.error("Error fetching user data:", error);
            setUser(null);
            setLoading(false);
          });
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    // Temizlik
    return () => subscriber();
  }, []);

  return (
    <FirebaseContext.Provider
      value={{
        user,
        loading,
        firebase,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = () => useContext(FirebaseContext);
