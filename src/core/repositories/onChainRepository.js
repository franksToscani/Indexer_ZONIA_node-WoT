/**
 * OnChainRepository
 * 
 * Repository per le operazioni riguardanti il logging delle azioni on-chain.
 * Tiene traccia di tutte le transazioni e le azioni effettuate sulla blockchain.
 * 
 * Responsabilità:
 * - Creare la tabella di log se non esiste
 * - Registrare le azioni on-chain (registrazione, iscrizione, ecc.)
 * - Mantenere traccia degli hash di transazione
 */

const pool = require("../../infrastructure/db");

/**
 * Inizializza la tabella on_chain_log se non esiste
 * 
 * Questa tabella serve per tracciare tutte le azioni on-chain effettuate dall'indexer.
 * Utile per:
 * - Debug
 * - Audit trail (traccia di tutte le operazioni)
 * - Ripresa da errori
 * 
 * @param {Object} client - (Opzionale) Client PostgreSQL da usare
 * 
 * @returns {Promise<void>}
 * 
 * Schema della tabella:
 * - id: identificatore unico
 * - request_id: ID della richiesta blockchain
 * - action: tipo di azione (es: "register", "apply_to_request")
 * - tx_hash: hash della transazione sulla blockchain
 * - created_at: timestamp dell'azione
 */
async function initOnChainTable(client = pool) {
    // CREATE TABLE IF NOT EXISTS -> crea solo se non esiste
    await client.query(`
        CREATE TABLE IF NOT EXISTS on_chain_log (
            id SERIAL PRIMARY KEY,
            request_id TEXT NOT NULL,
            action TEXT NOT NULL,
            tx_hash TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);
}

/**
 * Logga un'azione on-chain nel database
 * 
 * Questa funzione viene chiamata dopo ogni interazione con la blockchain
 * per creare un registro permanente di ciò che è accaduto.
 * 
 * @param {string} requestId - ID della richiesta o dell'operazione
 * @param {string} action - Descrizione dell'azione eseguita
 *        Esempi: "register_indexer", "apply_to_request", "register_success"
 * @param {string} txHash - Hash della transazione (ritornato dalla blockchain)
 * @param {Object} client - (Opzionale) Client PostgreSQL da usare
 * 
 * @returns {Promise<void>}
 * 
 * @example
 * await logAction(
 *   "req-001",
 *   "apply_to_request",
 *   "0x123abc..."
 * );
 */
async function logAction(requestId, action, txHash, client = pool) {
    // Inserisci una nuova riga nella tabella
    // Le colonne vengono riempite con i parametri forniti
    // created_at viene compilato automaticamente dal database con NOW()
    await client.query(
        `INSERT INTO on_chain_log (request_id, action, tx_hash) 
         VALUES ($1, $2, $3)`,
        [requestId, action, txHash]  // Parametri per evitare SQL injection
    );
}

module.exports = {
    initOnChainTable,
    logAction,
};
