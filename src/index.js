const express = require("express");
const bodyParser = require("body-parser");
const pool = require("./db");

const app = express();
const PORT = 3000;

const responseRoute = require("./routes/responseRoute");// Importa la route per le risposte

app.use(bodyParser.json());

app.use("/response", responseRoute);// Usa la route per le risposte

// Route di test
app.get("/", (req, res) => {
    res.send("Indexer ZONIA attivo!");
});

app.listen(PORT, () => {
    console.log(`Server avviato su http://localhost:${PORT}`);
});
