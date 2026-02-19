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
 * - Validare input e gestire errori
 * - Fornire logging per debug
 */

const pool = require("../../infrastructure/db");

/**
 * Valida che una TD abbia una struttura minima corretta
 */
function validateTd(td) {
    if (!td || typeof td !== "object") {
        throw new Error("TD deve essere un oggetto non-nullo");
    }
    if (!td["@type"]) {
        throw new Error("TD deve contenere il campo @type");
    }
}

/**
 * Valida che il tipo sia una stringa non vuota
 */
function validateType(type) {
    if (!type || typeof type !== "string" || type.trim() === "") {
        throw new Error("Type deve essere una stringa non vuota");
    }
}

/**
 * Inserisce una nuova Thing Description nel database
 */
async function insertTd(td, client = pool) {
    try {
        validateTd(td);
        
        const { rows } = await client.query(
            "INSERT INTO td_store (td) VALUES ($1) RETURNING id",
            [td]
        );
        
        const insertedId = rows[0].id;
        console.log(`✅ TD inserita con ID: ${insertedId}`);
        return insertedId;
    } catch (error) {
        console.error(`❌ Errore inserimento TD:`, error.message);
        throw error;
    }
}

/**
 * Trova tutti gli ID delle TD che hanno un determinato tipo
 * @example
 * const ids = await findTdIdsByType("Sensor");
 * // Ritorna: [1, 3, 5]
 */
async function findTdIdsByType(type, client = pool) {
    try {
        validateType(type);
        
        const { rows } = await client.query(
            `SELECT id FROM td_store
            WHERE (td->>'@type' = $1 
            OR td->'@type' @> $2::jsonb)`,
            [type, JSON.stringify([type])]
        );
        
        const ids = rows.map((row) => row.id);
        console.log(`✅ Trovati ${ids.length} TD di tipo "${type}"`);
        return ids;
    } catch (error) {
        console.error(`❌ Errore ricerca TD per tipo "${type}":`, error.message);
        throw error;
    }
}

/**
 * Recupera le TD complete (con i dati JSON) per un array di ID
 */

async function findTdsByIds(ids, client = pool) {
    try {
        // Protezione: se non ci sono ID, non eseguire la query
        if (!ids || ids.length === 0) {
            console.log("ℹ️ Nessun ID fornito per la ricerca");
            return [];
        }

        if (!Array.isArray(ids)) {
            throw new Error("IDs deve essere un array");
        }

        const normalizedIds = ids.map((id) => String(id));

        const { rows } = await client.query(
            "SELECT id, td FROM td_store WHERE id::text = ANY($1::text[])",
            [normalizedIds]
        );

        console.log(`✅ Recuperate ${rows.length} TD dai ${ids.length} ID requestati`);
        return rows;
    } catch (error) {
        console.error(`❌ Errore recupero TD per IDs:`, error.message);
        throw error;
    }
}


module.exports = {
    insertTd,
    findTdIdsByType,
    findTdsByIds,
};