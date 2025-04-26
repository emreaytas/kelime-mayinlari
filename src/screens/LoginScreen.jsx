// src/screens/LoginScreen.jsx - Giriş başarılı olduğunda yönlendirme için düzeltilmiş kısım
import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { getDoc, doc } from "firebase/firestore";
import { auth, firestore } from "../firebase/config";

export default function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  console.log("LoginScreen export default function LoginScreen çalıştı");

  // Check if user is already logged in
  useEffect(() => {
    console.log("LoginScreen useEffect çalıştı");

    const checkAuth = () => {
      if (auth.currentUser) {
        console.log(
          "Kullanıcı zaten giriş yapmış, ana sayfaya yönlendiriliyor"
        );
        router.replace("/home");
      }
    };

    checkAuth();

    // Listen for auth state changes
    const unsubscribe = auth.onAuthStateChanged((user) => {
      console.log(
        "LoginScreen auth state changed:",
        user ? "Kullanıcı bulundu" : "Kullanıcı bulunamadı"
      );
      if (user) {
        console.log("Kullanıcı giriş yaptı, /home'a yönlendiriliyor");
        router.replace("/home");
      }
    });

    return () => unsubscribe();
  }, []);

  const onLoginPress = async () => {
    // Validate inputs
    if (!username.trim()) {
      Alert.alert("Hata", "Lütfen kullanıcı adı girin.");
      return;
    }

    if (!password.trim()) {
      Alert.alert("Hata", "Lütfen şifre girin.");
      return;
    }

    try {
      setLoading(true);
      console.log("Giriş denemesi yapılıyor: " + username);

      // First try to find the user in Firestore by username
      const usernamesRef = doc(firestore, "usernames", username);
      const usernameDoc = await getDoc(usernamesRef);

      let email;

      if (usernameDoc.exists()) {
        // If username exists, get the associated email
        email = usernameDoc.data().email;
        console.log("Kullanıcı adı bulundu, email: " + email);
      } else {
        // Daha kapsamlı bir e-posta doğrulaması için düzenli ifade (regex) kullanma
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

        if (emailRegex.test(username)) {
          email = username;
          console.log("Email girildi: " + email);
        } else {
          // Create a "fake" email from username for Firebase Auth
          // This is a simplified approach - in a real app you'd want a more robust system
          email = `${username}@kelimemayinlari.app`;
          console.log("Oluşturulan email: " + email);
        }
      }

      // Attempt to sign in
      console.log("Firebase ile giriş yapılıyor: " + email);
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      console.log("Giriş başarılı: ", userCredential.user.uid);

      setLoading(false);

      // Manually navigate to home
      console.log("Ana sayfaya yönlendiriliyor");
      router.replace("/home");
    } catch (error) {
      setLoading(false);
      console.error("Login error:", error);

      let errorMessage = "Giriş başarısız.";

      if (error.code === "auth/user-not-found") {
        errorMessage = "Kullanıcı bulunamadı.";
      } else if (error.code === "auth/wrong-password") {
        errorMessage = "Hatalı şifre.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Geçersiz e-posta formatı.";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage =
          "Çok fazla giriş denemesi yaptınız. Lütfen daha sonra tekrar deneyin.";
      }

      Alert.alert("Giriş Hatası", errorMessage);
    }
  };

  console.log("LoginScreen render oluyor");
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.inner}>
            <View style={styles.logoContainer}>
              <Text style={styles.logo}>KELİME MAYINLARI</Text>
              <Text style={styles.subtitle}>GİRİŞ YAP</Text>
            </View>

            <View style={styles.formContainer}>
              <TextInput
                style={styles.input}
                placeholder="Kullanıcı Adı / E-Posta"
                placeholderTextColor="#888"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <TextInput
                style={styles.input}
                placeholder="Şifre"
                placeholderTextColor="#888"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />

              <TouchableOpacity
                style={styles.button}
                onPress={onLoginPress}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>GİRİŞ YAP</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Hesabınız yok mu?</Text>
              <TouchableOpacity onPress={() => router.push("/register")}>
                <Text style={styles.linkText}>KAYIT OL</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  keyboardView: {
    flex: 1,
  },
  inner: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  logo: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#2e6da4",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  formContainer: {
    marginBottom: 24,
  },
  input: {
    backgroundColor: "#fff",
    height: 50,
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#ddd",
    fontSize: 16,
  },
  button: {
    backgroundColor: "#2e6da4",
    height: 50,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  footerText: {
    color: "#666",
    marginRight: 5,
  },
  linkText: {
    color: "#2e6da4",
    fontWeight: "bold",
  },
});
