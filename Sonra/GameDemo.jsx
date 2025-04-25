// src/screens/GameDemo.jsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ScrollView,
} from "react-native";
import GameBoard from "../src/components/GameBoard";
import {
  generateLetterPool,
  distributeLetters,
  initializeBoard,
} from "../src/utils/GameUtils";

export default function GameDemo() {
  const [board, setBoard] = useState(null);
  const [letterPool, setLetterPool] = useState([]);
  const [player1Rack, setPlayer1Rack] = useState([]);
  const [player2Rack, setPlayer2Rack] = useState([]);
  const [currentPlayer, setCurrentPlayer] = useState(1); // 1 or 2
  const [player1Score, setPlayer1Score] = useState(0);
  const [player2Score, setPlayer2Score] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [debugMode, setDebugMode] = useState(false);

  // Start a new game
  const startNewGame = () => {
    // Generate letter pool
    const initialLetterPool = generateLetterPool();

    // Distribute initial letters
    const { player1Rack, player2Rack, remainingPool } =
      distributeLetters(initialLetterPool);

    // Create initial board
    const initialBoard = initializeBoard();

    // Update state
    setBoard(initialBoard);
    setLetterPool(remainingPool);
    setPlayer1Rack(player1Rack);
    setPlayer2Rack(player2Rack);
    setCurrentPlayer(1);
    setPlayer1Score(0);
    setPlayer2Score(0);
    setGameStarted(true);
  };

  // Handle word placement
  const handlePlaceWord = (result) => {
    const { board, playerRack, letterPool, points, specials } = result;

    // Update board
    setBoard(board);

    // Update letter pool
    setLetterPool(letterPool);

    // Update player rack
    if (currentPlayer === 1) {
      setPlayer1Rack(playerRack);

      // Handle point transfer mine
      const hasPointTransfer = specials.some((s) => s.type === "PuanTransferi");

      if (hasPointTransfer) {
        // Add points to player 2 instead
        setPlayer2Score(player2Score + points);
        Alert.alert(
          "Mayın Etkisi",
          "Puan Transferi: Puanlar rakibinize gitti!"
        );
      } else {
        // Add points to current player
        setPlayer1Score(player1Score + points);
      }
    } else {
      setPlayer2Rack(playerRack);

      // Handle point transfer mine
      const hasPointTransfer = specials.some((s) => s.type === "PuanTransferi");

      if (hasPointTransfer) {
        // Add points to player 1 instead
        setPlayer1Score(player1Score + points);
        Alert.alert(
          "Mayın Etkisi",
          "Puan Transferi: Puanlar rakibinize gitti!"
        );
      } else {
        // Add points to current player
        setPlayer2Score(player2Score + points);
      }
    }

    // Check for letter loss mine
    const hasLetterLoss = specials.some((s) => s.type === "HarfKaybi");
    if (hasLetterLoss) {
      Alert.alert("Mayın Etkisi", "Harf Kaybı: Tüm harfleriniz değiştirildi!");
      // The letter replacement is already handled in the GameBoard
    }

    // Check for game end (letterPool empty and a player's rack is empty)
    if (
      letterPool.length === 0 &&
      (player1Rack.length === 0 || player2Rack.length === 0)
    ) {
      endGame();
      return;
    }

    // Switch player
    setCurrentPlayer(currentPlayer === 1 ? 2 : 1);
  };

  // End the game
  const endGame = () => {
    let winner = 0;
    if (player1Score > player2Score) {
      winner = 1;
    } else if (player2Score > player1Score) {
      winner = 2;
    }

    const message =
      winner === 0
        ? "Oyun berabere bitti!"
        : `Oyun bitti! Oyuncu ${winner} kazandı!`;

    Alert.alert("Oyun Sonu", message, [
      { text: "Yeni Oyun", onPress: startNewGame },
      { text: "Tamam" },
    ]);

    setGameStarted(false);
  };

  // Toggle debug mode
  const toggleDebugMode = () => {
    setDebugMode(!debugMode);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Kelime Mayınları Demo</Text>

          {/* Player scores */}
          <View style={styles.scoreContainer}>
            <View
              style={[
                styles.playerScore,
                currentPlayer === 1 && styles.activePlayer,
              ]}
            >
              <Text style={styles.playerLabel}>Oyuncu 1</Text>
              <Text style={styles.scoreText}>{player1Score}</Text>
            </View>

            <View style={styles.separator} />

            <View
              style={[
                styles.playerScore,
                currentPlayer === 2 && styles.activePlayer,
              ]}
            >
              <Text style={styles.playerLabel}>Oyuncu 2</Text>
              <Text style={styles.scoreText}>{player2Score}</Text>
            </View>
          </View>
        </View>

        {gameStarted ? (
          <View style={styles.gameContainer}>
            <Text style={styles.turnText}>Sıra: Oyuncu {currentPlayer}</Text>

            <GameBoard
              initialBoard={board}
              initialLetterPool={letterPool}
              initialPlayerRack={
                currentPlayer === 1 ? player1Rack : player2Rack
              }
              onPlaceWord={handlePlaceWord}
              isUserTurn={true} // For demo, always allow turns
              showDebug={debugMode}
            />
          </View>
        ) : (
          <View style={styles.startContainer}>
            <Text style={styles.instructionText}>
              Kelime Mayınları oyun demosu. Yeni bir oyun başlatın!
            </Text>
            <TouchableOpacity style={styles.startButton} onPress={startNewGame}>
              <Text style={styles.buttonText}>Yeni Oyun Başlat</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Debug toggle */}
        <TouchableOpacity style={styles.debugButton} onPress={toggleDebugMode}>
          <Text style={styles.buttonText}>
            {debugMode ? "Debug Modu Kapat" : "Debug Modu Aç"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    padding: 15,
    backgroundColor: "#2e6da4",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
    textAlign: "center",
    marginBottom: 10,
  },
  scoreContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  playerScore: {
    flex: 1,
    alignItems: "center",
    padding: 10,
    borderRadius: 5,
  },
  activePlayer: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  playerLabel: {
    fontSize: 14,
    color: "white",
  },
  scoreText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
  },
  separator: {
    width: 1,
    height: 30,
    backgroundColor: "white",
    marginHorizontal: 10,
  },
  gameContainer: {
    padding: 10,
  },
  turnText: {
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 10,
  },
  startContainer: {
    padding: 20,
    alignItems: "center",
  },
  instructionText: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
  },
  startButton: {
    backgroundColor: "#4CAF50",
    padding: 15,
    borderRadius: 5,
    width: "80%",
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  debugButton: {
    margin: 10,
    padding: 10,
    backgroundColor: "#FF9800",
    borderRadius: 5,
    alignItems: "center",
  },
});
