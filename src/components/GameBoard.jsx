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
  showSpecials = false,
  getUserRack,
  restrictedSide = null,
  currentPlayer = null,
}) {
  // Board'un normalize edildiğinden emin ol
  if (!board || !Array.isArray(board) || board.length !== 15) {
    console.error("Geçersiz tahta verisi:", board);
    return (
      <View style={styles.container}>
        <View style={styles.board}>
          <Text>Tahta yükleniyor...</Text>
        </View>
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

  // Bölge kısıtlamasını kontrol et
  const isRestrictedCell = (row, col) => {
    if (!restrictedSide || !currentPlayer) return false;

    // Tahtanın orta çizgisi (sütun 7)
    const midPoint = 7;

    if (restrictedSide === "left") {
      // Sol taraf kısıtlı, sadece sağ tarafta oynayabilir
      return col < midPoint;
    } else if (restrictedSide === "right") {
      // Sağ taraf kısıtlı, sadece sol tarafta oynayabilir
      return col > midPoint;
    }

    return false;
  };

  // Hücreye tıklama işleyicisi
  const handleCellPress = (row, col) => {
    console.log(`GameBoard: Hücre tıklandı (${row}, ${col})`);

    // row ve col'un sayı olduğundan emin ol
    const rowNum = parseInt(row, 10);
    const colNum = parseInt(col, 10);

    console.log(`Dönüştürülmüş değerler: row=${rowNum}, col=${colNum}`);

    if (isNaN(rowNum) || isNaN(colNum)) {
      console.error("Row veya col sayıya dönüştürülemedi!");
      return;
    }

    // Bölge kısıtlaması kontrolü
    if (isRestrictedCell(rowNum, colNum)) {
      console.log("Bu hücre kısıtlı bölgede!");
      return;
    }

    if (onCellPress) {
      onCellPress(rowNum, colNum);
    }
  };

  const renderBoard = () => {
    const rows = [];

    for (let i = 0; i < 15; i++) {
      const cells = [];

      for (let j = 0; j < 15; j++) {
        // Güvenli erişim
        let cellData = {
          letter: null,
          type: null,
          special: null,
          points: null,
        };

        if (board && board[i] && board[i][j]) {
          cellData = {
            letter: board[i][j].letter || null,
            type: board[i][j].type || null,
            special: board[i][j].special || null,
            points: board[i][j].points || null,
          };
        }

        const isSelected = isCellSelected(i, j);
        const isRestricted = isRestrictedCell(i, j);

        let displayLetter = cellData.letter;
        let isTemporary = false;

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
            isRestricted={isRestricted}
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
