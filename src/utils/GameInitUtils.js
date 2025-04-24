// src/utils/GameInitUtils.js
import wordList from "../assets/wordList";
import { letterValues } from "./GameBoardUtils";

// Kelime listesinden rastgele maksimum 7 harfli bir kelime seç
export const getRandomStartingWord = () => {
  // Sadece maksimum 7 harfli kelimeleri filtrele
  const filteredWords = wordList.filter(
    (word) => word.length >= 3 && word.length <= 7
  );

  if (filteredWords.length === 0) {
    // Kelime listesi boşsa veya filtreleme sonrası boşsa fallback kelime
    return "kelime";
  }

  // Filtrelenmiş listeden rastgele bir kelime seç
  const randomIndex = Math.floor(Math.random() * filteredWords.length);
  return filteredWords[randomIndex].toUpperCase(); // Hepsi büyük harf olarak döndür
};

// Başlangıç kelimesini tahtaya yerleştir (ortadaki yıldızın altından başlayarak)
export const placeInitialWord = (board, word) => {
  // Tahta kopyasını oluştur
  const newBoard = JSON.parse(JSON.stringify(board));

  // Başlangıç pozisyonu: Merkez yıldız (7,7)
  const startRow = 7;
  const startCol = 7;

  // İlk harfi merkez yıldıza yerleştir
  newBoard[startRow][startCol].letter = word[0];

  // Geri kalan harfleri dikey olarak aşağıya doğru yerleştir
  for (let i = 1; i < word.length; i++) {
    // Tahta sınırlarını kontrol et
    if (startRow + i < 15) {
      newBoard[startRow + i][startCol].letter = word[i];
    }
  }

  return newBoard;
};

// Başlangıç kelimesini yerleştirdikten sonra bu harfleri havuzdan çıkar
export const removeInitialWordFromPool = (letterPool, word) => {
  // Havuz kopyasını oluştur
  const newPool = [...letterPool];

  // Her harf için havuzdan bir tane çıkar
  for (const letter of word) {
    const index = newPool.findIndex(
      (item) =>
        item.letter === letter ||
        (typeof item === "object" && item.letter === letter)
    );

    if (index !== -1) {
      newPool.splice(index, 1);
    }
  }

  return newPool;
};

// Oyun başlangıcında rastgele kelime yerleştirme işlemini yap
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

  // Kullanılan harfleri havuzdan çıkar
  newGame.letterPool = removeInitialWordFromPool(
    newGame.letterPool,
    startingWord
  );

  // İlk hamle yapıldığını belirt
  newGame.firstMove = false;
  newGame.centerRequired = false;

  return newGame;
};
