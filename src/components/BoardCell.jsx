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
  isRestricted,
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

  // Hücrenin tıklanabilir olup olmadığını kontrol et
  const isDisabled = (letter !== null && !isTemporary) || isRestricted;

  // Tıklama işlemini takip etmek için debug log
  const handleCellPress = () => {
    console.log("BoardCell tıklandı: ", {
      letter,
      type,
      isSelected,
      isTemporary,
      isRestricted,
    });

    if (isRestricted) {
      console.log("Bu hücre kısıtlı bölgede!");
      return;
    }

    if (onPress) {
      console.log("onPress fonksiyonu çağrılıyor");
      onPress(); // Üst bileşenden gelen tıklama işleyiciyi çağır
    } else {
      console.warn("onPress fonksiyonu tanımlı değil!");
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
        isRestricted && styles.restrictedCell,
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
      
      {/* Kısıtlı hücre göstergesi */}
      {isRestricted && (
        <View style={styles.restrictedOverlay}>
          <Text style={styles.restrictedIcon}>🚫</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cell: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#666",
    padding: 0,
    margin: 0,
  },
  selectedCell: {
    borderWidth: 2,
    borderColor: "#3f51b5",
    backgroundColor: "#e8eaf6",
  },
  filledCell: {
    backgroundColor: "#FFE4B5",
  },
  letterContainer: {
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    height: "100%",
  },
  letter: {
    fontSize: CELL_SIZE * 0.5,
    fontWeight: "bold",
  },
  points: {
    fontSize: CELL_SIZE * 0.25,
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
    backgroundColor: "#FFFACD",
    borderWidth: 2,
    borderColor: "#DAA520",
  },
  temporaryLetter: {
    color: "#B8860B",
  },
  restrictedCell: {
    backgroundColor: "#FFE5E5", // Açık kırmızı arka plan
    opacity: 0.7,
  },
  restrictedOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 0, 0, 0.1)",
  },
  restricte