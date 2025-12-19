const express = require("express");
const dataController = require("../controllers/dataController");

/**
 * Data Routes
 * 
 * Definisce le route per fornire Thing Descriptions agli oracoli
 * 
 * Route disponibile:
 * - GET /data/:requestId
 *   Parametri: requestId (path param) - ID della richiesta
 *   Response: { requestId, count, data: [...] }
 */

const router = express.Router();

// GET /data/:requestId
// Recupera i TD memorizzati per una richiesta specifica
// Controller: dataController.getTdData
router.get("/:requestId", dataController.getTdData);

module.exports = router;
