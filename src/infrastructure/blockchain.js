const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

class BlockchainService {
    /**
     * BlockchainService
     * 
     * Orchestrator centrale per tutte le interazioni blockchain tramite ethers.js v6.
     * Gestisce:
     * - Connessione al nodo blockchain (JSON-RPC)
     * - Firma delle transazioni
     * - Caricamento e istanziazione degli smart contract
     * - Event listener per RequestSubmitted
     * - Memorizzazione temporanea dei TD offerti
     * 
     * Architettura ethers.js v6:
     * - Provider: connessione read-only al nodo blockchain
     * - Wallet: firma delle transazioni con private key
     * - Contract: interfaccia per interagire con smart contract
     */

    /**
     * Inizializza il servizio blockchain
     * 
     * Procedura:
     * 1. Salva configurazione
     * 2. Crea provider JSON-RPC per leggere lo stato blockchain
     * 3. Crea wallet con private key per firmare transazioni
     * 4. Carica gli ABI dei due smart contract (json format)
     * 5. Istanzia gli ethers.Contract per IndexerRegistry e RequestGate
     * 6. Inizializza la mappa per memorizzare TD offerti
     * 
     * @param {Object} config - Configurazione blockchain
     * @param {string} config.rpcUrl - URL del nodo Ethereum (es: http://localhost:8545)
     * @param {string} config.privateKey - Private key dell'account che firma
     * @param {string} config.indexerDid - DID (Decentralized Identifier) dell'indexer
     * @param {string} config.indexerRegistryAddress - Indirizzo del contratto IndexerRegistry
     * @param {string} config.requestGateAddress - Indirizzo del contratto RequestGate
     * @param {number} config.gasLimit - Limite di gas per le transazioni
     * 
     * @example
     * const blockchain = new BlockchainService({
     *   rpcUrl: "http://localhost:8545",
     *   privateKey: "0x...",
     *   indexerDid: "did:example:indexer-001",
     *   indexerRegistryAddress: "0x...",
     *   requestGateAddress: "0x...",
     *   gasLimit: 300000
     * });
     */
    constructor(config) {
        this.config = config;
        
        // ======== Provider: connessione al blockchain ========
        // JsonRpcProvider crea una connessione read-only al nodo
        this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
        
        // ======== Wallet: firma le transazioni ========
        // Combina private key + provider per creare account che può firmare
        this.wallet = new ethers.Wallet(config.privateKey, this.provider);
        
        // ======== Caricamento ABI (Application Binary Interface) ========
        // L'ABI è la definizione JSON delle funzioni del smart contract
        // Permette a ethers.js di sapere come codificare/decodificare le chiamate
        const indexerRegistryAbi = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, "..", "contracts", "IndexerRegistry.abi.json"),
                "utf-8"
            )
        );
        const requestGateAbi = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, "..", "contracts", "RequestGate.abi.json"),
                "utf-8"
            )
        );

        // ======== Contract Instances ========
        // Crea istanze ethers.Contract che permettono di chiamare le funzioni
        this.indexerRegistry = new ethers.Contract(
            config.indexerRegistryAddress,
            indexerRegistryAbi,
            this.wallet
        );

        this.requestGate = new ethers.Contract(
            config.requestGateAddress,
            requestGateAbi,
            this.wallet
        );

        // ======== Memorizzazione TD Offerti ========
        // Map che memorizza i TD offerti per ogni richiesta
        // Struttura: this.didToTds[indexerDid] = [ { requestId, tds }, ... ]
        // Usata quando l'oracle chiama GET /data/:requestId
        this.didToTds = new Map();
    }

    /**
     * Registra l'indexer nello smart contract IndexerRegistry
     * 
     * Questa funzione deve essere chiamata PRIMA di ascoltare eventi.
     * Permette al RequestGate di identificare l'indexer come valido.
     * 
     * Flusso transazione:
     * 1. Crea transazione con parametro: indexerDid
     * 2. Firma la transazione con wallet
     * 3. Invia alla blockchain
     * 4. Attende confirmazione (tx.wait())
     * 5. Ritorna hash della transazione
     * 
     * Costo: Gas per eseguire la funzione register() del contratto
     * 
     * @returns {Promise<string>} Hash della transazione (0x...)
     * @throws {Error} Se il contratto non è disponibile o rifiuta la transazione
     * 
     * @example
     * const txHash = await blockchain.registerIndexer();
     * console.log("Registrato:", txHash);
     */
    async registerIndexer() {
        try {
            console.log(
                `🔗 Registrazione indexer con DID: ${this.config.indexerDid}`
            );
            
            // Chiama register(did) sul contratto IndexerRegistry
            // Il wallet firma automaticamente la transazione
            const tx = await this.indexerRegistry.register(
                this.config.indexerDid,
                { gasLimit: this.config.gasLimit }  // Limite di gas per evitare costi eccessivi
            );
            
            // Attende la confirmazione dalla blockchain
            // di default, attende 1 blocco di confirmazione
            const receipt = await tx.wait();
            
            console.log(`✅ Registrato on-chain - TX: ${receipt.hash}`);
            return receipt.hash;
        } catch (error) {
            console.error("❌ Errore registrazione:", error.message);
            throw error;
        }
    }

    /**
     * Avvia l'ascolto degli eventi RequestSubmitted dal RequestGate
     * 
     * Quando un nuovo RequestSubmitted event viene emesso:
     * 1. Estrae requestId e requiredType dall'evento
     * 2. Chiama il callback handler fornito
     * 3. Il handler valuta la compatibilità e iscrive l'indexer se c'è match
     * 
     * Rimane attivo fino a quando il programma non termina.
     * 
     * @param {Function} onRequestHandler - Callback da eseguire quando arriva una richiesta
     * @param {string} onRequestHandler.requestId - ID della richiesta (address-based hex)
     * @param {string} onRequestHandler.requiredType - @type richiesto nel TD
     * @returns {void}
     * 
     * @example
     * blockchain.listenToRequests(async (requestId, requiredType) => {
     *   console.log(`Ricevuta richiesta per tipo: ${requiredType}`);
     *   const tds = await findTds(requiredType);
     *   if (tds.length > 0) {
     *     await blockchain.applyToRequest(requestId);
     *   }
     * });
     */
    listenToRequests(onRequestHandler) {
        console.log("👂 In ascolto di RequestSubmitted...");
        
        // Registra il listener per l'evento RequestSubmitted
        // Rimane attivo fino a removeAllListeners()
        this.requestGate.on("RequestSubmitted", async (requestId, requiredType) => {
            console.log(`\n📢 Nuova richiesta ricevuta!`);
            console.log(`   RequestID: ${requestId}`);
            console.log(`   Tipo richiesto: ${requiredType}`);
            
            // Esegui il handler (che valuterà compatibilità e iscriversi se match)
            await onRequestHandler(requestId, requiredType);
        });
    }

    /**
     * Iscrive l'indexer a una richiesta specifica chiamando applyToRequest()
     * 
     * Dopo che il listener trova TD compatibili, chiama questa funzione
     * per registrare l'offerta on-chain.
     * 
     * Lo smart contract registra:
     * - indexerDid: chi sta facendo l'offerta
     * - requestId: per quale richiesta
     * - timestamp della transazione
     * 
     * Successivamente, l'oracle contatterà il nostro /data/:requestId endpoint
     * per recuperare i TD memorizzati.
     * 
     * @param {string} requestId - ID della richiesta a cui iscriversi
     * @returns {Promise<string>} Hash della transazione
     * @throws {Error} Se il contratto rifiuta l'iscrizione
     * 
     * @example
     * const txHash = await blockchain.applyToRequest("0x1234abcd");
     * console.log("Iscritto alla richiesta:", txHash);
     */
    async applyToRequest(requestId) {
        try {
            console.log(`🤝 Iscriviti a richiesta ${requestId}...`);
            
            // Chiama applyToRequest(indexerDid, requestId) sul contratto
            const tx = await this.requestGate.applyToRequest(
                this.config.indexerDid,
                requestId,
                { gasLimit: this.config.gasLimit }
            );
            
            // Attende la confirmazione
            const receipt = await tx.wait();
            
            console.log(`✅ Iscritto con successo - TX: ${receipt.hash}`);
            return receipt.hash;
        } catch (error) {
            console.error("❌ Errore iscrizione:", error.message);
            throw error;
        }
    }

    /**
     * Memorizza i TD offerti per una richiesta specifica
     * 
     * Quando l'indexer decide di iscriversi a una richiesta, memorizza i TD
     * compatibili che ha offerto. Questi verranno forniti all'oracle quando
     * chiama GET /data/:requestId.
     * 
     * Struttura della mappa:
     * this.didToTds[indexerDid] = [
     *   { requestId: "0x123", tds: [...] },
     *   { requestId: "0x456", tds: [...] }
     * ]
     * 
     * @param {string} requestId - ID della richiesta
     * @param {Array<Object>} tds - Array di Thing Descriptions da memorizzare
     * @returns {void}
     * 
     * @example
     * blockchain.storeOfferedTds("0x1234abcd", [
     *   { "@type": "Sensor", "title": "Temperature Sensor", ... },
     *   { "@type": "Sensor", "title": "Humidity Sensor", ... }
     * ]);
     */
    storeOfferedTds(requestId, tds) {
        if (!this.didToTds.has(this.config.indexerDid)) {
            this.didToTds.set(this.config.indexerDid, []);
        }
        
        this.didToTds
            .get(this.config.indexerDid)
            .push({ requestId, tds });
        
        console.log(
            `💾 Salvati ${tds.length} TD per richiesta ${requestId}`
        );
    }

    /**
     * Recupera i TD memorizzati per una richiesta specifica
     * 
     * Questa funzione è chiamata da dataController quando l'oracle
     * chiama GET /data/:requestId.
     * 
     * Ricerca nella mappa stored (creata da storeOfferedTds) e ritorna
     * l'array di TD per il requestId specificato.
     * 
     * @param {string} requestId - ID della richiesta di cui cercare i TD
     * @returns {Array<Object>} Array di TD memorizzati (vuoto se non trovato)
     * 
     * @example
     * const tds = blockchain.getOfferedTds("0x1234abcd");
     * // ritorna: [ { "@type": "Sensor", "title": "...", ... } ]
     * 
     * // Se non esiste nessuna offerta per quel requestId:
     * const emptyTds = blockchain.getOfferedTds("0x9999xxxx");
     * // ritorna: []
     */
    getOfferedTds(requestId) {
        const indexed = this.didToTds.get(this.config.indexerDid) || [];
        
        // Cerca nella lista di offerte l'elemento con il requestId corrispondente
        const match = indexed.find((entry) => entry.requestId === requestId);
        
        // Ritorna i TD se trovato, altrimenti array vuoto
        return match ? match.tds : [];
    }

    /**
     * Disconnette tutti i listener dagli smart contract
     * 
     * Deve essere chiamato durante lo spegnimento graceful per pulire
     * i listener e evitare memory leak.
     * 
     * @returns {void}
     */
    disconnect() {
        this.requestGate.removeAllListeners("RequestSubmitted");
        console.log("🔌 Disconnesso da blockchain");
    }
}

module.exports = BlockchainService;
