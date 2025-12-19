/**
 * Database Connection Pool
 * 
 * Crea un pool di connessioni PostgreSQL riutilizzabili
 * per evitare di creare una nuova connessione per ogni query.
 * 
 * Un pool:
 * - Mantiene connessioni aperte e disponibili
 * - Le riutilizza per nuove query
 * - Limita il numero massimo di connessioni (default 10)
 * - Riduce latenza e overhead
 * 
 * Uso:
 * await pool.query("SELECT * FROM td_store", [])
 * await pool.connect() // per transazioni multi-query
 */

const { Pool } = require("pg");
const config = require("../config");

// Crea il pool con la stringa di connessione da config
// Stringa formato: postgresql://user:password@localhost:5432/dbname
const pool = new Pool({
    connectionString: config.db.connectionString,
});

// Listener per errori inaspettati nel pool
// Se una connessione nel pool fallisce, lo stampiamo
pool.on("error", (err) => {
    console.error("Errore connessione PostgreSQL:", err);
});

// Esporta il pool per l'uso in altri moduli
module.exports = pool;