// Harflerin puanları ve adetleri
const LETTER_DATA = {
  A: { count: 12, points: 1 },
  B: { count: 2, points: 3 },
  C: { count: 2, points: 4 },
  Ç: { count: 2, points: 4 },
  D: { count: 2, points: 3 },
  E: { count: 8, points: 1 },
  F: { count: 1, points: 7 },
  G: { count: 1, points: 5 },
  Ğ: { count: 1, points: 8 },
  H: { count: 1, points: 5 },
  I: { count: 4, points: 2 },
  İ: { count: 7, points: 1 },
  J: { count: 1, points: 10 },
  K: { count: 7, points: 1 },
  L: { count: 7, points: 1 },
  M: { count: 4, points: 2 },
  N: { count: 5, points: 1 },
  O: { count: 3, points: 2 },
  Ö: { count: 1, points: 7 },
  P: { count: 1, points: 5 },
  R: { count: 6, points: 1 },
  S: { count: 3, points: 2 },
  Ş: { count: 2, points: 4 },
  T: { count: 5, points: 1 },
  U: { count: 3, points: 2 },
  Ü: { count: 2, points: 3 },
  V: { count: 1, points: 7 },
  Y: { count: 2, points: 3 },
  Z: { count: 2, points: 4 },
  JOKER: { count: 2, points: 0 },
};

// Tüm harfleri içeren dizi oluşturma
export const generateAllLetters = () => {
  const letters = [];

  Object.entries(LETTER_DATA).forEach(([letter, data]) => {
    for (let i = 0; i < data.count; i++) {
      if (letter === "JOKER") {
        letters.push({ char: "*", points: 0, isJoker: true });
      } else {
        letters.push({ char: letter, points: data.points });
      }
    }
  });

  return letters;
};

// Harfleri karıştır
export const shuffleLetters = (letters) => {
  const shuffled = [...letters];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Oyun başlangıcı için 7 harf al
export const drawInitialLetters = (letters) => {
  return letters.slice(0, 7);
};

// Belirtilen sayıda yeni harf çek
export const drawLetters = (letters, count) => {
  return letters.slice(0, count);
};

export default LETTER_DATA;
