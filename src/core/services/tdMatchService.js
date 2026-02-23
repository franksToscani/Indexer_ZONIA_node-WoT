/**
 * TdMatchService
 * 
 * Service che gestisce la ricerca di Thing Descriptions compatibili.
 * 
 * Responsabilità:
 * - Interrogare il database per trovare TD
 * - Filtrare per tipo (@type)
 * - Recuperare i dati completi delle TD
 * - Gestire i casi di errore
 */

const tdRepository = require("../repositories/tdRepository");

class TdMatchService {
    /**
     * Trova tutte le TD compatibili per un tipo richiesto
     * 
     * Questo metodo:
     * 1. Chiama il repository per trovare gli ID delle TD del tipo richiesto
     * 2. Se non trova nulla, ritorna un array vuoto
     * 3. Altrimenti recupera i dati completi delle TD
     * 4. Ritorna le TD complete
     * */
    async findCompatibleTds(requiredType) {
        try {
            const candidateTdIds = await tdRepository.findTdIdsByType(requiredType);
            
            if (candidateTdIds.length === 0) {
                console.log(`Nessun TD compatibile per tipo: ${requiredType}`);
                return [];
            }

            // Recupera i TD completi (con i dati JSON)
            // Abbiamo gli ID, ora otteniamo l'oggetto completo dal database
            const tds = await tdRepository.findTdsByIds(candidateTdIds);
            
            console.log(`Trovati ${tds.length} TD compatibili`);
            return tds;
        } catch (error) {
            console.error(`:-() Errore ricerca TD:`, error.message);
            return [];
        }
    }
}

// Esporta come singleton (una sola istanza in tutta l'app)
module.exports = new TdMatchService();
