// src/utils/GameInitUtils.js
// Yeni bir dosya oluşturuyoruz - Oyun başlatma yardımcı fonksiyonları

import wordList from "../assets/wordList";
import { letterValues } from "./GameBoardUtils";

// Kelime listesinden rastgele maksimum 7 harfli bir kelime seç
export const getRandomStartingWord = () => {
  // Sadece maksimum 7 harfli kelimeleri filtrele
  const filteredWords = wordList.filter(
    (word) => word.length <= 7 && word.length >= 3
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

  // Başlangıç pozisyonu: Merkez yıldızın bir alt hücresi (8,7)
  const startRow = 8;
  const startCol = 7;

  // Kelimeyi dikey olarak yerleştir
  for (let i = 0; i < word.length; i++) {
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
  word.split("").forEach((letter) => {
    const index = newPool.findIndex((item) => item.letter === letter);
    if (index !== -1) {
      newPool.splice(index, 1);
    }
  });

  return newPool;
};
