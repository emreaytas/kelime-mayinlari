// src/screens/RegisterScreen.jsx
import React, { useState } from "react";
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
  ScrollView,
} from "react-native";

import { router } from "expo-router";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, firestore, database } from "../firebase/config";
import { ref, set } from "firebase/database";

export default function RegisterScreen() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Validate email format
  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email.toLowerCase());
  };

  // şifreyi kontrol edeceğiz hocam...
  const validatePassword = (password) => {
    const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    return re.test(password);
  };

  const validateUsername = (username) => {
    const re = /^[a-zA-Z0-9_]+$/;
    return re.test(username);
  };

  const handleRegister = async () => {
    // Validate all inputs
    if (!username.trim()) {
      Alert.alert("Hata", "Kullanıcı adı boş olamaz.");
      return;
    }

    if (!validateUsername(username)) {
      Alert.alert(
        "Hata",
        "Kullanıcı adı sadece harf, rakam ve alt çizgi (_) içerebilir."
      );
      return;
    }

    if (!email.trim() || !validateEmail(email)) {
      Alert.alert("Hata", "Geçerli bir e-posta adresi girin.");
      return;
    }

    if (!validatePassword(password)) {
      Alert.alert(
        "Hata",
        "Şifre en az 8 karakter uzunluğunda olmalı ve büyük/küçük harf ile rakam içermelidir."
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Hata", "Şifreler eşleşmiyor.");
      return;
    }

    try {
      setLoading(true);

      // kullanıcı adı daha önce var mıydı hacı ona bakacağız.
      const usernameDoc = await getDoc(doc(firestore, "usernames", username));
      if (usernameDoc.exists()) {
        setLoading(false);
        Alert.alert("Hata", "Bu kullanıcı adı zaten kullanılıyor.");
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      await updateProfile(user, {
        displayName: username,
      });

      await setDoc(doc(firestore, "users", user.uid), {
        username,
        email,
        createdAt: new Date().toISOString(),
        gamesPlayed: 0,
        gamesWon: 0,
        successRate: 0,
      });

      await setDoc(doc(firestore, "usernames", username), {
        uid: user.uid,
        email,
      });

      await set(ref(database, `users/${user.uid}`), {
        username,
        email,
        gamesPlayed: 0,
        gamesWon: 0,
        successRate: 0,
        createdAt: new Date().toISOString(),
      });

      setLoading(false);

      Alert.alert("Başarılı", "Hesabınız oluşturuldu. Giriş yapılıyor...", [
        {
          text: "Tamam",
          onPress: () => router.replace("/home"),
        },
      ]);
    } catch (error) {
      setLoading(false);
      console.error("Registration error:", error);

      let errorMessage = "Kayıt sırasında bir hata oluştu.";

      if (error.code === "auth/email-already-in-use") {
        errorMessage = "Bu e-posta adresi zaten kullanılıyor.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Geçersiz e-posta formatı.";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "Şifre çok zayıf.";
      } else if (error.code === "auth/network-request-failed") {
        errorMessage = "Ağ hatası. İnternet bağlantınızı kontrol edin.";
      }

      Alert.alert("Kayıt Hatası", errorMessage);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollView}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.inner}>
              <View style={styles.headerContainer}>
                <Text style={styles.header}>KELİME MAYINLARI</Text>
                <Text style={styles.subheader}>HESAP OLUŞTUR</Text>
              </View>

              <View style={styles.formContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Kullanıcı Adı"
                  placeholderTextColor="#888"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <TextInput
                  style={styles.input}
                  placeholder="E-posta Adresi"
                  placeholderTextColor="#888"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
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

                <TextInput
                  style={styles.input}
                  placeholder="Şifre Tekrar"
                  placeholderTextColor="#888"
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />

                <TouchableOpacity
                  style={styles.button}
                  onPress={handleRegister}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>Kayıt Ol</Text>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.footer}>
                <Text style={styles.footerText}>Zaten hesabınız var mı?</Text>
                <TouchableOpacity onPress={() => router.back()}>
                  <Text style={styles.linkText}>GİRİŞ YAP</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </ScrollView>
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
  scrollView: {
    flexGrow: 1,
  },
  inner: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  headerContainer: {
    alignItems: "center",
    marginBottom: 30,
  },
  header: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#2e6da4",
    marginBottom: 8,
  },
  subheader: {
    fontSize: 18,
    color: "#666",
  },
  formContainer: {
    marginBottom: 20,
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
