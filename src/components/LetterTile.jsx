// src/components/LetterTile.jsx
import React from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";
export default function LetterTile({
  letter,
  points,
  isSelected,
  isFrozen,
  onPress,
}) {
  // Harf tanımsızsa gösterme
  if (!letter) {
    return null;
  }

  return (
    <TouchableOpacity
      style={[
        styles.tile,
        isSelected && styles.selectedTile,
        isFrozen && styles.frozenTile,
      ]}
      onPress={onPress}
      disabled={isFrozen}
    >
      <Text style={[styles.letter, isFrozen && styles.frozenLetter]}>
        {letter === "JOKER" ? "*" : letter}
      </Text>
      {points !== null && <Text style={styles.points}>{points}</Text>}
      {isFrozen && <Text style={styles.frozenIcon}>❄️</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 40,
    height: 40,
    backgroundColor: "#FFF8DC", // Krem rengi
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
    margin: 3,
    borderWidth: 1,
    borderColor: "#DEB887", // Koyu krem
    elevation: 2,
  },
  selectedTile: {
    backgroundColor: "#FFD700", // Altın rengi (seçili)
    borderColor: "#DAA520", // Koyu altın
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
