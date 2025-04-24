// src/utils/GameUtils.js
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

// Harflerin sayıları
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

// Kelime doğrulama
export const validateWord = (word) => {
  if (!word || typeof word !== "string" || word.length < 2) return false;

  // Kelimenin doğrulanması
  // Gerçek uygulamada geniş bir Türkçe kelime listesi kullanılmalı
  return wordList.includes(word.toLowerCase());
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

// Harf havuzu oluşturma
export const generateLetterPool = () => {
  const letterPool = [];

  // Her harften gerekli sayıda ekle
  Object.entries(letterCounts).forEach(([letter, count]) => {
    for (let i = 0; i < count; i++) {
      letterPool.push({
        letter,
        points: letterValues[letter],
      });
    }
  });

  // Havuzu karıştır
  return shuffleArray(letterPool);
};

// Harfleri oyuncular arasında dağıtma
export const distributeLetters = (letterPool) => {
  if (!letterPool || letterPool.length < 14) {
    throw new Error("Harf havuzu yetersiz!");
  }

  // İlk 7 harf 1. oyuncuya
  const player1Rack = letterPool.slice(0, 7);
  // Sonraki 7 harf 2. oyuncuya
  const player2Rack = letterPool.slice(7, 14);
  // Kalanlar havuzda kalır
  const remainingPool = letterPool.slice(14);

  return { player1Rack, player2Rack, remainingPool };
};

// Kullanılan harfler yerine yenilerini çekme
export const drawNewLetters = (playerRack, letterPool, usedIndices) => {
  if (!playerRack || !Array.isArray(playerRack)) {
    console.error("Geçersiz oyuncu rafı:", playerRack);
    return { updatedRack: [], updatedPool: letterPool || [] };
  }

  if (!letterPool || !Array.isArray(letterPool)) {
    console.error("Geçersiz harf havuzu:", letterPool);
    return { updatedRack: playerRack, updatedPool: [] };
  }

  // Kullanılan harfleri raftan çıkar
  const updatedRack = [...playerRack];

  // İndeksleri büyükten küçüğe sırala (doğru çıkarma için)
  const sortedIndices = [...usedIndices].sort((a, b) => b - a);

  // Kullanılan harfleri çıkar
  sortedIndices.forEach((index) => {
    if (index >= 0 && index < updatedRack.length) {
      updatedRack.splice(index, 1);
    } else {
      console.warn(
        `Geçersiz raf indeksi: ${index}, raf uzunluğu: ${updatedRack.length}`
      );
    }
  });

  // Yeni harfler çek
  const neededLetters = Math.min(7 - updatedRack.length, letterPool.length);
  const newLetters = letterPool.slice(0, neededLetters);
  const updatedPool = letterPool.slice(neededLetters);

  // Yeni harfleri rafa ekle
  updatedRack.push(...newLetters);

  return { updatedRack, updatedPool };
};

// Mayınlar oluşturma
export const generateMines = () => {
  const mines = [
    ...Array(5).fill("PuanBolunmesi"), // Puan Bölünmesi (5)
    ...Array(4).fill("PuanTransferi"), // Puan Transferi (4)
    ...Array(3).fill("HarfKaybi"), // Harf Kaybı (3)
    ...Array(2).fill("EkstraHamleEngeli"), // Ekstra Hamle Engeli (2)
    ...Array(2).fill("KelimeIptali"), // Kelime İptali (2)
  ];

  // Mayınları karıştır
  return shuffleArray(mines);
};

// Ödüller oluşturma
export const generateRewards = () => {
  const rewards = [
    ...Array(2).fill("BolgeYasagi"), // Bölge Yasağı (2)
    ...Array(3).fill("HarfYasagi"), // Harf Yasağı (3)
    ...Array(2).fill("EkstraHamleJokeri"), // Ekstra Hamle Jokeri (2)
  ];

  // Ödülleri karıştır
  return shuffleArray(rewards);
};

// Oyun tahtası başlatma
// src/utils/GameUtils.js
export const initializeBoard = () => {
  // 15x15 boş tahta oluştur
  const board = Array(15)
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

  // Özel hücre tiplerini tanımla (H2, H3, K2, K3)

  // H2 hücreleri (harf puanı 2 katı)
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

  // Özel hücreleri tahtaya yerleştir
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

  // Merkez hücreyi işaretle
  board[7][7].type = "star";

  return board;
};

// Mayın ve ödülleri tahtaya yerleştirme
export const placeSpecialsOnBoard = (board, mines, rewards) => {
  // Tahtanın kopyasını oluştur
  const newBoard = JSON.parse(JSON.stringify(board));

  // Boş hücreleri bul (H2, H3, K2, K3, star gibi özel tipli hücreler olmayanlar)
  const emptyCells = [];
  for (let row = 0; row < 15; row++) {
    for (let col = 0; col < 15; col++) {
      if (newBoard[row][col].type === null) {
        emptyCells.push({ row, col });
      }
    }
  }

  // Boş hücreleri karıştır
  const shuffledCells = shuffleArray([...emptyCells]);

  // Tüm özel öğeleri birleştir (mayınlar ve ödüller)
  const allSpecials = [...mines, ...rewards];

  // Özel öğeleri yerleştir
  for (let i = 0; i < Math.min(allSpecials.length, shuffledCells.length); i++) {
    const { row, col } = shuffledCells[i];
    newBoard[row][col].special = allSpecials[i];
  }

  return newBoard;
};

// Kelime yerleştirildiğinde özel hücreleri kontrol etme
export const checkSpecialItems = (board, placedCells) => {
  const specials = [];

  placedCells.forEach((cell) => {
    const { row, col } = cell;
    const special = board[row][col]?.special;

    if (special) {
      specials.push({
        type: special,
        row,
        col,
      });
    }
  });

  return specials;
};

// Mayın etkilerini uygulama
export const applyMineEffect = (mineType, points, placedCells, rack) => {
  switch (mineType) {
    case "PuanBolunmesi":
      return Math.round(points * 0.3); // Puanların %30'u

    case "PuanTransferi":
      return -points; // Rakibe transfer edilecek puan

    case "HarfKaybi":
      // Harf kaybı - oyun ekranında özel işlem yapılacak
      return points; // Normal puanları döndür, özel işlem sonra yapılacak

    case "EkstraHamleEngeli":
      // Harf ve kelime çarpanları iptal edilir
      return calculateRawPoints(placedCells, rack);

    case "KelimeIptali":
      return 0; // Kelimeden puan alınmaz

    default:
      return points; // Etki yok
  }
};

// Ham puanları hesaplama (çarpanlar olmadan)
export const calculateRawPoints = (placedCells, rack) => {
  let totalPoints = 0;

  placedCells.forEach((cell) => {
    const { rackIndex } = cell;

    // Harfi oyuncunun rafından al
    const letterObj = rack[rackIndex];
    const letter = typeof letterObj === "object" ? letterObj.letter : letterObj;

    // Harfin puan değerini al (çarpanlar yok)
    const letterPoint = letter === "JOKER" ? 0 : letterValues[letter] || 0;
    totalPoints += letterPoint;
  });

  return totalPoints;
};

// Kelime puanlarını hesaplama
export const calculateWordPoints = (placedCells, board, rack) => {
  let totalPoints = 0;
  let wordMultiplier = 1;

  placedCells.forEach((cell) => {
    const { row, col, rackIndex } = cell;

    // Harfi oyuncunun rafından al
    const letterObj = rack[rackIndex];
    const letter = typeof letterObj === "object" ? letterObj.letter : letterObj;

    // Harfin puan değerini al
    let letterPoint = letter === "JOKER" ? 0 : letterValues[letter] || 0;

    // Hücre tipini kontrol et (çarpanlar)
    const cellType = board[row][col]?.type;

    if (cellType === "H2") {
      letterPoint *= 2; // Harf puanı 2 katı
    } else if (cellType === "H3") {
      letterPoint *= 3; // Harf puanı 3 katı
    } else if (cellType === "K2") {
      wordMultiplier *= 2; // Kelime puanı 2 katı
    } else if (cellType === "K3") {
      wordMultiplier *= 3; // Kelime puanı 3 katı
    }

    totalPoints += letterPoint;
  });

  // Kelime çarpanını uygula
  totalPoints *= wordMultiplier;

  return totalPoints;
};

// Kelime yerleştirmenin geçerli olup olmadığını kontrol etme
export const isValidPlacement = (board, cells, isFirstMove) => {
  // İlk hamleyse, kelime merkez yıldıza yerleştirilmelidir
  if (isFirstMove) {
    const centerIncluded = cells.some(
      (cell) => cell.row === 7 && cell.col === 7
    );
    if (!centerIncluded) return false;
  } else {
    // İlk hamle değilse, mevcut harflere bağlanmalıdır
    const connectedToExisting = cells.some((cell) => {
      const { row, col } = cell;
      const directions = [
        { dr: -1, dc: 0 }, // yukarı
        { dr: 1, dc: 0 }, // aşağı
        { dr: 0, dc: -1 }, // sol
        { dr: 0, dc: 1 }, // sağ
      ];

      return directions.some(({ dr, dc }) => {
        const newRow = row + dr;
        const newCol = col + dc;

        // Tahta sınırlarını kontrol et
        if (newRow >= 0 && newRow < 15 && newCol >= 0 && newCol < 15) {
          // Komşu hücrede harf var mı kontrol et (mevcut yerleştirmeden değil)
          const adjacentHasLetter =
            board[newRow][newCol]?.letter &&
            !cells.some((c) => c.row === newRow && c.col === newCol);

          return adjacentHasLetter;
        }
        return false;
      });
    });

    if (!connectedToExisting) return false;
  }

  return true;
};

// Seçilen hücreleri kelime stringine dönüştürme
export const cellsToWord = (cells, rack, direction) => {
  if (!cells || cells.length === 0) return "";

  // Hücreleri pozisyona göre sırala
  const sortedCells = [...cells].sort((a, b) => {
    if (direction === "horizontal") {
      return a.col - b.col;
    } else {
      return a.row - b.row;
    }
  });

  // Harflerden kelimeyi oluştur
  let word = "";
  sortedCells.forEach((cell) => {
    const { rackIndex } = cell;
    if (rackIndex >= 0 && rackIndex < rack.length) {
      const letterObj = rack[rackIndex];
      const letter =
        typeof letterObj === "object" ? letterObj.letter : letterObj;
      word += letter === "JOKER" ? "*" : letter;
    }
  });

  return word;
};
