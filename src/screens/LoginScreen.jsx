// src/screens/LoginScreen.jsx
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
  Image,
} from "react-native";
import { router } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { getDoc, doc } from "firebase/firestore";
import { auth, firestore } from "../firebase/config";

export default function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = () => {
      if (auth.currentUser) {
        router.replace("/home");
      }
    };

    checkAuth();

    // Listen for auth state changes
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
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

      // First try to find the user in Firestore by username
      const usernamesRef = doc(firestore, "usernames", username);
      const usernameDoc = await getDoc(usernamesRef);

      let email;

      if (usernameDoc.exists()) {
        // If username exists, get the associated email
        email = usernameDoc.data().email;
      } else {
        // If not found by username, check if input is an email
        if (username.includes("@")) {
          email = username;
        } else {
          // Create a "fake" email from username for Firebase Auth
          // This is a simplified approach - in a real app you'd want a more robust system
          email = `${username}@kelimemayinlari.app`;
        }
      }

      // Attempt to sign in
      await signInWithEmailAndPassword(auth, email, password);

      // If successful, navigation will happen via the auth state listener
      setLoading(false);
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
                placeholder="E-Posta"
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
                  <Text style={styles.buttonText}>Giriş Yap</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Hesabınız yok mu?</Text>
              <TouchableOpacity onPress={() => router.push("/register")}>
                <Text style={styles.linkText}>Kayıt Ol</Text>
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
