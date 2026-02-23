const createApp = require("./app");
const config = require("./config");
const pool = require("./infrastructure/db");

async function start() {
    try {
        // Test DB connection
        // ====== Verifica accesso database ======
        const client = await pool.connect();
        console.log(":-) Database connesso");
        client.release();

        // ====== Creazione applicazione Express ======
        const app = createApp();
        
        // ====== Avvio server HTTP ======
        app.listen(config.http.port, () => {
            console.log(`:-) Server avviato su http://localhost:${config.http.port}`);
        });
    } catch (error) {
        console.error(":-() Errore avvio:", error.message);
        process.exit(1);
    }
}

start();