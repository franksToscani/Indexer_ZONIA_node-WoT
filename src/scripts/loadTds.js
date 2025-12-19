const tdIngestionService = require("../core/services/tdIngestionService");
const pool = require("../infrastructure/db");

async function main() {
    try {
        const inserted = await tdIngestionService.importFromFile();
        inserted.forEach((entry) => {
            const label = entry.title ?? entry.id;
            console.log(`TD inserita: ${label}`);
        });
        console.log("Inserimento completato per tutte le TD.");
    } catch (error) {
        console.error("Errore durante il caricamento delle TD:", error);
        process.exitCode = 1;
    } finally {
        await pool.end();
        console.log("Connessione al database chiusa.");
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    main,
};