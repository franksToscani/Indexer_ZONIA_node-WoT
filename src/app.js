const express = require("express");
const errorHandler = require("./api/middlewares/errorHandler");
const dataRoutes = require("./api/routes/dataRoutes");

/**
 * App Factory
 * 
 * Crea e configura l'applicazione Express con:
 * - Middleware per il parsing JSON
 * - Route di status (healthcheck)
 * - Route per fornire TD agli oracoli
 * - Middleware di error handling globale
 * 
 * Pattern Factory:
 * Questo modulo export una funzione che CREA l'app invece di crearla
 * direttamente. Permette al server.js di istanziare l'app quando pronto,
 * e facilita i test (si può creare app multiple indipendenti).
 */

function createApp() {
    const app = express();

    // ====================================================
    // MIDDLEWARE DI PARSING
    // ====================================================
    // Abilita il parsing automatico di request body JSON
    // Converte il body string in oggetto JavaScript
    app.use(express.json());

    // ====================================================
    // ROUTE DI HEALTH CHECK
    // ====================================================
    // Endpoint semplice per verificare che l'applicazione è online
    // Utile per monitoring, load balancer, ecc.
    // 
    // GET /
    // Response: { "status": "Indexer ZONIA Online" }
    app.get("/", (req, res) => {
        res.json({ status: "Indexer ZONIA Online" });
    });

    // ====================================================
    // ROUTES PRINCIPALE
    // ====================================================
    // Tutti gli endpoint che cominciano con /data sono gestiti da dataRoutes
    // Attualmente: GET /data/:requestId
    // Definito in src/api/routes/dataRoutes.js
    app.use("/data", dataRoutes);

    // ====================================================
    // ERROR HANDLING MIDDLEWARE
    // ====================================================
    // Middleware di error globale
    // Cattura qualsiasi errore lanciato nei controller o route
    // e lo formatta in una risposta JSON standardizzata
    // 
    // Nota: DEVE essere l'ultimo middleware registrato!
    app.use(errorHandler);

    // Ritorna l'app configurata per il server di avviarla
    return app;
}

module.exports = createApp;