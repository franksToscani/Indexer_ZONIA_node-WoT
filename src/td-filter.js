const pool = require("./db");

/**
 * Trova tutte le TD nel DB che contengono un determinato @type
 * @param {string} type - Il tipo da cercare, es. "temperature"
 * @returns {Promise<Array>} - Lista delle TD trovate
 */
async function findTDsByType(type) {
    try {
        const result = await pool.query(
            `SELECT td FROM td_store WHERE td -> '@type' ? $1`,
            [type]
        );

        console.log(`Trovate ${result.rows.length} TD con @type="${type}"`);
        return result.rows.map(row => row.td);

    } catch (err) {
        console.error("Errore nella query:", err);
        return [];
    }
}

module.exports = { findTDsByType };


/**
 * Trova tutte le TD che hanno almeno uno dei tipi specificati
 * @param {Array<string>} types - Array di tipi da cercare (es. ["temperature", "humidity"])
 * @returns {Promise<Array>} - Lista delle TD corrispondenti
 */

async function findTDsByTypes(types) {
    if (!Array.isArray(types) || types.length === 0) return [];

    // Costruisce una clausola SQL tipo: td -> '@type' ? 'temperature' OR td -> '@type' ? 'humidity'
    const conditions = types.map((_, i) => `td -> '@type' ? $${i + 1}`).join(" OR ");
    const query = `SELECT td FROM td_store WHERE ${conditions}`;

    try {
        const result = await pool.query(query, types);
        console.log(`Trovate ${result.rows.length} TD con @type in [${types.join(", ")}]`);
        return result.rows.map(row => row.td);
    } catch (err) {
        console.error("Errore nella query multipla:", err);
        return [];
    }
}

module.exports = { findTDsByType, findTDsByTypes };
/**
 * Trova tutte le TD che hanno un @type specifico e un @id che inizia con un prefisso dato
 * @param {string} type - Il tipo da cercare, es. "temperature"
 * @param {string} idPrefix - Il prefisso dell'ID da cercare, es. "urn:ngsi-ld:TemperatureSensor:"
 * @returns {Promise<Array>} - Lista delle TD trovate
 */  