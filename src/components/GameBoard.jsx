// src/components/GameBoard.jsx - Geliştirilmiş versiyon
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
} from "react-native";

// Ekran genişliğine göre tahta boyutunu ayarla
const windowWidth = Dimensions.get("window").width;
const BOARD_SIZE = Math.min(windowWidth - 20, 375); // Ekran genişliği veya maksimum 375
const CELL_SIZE = BOARD_SIZE / 15; // 15x15 tahta

// Harf puanları - Proje açıklamasından alındı
const LETTER_VALUES = {
  A: 1,
  B: 3,
  C: 4,
  Ç: 4,
  D: 3,
  E: 1,
  F: 7,
  G: 5,
  Ğ: 8,
  H: 5,
  I: 2,
  İ: 1,
  J: 10,
  K: 1,
  L: 1,
  M: 2,
  N: 1,
  O: 2,
  Ö: 7,
  P: 5,
  R: 1,
  S: 2,
  Ş: 4,
  T: 1,
  U: 2,
  Ü: 3,
  V: 7,
  Y: 3,
  Z: 4,
  JOKER: 0,
};

export default function GameBoard({
  board,
  selectedCells = [],
  onCellPress,
  showSpecials = false, // Debug modunda mayın ve ödülleri gösterme seçeneği
}) {
  // Safety check - create a default empty board if the board is invalid
  if (!board || !Array.isArray(board) || board.length !== 15) {
    // Return a loading indicator instead of an empty board
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Tahta yükleniyor...</Text>
      </View>
    );
  }

  // Seçili hücreyi kontrol et
  const isCellSelected = (row, col) => {
    return selectedCells.some((cell) => cell.row === row && cell.col === col);
  };

  // Hücre tipine göre renk ve etiket
  const getCellStyle = (type) => {
    switch (type) {
      case "H2":
        return { backgroundColor: "#87CEFA", label: "H²" }; // Açık mavi
      case "H3":
        return { backgroundColor: "#FF69B4", label: "H³" }; // Pembe
      case "K2":
        return { backgroundColor: "#90EE90", label: "K²" }; // Açık yeşil
      case "K3":
        return { backgroundColor: "#FFA07A", label: "K³" }; // Açık turuncu
      case "star":
        return { backgroundColor: "#FFD700", label: "★" }; // Altın rengi
      default:
        return { backgroundColor: "#f5f5f5", label: "" };
    }
  };

  // Harfin puanını hesapla
  const getLetterPoints = (letter) => {
    if (!letter) return null;
    return letter === "JOKER" ? 0 : LETTER_VALUES[letter] || 0;
  };

  // Özel öğe ikonları
  const getSpecialIcon = (special) => {
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

  // Render each cell in the board
  const renderCell = (cell, rowIndex, colIndex) => {
    // If cell is null or undefined, create a default empty cell
    const safeCell = cell || { type: null, letter: null, special: null };

    // Hücre tipi ve stil
    const { backgroundColor, label } = getCellStyle(safeCell.type);

    // Harfin kendisi ve puanı
    const letter = safeCell.letter;
    const points = letter ? getLetterPoints(letter) : null;

    // Özel öğe (mayın/ödül)
    const specialIcon = showSpecials ? getSpecialIcon(safeCell.special) : "";

    return (
      <TouchableOpacity
        key={`cell-${rowIndex}-${colIndex}`}
        style={[
          styles.cell,
          { backgroundColor },
          isCellSelected(rowIndex, colIndex) && styles.selectedCell,
          letter && styles.filledCell,
        ]}
        onPress={() => onCellPress && onCellPress(rowIndex, colIndex)}
        disabled={letter !== null && letter !== undefined}
      >
        {letter ? (
          <View style={styles.letterContainer}>
            <Text style={styles.letter}>
              {letter === "JOKER" ? "*" : letter}
            </Text>
            {points !== null && <Text style={styles.points}>{points}</Text>}
          </View>
        ) : specialIcon ? (
          <Text style={styles.special}>{specialIcon}</Text>
        ) : (
          <Text style={styles.cellLabel}>{label}</Text>
        )}
      </TouchableOpacity>
    );
  };

  // Manually create rows for safety
  const rows = [];
  for (let rowIndex = 0; rowIndex < 15; rowIndex++) {
    const rowCells = [];

    // Check if this row exists
    const currentRow = board[rowIndex];

    if (Array.isArray(currentRow)) {
      for (let colIndex = 0; colIndex < 15; colIndex++) {
        // Render each cell in the row, with safety checks
        rowCells.push(renderCell(currentRow[colIndex], rowIndex, colIndex));
      }
    } else {
      // Create empty cells if the row is invalid
      for (let colIndex = 0; colIndex < 15; colIndex++) {
        rowCells.push(renderCell(null, rowIndex, colIndex));
      }
    }

    rows.push(
      <View key={`row-${rowIndex}`} style={styles.row}>
        {rowCells}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.board}>{rows}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginVertical: 10,
  },
  board: {
    width: BOARD_SIZE,
    height: BOARD_SIZE,
    borderWidth: 1,
    borderColor: "#000",
    backgroundColor: "#fff",
  },
  row: {
    flexDirection: "row",
    height: CELL_SIZE,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: "#ccc",
  },
  selectedCell: {
    borderWidth: 2,
    borderColor: "#3f51b5",
  },
  filledCell: {
    backgroundColor: "#FFE4B5", // Dolu hücre rengi
  },
  letterContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  letter: {
    fontSize: CELL_SIZE * 0.5,
    fontWeight: "bold",
  },
  points: {
    fontSize: CELL_SIZE * 0.25,
    position: "absolute",
    bottom: 1,
    right: 2,
  },
  cellLabel: {
    fontSize: CELL_SIZE * 0.35,
    color: "#666",
  },
  special: {
    fontSize: CELL_SIZE * 0.5,
  },
  errorContainer: {
    width: BOARD_SIZE,
    height: BOARD_SIZE,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#000",
    backgroundColor: "#fff8dc",
  },
  errorText: {
    color: "#666",
    textAlign: "center",
    padding: 20,
    fontWeight: "bold",
  },
});
