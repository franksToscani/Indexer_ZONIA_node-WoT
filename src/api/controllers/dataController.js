/**
 * Controller per fornire TD agli oracoli
 */
/**
 * DataController
 * 
 * Controller che gestisce l'endpoint /data/:requestId
 * Fornisce i Thing Descriptions che l'indexer ha offerto per una richiesta specifica.
 * 
 * Flusso:
 * 1. Oracle effettua GET /data/:requestId
 * 2. Recupera i TD dalla memoria di BlockchainService
 * 3. Ritorna i TD come JSON
 */

/**
 * Gestisce la richiesta GET /data/:requestId
 * 
 * Recupera i TD che l'indexer ha memorizzato per una richiesta specifica
 * quando si è iscritto on-chain.
 * 
 * @param {Object} req - Oggetto richiesta Express
 * @param {Object} req.params.requestId - ID della richiesta (estratto da URL)
 * @param {Object} res - Oggetto risposta Express
 * @param {Function} next - Middleware di error handling
 * 
 * @returns {Promise<void>} - Invia una risposta JSON al client
 * 
 * Risposte possibili:
 * - 200: { requestId, count, data: [...] } - OK, TD trovati
 * - 404: { error: "Nessun TD disponibile..." } - Nessuna offerta per questo ID
 * - 500: Gestito da errorHandler middleware
 * 
 * @example
 * GET /data/0x1234abcd
 * Response (200):
 * {
 *   "requestId": "0x1234abcd",
 *   "count": 2,
 *   "data": [
 *     { 
 *       "id": "td-001", 
 *       "@type": "Sensor", 
 *       "title": "Temperature Sensor",
 *       "@context": "https://www.w3.org/2019/wot/td/v1",
 *       ...
 *     },
 *     { 
 *       "id": "td-002", 
 *       "@type": "Sensor",
 *       "title": "Humidity Sensor",
 *       ...
 *     }
 *   ]
 * }
 */
async function getTdData(req, res, next) {
    try {
        const { requestId } = req.params;
        
        // Recupera i TD memorizzati da BlockchainService
        // global.blockchain è settato in listener.js quando avvia il servizio
        // Il ? (optional chaining) è una protezione nel caso non sia inizializzato
        const tds = global.blockchain?.getOfferedTds(requestId) || [];

        if (tds.length === 0) {
            return res.status(404).json({
                error: "Nessun TD disponibile per questa richiesta",
            });
        }

        // Ritorna i TD trovati in formato JSON standardizzato
        res.json({
            requestId,           // L'ID della richiesta dal parametro URL
            count: tds.length,   // Numero totale di TD disponibili
            data: tds,           // Array dei Thing Descriptions
        });
    } catch (error) {
        // Passa l'errore al middleware di error handling
        // che lo formatterà e ritornerà al client
        next(error);
    }
}

module.exports = {
    getTdData,
};
