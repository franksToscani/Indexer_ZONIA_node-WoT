/**
 * TdRepository
 * 
 * Repository che gestisce tutte le operazioni sul database relative alle TD.
 * Questo file implementa il Repository Pattern: centralizza l'accesso ai dati.
 * 
 * Responsabilità:
 * - Inserire nuove TD nel database
 * - Cercare TD per tipo
 * - Recuperare TD complete per ID
 * - Gestire le query PostgreSQL JSONB
 */

const pool = require("../../infrastructure/db");

/**
 * Inserisce una nuova Thing Description nel database
 * 
 * @param {Object} td - L'oggetto TD (Thing Description) da salvare
 *        Deve contenere un campo @type (string o array)
 * @param {Object} client - (Opzionale) Client PostgreSQL da usare
 *        Se non fornito, usa il pool globale
 * 
 * @returns {Promise<number>} L'ID della TD appena inserita
 * 
 * @example
 * const td = {
 *   "@type": "Sensor",
 *   "title": "Temperature Sensor",
 *   "description": "Misura temperatura ambiente"
 * };
 * const id = await insertTd(td);
 * console.log(`TD inserita con ID: ${id}`);
 */
async function insertTd(td, client = pool) {
    // Usa la query di INSERT che ritorna l'ID generato
    // $1 è un placeholder per il parametro td (protegge da SQL injection)
    const { rows } = await client.query(
        "INSERT INTO td_store (td) VALUES ($1) RETURNING id",
        [td]  // td viene passato come array di parametri
    );
    
    // Ritorna l'ID della riga appena inserita
    return rows[0].id;
}

/**
 * Trova tutti gli ID delle TD che hanno un determinato tipo
 * 
 * Usa le operazioni PostgreSQL JSONB per cercare:
 * - td->>'@type' - Estrae il valore del campo @type come stringa
 * - td->'@type' @> - Controlla se il valore è contenuto nell'array
 * 
 * @param {string} type - Il tipo da cercare (es: "Sensor", "Actuator")
 * @param {Object} client - (Opzionale) Client PostgreSQL da usare
 * 
 * @returns {Promise<Array>} Array di ID di TD compatibili
 * 
 * @example
 * const ids = await findTdIdsByType("Sensor");
 * // Ritorna: [1, 3, 5]
 */
async function findTdIdsByType(type, client = pool) {
    // Query che cerca TD dove:
    // 1. td->>'@type' = $1  -> Il @type è una stringa che corrisponde a type
    // 2. td->'@type' @> $2  -> Il @type è un array che contiene type
    const { rows } = await client.query(
        `SELECT id FROM td_store
         WHERE (td->>'@type' = $1 
         OR td->'@type' @> $2::jsonb)`,
        [type, JSON.stringify([type])]  // type come stringa e come array
    );
    
    // Estrai solo gli ID e ritorna come array semplice
    return rows.map((row) => row.id);
}

/**
 * Recupera le TD complete (con i dati JSON) per un array di ID
 * 
 * @param {Array<number>} ids - Array di ID da recuperare
 *        Esempio: [1, 3, 5]
 * @param {Object} client - (Opzionale) Client PostgreSQL da usare
 * 
 * @returns {Promise<Array>} Array di TD complete { id, td }
 * 
 * @example
 * const tds = await findTdsByIds([1, 3, 5]);
 * // Ritorna: [
 * //   { id: 1, td: { "@type": "Sensor", "title": "..." } },
 * //   { id: 3, td: { "@type": "Sensor", "title": "..." } },
 * //   { id: 5, td: { "@type": "Actuator", "title": "..." } }
 * // ]
 */
async function findTdsByIds(ids, client = pool) {
    // Protezione: se non ci sono ID, non eseguire la query
    if (!ids || ids.length === 0) return [];
    
    // Query che usa ANY() per cercare uno qualsiasi degli ID
    // id = ANY($1::int[]) significa: id deve essere uno qualsiasi degli ID in $1
    const { rows } = await client.query(
        "SELECT id, td FROM td_store WHERE id = ANY($1::int[])",
        [ids]  // ids è un array di numeri
    );
    
    // Ritorna le righe così come sono dal database
    return rows;
}

module.exports = {
    insertTd,
    findTdIdsByType,
    findTdsByIds,
};