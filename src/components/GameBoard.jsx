// src/components/GameBoard.jsx
import React from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import BoardCell from "./BoardCell";

// Get screen dimensions to make the board responsive
const { width } = Dimensions.get("window");
const BOARD_SIZE = Math.min(width - 20, 375); // Screen width or max 375px
const CELL_SIZE = BOARD_SIZE / 15; // For a 15x15 board

export default function GameBoard({
  board,
  selectedCells = [],
  onCellPress,
  showSpecials = false, // Debug option to show mines and rewards
}) {
  // Check if a cell is selected
  const isCellSelected = (row, col) => {
    return selectedCells.some((cell) => cell.row === row && cell.col === col);
  };

  // Create the board rows and cells
  const renderBoard = () => {
    const rows = [];

    for (let i = 0; i < 15; i++) {
      const cells = [];

      for (let j = 0; j < 15; j++) {
        const cellData = board[i][j] || {};

        cells.push(
          <BoardCell
            key={`cell-${i}-${j}`}
            letter={cellData.letter}
            points={cellData.points}
            type={cellData.type}
            special={showSpecials ? cellData.special : null}
            isSelected={isCellSelected(i, j)}
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
