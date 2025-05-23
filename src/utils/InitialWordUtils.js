// src/utils/InitialWordUtils.js
import wordList from "../assets/wordList";

// Kelime listesinden rastgele maksimum 7 harfli bir kelime seç
export const getRandomStartingWord = () => {
  // Sadece maksimum 7 harfli kelimeleri filtrele
  const filteredWords = wordList.filter(
    (word) => word.length >= 2 && word.length <= 7
  );

  if (filteredWords.length === 0) {
    // Kelime listesi boşsa veya filtreleme sonrası boşsa fallback kelime
    return "kelime";
  }

  // Filtrelenmiş listeden rastgele bir kelime seç
  const randomIndex = Math.floor(Math.random() * filteredWords.length);
  return filteredWords[randomIndex].toUpperCase(); // Hepsi büyük harf olarak döndür
};
// Başlangıç kelimesini tahtaya yerleştir
export const placeInitialWord = (board, word) => {
  // Tahta kopyasını oluştur
  const newBoard = JSON.parse(JSON.stringify(board));

  // Başlangıç pozisyonu: (8,7)
  const startRow = 8;
  const startCol = 7;

  newBoard[startRow][startCol].letter = word[0];

  // Geri kalan harfleri yatay olarak sağa doğru yerleştir
  for (let i = 1; i < word.length; i++) {
    // Tahta sınırlarını kontrol et
    if (startCol + i < 15) {
      newBoard[startRow][startCol + i].letter = word[i];
    }
  }

  return newBoard;
};

export const setupInitialGame = (game) => {
  if (!game || !game.board || !game.letterPool) {
    console.error("Geçersiz oyun verisi");
    return game;
  }

  // Oyun kopyasını oluştur
  const newGame = { ...game };

  // Rastgele bir başlangıç kelimesi seç
  const startingWord = getRandomStartingWord();

  // Kelimeyi tahtaya yerleştir
  newGame.board = placeInitialWord(newGame.board, startingWord);

  // İlk hamle yapıldığını belirt
  newGame.firstMove = false;
  newGame.centerRequired = false;

  // Başlangıç kelimesini kaydet
  newGame.initialWord = startingWord;

  return newGame;
};
