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
├── config/index.js                  # Configurazione centralizzata
├── infrastructure/
│   ├── db.js                        # Pool PostgreSQL
│   └── blockchain.js                # BlockchainService (ethers.js)
├── core/
│   ├── repositories/
│   │   ├── tdRepository.js          # Query TD
│   │   └── onChainRepository.js     # Log azioni
│   └── services/
│       └── tdMatchService.js        # Ricerca TD compatibili
├── api/
│   ├── controllers/dataController.js # Endpoint /data/:requestId
│   ├── routes/dataRoutes.js         # Route definition
│   └── middlewares/errorHandler.js  # Error handling
├── contracts/
│   ├── IndexerRegistry.abi.json     # ABI smart contract
│   └── RequestGate.abi.json         # ABI smart contract
├── scripts/
│   ├── initDb.js                    # Crea tabelle
│   ├── loadTds.js                   # Carica TD da file
│   └── listener.js                  # Blockchain listener
├── app.js                           # Express app
└── server.js                        # Server startup
```

---

## ⚡ Quick Start

### 1. Setup

```bash
npm install
```

### 2. Configurazione `.env`

```env
# Database
DATABASE_URL=postgres://user:pass@localhost:5432/indexerDB

# Blockchain
RPC_URL=http://localhost:8545
PRIVATE_KEY=0x...
INDEXER_DID=did:zonia:indexer:001
INDEXER_REGISTRY_ADDRESS=0x...
REQUEST_GATE_ADDRESS=0x...

# Server
PORT=3000
TD_LIST_FILE=./tds/td_list.json
```

### 3. Inizializzazione

```bash
node src/scripts/initDb.js
node src/scripts/loadTds.js
```

### 4. Avvio

**Terminal 1 - Blockchain Listener:**
```bash
node src/scripts/listener.js
```

**Terminal 2 - API Server:**
```bash
node src/server.js
```

---

## 🔌 API

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

## 📝 Licenza

ISC
- Pulizia e rifinitura del codice
- Documentazione finale per tesi
