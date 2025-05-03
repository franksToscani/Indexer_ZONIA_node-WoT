const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

pool.connect()
    .then(() => console.log("✅ Connessione a PostgreSQL riuscita"))
    .catch((err) => console.error("❌ Errore connessione PostgreSQL:", err));

module.exports = pool;
