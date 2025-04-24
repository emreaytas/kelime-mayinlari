// src/components/Board.jsx
import React from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import BoardCell from "./BoardCell";

// Ekran boyutlarını al
const { width } = Dimensions.get("window");

export default function Board({ selectedCells = [], onCellPress }) {
  // Bir hücrenin seçili olup olmadığını kontrol et
  const isCellSelected = (row, col) => {
    return selectedCells.some((cell) => cell.row === row && cell.col === col);
  };

  // Bir hücrenin tipini belirleme
  const getCellType = (row, col) => {
    // H2 hücreleri (harf puanı 2 katı)
    const h2Cells = [
      [0, 5],
      [0, 9],
      [1, 6],
      [1, 8],
      [5, 0],
      [5, 5],
      [5, 9],
      [5, 14],
      [6, 1],
      [6, 6],
      [6, 8],
      [6, 13],
      [8, 1],
      [8, 6],
      [8, 8],
      [8, 13],
      [9, 0],
      [9, 5],
      [9, 9],
      [9, 13],
      [13, 6],
      [13, 8],
      [14, 5],
      [14, 11],
    ];

    // H3 hücreleri (harf puanı 3 katı)
    const h3Cells = [
      [1, 1],
      [1, 13],
      [4, 4],
      [4, 10],
      [10, 4],
      [10, 10],
      [13, 1],
      [13, 13],
    ];

    // K2 hücreleri (kelime puanı 2 katı)
    const k2Cells = [
      [2, 7],
      [3, 3],
      [3, 11],
      [7, 2],
      [7, 12],
      [11, 3],
      [11, 11],
      [12, 7],
    ];

    // K3 hücreleri (kelime puanı 3 katı)
    const k3Cells = [
      [0, 2],
      [0, 12],
      [2, 0],
      [2, 14],
      [12, 0],
      [12, 14],
      [14, 2],
      [14, 12],
    ];

    // Merkez yıldız (7,7)
    if (row === 7 && col === 7) {
      return "star";
    }

    // Diğer özel hücre tipleri için kontrol
    for (const [r, c] of h2Cells) {
      if (r === row && c === col) return "H2";
    }

    for (const [r, c] of h3Cells) {
      if (r === row && c === col) return "H3";
    }

    for (const [r, c] of k2Cells) {
      if (r === row && c === col) return "K2";
    }

    for (const [r, c] of k3Cells) {
      if (r === row && c === col) return "K3";
    }

    return null; // Normal hücre
  };

  // 15x15 tahta oluşturma
  const renderBoard = () => {
    const rows = [];
    for (let rowIndex = 0; rowIndex < 15; rowIndex++) {
      const cells = [];
      for (let colIndex = 0; colIndex < 15; colIndex++) {
        // Hücre tipi belirle
        const cellType = getCellType(rowIndex, colIndex);

        cells.push(
          <BoardCell
            key={`cell-${rowIndex}-${colIndex}`}
            letter={null} // Başlangıçta tüm hücreler boş
            points={null}
            type={cellType}
            special={null} // Mayın ve ödüller gösterilmiyor
            isSelected={isCellSelected(rowIndex, colIndex)}
            onPress={() => onCellPress && onCellPress(rowIndex, colIndex)}
          />
        );
      }
      rows.push(
        <View key={`row-${rowIndex}`} style={styles.row}>
          {cells}
        </View>
      );
    }
    return rows;
  };

  return (
    <View style={styles.container}>
      <View style={styles.board}>{renderBoard()}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    margin: 0,
  },
  board: {
    width: width,
    aspectRatio: 1, // Kare bir tahta için
    borderWidth: 1,
    borderColor: "#000",
    backgroundColor: "#fff",
    padding: 0,
    margin: 0,
  },
  row: {
    flexDirection: "row",
    flex: 1, // Her satır eşit yükseklikte
    padding: 0,
    margin: 0,
  },
});
