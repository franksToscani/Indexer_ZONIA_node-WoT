const express = require("express");
const bodyParser = require("body-parser");
const responseRoutes = require("./api/routes/responseRoutes");
const errorHandler = require("./api/middlewares/errorHandler");

function createApp() {
    const app = express();

    app.use(bodyParser.json());

    app.get("/", (req, res) => {
        res.send("Indexer ZONIA attivo!");
    });

    app.use("/response", responseRoutes);

    app.use(errorHandler);

    return app;
}

module.exports = createApp;