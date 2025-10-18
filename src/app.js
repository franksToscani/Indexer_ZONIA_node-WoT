const express = require("express");
const bodyParser = require("body-parser");
const responseRoutes = require("./routes/responseRoutes");

function createApp() {
    const app = express();

    app.use(bodyParser.json());

    app.get("/", (req, res) => {
        res.send("Indexer ZONIA attivo!");
    });

    app.use("/response", responseRoutes);

    app.use((err, req, res, next) => {
        console.error("Errore nell'applicazione:", err);
        res.status(500).json({ error: "Errore interno del server" });
    });

    return app;
}


module.exports = createApp;