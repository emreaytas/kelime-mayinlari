// src/components/LetterTile.jsx
import React from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";

export default function LetterTile({ letter, points, isSelected, onPress }) {
  // If letter is undefined or null, don't render anything
  if (!letter) {
    return null;
  }

  return (
    <TouchableOpacity
      style={[styles.tile, isSelected && styles.selectedTile]}
      onPress={onPress}
    >
      <Text style={styles.letter}>{letter === "JOKER" ? "*" : letter}</Text>
      {points !== null && <Text style={styles.points}>{points}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 40,
    height: 40,
    backgroundColor: "#FFF8DC", // Cream color
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
    margin: 3,
    borderWidth: 1,
    borderColor: "#DEB887", // Dark cream
    elevation: 2,
  },
  selectedTile: {
    backgroundColor: "#FFD700", // Gold
    borderColor: "#DAA520", // Dark gold
    borderWidth: 2,
  },
  letter: {
    fontSize: 18,
    fontWeight: "bold",
  },
  points: {
    fontSize: 10,
    position: "absolute",
    bottom: 2,
    right: 2,
  },
});
