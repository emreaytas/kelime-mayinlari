// src/components/BoardCell.jsx - Düzeltilmiş Versiyon
import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  Dimensions,
} from "react-native";

// Ekran genişliğini al
const { width } = Dimensions.get("window");
const BOARD_SIZE = Math.min(width - 20, 375); // Ekran genişliği veya maksimum 375px
const CELL_SIZE = BOARD_SIZE / 15; // 15x15 tahta için

export default function BoardCell({
  letter,
  points,
  type,
  special,
  isSelected,
  onPress,
}) {
  // Hücre rengi ve açıklaması (türüne göre)
  const getCellStyle = () => {
    switch (type) {
      case "H2":
        return { backgroundColor: "#87CEFA", description: "H²" }; // Açık mavi
      case "H3":
        return { backgroundColor: "#FF69B4", description: "H³" }; // Pembe
      case "K2":
        return { backgroundColor: "#90EE90", description: "K²" }; // Açık yeşil
      case "K3":
        return { backgroundColor: "#FFA07A", description: "K³" }; // Açık turuncu
      case "star":
        return { backgroundColor: "#FFD700", description: "★" }; // Altın rengi
      default:
        return { backgroundColor: "#f5f5f5", description: "" };
    }
  };

  // Özel öğe (mayın/ödül) ikonu
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

  return (
    <TouchableOpacity
      style={[
        styles.cell,
        {
          backgroundColor,
          width: CELL_SIZE,
          height: CELL_SIZE,
        },
        isSelected && styles.selectedCell,
        letter && styles.filledCell,
      ]}
      onPress={onPress}
      disabled={letter !== null && letter !== undefined}
    >
      {letter ? (
        <View style={styles.letterContainer}>
          <Text style={[styles.letter, { fontSize: CELL_SIZE * 0.5 }]}>
            {letter === "JOKER" ? "*" : letter}
          </Text>
          {points !== null && (
            <Text style={[styles.points, { fontSize: CELL_SIZE * 0.25 }]}>
              {points}
            </Text>
          )}
        </View>
      ) : specialIcon ? (
        <Text style={[styles.special, { fontSize: CELL_SIZE * 0.5 }]}>
          {specialIcon}
        </Text>
      ) : (
        <Text style={[styles.description, { fontSize: CELL_SIZE * 0.35 }]}>
          {description}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cell: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: "#cccccc",
    padding: 0,
    margin: 0,
  },
  selectedCell: {
    borderWidth: 2,
    borderColor: "#3f51b5",
  },
  filledCell: {
    backgroundColor: "#FFE4B5", // Dolu hücre rengi
  },
  letterContainer: {
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    height: "100%",
  },
  letter: {
    fontWeight: "bold",
  },
  points: {
    position: "absolute",
    bottom: 1,
    right: 1,
  },
  description: {
    color: "#666",
  },
  special: {
    color: "#333",
  },
});
