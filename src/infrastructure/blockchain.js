const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

class BlockchainService {
    /**
     * BlockchainService
     * 
     * Centrale per tutte le interazioni blockchain tramite ethers.js v6.
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

        // ======== Memorizzazione TD Offerti in una Map ========
        // Map che memorizza i TD offerti per ogni richiesta
        // Usata quando l'oracle chiama GET /data/:requestId
        this.didToTds = new Map();
    }

    /**
     * Registriamo con questo l'indexer nello smart contract IndexerRegistry
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
                { gasLimit: this.config.gasLimit } 
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
     * Quando un nuovo RequestSubmitted event viene emesso:
     * 1. Estrae requestId e requiredType dall'evento
     * 2. Chiama il callback handler fornito
     * 3. Il handler valuta la compatibilità e iscrive l'indexer se c'è match
     * Rimane attivo fino a quando il programma non termina.
     */
    listenToRequests(onRequestHandler) {
        console.log("👂 In ascolto di RequestSubmitted...");
        
        this.requestGate.on("RequestSubmitted", async (requestId, requiredType) => {
            console.log(`\n📢 Nuova richiesta ricevuta!`);
            console.log(`   RequestID: ${requestId}`);
            console.log(`   Tipo richiesto: ${requiredType}`);
            
            await onRequestHandler(requestId, requiredType);
        });
    }

    /**
     * Iscrive l'indexer a una richiesta specifica chiamando applyToRequest()
     * 
     * Dopo che il listener trova TD compatibili, chiama questa funzione
     * per registrare l'offerta on-chain.
     * Successivamente, l'oracle contatterà il nostro /data/:requestId endpoint
     * per recuperare i TD memorizzati.
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
     * Deve essere chiamato durante lo spegnimento graceful per pulire
     * i listener e evitare memory leak.
     */
    disconnect() {
        this.requestGate.removeAllListeners("RequestSubmitted");
        console.log("🔌 Disconnesso da blockchain");
    }
}

module.exports = BlockchainService;
