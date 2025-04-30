// src/components/GameBoard.jsx
import React from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import BoardCell from "./BoardCell";

// Ekran boyutlarına göre tahta boyutunu hesapla
const { width } = Dimensions.get("window");
const BOARD_SIZE = Math.min(width - 20, 375); // Ekran genişliği veya maksimum 375px
const CELL_SIZE = BOARD_SIZE / 15; // 15x15 bir tahta için hücre boyutu

export default function GameBoard({
  board,
  selectedCells = [],
  onCellPress,
  showSpecials = false, // Debug modu için mayın ve ödülleri göster
  getUserRack, // Harfleri getiren fonksiyon - bu parametreyi yolladığından emin ol
}) {
  // Bir hücrenin seçili olup olmadığını kontrol et
  const isCellSelected = (row, col) => {
    return selectedCells.some((cell) => cell.row === row && cell.col === col);
  };

  // Seçili hücreden harfi al
  const getSelectedCellLetter = (row, col) => {
    const selectedCell = selectedCells.find(
      (cell) => cell.row === row && cell.col === col
    );

    if (!selectedCell || selectedCell.rackIndex === undefined) {
      return null;
    }

    const userRack = getUserRack ? getUserRack() : [];

    if (!userRack || !Array.isArray(userRack) || userRack.length === 0) {
      return null;
    }

    if (
      selectedCell.rackIndex < 0 ||
      selectedCell.rackIndex >= userRack.length
    ) {
      console.warn(
        `Geçersiz raf indeksi: ${selectedCell.rackIndex}, raf uzunluğu: ${userRack.length}`
      );
      return null;
    }

    const letterObj = userRack[selectedCell.rackIndex];

    if (!letterObj) {
      return null;
    }

    // Harf nesne veya string olabilir
    return typeof letterObj === "object" ? letterObj.letter : letterObj;
  };

  // Tahta satırları ve hücrelerini oluştur
  const renderBoard = () => {
    const rows = [];

    for (let i = 0; i < 15; i++) {
      const cells = [];

      for (let j = 0; j < 15; j++) {
        const cellData = board[i][j] || {};
        const isSelected = isCellSelected(i, j);

        // Varsayılan olarak hücredeki kalıcı harfi göster
        let displayLetter = cellData.letter;
        let isTemporary = false;

        // Eğer bu hücre şu anda seçili ise, geçici harfi göster
        if (isSelected) {
          const selectedLetter = getSelectedCellLetter(i, j);
          if (selectedLetter) {
            displayLetter = selectedLetter;
            isTemporary = true;

            // Debug için log
            console.log(
              `Geçici harf yerleştirildi - Satır: ${i}, Sütun: ${j}, Harf: ${displayLetter}`
            );
          }
        }

        cells.push(
          <BoardCell
            key={`cell-${i}-${j}`}
            letter={displayLetter}
            points={cellData.points}
            type={cellData.type}
            special={showSpecials ? cellData.special : null}
            isSelected={isSelected}
            isTemporary={isTemporary}
            onPress={() => onCellPress && onCellPress(i, j)}
          />
        );
      }

      rows.push(
        <View key={`row-${i}`} style={styles.row}>
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
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
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
    flex: 1,
  },
});
