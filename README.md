# 🔗 ZONIA Indexer

Un indexer Node.js che ascolta eventi blockchain, valuta compatibilità di Thing Descriptions (TD) e si offre volontariamente per fornire dati semantici agli oracoli, secondo l'architettura ZONIA.

---

## 🎯 Cos'è

L'indexer è un componente dell'ecosistema ZONIA che:

1. **Memorizza** TD (Thing Descriptions) in un database locale
2. **Ascolta** smart contract per nuove richieste di dati
3. **Valuta** se possiede TD compatibili con il tipo richiesto
4. **Si registra** on-chain offrendosi volontariamente
5. **Fornisce** i dati agli oracoli via API HTTP

---

## 🏗️ Architettura

```
┌─────────────────────────────────────────┐
│     BLOCKCHAIN (IndexerRegistry)        │
│     BLOCKCHAIN (RequestGate)            │
└────────┬────────────────────────┬───────┘
         │ Events                 │
         │ applyToRequest()       │
         │                        │
    ┌────▼────────────────────────▼──┐
    │   BlockchainService (ethers)   │
    │   - Listener RequestSubmitted   │
    │   - Register on-chain          │
    │   - Apply to requests          │
    └────┬───────────────────────────┘
         │
    ┌────▼──────────────────┐
    │  TdMatchService       │
    │  - Ricerca TD         │
    │  - Valida compatibilità
    └────┬──────────────────┘
         │
    ┌────▼─────────────────┐
    │  PostgreSQL Database │
    │  - td_store          │
    │  - on_chain_log      │
    └─────────────────────┘
         │
         │ HTTP API
         ▼
    ┌──────────────┐
    │   Oracles    │
    └──────────────┘
```

---

## 📂 Struttura

```
src/
├── app.js                           # Express app
├── server.js                        # Server startup
├── config/
│   └── index.js                     # Configurazione centralizzata
├── infrastructure/
│   ├── db.js                        # Pool PostgreSQL
│   └── blockchain.js                # BlockchainService (ethers.js)
├── core/
│   ├── repositories/
│   │   └── tdRepository.js          # Query TD JSONB
│   └── services/
│       └── tdMatchService.js        # Ricerca TD compatibili
├── api/
│   ├── controllers/
│   │   └── dataController.js        # Endpoint GET /data/:requestId
│   ├── routes/
│   │   └── dataRoutes.js            # Route definition
│   └── middlewares/
│       └── errorHandler.js          # Error handling
├── scripts/
│   ├── initDb.js                    # Crea schema database
│   ├── loadTds.js                   # Carica TD da JSON
│   └── listener.js                  # MAIN: Blockchain listener
└── contracts/
    ├── IndexerRegistry.sol          # Contract source
    ├── Gate.sol                     # Contract source
    └── common/                      # Librerie di supporto

tds/
└── td_list.json                     # Thing Descriptions data

.env                                 # Configurazione (NON committare!)
.env.example                         # Template configurazione
package.json                         # Dipendenze
README.md                            # Questo file
```

---

## ⚡ Quick Start

### 1. Clone e dipendenze

```bash
cd Indexer_ZONIA_node-WoT
npm install
```

### 2. Configurazione `.env`

```bash
cp .env.example .env
# Edita .env con i tuoi parametri:
# - DATABASE_URL
# - RPC_URL
# - PRIVATE_KEY (con fondi!)
# - INDEXER_DID
# - INDEXER_REGISTRY_ADDRESS
# - REQUEST_GATE_ADDRESS
```

### 3. Inizializzazione Database

```bash
# Crea le tabelle in PostgreSQL
node src/scripts/initDb.js

# Carica le Thing Descriptions dal file
node src/scripts/loadTds.js
```

### 4. Avvio

**Option A: Due terminali separati**

```bash
# Terminal 1: Blockchain listener (principale)
node src/scripts/listener.js

# Terminal 2: API server (serve i TD agli oracoli)
npm start
# oppure
node src/server.js
```

**Option B: Backgroundare il listener**
```bash
# Avvia il listener in background
node src/scripts/listener.js &

# Avvia il server
npm start
```

---

## ✅ Verifica che tutto funzioni

### 1. Database inizializzato
```bash
# Controlla che le tabelle siano state create
# Esegui initDb.js: dovrebbe mostrare "✅ Tabelle create"
```

### 2. TD caricate
```bash
# Controlla che i dati siano stati inseriti
# Esegui loadTds.js: dovrebbe mostrare numero di TD caricate
# Es: ✨ Caricati 3 TD nel database
```

### 3. Listener attivo
```bash
# Il listener dovrebbe mostrare:
# 🔗 Inizializzazione Blockchain Service...
# 📝 Registrazione on-chain...
# ✅ Registrato on-chain - TX: 0x...
# 👂 In ascolto di RequestSubmitted...
```

### 4. API raggiungibile
```bash
curl http://localhost:3000/
# Response: { "status": "Indexer ZONIA Online" }
```

---

## � Architettura ad alto livello

```
Cosa fa il tuo Indexer:

1. REGISTRATION PHASE
   ├─ registerIndexer() → IndexerRegistry.register(did)
   ├─ Salvi il DID on-chain
   └─ Emetti: IndexerRegistered(did, address)

2. LISTENING PHASE (continuo)
   ├─ listenToRequests() → Ascolti evento RequestSubmitted
   ├─ Per ogni richiesta ricevuta:
   │  ├─ findCompatibleTds(requiredType) → Cerchi nel DB
   │  ├─ if (tds found):
   │  │  ├─ applyToRequest(requestId) → Chiami contratto
   │  │  └─ storeOfferedTds(requestId, tds) → Salvi in memoria
   │  └─ if (no tds):
   │     └─ Aspetta prossima richiesta
   │
   └─ Loop su nuovo evento RequestSubmitted

3. DATA SERVING PHASE (on-demand)
   ├─ Oracle: GET /data/:requestId
   ├─ dataController ritrova TD in memoria
   └─ Response: JSON con TD
```

---

## �🔌 API

### GET `/`

```json
{ "status": "Indexer ZONIA Online" }
```

### GET `/data/:requestId`

Fornisce i TD offerti per una richiesta specifica.

**Esempio:**
```bash
curl http://localhost:3000/data/0x1234abcd...
```

**Risposta:**
```json
{
  "requestId": "0x1234abcd...",
  "count": 2,
  "data": [
    { "id": "td-001", "@type": "Sensor", "title": "Temperature" },
    { "id": "td-002", "@type": "Sensor", "title": "Humidity" }
  ]
}
```

---

## 🔄 Flusso Operativo

```
1. BlockchainService.registerIndexer()
   └─ Chiama: indexerRegistry.register(did)

2. BlockchainService.listenToRequests()
   └─ Ascolta: event RequestSubmitted(requestId, requiredType)

3. TdMatchService.findCompatibleTds(requiredType)
   └─ Query: SELECT td FROM td_store WHERE td->>'@type' = ?

4. BlockchainService.applyToRequest(requestId)
   └─ Chiama: requestGate.applyToRequest(did, requestId)

5. BlockchainService.storeOfferedTds(requestId, tds)
   └─ Salva in memoria: { requestId => [td1, td2, ...] }

6. Oracle richiede: GET /data/requestId
   └─ BlockchainService.getOfferedTds(requestId)
      └─ Ritorna TD memorizzati
```

---

## 📊 Database Schema

```sql
-- Thing Descriptions
CREATE TABLE td_store (
    id SERIAL PRIMARY KEY,
    td JSONB NOT NULL
);

-- Log azioni on-chain
CREATE TABLE on_chain_log (
    id SERIAL PRIMARY KEY,
    request_id TEXT NOT NULL,
    action TEXT NOT NULL,
    tx_hash TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🔗 Smart Contract Functions

### IndexerRegistry

```solidity
function register(string memory did) public {
    super.register(did);
    emit Events.IndexerRegistered(did, msg.sender);
}
```

### RequestGate

```solidity
function applyToRequest(
    string memory did,
    bytes32 requestId
) external onlyIndexer(did) isRequestInStatus(...) {
    // Indexer si offre volontariamente
    emit Events.IndexerVolunteer(requestId, indexer);
}
```

---

## 🔑 Variabili d'Ambiente

| Variabile | Descrizione |
|-----------|-------------|
| `DATABASE_URL` | Connessione PostgreSQL |
| `RPC_URL` | Endpoint blockchain (Ethereum, Sepolia, etc.) |
| `PRIVATE_KEY` | Chiave privata indexer (senza `0x` prefix) |
| `INDEXER_DID` | DID univoco dell'indexer |
| `INDEXER_REGISTRY_ADDRESS` | Indirizzo smart contract registry |
| `REQUEST_GATE_ADDRESS` | Indirizzo smart contract gate |
| `PORT` | Porta HTTP (default: 3000) |
| `TD_LIST_FILE` | Path file TD JSON |

---

## 🛠️ Comandi Utili

```bash
# Setup database
node src/scripts/initDb.js

# Carica TD
node src/scripts/loadTds.js

# Avvia listener blockchain
node src/scripts/listener.js

# Avvia server API
node src/server.js

# Test endpoint
curl http://localhost:3000/data/0x...
```

---

## 📦 Dipendenze

- `express` - Web framework
- `pg` - PostgreSQL driver
- `ethers` - Blockchain interaction
- `dotenv` - Environment variables

---

## 🆘 Troubleshooting

### ❌ "Cannot find module 'pg'"
**Soluzione:**
```bash
npm install
npm install --save pg ethers express dotenv
```

### ❌ "connect ECONNREFUSED - PostgreSQL non raggiungibile"
**Soluzione:**
1. Assicurati che PostgreSQL sia in running
2. Verifica DATABASE_URL nel .env
3. Prova connessione:
   ```bash
   psql "postgresql://user:password@localhost:5432/indexerDB"
   ```

### ❌ "Invalid PRIVATE_KEY" o "Not Indexer" dal contratto
**Soluzione:**
1. Verifica che il PRIVATE_KEY abbia il prefisso `0x`
2. Assicurati che l'account abbia ETH/fondi per gas
3. Verifica che PRIVATE_KEY corrisponda a INDEXER_DID registrato

### ❌ "RequestGate event not firing"
**Soluzione:**
1. Verifica RPC_URL sia corretto
2. Verifica REQUEST_GATE_ADDRESS sia corretto su quella blockchain
3. Assicurati che il contratto sia deployato

### ❌ "404 - Nessun TD disponibile" su GET /data/:requestId
**Soluzione:**
1. Verifica che il requestId sia corretto
2. Verifica che il tuo indexer si sia iscritto a quella richiesta (IndexerVolunteer event)
3. Controlla che i TD siano stati caricati correttamente:
   ```bash
   node src/scripts/loadTds.js
   ```

### ❌ "No Thing Descriptions compatible con tipo..."
**Soluzione:**
1. Controlla il tipo richiesto corrisponda al @type nel td_list.json
2. Verifica la query JSONB:
   ```javascript
   // Nel DB, @type può essere:
   // Stringa: td->>'@type' = 'Sensor'
   // Array: td->'@type' @> '["Sensor"]'
   ```

---

## 📚 Documentazione Utile

- [Ethers.js v6 Docs](https://docs.ethers.org/v6/)
- [PostgreSQL JSONB](https://www.postgresql.org/docs/current/datatype-json.html)
- [W3C WoT Thing Descriptions](https://www.w3.org/TR/wot-thing-description/)
- [ZONIA Architecture](./Articolo%20su%20ZONIA.pdf)

---

## 📝 Note per la Tesi

Questo indexer implementa un **nodo decentralizzato di indicizzazione** per il sistema ZONIA:

- **Ruolo**: Fornitore volontario di dati semantici (Thing Descriptions)
- **Architettura**: Off-chain (Node.js) + On-chain (Smart Contracts)
- **Protocolo**: Event-driven con blockchain listener
- **Database**: PostgreSQL con query JSONB per semantica TD
- **API**: REST per servire dati agli oracoli
- **Sicurezza**: Gestione private key, validazione on-chain

Espandi questa base per aggiungere:
- Auth token per API
- Caching avanzato
- Scoring dinamico
- Query semantica avanzata

---

## 📄 Licenza

ISC
- Pulizia e rifinitura del codice
- Documentazione finale per tesi
