const pool = require("../infrastructure/db");

/**
 * Script di Inizializzazione Database
 * 
 * Crea le tabelle PostgreSQL necessarie per il funzionamento dell'indexer.
 * Deve essere eseguito UNA SOLA VOLTA prima di avviare l'applicazione.
 * 
 * Tabelle create:
 * 1. td_store - Memorizza le Thing Descriptions in formato JSONB
 * 2. on_chain_log - Log di tutte le azioni blockchain per audit trail
 * 
 * Utilizzo (da terminale):
 * $ node src/scripts/initDb.js
 */

async function initDatabase() {
    try {
        console.log("🔄 Inizializzazione database...");

        // ====================================================
        // TABELLA 1: td_store
        // ====================================================
        // Memorizza le Thing Descriptions nel formato W3C WoT
        // 
        // Colonne:
        // - id: Primary key auto-incrementante
        // - td: JSONB che contiene l'intero TD
        //
        // Vantaggi JSONB:
        // - Consente query su campi interni (@type, title, ecc)
        // - Supporta operatori come ->> (estrai come text), @> (contains)
        // - Indicizzabile per performance
        //
        // Esempio TD memorizzato:
        // {
        //   "id": "td-001",
        //   "@type": "Sensor",
        //   "title": "Temperature Sensor",
        //   "@context": "https://www.w3.org/2019/wot/td/v1",
        //   "properties": { ... },
        //   "actions": { ... }
        // }
        await pool.query(`
            CREATE TABLE IF NOT EXISTS td_store (
                id SERIAL PRIMARY KEY,
                td JSONB NOT NULL
            );
        `);

        // ====================================================
        // TABELLA 2: on_chain_log
        // ====================================================
        // Traccia tutte le interazioni blockchain per debugging e audit
        // 
        // Colonne:
        // - id: Primary key auto-incrementante
        // - request_id: ID della richiesta a cui si riferisce l'azione
        // - action: Tipo di azione (es: "register", "apply_to_request")
        // - tx_hash: Hash della transazione blockchain (per verificare su etherscan)
        // - created_at: Timestamp automatico dell'azione
        //
        // Utilizzo: Permette di ricostruire la cronologia esatta delle azioni
        //           e debug di problemi con transazioni fallite
        await pool.query(`
            CREATE TABLE IF NOT EXISTS on_chain_log (
                id SERIAL PRIMARY KEY,
                request_id TEXT NOT NULL,
                action TEXT NOT NULL,
                tx_hash TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log("✅ Database pronto!\n");
        
        // Termina il processo con successo (0)
        process.exit(0);
    } catch (error) {
        // Se la creazione delle tabelle fallisce (credenziali sbagliate, DB non exists, ecc):
        console.error("❌ Errore:", error.message);
        process.exit(1);
    }
}

// Esegui solo se eseguito direttamente, non quando importato
if (require.main === module) {
    initDatabase();
}

module.exports = { initDatabase };
