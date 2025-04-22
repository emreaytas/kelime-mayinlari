// src/services/wordService.js
import wordList from "../assets/wordList";

// Kelime doğrulama
export const validateWord = (word) => {
  // Kelime listesinde arama yap (lowercase ile karşılaştır)
  return wordList.includes(word.toLowerCase());
};

// Kelimenin puanını hesapla
export const calculateWordPoints = (word, cellTypes, letterValues) => {
  let totalPoints = 0;
  let wordMultiplier = 1;

  // Her harf için puan hesapla
  for (let i = 0; i < word.length; i++) {
    const letter = word[i];
    let letterPoints = letterValues[letter] || 0;
    const cellType = cellTypes[i];

    // Harf çarpanları
    if (cellType === "H2") {
      letterPoints *= 2;
    } else if (cellType === "H3") {
      letterPoints *= 3;
    } else if (cellType === "K2") {
      wordMultiplier *= 2;
    } else if (cellType === "K3") {
      wordMultiplier *= 3;
    }

    totalPoints += letterPoints;
  }

  // Kelime çarpanı uygula
  totalPoints *= wordMultiplier;

  return totalPoints;
};

// Rastgele kelime seçimi (örneğin test için)
export const getRandomWord = () => {
  const randomIndex = Math.floor(Math.random() * wordList.length);
  return wordList[randomIndex];
};

// Kelime listesini belirli bir harfle başlayan kelimelere göre filtrele
export const getWordsStartingWith = (prefix) => {
  return wordList.filter((word) =>
    word.toLowerCase().startsWith(prefix.toLowerCase())
  );
};

// Kelime listesini belirli bir harfle biten kelimelere göre filtrele
export const getWordsEndingWith = (suffix) => {
  return wordList.filter((word) =>
    word.toLowerCase().endsWith(suffix.toLowerCase())
  );
};

// Kelime listesini belirli harfleri içeren kelimelere göre filtrele
export const getWordsContaining = (letters) => {
  const letterArray = letters.toLowerCase().split("");

  return wordList.filter((word) => {
    const wordLower = word.toLowerCase();
    return letterArray.every((letter) => wordLower.includes(letter));
  });
};

// Belirli bir uzunlukta olan kelimeleri getir
export const getWordsByLength = (length) => {
  return wordList.filter((word) => word.length === length);
};

// Belirli harflerden oluşturulabilecek kelimeleri bul
export const getPossibleWords = (availableLetters) => {
  // Mevcut harfleri küçük harfe çevir ve diziye dönüştür
  const lettersArray = availableLetters.toLowerCase().split("");

  return wordList.filter((word) => {
    // Kelimeyi küçük harfe çevir
    const wordLower = word.toLowerCase();

    // Harflerin kopyasını oluştur (çünkü her harfi sadece bir kez kullanmalıyız)
    const lettersCopy = [...lettersArray];

    // Kelimenin her harfi için kontrol et
    for (const char of wordLower) {
      const index = lettersCopy.indexOf(char);
      if (index === -1) {
        // Bu harf mevcut harfler arasında yok veya zaten kullanılmış
        return false;
      }
      // Harfi kullanıldı olarak işaretle (diziden çıkar)
      lettersCopy.splice(index, 1);
    }

    // Tüm harfler bulundu
    return true;
  });
};

export default {
  validateWord,
  calculateWordPoints,
  getRandomWord,
  getWordsStartingWith,
  getWordsEndingWith,
  getWordsContaining,
  getWordsByLength,
  getPossibleWords,
};
