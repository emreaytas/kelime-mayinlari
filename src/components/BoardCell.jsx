// src/components/BoardCell.jsx
import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  Dimensions,
} from "react-native";

// Ekran boyutlarına göre hücre boyutunu hesapla
const { width } = Dimensions.get("window");
const BOARD_SIZE = Math.min(width - 20, 375);
const CELL_SIZE = BOARD_SIZE / 15;

export default function BoardCell({
  letter,
  points,
  type,
  special,
  isSelected,
  isTemporary,
  onPress,
}) {
  // Hücre tipi, renk ve açıklaması
  const getCellStyle = () => {
    switch (type) {
      case "H2":
        return { backgroundColor: "#87CEFA", description: "H²" }; // Açık mavi (Harf 2x)
      case "H3":
        return { backgroundColor: "#FF69B4", description: "H³" }; // Pembe (Harf 3x)
      case "K2":
        return { backgroundColor: "#90EE90", description: "K²" }; // Açık yeşil (Kelime 2x)
      case "K3":
        return { backgroundColor: "#FFA07A", description: "K³" }; // Açık turuncu (Kelime 3x)
      case "star":
        return { backgroundColor: "#FFD700", description: "★" }; // Altın (başlangıç yıldızı)
      default:
        return { backgroundColor: "#f5f5f5", description: "" };
    }
  };

  // Özel öğe (mayın/ödül) simgesi
  const getSpecialIcon = () => {
    if (!special) return "";

    // Mayınlar
    if (special === "PuanBolunmesi") return "💣";
    if (special === "PuanTransferi") return "💸";
    if (special === "HarfKaybi") return "🧨";
    if (special === "EkstraHamleEngeli") return "🚫";
    if (special === "KelimeIptali") return "❌";

    // Ödüller
    if (special === "BolgeYasagi") return "🚧";
    if (special === "HarfYasagi") return "🔒";
    if (special === "EkstraHamleJokeri") return "🎁";

    return "";
  };

  const { backgroundColor, description } = getCellStyle();
  const specialIcon = getSpecialIcon();

  // ÖNEMLİ DEĞİŞİKLİK: KRİTİK DÜZELTME
  // Tüm hücrelerin tıklanabilir olmasını sağlıyoruz,
  // sadece kalıcı harfi olan hücreler tıklanamaz (geçici değil)
  const isDisabled = letter !== null && !isTemporary;

  // Tıklama işlemini takip etmek için debug log
  const handleCellPress = () => {
    console.log("BoardCell tıklandı: ", {
      letter,
      type,
      isSelected,
      isTemporary,
    });
    if (onPress) {
      onPress(); // Üst bileşenden gelen tıklama işleyiciyi çağır
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.cell,
        { backgroundColor, width: CELL_SIZE, height: CELL_SIZE },
        isSelected && styles.selectedCell,
        letter && !isTemporary && styles.filledCell,
        letter && isTemporary && styles.temporaryFilledCell,
      ]}
      onPress={handleCellPress}
      disabled={isDisabled}
      activeOpacity={0.5} // Daha belirgin tıklama geri bildirimi
    >
      {letter ? (
        // Harf içeren hücre
        <View style={styles.letterContainer}>
          <Text style={[styles.letter, isTemporary && styles.temporaryLetter]}>
            {letter === "JOKER" ? "*" : letter}
          </Text>
          {points !== null && <Text style={styles.points}>{points}</Text>}
        </View>
      ) : specialIcon ? (
        // Özel öğe içeren hücre
        <Text style={styles.special}>{specialIcon}</Text>
      ) : (
        // Boş hücre
        <Text style={styles.description}>{description}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cell: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1, // Daha belirgin kenar
    borderColor: "#666",
    padding: 0,
    margin: 0,
  },
  selectedCell: {
    borderWidth: 2,
    borderColor: "#3f51b5", // Seçilen hücre kenarı mavi
    backgroundColor: "#e8eaf6", // Açık mavi arka plan
  },
  filledCell: {
    backgroundColor: "#FFE4B5", // Doldurulmuş hücre rengi
  },
  letterContainer: {
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    height: "100%",
  },
  letter: {
    fontSize: CELL_SIZE * 0.5, // Hücre boyutuna göre harf boyutu
    fontWeight: "bold",
  },
  points: {
    fontSize: CELL_SIZE * 0.25, // Hücre boyutuna göre puan boyutu
    position: "absolute",
    bottom: 1,
    right: 1,
  },
  description: {
    fontSize: CELL_SIZE * 0.35,
    color: "#666",
  },
  special: {
    fontSize: CELL_SIZE * 0.5,
  },
  temporaryFilledCell: {
    backgroundColor: "#FFFACD", // Daha açık sarı renk (geçici yerleştirme için)
    borderWidth: 2,
    borderColor: "#DAA520", // Altın rengi kenar
  },
  temporaryLetter: {
    color: "#B8860B", // Biraz daha koyu renk (geçici harf için)
  },
});
