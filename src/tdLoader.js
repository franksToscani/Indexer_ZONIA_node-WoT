const fs = require("fs");
const path = require("path");
const pool = require("./db");

const tdFilePath = path.join(__dirname, "../tds/td_list.json");

async function loadTDs() {
  try {
    const raw = fs.readFileSync(tdFilePath, "utf-8");
    const tdArray = JSON.parse(raw);

    for (const td of tdArray) {
      await pool.query(
        "INSERT INTO td_store (td) VALUES ($1)",
        [td]
      );
      console.log(`TD inserita: ${td.title}`);
    }

    console.log("Inserimento completato per tutte le TD.");
    await pool.end();
    console.log("Connessione al database chiusa.");
    process.exit();
  } catch (err) {
    console.error("Errore durante il caricamento delle TD:", err);
    process.exit(1);
  }
}

loadTDs();
