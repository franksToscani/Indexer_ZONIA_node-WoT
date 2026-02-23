const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

function normalizePrivateKey(privateKey) {
    if (!privateKey) {
        throw new Error("PRIVATE_KEY mancante nel file .env");
    }

    const trimmedKey = privateKey.trim();

    if (/^0x00[0-9a-fA-F]{64}$/.test(trimmedKey)) {
        console.warn(":-# PRIVATE_KEY contiene prefisso extra '00': normalizzato automaticamente.");
        return `0x${trimmedKey.slice(4)}`;
    }

    if (!/^0x[0-9a-fA-F]{64}$/.test(trimmedKey)) {
        throw new Error("PRIVATE_KEY non valida: deve essere una chiave esadecimale da 32 byte (formato 0x + 64 caratteri hex).");
    }

    return trimmedKey;
}

function formatBlockchainError(error) {
    const rawMessage = [
        error?.info?.error?.message,
        error?.reason,
        error?.message,
        error?.shortMessage,
    ]
        .find((value) => value && value !== "could not coalesce error") ||
        error?.shortMessage ||
        "";

    const searchableMessage = [
        error?.info?.error?.message,
        error?.reason,
        error?.message,
        error?.shortMessage,
        (() => {
            try {
                return JSON.stringify(error);
            } catch {
                return "";
            }
        })(),
        (() => {
            try {
                return JSON.stringify(error?.info?.payload);
            } catch {
                return "";
            }
        })(),
    ]
        .filter(Boolean)
        .join(" | ");

    const allowanceMatch = searchableMessage.match(
        /ERC20InsufficientAllowance\((?:\\?"|')?([^,"')]+)(?:\\?"|')?,\s*(\d+),\s*(\d+)\)/
    );

    if (allowanceMatch) {
        const spender = allowanceMatch[1];
        const currentAllowance = allowanceMatch[2];
        const requiredAllowance = allowanceMatch[3];

        return `:-() Allowance token insufficiente per lo stake (spender: ${spender}, allowance attuale: ${currentAllowance}, richiesta: ${requiredAllowance}). Esegui approve() del token ZONIA verso IndexerRegistry prima di register().`;
    }

    if (searchableMessage.includes("DID already registered")) {
        return "DID_ALREADY_REGISTERED";
    }

    return (
        rawMessage ||
        "Errore blockchain sconosciuto"
    );
}

class BlockchainService {
    /**
     * BlockchainService
     * 
     * Centrale per tutte le interazioni blockchain tramite ethers.js.
     * Gestisce:
     * - Connessione al nodo blockchain (JSON-RPC)
     * - Firma delle transazioni
     * - Caricamento e istanziazione degli smart contract
     * - Event listener per RequestSubmitted
     * - Memorizzazione temporanea dei TD offerti
     * 
     * Architettura ethers.js:
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
        const normalizedPrivateKey = normalizePrivateKey(config.privateKey);
        this.wallet = new ethers.Wallet(normalizedPrivateKey, this.provider);
        
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
                `... Registrazione indexer con DID: ${this.config.indexerDid}`
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
            
            console.log(` Registrato on-chain - TX: ${receipt.hash}`);
            return receipt.hash;
        } catch (error) {
            const formattedError = formatBlockchainError(error);
            
            if (formattedError === "DID_ALREADY_REGISTERED") {
                console.log(` DID già registrato on-chain (riavvio listener)`);
                return null;
            }
            
            console.error(`:-() Errore registrazione:`, formattedError);
            throw new Error(formattedError);
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
        console.log(" In ascolto di RequestSubmitted...");

        this.requestGate.on("RequestSubmitted", async (requestId, sender) => {
            console.log(`\n-() Nuova richiesta ricevuta!`);
            console.log(`   RequestID: ${requestId}`);
            console.log(`   Sender: ${sender}`);

            let requiredType = "";
            try {
                const request = await this.requestGate.getRequest(requestId);
                requiredType = request.query;
                console.log(`   Query richiesta: ${requiredType}`);
            } catch (error) {
                console.error(`:-() Impossibile leggere la richiesta on-chain:`, formatBlockchainError(error));
                return;
            }

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
            console.log(`Iscriviti a richiesta ${requestId}...`);
            
            // Chiama applyToRequest(indexerDid, requestId) sul contratto
            const tx = await this.requestGate.applyToRequest(
                this.config.indexerDid,
                requestId,
                { gasLimit: this.config.gasLimit }
            );
            
            // Attende la confirmazione
            const receipt = await tx.wait();
            
            console.log(`Iscritto con successo - TX: ${receipt.hash}`);
            return receipt.hash;
        } catch (error) {
            const formattedError = formatBlockchainError(error);
            console.error(`:-() Errore iscrizione:`, formattedError);
            throw new Error(formattedError);
        }
    }

    /**
     * Memorizza i TD offerti per una richiesta specifica 
     * per adesso lo faccio in una mappa in memoria, ma poi useroi un database vero (es. Redis) per persistenza e scalabilità.
     * 
     * Questa funzione è chiamata dal dataController quando l'oracle chiama GET /data/:requestId
     */
    storeOfferedTds(requestId, tds) {
        if (!this.didToTds.has(this.config.indexerDid)) {
            this.didToTds.set(this.config.indexerDid, []);
        }
        
        this.didToTds
            .get(this.config.indexerDid)
            .push({ requestId, tds });
        
        console.log(
            `Salvati ${tds.length} TD per richiesta ${requestId}`
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
        console.log(" Disconnesso da blockchain");
    }
}

module.exports = BlockchainService;
