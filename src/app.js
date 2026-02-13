const express = require("express");
const errorHandler = require("./api/middlewares/errorHandler");
const dataRoutes = require("./api/routes/dataRoutes");

/**
 * App Factory
 * Crea e configura l'applicazione Express con:
 * - Middleware per il parsing JSON
 * - Route di status (healthcheck)
 * - Route per fornire TD agli oracoli
 * - Middleware di error handling globale
 */
        
function createApp() {
    const app = express();

    app.use(express.json());

    app.get("/", (req, res) => {
        res.json({ status: "Indexer ZONIA Online" });
    });

    app.use("/data", dataRoutes);

    app.use(errorHandler);

    // Ritorna l'app configurata per il server di avviarla
    return app;
}

module.exports = createApp;