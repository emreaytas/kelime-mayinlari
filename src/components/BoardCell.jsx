// src/components/BoardCell.jsx
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

export default function BoardCell({
  letter,
  points,
  type,
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

  const { backgroundColor, description } = getCellStyle();
  // Her hücrenin boyutu ekran genişliğinin 1/15'i olacak
  const cellSize = width / 15;

  return (
    <TouchableOpacity
      style={[
        styles.cell,
        {
          backgroundColor,
          width: cellSize,
          height: cellSize,
        },
        isSelected && styles.selectedCell,
        letter && styles.filledCell,
      ]}
      onPress={onPress}
      disabled={letter !== null && letter !== undefined}
    >
      {letter ? (
        <View style={styles.letterContainer}>
          <Text style={[styles.letter, { fontSize: cellSize * 0.5 }]}>
            {letter === "JOKER" ? "*" : letter}
          </Text>
          {points !== null && (
            <Text style={[styles.points, { fontSize: cellSize * 0.25 }]}>
              {points}
            </Text>
          )}
        </View>
      ) : (
        <Text style={[styles.description, { fontSize: cellSize * 0.35 }]}>
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
});
