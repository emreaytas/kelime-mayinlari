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
  getUserRack, // Harfleri getiren fonksiyon
}) {
  if (!board || !Array.isArray(board) || board.length === 0) {
    console.error("Geçersiz tahta verisi:", board);
    return (
      <View style={styles.container}>
        <View style={styles.board}></View>
      </View>
    );
  }

  // Bir hücrenin seçili olup olmadığını kontrol et
  const isCellSelected = (row, col) => {
    return selectedCells.some((cell) => cell.row === row && cell.col === col);
  };

  // Seçili hücrenin harfini al
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

    const rackIndex = selectedCell.rackIndex;

    if (rackIndex < 0 || rackIndex >= userRack.length) {
      console.warn(
        `Geçersiz raf indeksi: ${rackIndex}, raf uzunluğu: ${userRack.length}`
      );
      return null;
    }

    const letterObj = userRack[rackIndex];

    if (!letterObj) {
      return null;
    }

    // Harf nesne veya string olabilir
    return typeof letterObj === "object" ? letterObj.letter : letterObj;
  };

  // Hücreye tıklama işleyicisi
  const handleCellPress = (row, col) => {
    console.log(`GameBoard: Hücre tıklandı (${row}, ${col})`);
    if (onCellPress) {
      onCellPress(row, col);
    }
  };

  // Tahta satırları ve hücrelerini oluştur
  const renderBoard = () => {
    const rows = [];

    // Tahta verisi kontrolü
    if (!board || !Array.isArray(board) || board.length === 0) {
      console.error("Geçersiz tahta verisi:", board);
      return [];
    }

    for (let i = 0; i < 15; i++) {
      const cells = [];

      for (let j = 0; j < 15; j++) {
        // Buradaki hata koruması çok önemli
        // Hücrelere güvenli erişim sağlayın
        const cellData =
          board[i] && board[i][j] ? board[i][j] : { letter: null, type: null };
        const isSelected = isCellSelected(i, j);

        // Varsayılan olarak hücredeki kalıcı harfi göster
        let displayLetter = cellData.letter || null;
        let isTemporary = false;

        // Eğer bu hücre şu anda seçili ise, geçici harfi göster
        if (isSelected) {
          const selectedLetter = getSelectedCellLetter(i, j);
          if (selectedLetter) {
            displayLetter = selectedLetter;
            isTemporary = true;
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
            onPress={() => handleCellPress(i, j)}
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
    padding: 0,
    margin: 0,
    backgroundColor: "#fff", // Arka plan rengi
  },
  board: {
    width: BOARD_SIZE,
    height: BOARD_SIZE,
    borderWidth: 2, // Daha belirgin kenar
    borderColor: "#333", // Daha koyu kenar rengi
    backgroundColor: "#fff",
    overflow: "hidden", // Taşmaları önle
  },
  row: {
    flexDirection: "row", // Yatay yerleşim
    flex: 1, // Her satır eşit yükseklikte
    flexWrap: "nowrap", // Kaydırma olmasın
  },
});
