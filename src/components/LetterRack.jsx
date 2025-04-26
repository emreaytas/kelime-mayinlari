// src/components/LetterRack.jsx
import React from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import LetterTile from "./LetterTile";

export default function LetterRack({
  letters,
  selectedIndices = [],
  onTilePress,
}) {
  // Veri kontrolü
  if (!letters || !Array.isArray(letters)) {
    console.warn("Invalid letters data:", letters);
    return <View style={styles.rack} />;
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.rack}>
        {letters.map((letterObj, index) => {
          // Hem nesne hem de string formatlarını destekle
          const letter =
            typeof letterObj === "object" && letterObj !== null
              ? letterObj.letter
              : letterObj;

          const points =
            typeof letterObj === "object" && letterObj !== null
              ? letterObj.points
              : null;

          return (
            <LetterTile
              key={`tile-${index}`}
              letter={letter}
              points={points}
              isSelected={selectedIndices.includes(index)}
              onPress={() => onTilePress && onTilePress(index)}
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
