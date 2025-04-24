// src/components/DraggableLetterRack.jsx
import React from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import DraggableLetterTile from "./DraggableLetterTile";

export default function DraggableLetterRack({
  letters,
  selectedIndices = [],
  onTilePress,
  onDragStart,
  onDragEnd,
  onTileDropped,
  boardLayout,
  boardRef,
}) {
  if (!letters || !Array.isArray(letters)) {
    console.warn("Invalid letters data:", letters);
    return <View style={styles.rack} />;
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.rack}>
        {letters.map((letterObj, index) => {
          // Handle both object and string formats
          const letter =
            typeof letterObj === "object" && letterObj !== null
              ? letterObj.letter
              : letterObj;

          const points =
            typeof letterObj === "object" && letterObj !== null
              ? letterObj.points
              : null;

          const isSelected = selectedIndices.includes(index);

          return (
            <DraggableLetterTile
              key={`tile-${index}`}
              letter={letter}
              points={points}
              index={index}
              disabled={isSelected}
              onDragStart={(idx) => onDragStart && onDragStart(idx)}
              onDragEnd={(idx) => onDragEnd && onDragEnd(idx)}
              onDropped={(idx, row, col) =>
                onTileDropped && onTileDropped(idx, row, col)
              }
              boardLayout={boardLayout}
              boardRef={boardRef}
            />
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rack: {
    flexDirection: "row",
    padding: 10,
    backgroundColor: "#ddd",
    borderRadius: 5,
    minHeight: 60,
    alignItems: "center",
  },
});
