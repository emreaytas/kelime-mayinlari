// src/components/Board.jsx - Düzeltilmiş Versiyon
import React from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import BoardCell from "./BoardCell";

// Ekran boyutlarını al
const { width } = Dimensions.get("window");
const BOARD_SIZE = Math.min(width - 20, 375); // Ekran genişliği veya maksimum 375px
const CELL_SIZE = BOARD_SIZE / 15; // 15x15 tahta

export default function Board({
  board,
  selectedCells = [],
  onCellPress,
  showSpecials = false,
}) {
  // Bir hücrenin seçili olup olmadığını kontrol et
  const isCellSelected = (row, col) => {
    return selectedCells.some((cell) => cell.row === row && cell.col === col);
  };

  // Tahta verileri yoksa boş bir tahta oluştur
  const renderEmptyBoard = () => {
    const rows = [];
    for (let rowIndex = 0; rowIndex < 15; rowIndex++) {
      const cells = [];
      for (let colIndex = 0; colIndex < 15; colIndex++) {
        // Hücre tipi belirle - varsayılan tahtaya göre
        let type = null;

        // Merkez yıldız (7,7)
        if (rowIndex === 7 && colIndex === 7) {
          type = "star";
        }

        // H2, H3, K2, K3 hücreleri burada tanımlanabilir
        // Boş bir tahta için sadece yıldızı gösteriyoruz

        cells.push(
          <BoardCell
            key={`cell-${rowIndex}-${colIndex}`}
            letter={null}
            points={null}
            type={type}
            special={null}
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

  // Mevcut tahtayı render et
  const renderBoard = () => {
    if (!board || !Array.isArray(board)) {
      return renderEmptyBoard();
    }

    const rows = [];
    for (let rowIndex = 0; rowIndex < board.length; rowIndex++) {
      const cells = [];
      for (
        let colIndex = 0;
        colIndex < (board[rowIndex]?.length || 0);
        colIndex++
      ) {
        const cell = board[rowIndex][colIndex] || {};

        cells.push(
          <BoardCell
            key={`cell-${rowIndex}-${colIndex}`}
            letter={cell.letter}
            points={
              cell.letter
                ? cell.letter === "JOKER"
                  ? 0
                  : getLetterPoints(cell.letter)
                : null
            }
            type={cell.type}
            special={showSpecials ? cell.special : null}
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

  // Harf puanlarını hesapla
  const getLetterPoints = (letter) => {
    const letterValues = {
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
    return letterValues[letter] || 0;
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
});
