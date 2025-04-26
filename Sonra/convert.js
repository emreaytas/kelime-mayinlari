// convert.js
const fs = require("fs");
const path = require("path");

// TXT dosyasının yolu
const txtFilePath = path.join(__dirname, "kelimeler.txt");

// JSON dosyasının çıktı yolu
const jsonOutputPath = path.join(__dirname, "wordList.json");

// TXT dosyasını oku
fs.readFile(txtFilePath, "utf8", (err, data) => {
  if (err) {
    console.error("Dosya okuma hatası:", err);
    return;
  }

  // Kelimeleri satır satır ayır
  const words = data
    .split("\n")
    .map((word) => word.trim())
    .filter((word) => word.length > 0);

  // JSON olarak kaydet
  fs.writeFile(jsonOutputPath, JSON.stringify(words), "utf8", (err) => {
    if (err) {
      console.error("JSON kaydetme hatası:", err);
      return;
    }
    console.log(
      `${words.length} kelime JSON olarak kaydedildi: ${jsonOutputPath}`
    );
  });
});
