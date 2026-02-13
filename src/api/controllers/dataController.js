/**
 * Controller per fornire TD agli oracoli
 * gestisce l'endpoint /data/:requestId
 * Flusso:
 * 1. Oracle effettua GET /data/:requestId
 * 2. Recupera i TD dalla memoria di BlockchainService
 * 3. Ritorna i TD come JSON
 * 
 * Risposte possibili:
 * - 200: { requestId, count, data: [...] } - OK, TD trovati
 * - 404: { error: "Nessun TD disponibile..." } - Nessuna offerta per questo ID
 * - 500: Gestito da errorHandler middleware
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

        // Ritorna i TD trovati
        res.json({
            requestId,          
            count: tds.length,   
            data: tds,           
        });
    } catch (error) {
        console.error(`❌ Errore nel controller getTdData:`, error.message);
        next(error);
    }
}

module.exports = {
    getTdData,
};
