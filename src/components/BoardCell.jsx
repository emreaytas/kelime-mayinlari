// src/components/BoardCell.jsx
import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  Dimensions,
} from "react-native";

// Get screen dimensions for responsive cells
const { width } = Dimensions.get("window");
const BOARD_SIZE = Math.min(width - 20, 375);
const CELL_SIZE = BOARD_SIZE / 15;

export default function BoardCell({
  letter,
  points,
  type,
  special,
  isSelected,
  onPress,
}) {
  // Cell color and description based on type
  const getCellStyle = () => {
    switch (type) {
      case "H2":
        return { backgroundColor: "#87CEFA", description: "H²" }; // Light blue
      case "H3":
        return { backgroundColor: "#FF69B4", description: "H³" }; // Pink
      case "K2":
        return { backgroundColor: "#90EE90", description: "K²" }; // Light green
      case "K3":
        return { backgroundColor: "#FFA07A", description: "K³" }; // Light orange
      case "star":
        return { backgroundColor: "#FFD700", description: "★" }; // Gold
      default:
        return { backgroundColor: "#f5f5f5", description: "" };
    }
  };

  // Special item (mine/reward) icon
  const getSpecialIcon = () => {
    if (!special) return "";

    // Mines
    if (special === "PuanBolunmesi") return "💣";
    if (special === "PuanTransferi") return "💸";
    if (special === "HarfKaybi") return "🧨";
    if (special === "EkstraHamleEngeli") return "🚫";
    if (special === "KelimeIptali") return "❌";

    // Rewards
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
        { backgroundColor, width: CELL_SIZE, height: CELL_SIZE },
        isSelected && styles.selectedCell,
        letter && styles.filledCell,
      ]}
      onPress={onPress}
      disabled={letter !== null}
    >
      {letter ? (
        <View style={styles.letterContainer}>
          <Text style={styles.letter}>{letter === "JOKER" ? "*" : letter}</Text>
          {points !== null && <Text style={styles.points}>{points}</Text>}
        </View>
      ) : specialIcon ? (
        <Text style={styles.special}>{specialIcon}</Text>
      ) : (
        <Text style={styles.description}>{description}</Text>
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
  },
  selectedCell: {
    borderWidth: 2,
    borderColor: "#3f51b5",
  },
  filledCell: {
    backgroundColor: "#FFE4B5", // Filled cell color
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
});
