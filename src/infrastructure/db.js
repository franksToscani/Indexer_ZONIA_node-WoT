const { Pool } = require("pg");
const config = require("../config");

const pool = new Pool({
    connectionString: config.db.connectionString,
});

pool.on("error", (err) => {
    console.error("Errore connessione PostgreSQL:", err);
});

module.exports = pool;