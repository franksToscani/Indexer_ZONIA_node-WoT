const path = require("path");
const dotenv = require("dotenv");

/**
 * Configurazione Centralizzata
 * 
 * Questo modulo centralizza TUTTA la configurazione dell'applicazione
 * da variabili d'ambiente (.env).
 * 
 * Vantaggi di questa approach:
 * - Una sola fonte di verità per le configurazioni
 * - Facile da testare (importa config sempre dal solito posto)
 * - Supporta ambienti diversi (dev, staging, prod)
 * - Separazione di secrets dal codice
 * 
 * File di configurazione: .env (root del progetto)
 */

dotenv.config();

/**
 * Oggetto di configurazione esportato
 * 
 * Organizzato in sezioni (http, db, files, blockchain)
 * per una lettura logica e ordinata.
 */
module.exports = {
    
    // HTTP
    /**
     * Configurazione server HTTP
     * @property {number} port - Porta su cui ascoltare (default 3000)
     */
    http: {
        port: parseInt(process.env.PORT || "3000"),
    },

    // Database
    /**
     * Configurazione PostgreSQL
     * @property {string} connectionString - URL di connessione (da DATABASE_URL)
     * Formato: postgresql://user:password@host:port/dbname
     */
    db: {
        connectionString: process.env.DATABASE_URL,
    },

    // Files
    /**
     * Configurazione file
     * @property {string} tdList - Percorso del file JSON con Thing Descriptions
     * Default: tds/td_list.json (relativo alla root)
     */
    files: {
        tdList: process.env.TD_LIST_FILE
            ? path.resolve(process.env.TD_LIST_FILE)
            : path.join(__dirname, "..", "..", "tds", "td_list.json"),
    },

    // Blockchain
    /**
     * Configurazione per l'interazione blockchain via ethers.js
     * @property {string} rpcUrl - URL del nodo Ethereum (da RPC_URL)
     * @property {string} privateKey - Private key dell'account (da PRIVATE_KEY)
     * @property {string} indexerDid - DID dell'indexer (da INDEXER_DID)
     * @property {string} indexerRegistryAddress - Indirizzo contratto IndexerRegistry
     * @property {string} requestGateAddress - Indirizzo contratto RequestGate
     * @property {number} gasLimit - Limite di gas per transazioni (default 500000)
     */
    blockchain: {
        rpcUrl: process.env.RPC_URL,
        privateKey: process.env.PRIVATE_KEY,
        indexerDid: process.env.INDEXER_DID,
        indexerRegistryAddress: process.env.INDEXER_REGISTRY_ADDRESS,
        requestGateAddress: process.env.REQUEST_GATE_ADDRESS,
        gasLimit: parseInt(process.env.GAS_LIMIT || "500000"),
    },
};
