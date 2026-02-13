/**
 * Database Connection Pool
 * 
 * Crea un pool di connessioni PostgreSQL riutilizzabili
 * per evitare di creare una nuova connessione per ogni query.
 * 
 * questo mio pool:
 * - Mantiene connessioni aperte e disponibili
 * - Le riutilizza per nuove query
 * - Limita il numero massimo di connessioni (default 10)
 * - Riduce latenza e overhead di connessione
 */

const { Pool } = require("pg");
const config = require("../config");

const pool = new Pool({
    connectionString: config.db.connectionString,
});

// Listener per errori inaspettati nel pool
pool.on("error", (err) => {
    console.error("Errore connessione PostgreSQL:", err);
});

module.exports = pool;