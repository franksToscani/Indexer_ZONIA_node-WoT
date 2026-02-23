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
│   ├── listener.js                  # MAIN: Blockchain listener
│   ├── getRegisteredDid.js          # Verifica DID registrato on-chain
│   ├── approveStake.js              # Approve token ZONIA per stake
│   └── demoStart.js                 # One-shot: approve + listener
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
npm run db:init
# oppure: node src/scripts/initDb.js

# Carica le Thing Descriptions dal file
npm run td:load
# oppure: node src/scripts/loadTds.js
```

### 4. Avvio

**Option A: Due terminali separati**

```bash
# Terminal 1: Blockchain listener (principale)
npm run demo:start
# oppure: node src/scripts/listener.js

# Terminal 2: API server (serve i TD agli oracoli)
npm start
# oppure: node src/server.js
```

**Option B: Demo One-Shot (approve automatico + listener)**
```bash
# Esegue automaticamente approve stake e avvia listener
npm run demo:start
```

**Option C: Backgroundare il listener**
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

### 5. Verifica DID registrato (opzionale)
```bash
# Controlla se sei già registrato on-chain
npm run did:lookup
# oppure: node src/scripts/getRegisteredDid.js

# Se registrato, mostra:
# ✅ DID trovato: did:zonia:indexer-frank
# Se non ancora registrato:
# ⚠️ Nessun evento IndexerRegistered trovato
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
   └─ Ascolta: event RequestSubmitted(requestId, sender)

3. Evento ricevuto → legge dettagli richiesta
   └─ requestGate.getRequest(requestId) → ottiene query

4. TdMatchService.findCompatibleTds(query)
   └─ Query: SELECT td FROM td_store WHERE td->>'@type' = ?

5. BlockchainService.applyToRequest(requestId)
   └─ Chiama: requestGate.applyToRequest(did, requestId)

6. BlockchainService.storeOfferedTds(requestId, tds)
   └─ Salva in memoria: { requestId => [td1, td2, ...] }

7. Oracle richiede: GET /data/requestId
   └─ BlockchainService.getOfferedTds(requestId)
      └─ Ritorna TD memorizzati
```

---

## 📊 Database Schema

```sql
-- Thing Descriptions
CREATE TABLE td_store (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    td JSONB NOT NULL
);

-- Log azioni on-chain (opzionale)
CREATE TABLE on_chain_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

| Variabile | Descrizione | Esempio |
|-----------|-------------|----------|
| `DATABASE_URL` | Connessione PostgreSQL | `postgresql://user:pass@localhost:5432/indexerDB` |
| `RPC_URL` | Endpoint blockchain | `http://localhost:8545` |
| `PRIVATE_KEY` | Chiave privata indexer (con `0x`) | `0xac09...` |
| `INDEXER_DID` | DID univoco dell'indexer | `did:zonia:indexer-frank` |
| `INDEXER_REGISTRY_ADDRESS` | Indirizzo smart contract registry | `0x5FbDB...` |
| `REQUEST_GATE_ADDRESS` | Indirizzo smart contract gate | `0xe7f1...` |
| `ZONIA_TOKEN_ADDRESS` | Indirizzo token ERC20 ZONIA | `0x5FbDB...` |
| `STAKE_AMOUNT` | Stake richiesto in token interi | `1000` |
| `PORT` | Porta HTTP (default: 3000) | `3000` |
| `TD_LIST_FILE` | Path file TD JSON | `tds/td_list.json` |
| `GAS_LIMIT` | Limite gas transazioni | `500000` |

---

## 🛠️ Comandi Utili

```bash
# Setup database
npm run db:init

# Carica TD
npm run td:load

# Verifica DID registrato
npm run did:lookup

# Avvia listener blockchain
npm run listener

# Avvia server API
npm start

# Test endpoint health
curl http://localhost:3000/

# Test endpoint dati
curl http://localhost:3000/data/0x...
```

### Script NPM disponibili

| Comando | Descrizione |
|---------|-------------|
| `npm start` | Avvia API server |
| `npm run listener` | Avvia blockchain listener |
| `npm run db:init` | Inizializza database |
| `npm run td:load` | Carica Thing Descriptions |
| `npm run did:lookup` | Verifica DID registrato on-chain |
| `npm run stake:approve` | Approve token ZONIA per stake |
| `npm run demo:start` | One-shot: approve + listener |

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

### ❌ Errore durante `register()`: "Stake transfer failed"
**Soluzione:**
1. Il contratto `register()` richiede **token ZONIA come stake**
2. Verifica che il tuo wallet abbia token ZONIA
3. Approva lo stake: chiama `approve(IndexerRegistryAddress, stakeAmount)` sul token ZONIA
4. Poi riprova `register(did)`

### ❌ "INDEXER_REGISTRY_ADDRESS non valido"
**Soluzione:**
1. Verifica che gli indirizzi in `.env` siano reali (0x...)
2. Non usare placeholder `0x...`
3. Chiedi al tutore gli indirizzi deployati corretti

### ❌ "DID already registered" (riavvio listener)
**Soluzione:**
Non è un errore! Il listener riconosce automaticamente questo caso e continua in ascolto.
Se vedi `⚠️ DID già registrato on-chain (riavvio listener)`, tutto è ok.

### ❌ "PRIVATE_KEY non valida: deve essere una chiave esadecimale da 32 byte"
**Soluzione:**
1. Formato corretto: `0x` + esattamente 64 caratteri hex
2. Esempio: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
3. Non usare prefissi extra tipo `0x00...`
4. Rimuovi virgolette e spazi

### ❌ "ZONIA_TOKEN_ADDRESS non valido per questa rete"
**Soluzione:**
1. Verifica che `RPC_URL` punti alla stessa rete dove sono deployati i contratti
2. Aggiorna `ZONIA_TOKEN_ADDRESS` con l'indirizzo reale dalla rete corretta
3. Esegui deploy contratti su localhost se stai testando: vedi sezione "Demo Completa"

### ❌ "Allowance token insufficiente per lo stake"
**Soluzione:**
Esegui l'approve prima di register:
```bash
npm run stake:approve
# oppure usa demo:start che fa tutto automaticamente
npm run demo:start
```

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

## � Demo Completa End-to-End

Per testare l'intero sistema in locale:

### Setup ambiente completo

**1. Avvia nodo Hardhat (Terminal 1):**
```bash
cd C:\Users\ftosc\Downloads\protocol\protocol
npx hardhat node
# Lascia running, mostra 20 account con ETH
```

**2. Deploy contratti ZONIA (Terminal 2):**
```bash
cd C:\Users\ftosc\Downloads\protocol\protocol
npx hardhat --network localhost deploy localhost
# Output: indirizzi deployati (ZoniaToken, Gate, IndexerRegistry...)
# Copia gli indirizzi nel tuo .env dell'indexer
```

**3. Configura indexer .env (usa indirizzi deployati):**
```dotenv
RPC_URL=http://localhost:8545
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
INDEXER_DID=did:zonia:indexer-demo
INDEXER_REGISTRY_ADDRESS=0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
REQUEST_GATE_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
ZONIA_TOKEN_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
STAKE_AMOUNT=1000
DATABASE_URL=postgresql://postgres:password@localhost:5432/indexerDB
```

**4. Setup database e TD (Terminal 3 - indexer):**
```bash
cd C:\Users\ftosc\Dev\Indexer_ZONIA_node-WoT
npm run db:init
npm run td:load
```

**5. Avvia listener indexer:**
```bash
npm run demo:start
# Output:
# ✅ Approve confermata
# ✅ Registrato on-chain
# ✅ Listener avviato e in ascolto...
```

**6. Simula richiesta dal protocol (Terminal 2):**
```bash
cd C:\Users\ftosc\Downloads\protocol\protocol
npx hardhat run scripts/simulateRequest.js --network localhost
# Output:
# ✅ Richiesta inviata
# 🆔 Request ID: 0x...
```

**7. Verifica cattura nel listener (Terminal 3):**
```
📢 Nuova richiesta ricevuta!
   RequestID: 0xea85...
   Query richiesta: TemperatureSensor
🎯 Trovati 2 TD compatibili
🤝 Iscriviti a richiesta...
✅ Iscritto con successo
💾 Salvati 2 TD per richiesta
```

**8. (Opzionale) Avvia API server (Terminal 4):**
```bash
cd C:\Users\ftosc\Dev\Indexer_ZONIA_node-WoT
npm start
# Ora oracle può chiamare: GET /data/0xea85...
```

### Script di simulazione (nel progetto protocol)

Il file `scripts/simulateRequest.js` nel progetto protocol:
- Approva automaticamente i token ZONIA al Gate
- Chiama `submitRequest({ query: "TemperatureSensor", ... })`
- Emette evento `RequestSubmitted` che il listener cattura

Personalizza la query modificando:
```javascript
const inputRequest = {
    query: "TemperatureSensor",  // Cambia tipo TD richiesto
    ko: 0,   // Numero oracoli
    ki: 1,   // Numero indexer
    fee: feeAmount
};
```

---

## �🆔 Cos'è il DID (Decentralized Identifier)?

Il **DID** è un identificatore univoco che rappresenta il tuo indexer nel sistema ZONIA.

**Formato standard W3C:**
```
did:metodo:identificatore-specifico
```

**Esempi validi:**
```
did:zonia:indexer-frank
did:zonia:my-indexer-001
did:example:0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266
```

**Come funziona:**
1. Scegli un DID univoco (es: `did:zonia:indexer-frank`)
2. Lo metti in `.env` come `INDEXER_DID`
3. Chiami `register(did)` → salva on-chain `DID → wallet address`
4. Il contratto poi verifica con `onlyIndexer(did)` che `_dids[did] == msg.sender`

**Vantaggi rispetto al solo address:**
- **Leggibile**: `did:zonia:frank` vs `0xf39fd6e51aad88f6...`
- **Standard W3C**: compatibile con sistemi di identità decentralizzata
- **Portabilità**: teoricamente trasferibile ad altro wallet

**Verifica il tuo DID registrato:**
```bash
npm run did:lookup
```

---

## 🧪 Testing con il Relatore

Se il relatore vuole testare il tuo indexer sulla loro blockchain, fornisci loro questo endpoint:

### Endpoint da fornire

```
http://<your-host>:<port>/data/:requestId
```

**Dove:**
- `<your-host>` = IP/hostname della tua macchina (es: `localhost`, `192.168.1.100`, `example.com`)
- `<port>` = porta API (default: `3000`)
- `:requestId` = ID della richiesta che loro creano sulla loro blockchain

**Esempi:**
```
http://localhost:3000/data/:requestId          # Test locale
http://192.168.1.100:3000/data/:requestId      # Rete locale
http://myindexer.example.com:3000/data/:requestId  # Remoto
```

### Come preparare il server per i test

**1. Aggiorna la configurazione:**
Modifica `.env` con i parametri della loro blockchain:
```dotenv
RPC_URL=<loro endpoint RPC>
PRIVATE_KEY=<tua chiave privata>
INDEXER_DID=did:zonia:indexer-<nome>
INDEXER_REGISTRY_ADDRESS=<loro IndexerRegistry>
REQUEST_GATE_ADDRESS=<loro RequestGate>
ZONIA_TOKEN_ADDRESS=<loro token ZONIA>
STAKE_AMOUNT=1000
PORT=3000
```

**2. Setup database:**
```bash
npm run db:init
npm run td:load
```

**3. Approva lo stake:**
```bash
npm run stake:approve
```

**4. Avvia il listener e l'API:**
```bash
# Terminal 1: Listener (ascolta blockchain)
npm run listener

# Terminal 2: API server
npm start
```

O in un'unica sessione:
```bash
npm run demo:start
# Poi in un altro terminal:
npm start
```

### Cosa il relatore deve fare

**1. Creare una richiesta sulla loro blockchain:**
```solidity
// Pseudocode
requestGate.submitRequest({
    query: "Sensor",  // Tipo di Thing Description ricercato
    ko: 0,            // Numero oracoli necessari
    ki: 1,            // Numero indexer necessari
    fee: amount       // Fee in token
})
// Emits RequestSubmitted(requestId, sender)
```

**2. Recuperare il `requestId` dall'evento**
```javascript
const requestId = event.requestId;  // es: 0x1234abcd...
```

**3. Attendere che il tuo indexer si iscriva**
- Il tuo listener cattura l'evento `RequestSubmitted`
- Cerca TD compatibili nel DB
- Chiama `applyToRequest(did, requestId)`
- Salva i TD matchati

**4. Chiamare l'endpoint per ottenere i TD:**
```bash
curl http://<your-host>:3000/data/<requestId>
```

### Risposta attesa

Se il tuo indexer ha TD compatibili:
```json
[
  {
    "id": "td-sensor-001",
    "title": "Temperature Sensor",
    "@type": "Sensor",
    "description": "Misura temperatura ambiente",
    "properties": { ... }
  },
  {
    "id": "td-sensor-002",
    "title": "Humidity Sensor",
    "@type": "Sensor",
    ...
  }
]
```

Se NON hai TD compatibili:
```json
{
  "error": "Nessun TD disponibile per questa richiesta"
}
```

### Troubleshooting

| Problema | Causa | Soluzione |
|----------|-------|-----------|
| `Connection refused` | Server non in ascolto | Esegui `npm start` |
| `404 - No TD found` | Indexer non iscritto | Verifica RPC_URL e che listener sia attivo |
| `timeout` | Listener non cattura evento | Verifica REQUEST_GATE_ADDRESS |
| `Can't parse requestId` | Formato ID non valido | Assicurati sia un hex valido (0x...) |
| `Duplicate TD on retry` | Deduplicazione fallita | Normale, il sistema deduplica automaticamente |

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
