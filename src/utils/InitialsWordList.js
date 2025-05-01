// src/utils/InitialWordUtils.js

// Oyun başlangıcında rastgele kelime yerleştirme işlemini yap
export const setupInitialGame = (game) => {
  if (!game || !game.board || !game.letterPool) {
    console.error("Geçersiz oyun verisi");
    return game;
  }

  // Oyun kopyasını oluştur
  const newGame = { ...game };

  // İlk hamle yapıldığını belirt
  newGame.firstMove = false;
  newGame.centerRequired = false;

  return newGame;
};
