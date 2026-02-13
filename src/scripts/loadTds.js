const fs = require("fs/promises");
const path = require("path");
const config = require("../config");
const tdRepository = require("../core/repositories/tdRepository");

/**
 * Script di Caricamento Thing Descriptions (TD)
 */

async function loadTds() {
    try {
        console.log("📂 Caricamento TD da file...");
        
        const filePath = config.files.tdList;
        
        const raw = await fs.readFile(filePath, "utf-8");

        const tdArray = JSON.parse(raw);

        if (!Array.isArray(tdArray)) {
            throw new Error("Il file TD deve contenere un array JSON");
        }
        let inserted = 0;
        
        for (const td of tdArray) {
            await tdRepository.insertTd(td);

            console.log(`   ✅ Caricato: ${td.title || td.id}`);
            inserted++;
        }

                process.exit(0);
    } catch (error) {
        console.error("❌ Errore:", error.message);
        process.exit(1);
    }
}

// Esegui la funzione SOLO se questo file è eseguito direttamente da terminale
// Non quando è importato come modulo
if (require.main === module) {
    loadTds();
}

module.exports = { loadTds };