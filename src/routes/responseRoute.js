const express = require("express");
const router = express.Router();
const pool = require("../db");

// GET /response/:requestId
router.get("/:requestId", async (req, res) => {
    const { requestId } = req.params;
    try {
        const result = await pool.query(`
        SELECT t.td
        FROM td_matches m
        JOIN td_store t ON m.td_id = t.id
        WHERE m.request_id = $1
        `, [requestId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Nessun match trovato per questa richiesta." });
        }

        const tdList = result.rows.map(row => row.td);

        res.json({ requestId, matches: tdList });// Restituisce la lista dei TDs trovati

    } catch (err) {
        console.error("Errore nella route /response:", err);
        res.status(500).json({ error: "Errore interno del server" });
    }
});

module.exports = router;
