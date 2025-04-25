// app/index.js
import { Redirect } from "expo-router"; // kulanıcıyı başka bir sayfaya yönlendirebilmek için kullanırız.
import { useEffect, useState } from "react"; //  React'ın Hook'ları - fonksiyonel bileşenlerde state yönetimi ve yan etkileri (side effects) yönetmek için kullanılır.
import { View, ActivityIndicator, StyleSheet } from "react-native"; // React Native'in UI bileşenleri ve stil yönetimi için kullanılan yapılar.
import { auth } from "../src/firebase/config"; // Firebase Authentication servisi, ../src/firebase/config dosyasından import edilmiş.
import LoginScreen from "../src/screens/LoginScreen"; // Kullanıcı giriş ekranı bileşeni, ../src/screens/LoginScreen dosyasından import edilmiş.

export default function Index() {
  // bize bir sayfa dönecek bu metot ana bileşen olarak çalışıyor.
  //  React fonksiyonel bileşeni - JSX döndüren ve kullanıcı arayüzü oluşturan bir JavaScript fonksiyonu.
  // Bu fonksiyonu (veya değişkeni) dosyanın ana/varsayılan dışa aktarımı olarak belirler. Bir dosyadan yalnızca bir default export olabilir.
  const [initializing, setInitializing] = useState(true); //  Uygulama yükleniyor mu durumunu tutan state değişkeni (başlangıç değeri true).
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Listen for auth state to change
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
      setInitializing(false);
    });

    // Cleanup subscription
    return unsubscribe;
  }, []);

  if (initializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2e6da4" />
      </View>
    );
  }

  if (user) {
    // eğer girişi var ise uyglamada direkt home sayfasından başlıyor.
    // User is signed in, redirect to home
    return <Redirect href="/home" />;
  }

  // User is not signed in, show login screen
  return <LoginScreen />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
