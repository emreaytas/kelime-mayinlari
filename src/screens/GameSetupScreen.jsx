// src/screens/GameSetupScreen.jsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from "react-native";
import {
  createGameBoard,
  generateLetterPool,
  distributeLetters,
} from "../utils/GameBoardUtils";
import GameBoard from "../components/GameBoard";

export default function GameSetupScreen() {
  const [board, setBoard] = useState(null);
  const [letterPool, setLetterPool] = useState([]);
  const [player1Rack, setPlayer1Rack] = useState([]);
  const [player2Rack, setPlayer2Rack] = useState([]);
  const [showSpecials, setShowSpecials] = useState(false);
  const [selectedCells, setSelectedCells] = useState([]);

  // Oyun tahtasını başlat
  const initializeGame = () => {
    // Tam oyun tahtası oluştur
    const gameBoard = createGameBoard();
    setBoard(gameBoard);

    // Harf havuzu oluştur
    const pool = generateLetterPool();
    setLetterPool(pool);

    // Harfleri dağıt
    const { player1Rack, player2Rack, remainingPool } = distributeLetters(pool);
    setPlayer1Rack(player1Rack);
    setPlayer2Rack(player2Rack);
    setLetterPool(remainingPool);

    // Seçimleri sıfırla
    setSelectedCells([]);
  };

  // Sayfa yüklendiğinde oyunu başlat
  useEffect(() => {
    initializeGame();
  }, []);

  // Hücre seçimi
  const handleCellPress = (row, col) => {
    // Sadece bir örnek - seçili hücreleri takip eder
    if (board && !board[row][col].letter) {
      // Hücre seçimini güncelle
      const isAlreadySelected = selectedCells.some(
        (cell) => cell.row === row && cell.col === col
      );

      if (isAlreadySelected) {
        // Seçimi kaldır
        setSelectedCells(
          selectedCells.filter(
            (cell) => !(cell.row === row && cell.col === col)
          )
        );
      } else {
        // Seçim ekle
        setSelectedCells([...selectedCells, { row, col }]);
      }
    }
  };

  // Seçili hücrelere test harfi yerleştir
  const placeTestLetters = () => {
    if (selectedCells.length === 0 || !board) return;

    // Tahta kopyası oluştur
    const newBoard = JSON.parse(JSON.stringify(board));

    // Test harfleri
    const testLetters = ["K", "E", "L", "İ", "M", "E"];

    // Seçili hücrelere harf yerleştir (en fazla testLetters.length kadar)
    const cellsToFill = Math.min(selectedCells.length, testLetters.length);

    for (let i = 0; i < cellsToFill; i++) {
      const { row, col } = selectedCells[i];
      newBoard[row][col].letter = testLetters[i];
    }

    setBoard(newBoard);
    setSelectedCells([]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Kelime Mayınları Tahta Testi</Text>

        <View style={styles.boardContainer}>
          {board ? (
            <GameBoard
              board={board}
              selectedCells={selectedCells}
              onCellPress={handleCellPress}
              showSpecials={showSpecials}
            />
          ) : (
            <Text>Tahta yükleniyor...</Text>
          )}
        </View>

        <View style={styles.controlsContainer}>
          <TouchableOpacity
            style={styles.button}
            onPress={() => setShowSpecials(!showSpecials)}
          >
            <Text style={styles.buttonText}>
              {showSpecials ? "Mayın/Ödülleri Gizle" : "Mayın/Ödülleri Göster"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={initializeGame}>
            <Text style={styles.buttonText}>Tahtayı Yenile</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              selectedCells.length === 0 && styles.disabledButton,
            ]}
            onPress={placeTestLetters}
            disabled={selectedCells.length === 0}
          >
            <Text style={styles.buttonText}>Test Harfleri Yerleştir</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.sectionTitle}>Harf Havuzu</Text>
          <Text>Kalan harf sayısı: {letterPool.length}</Text>

          <Text style={styles.sectionTitle}>Oyuncu 1 Rafı</Text>
          <View style={styles.rackDisplay}>
            {player1Rack.map((item, index) => (
              <View key={`p1-${index}`} style={styles.letterTile}>
                <Text style={styles.letterText}>{item.letter}</Text>
                <Text style={styles.pointText}>{item.points}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Oyuncu 2 Rafı</Text>
          <View style={styles.rackDisplay}>
            {player2Rack.map((item, index) => (
              <View key={`p2-${index}`} style={styles.letterTile}>
                <Text style={styles.letterText}>{item.letter}</Text>
                <Text style={styles.pointText}>{item.points}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Bilgiler</Text>
          <Text style={styles.infoText}>
            - Hücreler: H² (Harf 2x), H³ (Harf 3x), K² (Kelime 2x), K³ (Kelime
            3x)
          </Text>
          <Text style={styles.infoText}>
            - Mayınlar: PuanBölünmesi, PuanTransferi, HarfKaybı,
            EkstraHamleEngeli, Kelimeİptali
          </Text>
          <Text style={styles.infoText}>
            - Ödüller: BölgeYasağı, HarfYasağı, EkstraHamleJokeri
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollContent: {
    padding: 16,
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#2e6da4",
  },
  boardContainer: {
    marginVertical: 16,
    alignItems: "center",
  },
  controlsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: 16,
  },
  button: {
    backgroundColor: "#2e6da4",
    padding: 10,
    borderRadius: 5,
    margin: 5,
    minWidth: 120,
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
  },
  disabledButton: {
    backgroundColor: "#cccccc",
  },
  infoContainer: {
    width: "100%",
    padding: 10,
    backgroundColor: "white",
    borderRadius: 8,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 12,
    marginBottom: 8,
    color: "#2e6da4",
  },
  rackDisplay: {
    flexDirection: "row",
    marginBottom: 10,
  },
  letterTile: {
    width: 35,
    height: 35,
    backgroundColor: "#fff8dc",
    borderRadius: 4,
    margin: 3,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#deb887",
  },
  letterText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  pointText: {
    fontSize: 10,
    position: "absolute",
    bottom: 1,
    right: 2,
  },
  infoText: {
    fontSize: 12,
    marginVertical: 3,
    color: "#555",
  },
});
