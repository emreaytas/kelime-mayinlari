// src/utils/GameBoardUtils.js
import wordList from "../assets/wordList";

// Harflerin puan değerleri
export const letterValues = {
  A: 1,
  B: 3,
  C: 4,
  Ç: 4,
  D: 3,
  E: 1,
  F: 7,
  G: 5,
  Ğ: 8,
  H: 5,
  I: 2,
  İ: 1,
  J: 10,
  K: 1,
  L: 1,
  M: 2,
  N: 1,
  O: 2,
  Ö: 7,
  P: 5,
  R: 1,
  S: 2,
  Ş: 4,
  T: 1,
  U: 2,
  Ü: 3,
  V: 7,
  Y: 3,
  Z: 4,
  JOKER: 0,
};

// Harflerin adetleri
export const letterCounts = {
  A: 12,
  B: 2,
  C: 2,
  Ç: 2,
  D: 2,
  E: 8,
  F: 1,
  G: 1,
  Ğ: 1,
  H: 1,
  I: 4,
  İ: 7,
  J: 1,
  K: 7,
  L: 7,
  M: 4,
  N: 5,
  O: 3,
  Ö: 1,
  P: 1,
  R: 6,
  S: 3,
  Ş: 2,
  T: 5,
  U: 3,
  Ü: 2,
  V: 1,
  Y: 2,
  Z: 2,
  JOKER: 2,
};

// 15x15 boş oyun tahtası oluştur
export const createEmptyBoard = () => {
  return Array(15)
    .fill()
    .map(() =>
      Array(15)
        .fill()
        .map(() => ({
          letter: null,
          type: null,
          special: null,
        }))
    );
};

// Oyun tahtasını başlat (sabit özel hücreler) - Mayınlar ve ödüller hariç
export const initializeBoard = () => {
  const board = createEmptyBoard();

  // Özel hücre tipleri

  // H2 hücreleri (harf puanı 2 kat)
  const h2Cells = [
    [0, 5],
    [0, 9],
    [1, 6],
    [1, 8],
    [5, 0],
    [5, 5],
    [5, 9],
    [5, 14],
    [6, 1],
    [6, 6],
    [6, 8],
    [6, 13],
    [8, 1],
    [8, 6],
    [8, 8],
    [8, 13],
    [9, 0],
    [9, 5],
    [9, 9],
    [9, 14],
    [13, 6],
    [13, 8],
    [14, 5],
    [14, 9],
  ];

  // H3 hücreleri (harf puanı 3 katı)
  const h3Cells = [
    [1, 1],
    [1, 13],
    [4, 4],
    [4, 10],
    [10, 4],
    [10, 10],
    [13, 1],
    [13, 13],
  ];

  const k2Cells = [
    [2, 7],
    [3, 3],
    [3, 11],
    [7, 2],
    [7, 12],
    [11, 3],
    [11, 11],
    [12, 7],
  ];

  // K3 hücreleri (kelime puanı 3 kat)
  const k3Cells = [
    [0, 2],
    [0, 12],
    [2, 0],
    [2, 14],
    [12, 0],
    [12, 14],
    [14, 2],
    [14, 12],
  ];
  // Hücre tiplerini yerleştir
  h2Cells.forEach(([row, col]) => {
    board[row][col].type = "H2";
  });
  h3Cells.forEach(([row, col]) => {
    board[row][col].type = "H3";
  });
  k2Cells.forEach(([row, col]) => {
    board[row][col].type = "K2";
  });
  k3Cells.forEach(([row, col]) => {
    board[row][col].type = "K3";
  });

  // Merkez hücre (oyunun başlangıç noktası)
  board[7][7].type = "star";

  return board;
};

// Diziyi karıştırma (Fisher-Yates algoritması)
export const shuffleArray = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// Mayınlar oluştur
export const generateMines = () => {
  const mines = [
    ...Array(5).fill("PuanBolunmesi"), // 5 adet
    ...Array(4).fill("PuanTransferi"), // 4 adet
    ...Array(3).fill("HarfKaybi"), // 3 adet
    ...Array(2).fill("EkstraHamleEngeli"), // 2 adet
    ...Array(2).fill("KelimeIptali"), // 2 adet
  ];
  return shuffleArray(mines);
};

// Ödüller oluştur
export const generateRewards = () => {
  const rewards = [
    ...Array(2).fill("BolgeYasagi"), // 2 adet
    ...Array(3).fill("HarfYasagi"), // 3 adet
    ...Array(2).fill("EkstraHamleJokeri"), // 2 adet
  ];
  return shuffleArray(rewards);
};

// Mayın ve ödülleri tahtaya yerleştir
export const placeSpecialsOnBoard = (board, mines, rewards) => {
  // Tahta kopyası oluştur
  const newBoard = JSON.parse(JSON.stringify(board));

  // Boş hücreler (özel tip olmayan hücreler)
  const emptyCells = [];
  for (let row = 0; row < 15; row++) {
    for (let col = 0; col < 15; col++) {
      if (newBoard[row][col].type === null) {
        emptyCells.push({ row, col });
      }
    }
  }

  // Boş hücreleri karıştır
  const shuffledCells = shuffleArray(emptyCells);

  // Tüm özel öğeleri birleştir
  const allSpecials = [...mines, ...rewards];

  // Özel öğeleri yerleştir
  const totalSpecials = Math.min(allSpecials.length, shuffledCells.length);
  for (let i = 0; i < totalSpecials; i++) {
    const { row, col } = shuffledCells[i];
    newBoard[row][col].special = allSpecials[i];
  }

  return newBoard;
};

// Tam oyun tahtası oluştur (sabit hücreler + rastgele mayın ve ödüller)
export const createGameBoard = () => {
  // Sabit hücreli tahtayı başlat
  const baseBoard = initializeBoard();

  // Mayın ve ödülleri oluştur
  const mines = generateMines();
  const rewards = generateRewards();

  // Özel öğeleri tahtaya yerleştir
  return placeSpecialsOnBoard(baseBoard, mines, rewards);
};

// Harf havuzu oluştur
export const generateLetterPool = () => {
  const letterPool = [];

  // Her harften belirlenen sayıda ekle
  Object.entries(letterCounts).forEach(([letter, count]) => {
    for (let i = 0; i < count; i++) {
      letterPool.push({
        letter,
        points: letterValues[letter] || 0,
      });
    }
  });

  // Havuzu karıştır (Fisher-Yates algoritması)
  for (let i = letterPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [letterPool[i], letterPool[j]] = [letterPool[j], letterPool[i]];
  }

  return letterPool;
};

// Harfleri oyunculara dağıt
export const distributeLetters = (letterPool) => {
  if (!letterPool || letterPool.length < 14) {
    throw new Error("Harf havuzu yetersiz!");
  }

  // İlk 7 harf 1. oyuncuya
  const player1Rack = letterPool.slice(0, 7);
  // Sonraki 7 harf 2. oyuncuya
  const player2Rack = letterPool.slice(7, 14);
  // Kalan harfler havuzda kalır
  const remainingPool = letterPool.slice(14);

  return { player1Rack, player2Rack, remainingPool };
};

// Kelime doğrulama
export const validateWord = (word) => {
  if (!word || typeof word !== "string" || word.length < 2) return false;

  // Joker karakterini handle et ve Türkçe karakterleri normalize et
  const wordToCheck = word
    .toLowerCase()
    .replace(/\*/g, "a") // Joker karakterini a ile değiştir
    .replace(/i̇/g, "i") // Türkçe i harfi problemini çöz
    .replace(/ı/g, "i"); // Türkçe ı karakterini i olarak değiştir

  // Debug için
  console.log("GameBoardUtils: Doğrulanacak kelime:", wordToCheck);
  console.log(
    "GameBoardUtils: Kelime listesinde var mı?",
    wordList.includes(wordToCheck)
  );

  return wordList.includes(wordToCheck);
};

// Harf değerlerini al
export const getLetterValues = () => {
  return letterValues;
};
