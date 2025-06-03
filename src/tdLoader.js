const fs = require("fs");
const path = require("path");
const pool = require("./db");

const tdsFolder = path.join(__dirname, "../tds");

async function loadTDs() {
  try {
    const files = fs.readdirSync(tdsFolder);
    const tdFiles = files.filter(file => file.endsWith(".json"));

    for (const file of tdFiles) {
      const filePath = path.join(tdsFolder, file);
      const raw = fs.readFileSync(filePath, "utf-8");
      const td = JSON.parse(raw);

      await pool.query(
        "INSERT INTO td_store (td) VALUES ($1)",
        [td]
      );

      console.log("TD inserita: ${file}");
    }

    console.log("Inserimento completato per tutte le TD.");
    // Chiudiamo la connessione al database 
    await pool.end();
    console.log("Connessione al database chiusa.");
    process.exit();
  } catch (err) {
    console.error("❌ Errore durante il caricamento delle TD:", err);
    process.exit(1);
  }
}

loadTDs();
