const createApp = require("./app");
const config = require("./config");
const pool = require("./infrastructure/db");

async function start() {
    let client;
    try {
        client = await pool.connect();
        console.log("Connessione a PostgreSQL riuscita");
    } catch (error) {
        console.error("Errore connessione PostgreSQL:", error);
        process.exit(1);
    } finally {
        client?.release();
    }

    const app = createApp();
    const port = config.http.port;

    app.listen(port, () => {
        console.log(`Server avviato su http://localhost:${port}`);
    });
}

start();