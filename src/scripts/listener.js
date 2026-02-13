const config = require("../config");
const BlockchainService = require("../infrastructure/blockchain");
const tdMatchService = require("../core/services/tdMatchService");
const pool = require("../infrastructure/db");

/**
 * Blockchain Listener Script
 * 
 * Questo è il cuore del mio sistema ZONIA Indexer.
 * Script eseguibile che orchestra l'intero flusso:
 * 
 * Responsabilità principali:
 * 1. Inizializzare BlockchainService e ottenere connessione
 * 2. Registrare l'indexer on-chain sul contratto IndexerRegistry
 * 3. Ascoltare eventi RequestSubmitted dal contratto RequestGate
 * 4. Valutare la compatibilità dei TD per ogni richiesta
 * 5. Iscrivere l'indexer se c'è match trovato
 * 6. Memorizzare TD offerti in memoria per il successivo retrieval via API
 * 7. Gestire lo spegnimento graceful (Ctrl+C)
 * 
 * Utilizzo (da terminale):
 * $ node src/scripts/listener.js
 * 
 * Prerequisiti:
 * - Database PostgreSQL con TD caricate (eseguire loadTds.js prima)
 * - Smart contracts deployed su blockchain
 * - Variabili ambiente configurate (.env)
 * - RPC_URL accessibile
 * - Account con private key finanziato per gas
 */

async function startListener() {
    try {
        console.log("🔗 Inizializzazione Blockchain Service...");
        const blockchain = new BlockchainService(config.blockchain);

        // Rendi il BlockchainService disponibile globalmente
        // Così i controller Express (dataController) possono accedere ai TD memorizzati
        // senza doverlo passare come parametro
        global.blockchain = blockchain;

        // STEP 2: Registrazione on-chain
        console.log("\n📝 Registrazione on-chain...");
        await blockchain.registerIndexer();

        // STEP 3: handler per le richieste
        const onRequestHandler = async (requestId, requiredType) => {
            // Cerchia nel database le TD che hanno il @type richiesto
            const tds = await tdMatchService.findCompatibleTds(requiredType);

            if (tds.length > 0) {
                // Chiama applyToRequest() sul contratto RequestGate
                // Questo registra la nostra offerta on-chain
                await blockchain.applyToRequest(requestId);
                
                // Memorizza i TD in una Map all'interno di BlockchainService
                // Quando l'oracle chiama GET /data/:requestId,
                // dataController recupererà questi TD da qui
                blockchain.storeOfferedTds(requestId, tds);
            }
        };

        // STEP 4: Registra il listener e rimani in ascolto
        blockchain.listenToRequests(onRequestHandler);
        console.log("\n✅ Listener avviato e in ascolto...\n");

        // STEP 5: Gestione dello spegnimento graceful
        // Quando l'utente preme Ctrl+C:
        process.on("SIGINT", () => {
            console.log("\n\n⛔ Spegnimento...");
            blockchain.disconnect();
            pool.end();
            process.exit(0);
        });
    } catch (error) {
        // Se qualcosa fallisce durante l'inizializzazione (registrazione, connessione, ecc),
        console.error("❌ Errore fatale:", error.message);
        process.exit(1);
    }
}

// Esegui la funzione SOLO se questo file è eseguito direttamente da terminale
// Non quando è importato come modulo in un altro file
if (require.main === module) {
    startListener();
}

module.exports = { startListener };
