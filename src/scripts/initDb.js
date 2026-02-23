const pool = require("../infrastructure/db");

/**
 * Script di Inizializzazione Database
 * Crea le tabelle PostgreSQL necessarie per il funzionamento dell'indexer.
 * Tabelle create:
 * 1. td_store - Memorizza le Thing Descriptions in formato JSONB
 * 2. on_chain_log - Log di tutte le azioni blockchain per audit trail
 */

async function initDatabase() {
    try {
        console.log("Inizializzazione database...");

        await pool.query(`
            CREATE TABLE IF NOT EXISTS td_store (
                id SERIAL PRIMARY KEY,
                td JSONB NOT NULL
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS on_chain_log (
                id SERIAL PRIMARY KEY,
                request_id TEXT NOT NULL,
                action TEXT NOT NULL,
                tx_hash TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS td_matches (
                id SERIAL PRIMARY KEY,
                request_id TEXT NOT NULL,
                td_id UUID NOT NULL,
                matched_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await pool.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS td_matches_request_td_uniq
            ON td_matches (request_id, td_id);
        `);

        console.log(" Database pronto!\n");
        
        process.exit(0);
    } catch (error) {
        console.error(":-() Errore:", error.message);
        process.exit(1);
    }
}

// Esegui solo se eseguito direttamente, non quando importato
if (require.main === module) {
    initDatabase();
}

module.exports = { initDatabase };
