const fs = require("fs/promises");
const matchService = require("../services/matchService");
const config = require("../config");
const pool = require("../infrastructure/db");

async function processRequests(filePath = config.paths.requests) {
    const raw = await fs.readFile(filePath, "utf-8");
    const requests = JSON.parse(raw);

    if (!Array.isArray(requests)) {
        throw new Error("Il file delle richieste deve contenere un array JSON");
    }

    let totalMatches = 0;

    for (const request of requests) {
        console.log(`Elaboro richiesta ${request.requestId} (type: ${request.type})`);
        const matches = await matchService.createMatchesForRequest(request);

        if (matches.length === 0) {
            console.log(`Nessuna TD compatibile trovata per ${request.type}`);
            continue;
        }

        for (const tdId of matches) {
            console.log(`Match salvato: request ${request.requestId} ↔ TD ${tdId}`);
            totalMatches++;
        }
    }

    return totalMatches;
}

async function main() {
    try {
        const total = await processRequests();
        console.log(`\nFine elaborazione. Match totali salvati: ${total}`);
    } catch (error) {
        console.error("Errore durante l'elaborazione delle richieste:", error);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    processRequests,
};