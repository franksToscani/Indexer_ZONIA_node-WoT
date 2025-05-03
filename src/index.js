const express = require("express");
const bodyParser = require("body-parser");
const pool = require("./db");

const app = express();
const PORT = 3000;

app.use(bodyParser.json());

// Route di test
app.get("/", async (req, res) => {
    res.send("Indexer ZONIA attivo!");
});

app.listen(PORT, () => {
    console.log(`✅ Server avviato su http://localhost:${PORT}`);
});
