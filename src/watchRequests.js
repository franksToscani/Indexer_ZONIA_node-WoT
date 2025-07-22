const fs = require("fs");
const path = require("path");
const pool = require("./db");

const requestsPath = path.join(__dirname, "../requests.json");

async function watchRequests() {
    try {
        const raw = fs.readFileSync(requestsPath, "utf-8");
        const requests = JSON.parse(raw);
        let totalMatches = 0;

        for (const req of requests) {
            console.log(`🔍 Elaboro richiesta ${req.requestId} (type: ${req.type})`);

            // Trova TD compatibili: supporta sia stringa che array
            const result = await pool.query(`
        SELECT id FROM td_store
        WHERE td->>'@type' = $1
        OR td->'@type' @> $2::jsonb
        `, [req.type, JSON.stringify([req.type])]);

            if (result.rows.length === 0) {
                console.log(`⚠️ Nessuna TD compatibile trovata per ${req.type}`);
                continue;
            }

            for (const row of result.rows) {
                await pool.query(`
            INSERT INTO td_matches (request_id, td_id)
            VALUES ($1, $2)
        `, [req.requestId, row.id]);

                console.log(`Match salvato: request ${req.requestId} ↔ TD ${row.id}`);
                totalMatches++;
            }
        }

        console.log(`\n🏁 Fine elaborazione. Match totali salvati: ${totalMatches}`);
        await pool.end();
        process.exit();
    } catch (err) {
        console.error("Errore durante l'elaborazione delle richieste:", err);
        process.exit(1);
    }
}

watchRequests();
